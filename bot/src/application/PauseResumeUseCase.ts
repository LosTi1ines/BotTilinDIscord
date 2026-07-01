import type { IMusicPlayerPort } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';
import type { ILogger } from '../domain/ports/LoggerPort.js';

export type PauseResumeResult =
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'error'; message: string };

export class PauseResumeUseCase {
  constructor(
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
    private readonly logger: ILogger,
  ) {}

  async pause(guildId: string): Promise<PauseResumeResult> {
    const queue = this.queueManager.get(guildId);
    if (!queue?.getCurrent()) return { type: 'error', message: 'No hay nada reproduciéndose.' };

    try {
      await this.player.pause(guildId);
      return { type: 'paused' };
    } catch (err) {
      this.logger.error('Pause failed', err, { guildId });
      return { type: 'error', message: 'Error al pausar.' };
    }
  }

  async resume(guildId: string): Promise<PauseResumeResult> {
    const queue = this.queueManager.get(guildId);
    if (!queue?.getCurrent()) return { type: 'error', message: 'No hay nada en cola.' };

    try {
      await this.player.resume(guildId);
      return { type: 'resumed' };
    } catch (err) {
      this.logger.error('Resume failed', err, { guildId });
      return { type: 'error', message: 'Error al reanudar.' };
    }
  }
}
