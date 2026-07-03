// ═══════════════════════════════════════════════════════════════
// src/infrastructure/state/GuildStateStore.ts
//
// Almacena estado efímero por servidor:
//   - textChannelId: canal de texto donde se ejecutó /play
//   - nowPlayingMessageId: ID del último embed de "Reproduciendo ahora"
//     para editarlo en vez de enviar mensajes nuevos
// ═══════════════════════════════════════════════════════════════

export interface GuildState {
  textChannelId: string;
  nowPlayingMessageId: string | null;
}

export class GuildStateStore {
  private readonly map = new Map<string, GuildState>();

  setTextChannel(guildId: string, textChannelId: string): void {
    const existing = this.map.get(guildId);
    this.map.set(guildId, {
      textChannelId,
      nowPlayingMessageId: existing?.nowPlayingMessageId ?? null,
    });
  }

  setNowPlayingMessage(guildId: string, messageId: string | null): void {
    const existing = this.map.get(guildId);
    if (!existing) return;
    this.map.set(guildId, { ...existing, nowPlayingMessageId: messageId });
  }

  get(guildId: string): GuildState | null {
    return this.map.get(guildId) ?? null;
  }

  getTextChannelId(guildId: string): string | null {
    return this.map.get(guildId)?.textChannelId ?? null;
  }

  getNowPlayingMessageId(guildId: string): string | null {
    return this.map.get(guildId)?.nowPlayingMessageId ?? null;
  }

  delete(guildId: string): void {
    this.map.delete(guildId);
  }
}
