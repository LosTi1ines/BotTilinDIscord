import { EventEmitter } from 'node:events';
import {
  Constants, LoadType,
  type Shoukaku, type Player,
  type FilterOptions, type LavalinkResponse,
  type Track as ShoukakuTrack,
  type TrackStartEvent, type TrackEndEvent,
  type TrackExceptionEvent, type TrackStuckEvent, type WebSocketClosedEvent,
} from 'shoukaku';
import type { ILogger } from '../../domain/ports/LoggerPort.js';
import type { IMusicPlayerPort, LoadResult, RawTrack } from '../../domain/ports/MusicPlayerPort.js';
import type { AudioFilters } from '../../domain/entities/PlayerState.js';
import type { Track } from '../../domain/entities/Track.js';

// ── Filter mapping ───────────────────────────────────────────────

function buildFilters(filters: AudioFilters): FilterOptions {
  return {
    equalizer: filters.bassboost
      ? [
          { band: 0, gain: 0.6 }, { band: 1, gain: 0.7 },
          { band: 2, gain: 0.8 }, { band: 3, gain: 0.55 },
          { band: 4, gain: 0.25 },
        ]
      : [],
    timescale: filters.nightcore
      ? { speed: 1.0, pitch: 1.3, rate: 1.0 }
      : filters.vaporwave
        ? { speed: 0.8, pitch: 0.8, rate: 1.0 }
        : null,
    karaoke: filters.karaoke
      ? { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 }
      : null,
  };
}

// ── Rate limiter para búsquedas de Spotify ─────────────────────────
// Spotify puede marcar como abuso ráfagas de peticiones (ej: autocompletado
// disparando una búsqueda por cada tecla escrita por varios usuarios a la vez).
// Serializa esas peticiones con un espaciado mínimo entre ellas.

class SpotifyRateLimiter {
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  acquire(): Promise<void> {
    this.queue = this.queue.then(() => this.waitTurn());
    return this.queue;
  }

  private async waitTurn(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }
}

function isSpotifyQuery(query: string): boolean {
  return query.startsWith('spsearch:')
    || query.includes('open.spotify.com')
    || query.startsWith('spotify:');
}

// ── Adapter ──────────────────────────────────────────────────────

export class LavalinkAdapter extends EventEmitter implements IMusicPlayerPort {
  private readonly spotifyRateLimiter = new SpotifyRateLimiter(300);

  constructor(
    private readonly shoukaku: Shoukaku,
    private readonly logger: ILogger,
  ) {
    super();
  }

  private getPlayer(guildId: string): Player | undefined {
    return this.shoukaku.players.get(guildId);
  }

  private attachListeners(guildId: string, player: Player): void {
    player.on('start', (data: TrackStartEvent) => {
      this.logger.debug('Track started', { guildId, title: data.track.info.title });
      this.emit('trackStart', guildId, data.track);
    });

    player.on('end', (data: TrackEndEvent) => {
      this.logger.debug('Track ended', { guildId, reason: data.reason });
      this.emit('trackEnd', guildId, data.reason);
    });

    player.on('exception', (data: TrackExceptionEvent) => {
      this.logger.error('Track exception', undefined, { guildId, error: data.exception.message });
      this.emit('trackError', guildId, data.exception.message);
    });

    player.on('stuck', (data: TrackStuckEvent) => {
      this.logger.warn('Track stuck', { guildId, thresholdMs: data.thresholdMs });
      this.emit('trackStuck', guildId);
    });

    player.on('closed', (data: WebSocketClosedEvent) => {
      this.logger.warn('Voice connection closed', { guildId, code: data.code });
      this.emit('playerClosed', guildId);
    });
  }

  private toRawTrack(t: ShoukakuTrack): RawTrack {
    return {
      encoded: t.encoded,
      info: {
        title: t.info.title,
        author: t.info.author,
        duration: t.info.length,
        identifier: t.info.identifier,
        uri: t.info.uri ?? '',
        artworkUrl: t.info.artworkUrl ?? null,
        isrc: t.info.isrc ?? null,
        sourceName: t.info.sourceName,
        isStream: t.info.isStream,
      },
    };
  }

