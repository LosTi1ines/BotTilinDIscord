import { createTrack } from '../domain/entities/Track.js';
import type { Track } from '../domain/entities/Track.js';
import type { IMusicPlayerPort } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';
import type { ILogger } from '../domain/ports/LoggerPort.js';
import type { GuildStateStore } from '../infrastructure/state/GuildStateStore.js';

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
  | { type: 'playlist'; name: string; count: number; first: Track }
  | { type: 'error'; message: string };

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
  ) {}

  async execute(input: PlayTrackInput): Promise<PlayTrackResult> {
    const { guildId, voiceChannelId, textChannelId, query, requestedBy } = input;

    try {
      // Guardar el canal de texto para poder editar el embed después
      this.guildStateStore.setTextChannel(guildId, textChannelId);

      if (!this.player.hasPlayer(guildId)) {
        await this.player.connect(guildId, voiceChannelId);
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
      this.logger.error('PlayTrackUseCase failed', err, { guildId, query });
      return { type: 'error', message: 'Ocurrió un error interno al intentar reproducir.' };
    }
  }

  /**
   * Búsqueda paralela en YouTube y Spotify para el autocompletado del comando /play.
   * Devuelve hasta 3 resultados de YouTube y 2 de Spotify (5 en total).
   */
  async searchForAutocomplete(query: string): Promise<AutocompleteTrack[]> {
    if (!query || query.length < 2) return [];

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

    return tracks;
  }
}
