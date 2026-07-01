import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildQueueEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [buildErrorEmbed('Solo disponible en servidores.')] });
    return;
  }

  const result = ctx.viewQueue.execute(interaction.guildId);

  if (result.isEmpty) {
    await interaction.editReply({ embeds: [buildErrorEmbed('La cola está vacía.')] });
    return;
  }

  await interaction.editReply({
    embeds: [buildQueueEmbed(
      result.currentTrack,
      result.upcoming,
      result.totalSize,
      result.currentIndex,
      result.totalDuration,
    )],
  });
}
