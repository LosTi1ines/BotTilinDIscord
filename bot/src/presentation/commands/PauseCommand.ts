import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa la reproducción');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [buildErrorEmbed('Solo disponible en servidores.')] });
    return;
  }

  const result = await ctx.pauseResume.pause(interaction.guildId);

  const embed = result.type === 'error'
    ? buildErrorEmbed(result.message)
    : buildSuccessEmbed('Reproducción pausada.');

  await interaction.editReply({ embeds: [embed] });
}
