import { createTrack } from '../domain/entities/Track.js';
import type { Track } from '../domain/entities/Track.js';
import type { IMusicPlayerPort, RawTrack } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';
import type { ILogger } from '../domain/ports/LoggerPort.js';
import type { ISpotifyPlaylistPort, SpotifyResolvedTrack } from '../domain/ports/SpotifyPlaylistPort.js';
import type { GuildStateStore } from '../infrastructure/state/GuildStateStore.js';
import { SpotifyAuthExpiredError, SpotifyPlaylistNotAccessibleError } from '../infrastructure/spotify/SpotifyUserAuthAdapter.js';

export interface PlayTrackInput {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  query: string;
  requestedBy: string;
}

export type PlayTrackResult =
  | { type: 'playing'; track: Track; queueSize: number }
  | { type: 'queued'; track: Track; position: number }
  | { type: 'playlist'; name: string; count: number; first: Track; truncated?: boolean }
  | { type: 'error'; message: string };

/** Cuántas búsquedas de resolución (ytsearch) se disparan en paralelo por lote. */
const RESOLUTION_BATCH_SIZE = 4;

function extractSpotifyPlaylistId(query: string): string | null {
  const urlMatch = /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/.exec(query);
  if (urlMatch) return urlMatch[1]!;
  const uriMatch = /^spotify:playlist:([a-zA-Z0-9]+)$/.exec(query.trim());
  if (uriMatch) return uriMatch[1]!;
  return null;
}

export interface AutocompleteTrack {
  title: string;
  author: string;
  uri: string;
  source: 'youtube' | 'spotify';
}

function resolveIdentifier(query: string): string {
  if (query.startsWith('http://') || query.startsWith('https://')) return query;
  return `ytsearch:${query}`;
}

export class PlayTrackUseCase {
  constructor(
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
    private readonly logger: ILogger,
    private readonly guildStateStore: GuildStateStore,
    private readonly spotifyPlaylistPort: ISpotifyPlaylistPort,
  ) {}

  async execute(input: PlayTrackInput): Promise<PlayTrackResult> {
    const { guildId, voiceChannelId, textChannelId, query, requestedBy } = input;

    try {
      // Guardar el canal de texto para poder editar el embed después
      this.guildStateStore.setTextChannel(guildId, textChannelId);

      if (!this.player.hasPlayer(guildId)) {
        await this.player.connect(guildId, voiceChannelId);
      }

      // Playlists de Spotify no se pueden resolver vía Lavalink/LavaSrc
      // (Spotify exige autenticación de usuario) — se resuelven aparte.
      const spotifyPlaylistId = extractSpotifyPlaylistId(query);
      if (spotifyPlaylistId) {
        return await this.playSpotifyPlaylist(spotifyPlaylistId, guildId, requestedBy);
      }

      const result = await this.player.loadTracks(resolveIdentifier(query));

      if (result.loadType === 'empty' || result.tracks.length === 0) {
        return { type: 'error', message: 'No se encontraron resultados para esa búsqueda.' };
      }

      if (result.loadType === 'error') {
        return { type: 'error', message: result.error ?? 'Error al cargar el track.' };
      }

      const queue = this.queueManager.getOrCreate(guildId);
      const wasEmpty = queue.isEmpty();

      if (result.loadType === 'playlist' && result.playlist) {
        const tracks = result.tracks.map(r => createTrack(r.encoded, r.info, requestedBy));
        queue.addTracks(tracks);

        const first = tracks[0]!;
        if (wasEmpty) {
          queue.skipTo(0);
          await this.player.play(guildId, first);
        }

        return { type: 'playlist', name: result.playlist.name, count: tracks.length, first };
      }

      const rawTrack = result.tracks[0]!;
      const track = createTrack(rawTrack.encoded, rawTrack.info, requestedBy);
      queue.addTrack(track);

      if (wasEmpty) {
        queue.skipTo(0);
        await this.player.play(guildId, track);
        this.logger.debug('Started playback', { guildId, title: track.info.title });
        return { type: 'playing', track, queueSize: queue.size() };
      }

      const position = queue.size();
      return { type: 'queued', track, position };
    } catch (err) {
      if (err instanceof SpotifyAuthExpiredError || err instanceof SpotifyPlaylistNotAccessibleError) {
        return { type: 'error', message: err.message };
      }
      this.logger.error('PlayTrackUseCase failed', err, { guildId, query });
      return { type: 'error', message: 'Ocurrió un error interno al intentar reproducir.' };
    }
  }

