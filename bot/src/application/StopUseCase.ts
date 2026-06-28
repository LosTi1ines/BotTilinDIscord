import type { IMusicPlayerPort } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';
import type { ILogger } from '../domain/ports/LoggerPort.js';

export type StopResult =
  | { type: 'stopped' }
  | { type: 'error'; message: string };

export class StopUseCase {
  constructor(
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
    private readonly logger: ILogger,
  ) {}

  async execute(guildId: string): Promise<StopResult> {
    if (!this.player.hasPlayer(guildId)) {
      return { type: 'error', message: 'El bot no está en ningún canal de voz.' };
    }

    try {
      this.queueManager.get(guildId)?.clear();
      await this.player.stop(guildId);
      await this.player.destroyPlayer(guildId);
      this.queueManager.destroy(guildId);
      return { type: 'stopped' };
    } catch (err) {
      this.logger.error('StopUseCase failed', err, { guildId });
      return { type: 'error', message: 'Error al detener la reproducción.' };
    }
  }
}
