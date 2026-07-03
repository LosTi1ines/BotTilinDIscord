import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';
import { checkVoiceChannel } from '../middleware/VoiceChannelGuard.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Detiene la reproducción, limpia la cola y desconecta al bot');

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

  const result = await ctx.stop.execute(guard.guildId);

  const embed = result.type === 'error'
    ? buildErrorEmbed(result.message)
    : buildSuccessEmbed('Reproducción detenida y cola limpiada.');

  await interaction.editReply({ embeds: [embed] });
}