  /**
   * Resuelve una playlist de Spotify leyendo su contenido vía OAuth2 de
   * usuario (Lavalink/LavaSrc ya no puede: Spotify exige autenticación de
   * usuario para leer playlists). Cada canción se busca después en YouTube
   * por ISRC, igual que ya hace LavaSrc para tracks individuales.
   */
  private async playSpotifyPlaylist(
    playlistId: string,
    guildId: string,
    requestedBy: string,
  ): Promise<PlayTrackResult> {
    const spotifyPlaylist = await this.spotifyPlaylistPort.getPlaylistTracks(playlistId);

    const tracks: Track[] = [];
    for (let i = 0; i < spotifyPlaylist.tracks.length; i += RESOLUTION_BATCH_SIZE) {
      const batch = spotifyPlaylist.tracks.slice(i, i + RESOLUTION_BATCH_SIZE);
      const resolved = await Promise.all(batch.map(t => this.resolveSpotifyTrack(t)));
      for (const raw of resolved) {
        if (raw) tracks.push(createTrack(raw.encoded, raw.info, requestedBy));
      }
    }

    if (tracks.length === 0) {
      return { type: 'error', message: 'No se pudo resolver ninguna canción de esa playlist en YouTube.' };
    }

    const queue = this.queueManager.getOrCreate(guildId);
    const wasEmpty = queue.isEmpty();
    queue.addTracks(tracks);

    const first = tracks[0]!;
    if (wasEmpty) {
      queue.skipTo(0);
      await this.player.play(guildId, first);
    }

    return {
      type: 'playlist',
      name: spotifyPlaylist.name,
      count: tracks.length,
      first,
      truncated: spotifyPlaylist.truncated,
    };
  }

  /** Busca una canción resuelta de Spotify en YouTube: primero por ISRC, con fallback a texto. */
  private async resolveSpotifyTrack(track: SpotifyResolvedTrack): Promise<RawTrack | null> {
    try {
      if (track.isrc) {
        const byIsrc = await this.player.loadTracks(`ytsearch:"${track.isrc}"`);
        if (byIsrc.loadType === 'search' && byIsrc.tracks.length > 0) return byIsrc.tracks[0]!;
      }

      const byText = await this.player.loadTracks(`ytsearch:${track.title} ${track.artist}`);
      if (byText.loadType === 'search' && byText.tracks.length > 0) return byText.tracks[0]!;

      return null;
    } catch (err) {
      this.logger.warn('No se pudo resolver canción de playlist de Spotify en YouTube', { title: track.title, err });
      return null;
    }
  }

  /**
   * Búsqueda paralela en YouTube y Spotify para el autocompletado del comando /play.
   * Devuelve hasta 3 resultados de YouTube y 2 de Spotify (5 en total).
   * Implementa una caché interna para evitar rate-limits (HTTP 403).
   */
  private readonly autocompleteCache = new Map<string, { tracks: AutocompleteTrack[]; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché

  async searchForAutocomplete(query: string): Promise<AutocompleteTrack[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || cleanQuery.length < 2) return [];

    // 1. Intentar servir desde la caché en memoria si no ha expirado
    const cached = this.autocompleteCache.get(cleanQuery);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug('Serving autocomplete from cache', { query: cleanQuery });
      return cached.tracks;
    }

    // 2. Realizar búsquedas en paralelo (YouTube + Spotify)
    const [ytResult, spResult] = await Promise.allSettled([
      this.player.loadTracks(`ytsearch:${query}`),
      this.player.loadTracks(`spsearch:${query}`),
    ]);

    const tracks: AutocompleteTrack[] = [];

    if (ytResult.status === 'fulfilled' && ytResult.value.loadType === 'search') {
      for (const t of ytResult.value.tracks.slice(0, 3)) {
        tracks.push({
          title: t.info.title,
          author: t.info.author,
          uri: t.info.uri,
          source: 'youtube',
        });
      }
    }

    if (spResult.status === 'fulfilled' && spResult.value.loadType === 'search') {
      for (const t of spResult.value.tracks.slice(0, 2)) {
        tracks.push({
          title: t.info.title,
          author: t.info.author,
          uri: t.info.uri,
          source: 'spotify',
        });
      }
    }

    // 3. Guardar en caché si obtuvimos resultados para proteger las APIs
    if (tracks.length > 0) {
      this.autocompleteCache.set(cleanQuery, {
        tracks,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
    }

    return tracks;
  }
}
