import type { Track } from '../domain/entities/Track.js';
import type { IMusicPlayerPort } from '../domain/ports/MusicPlayerPort.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';

export type NowPlayingResult =
  | { type: 'playing' | 'paused'; track: Track; position: number }
  | { type: 'idle' };

export class NowPlayingUseCase {
  constructor(
    private readonly player: IMusicPlayerPort,
    private readonly queueManager: IQueueManager,
  ) {}

  execute(guildId: string): NowPlayingResult {
    const queue = this.queueManager.get(guildId);
    const current = queue?.getCurrent() ?? null;

    if (!current || !this.player.hasPlayer(guildId)) return { type: 'idle' };

    return {
      type: 'playing',
      track: current,
      position: this.player.getPosition(guildId),
    };
  }
}
