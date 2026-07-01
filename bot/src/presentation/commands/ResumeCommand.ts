import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Reanuda la reproducción');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [buildErrorEmbed('Solo disponible en servidores.')] });
    return;
  }

  const result = await ctx.pauseResume.resume(interaction.guildId);

  const embed = result.type === 'error'
    ? buildErrorEmbed(result.message)
    : buildSuccessEmbed('Reproducción reanudada.');

  await interaction.editReply({ embeds: [embed] });
}
