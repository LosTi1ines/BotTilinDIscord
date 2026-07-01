import type { IQueueManager } from '../../domain/ports/QueueManagerPort.js';
import type { IQueue } from '../../domain/entities/Queue.js';
import { Queue } from '../../domain/entities/Queue.js';

export class InMemoryQueueManager implements IQueueManager {
  private readonly queues = new Map<string, IQueue>();

  getOrCreate(guildId: string): IQueue {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new Queue();
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  get(guildId: string): IQueue | null {
    return this.queues.get(guildId) ?? null;
  }

  has(guildId: string): boolean {
    return this.queues.has(guildId);
  }

  destroy(guildId: string): void {
    this.queues.delete(guildId);
  }

  getActiveGuilds(): string[] {
    return Array.from(this.queues.keys());
  }

  clearAll(): void {
    this.queues.clear();
  }
}
