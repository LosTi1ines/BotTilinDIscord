import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildSkippedEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Salta el track actual');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [buildErrorEmbed('Solo disponible en servidores.')] });
    return;
  }

  const result = await ctx.skipTrack.execute(interaction.guildId);

  if (result.type === 'error') {
    await interaction.editReply({ embeds: [buildErrorEmbed(result.message)] });
    return;
  }

  await interaction.editReply({ embeds: [buildSkippedEmbed(result.skipped, result.next)] });
}
