import type { ChatInputCommandInteraction } from 'discord.js';

export interface VoiceGuardResult {
  ok: true;
  voiceChannelId: string;
  guildId: string;
}

export interface VoiceGuardError {
  ok: false;
  message: string;
}

export function checkVoiceChannel(
  interaction: ChatInputCommandInteraction,
): VoiceGuardResult | VoiceGuardError {
  if (!interaction.guildId) {
    return { ok: false, message: 'Este comando solo funciona en servidores.' };
  }

  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannelId = member?.voice.channelId ?? null;

  if (!voiceChannelId) {
    return { ok: false, message: 'Debes estar en un canal de voz para usar este comando.' };
  }

  return { ok: true, voiceChannelId, guildId: interaction.guildId };
}
