import type { Track } from '../domain/entities/Track.js';
import type { IMusicPlayerPort } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';
import type { ILogger } from '../domain/ports/LoggerPort.js';

export type SkipResult =
  | { type: 'skipped'; skipped: Track; next: Track | null }
  | { type: 'error'; message: string };

export class SkipTrackUseCase {
  constructor(
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
    private readonly logger: ILogger,
  ) {}

  async execute(guildId: string): Promise<SkipResult> {
    const queue = this.queueManager.get(guildId);
    if (!queue) return { type: 'error', message: 'No hay nada reproduciéndose.' };

    const skipped = queue.getCurrent();
    if (!skipped) return { type: 'error', message: 'No hay track actual para saltar.' };

    const next = queue.next();

    try {
      if (next) {
        await this.player.play(guildId, next);
      } else {
        await this.player.stop(guildId);
      }
    } catch (err) {
      this.logger.error('SkipTrackUseCase failed', err, { guildId });
      return { type: 'error', message: 'Error al saltar el track.' };
    }

    return { type: 'skipped', skipped, next };
  }
}
