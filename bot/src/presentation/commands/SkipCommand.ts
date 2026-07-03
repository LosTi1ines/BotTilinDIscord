import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildSkippedEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';
import { checkVoiceChannel } from '../middleware/VoiceChannelGuard.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Salta el track actual');

export async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  await interaction.deferReply();

  const guard = checkVoiceChannel(interaction);
  if (!guard.ok) {
    await interaction.editReply({ embeds: [buildErrorEmbed(guard.message)] });
    return;
  }

  const result = await ctx.skipTrack.execute(guard.guildId);

  if (result.type === 'error') {
    await interaction.editReply({ embeds: [buildErrorEmbed(result.message)] });
    return;
  }

  await interaction.editReply({ embeds: [buildSkippedEmbed(result.skipped, result.next)] });
}
