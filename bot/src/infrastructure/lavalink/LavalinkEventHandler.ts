import { EventEmitter } from 'node:events';
import type { ILogger } from '../../domain/ports/LoggerPort.js';
import type { IMusicPlayerPort } from '../../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../../domain/ports/QueueManagerPort.js';
import type { LavalinkAdapter } from './LavalinkAdapter.js';

const SKIP_REASONS = new Set(['REPLACED', 'STOPPED', 'CLEANUP']);

export class LavalinkEventHandler extends EventEmitter {
  private readonly inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    adapter: LavalinkAdapter,
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
    private readonly logger: ILogger,
    private readonly inactivitySeconds: number = 300,
  ) {
    super();

    adapter.on('trackEnd', (guildId: string, reason: string) => {
      void this.onTrackEnd(guildId, reason);
    });

    adapter.on('trackError', (guildId: string, error: string) => {
      this.logger.warn('Track error, skipping', { guildId, error });
      void this.onTrackEnd(guildId, 'LOAD_FAILED');
    });

    adapter.on('trackStuck', (guildId: string) => {
      this.logger.warn('Track stuck, skipping', { guildId });
      void this.onTrackEnd(guildId, 'STUCK');
    });

    adapter.on('playerClosed', (guildId: string) => {
      this.queueManager.destroy(guildId);
      this.clearInactivityTimer(guildId);
      // Notificar que el player fue cerrado (para que main.ts limpie GuildStateStore)
      this.emit('playerClosed', guildId);
    });
  }

  private async onTrackEnd(guildId: string, reason: string): Promise<void> {
    if (SKIP_REASONS.has(reason)) return;

    const queue = this.queueManager.get(guildId);
    if (!queue) return;

    const nextTrack = queue.next();
    if (nextTrack) {
      try {
        await this.player.play(guildId, nextTrack);
        this.clearInactivityTimer(guildId);
        // Emitir evento para que main.ts actualice el embed en el canal de Discord
        this.emit('nowPlaying', guildId, nextTrack);
      } catch (err) {
        this.logger.error('Failed to play next track', err, { guildId });
      }
    } else {
      this.startInactivityTimer(guildId);
    }
  }

  private startInactivityTimer(guildId: string): void {
    this.clearInactivityTimer(guildId);
    if (this.inactivitySeconds <= 0) return;

    const timer = setTimeout(() => {
      this.logger.info('Inactivity timeout, disconnecting', { guildId });
      this.queueManager.destroy(guildId);
      void this.player.destroyPlayer(guildId);
    }, this.inactivitySeconds * 1000);

    this.inactivityTimers.set(guildId, timer);
  }

  clearInactivityTimer(guildId: string): void {
    const timer = this.inactivityTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.inactivityTimers.delete(guildId);
    }
  }
}
