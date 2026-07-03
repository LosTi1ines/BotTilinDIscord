import type { Track } from '../domain/entities/Track.js';
import type { IQueueManager } from '../domain/ports/QueueManagerPort.js';

export interface QueueViewResult {
  currentTrack: Track | null;
  upcoming: Track[];
  totalSize: number;
  currentIndex: number;
  totalDuration: number;
  isEmpty: boolean;
}

export class QueueViewUseCase {
  constructor(private readonly queueManager: IQueueManager) {}

  execute(guildId: string): QueueViewResult {
    const queue = this.queueManager.get(guildId);
    if (!queue || queue.isEmpty()) {
      return { currentTrack: null, upcoming: [], totalSize: 0, currentIndex: 0, totalDuration: 0, isEmpty: true };
    }

    return {
      currentTrack: queue.getCurrent(),
      upcoming: queue.getUpcoming(10),
      totalSize: queue.size(),
      currentIndex: queue.currentIndex,
      totalDuration: queue.totalDuration(),
      isEmpty: false,
    };
  }
}
