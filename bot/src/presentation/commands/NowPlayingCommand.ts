import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildNowPlayingEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Muestra el track actualmente en reproducción');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [buildErrorEmbed('Solo disponible en servidores.')] });
    return;
  }

  const result = ctx.nowPlaying.execute(interaction.guildId);

  if (result.type === 'idle') {
    await interaction.editReply({ embeds: [buildErrorEmbed('No hay nada reproduciéndose.')] });
    return;
  }

  await interaction.editReply({ embeds: [buildNowPlayingEmbed(result.track, result.position)] });
}