  // ── IMusicPlayerPort ────────────────────────────────────────

  async connect(guildId: string, voiceChannelId: string): Promise<void> {
    const connection = this.shoukaku.connections.get(guildId);

    // Si hay un player en memoria pero sin canal activo (zombie post-disconnect),
    // destruirlo antes de reconectar para evitar estado inconsistente
    if (connection?.channelId) return; // ya conectado y activo

    // Destruir player zombie si existe sin conexión activa
    const existing = this.getPlayer(guildId);
    if (existing) {
      await existing.destroy();
    }

    const player = await this.shoukaku.joinVoiceChannel({
      guildId,
      channelId: voiceChannelId,
      shardId: 0,
      deaf: true,
    });
    this.attachListeners(guildId, player);
  }

  async disconnect(guildId: string): Promise<void> {
    await this.getPlayer(guildId)?.destroy();
  }

  async play(guildId: string, track: Track): Promise<void> {
    const player = this.getPlayer(guildId);
    if (!player) throw new Error(`No player for guild ${guildId}`);
    await player.playTrack({ track: { encoded: track.encoded } });
  }

  async pause(guildId: string): Promise<void> {
    await this.getPlayer(guildId)?.setPaused(true);
  }

  async resume(guildId: string): Promise<void> {
    await this.getPlayer(guildId)?.setPaused(false);
  }

  async stop(guildId: string): Promise<void> {
    await this.getPlayer(guildId)?.stopTrack();
  }

  async seek(guildId: string, positionMs: number): Promise<void> {
    await this.getPlayer(guildId)?.seekTo(positionMs);
  }

  async setVolume(guildId: string, volume: number): Promise<void> {
    await this.getPlayer(guildId)?.setGlobalVolume(volume * 10);
  }

  async setFilters(guildId: string, filters: AudioFilters): Promise<void> {
    const player = this.getPlayer(guildId);
    if (!player) return;
    await player.setFilters(buildFilters(filters));
  }

  async loadTracks(query: string): Promise<LoadResult> {
    if (isSpotifyQuery(query)) {
      await this.spotifyRateLimiter.acquire();
    }

    const node = [...this.shoukaku.nodes.values()]
      .find(n => n.state === Constants.State.CONNECTED);
    if (!node) throw new Error('No connected Lavalink nodes');

    const response: LavalinkResponse | undefined = await node.rest.resolve(query);
    if (!response) return { loadType: 'empty', tracks: [], playlist: null, error: null };

    switch (response.loadType) {
      case LoadType.TRACK:
        return { loadType: 'track', tracks: [this.toRawTrack(response.data)], playlist: null, error: null };

      case LoadType.PLAYLIST:
        return {
          loadType: 'playlist',
          tracks: response.data.tracks.map(t => this.toRawTrack(t)),
          playlist: {
            name: response.data.info.name,
            selectedIndex: response.data.info.selectedTrack,
            duration: response.data.tracks.reduce((acc, t) => acc + t.info.length, 0),
          },
          error: null,
        };

      case LoadType.SEARCH:
        return { loadType: 'search', tracks: response.data.map(t => this.toRawTrack(t)), playlist: null, error: null };

      case LoadType.EMPTY:
        return { loadType: 'empty', tracks: [], playlist: null, error: null };

      case LoadType.ERROR:
        return { loadType: 'error', tracks: [], playlist: null, error: response.data.message };

      default:
        return { loadType: 'empty', tracks: [], playlist: null, error: null };
    }
  }

  async destroyPlayer(guildId: string): Promise<void> {
    await this.disconnect(guildId);
  }

  hasPlayer(guildId: string): boolean {
    // Verificar tanto el player como la conexión de voz activa en Discord
    const connection = this.shoukaku.connections.get(guildId);
    return !!(this.shoukaku.players.has(guildId) && connection?.channelId);
  }

  getPosition(guildId: string): number {
    return this.shoukaku.players.get(guildId)?.position ?? 0;
  }
}
