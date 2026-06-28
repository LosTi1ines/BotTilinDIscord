import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { checkVoiceChannel } from '../middleware/VoiceChannelGuard.js';
import { buildAddedEmbed, buildPlaylistEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce una canción o añade a la cola')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('URL de YouTube/Spotify o texto a buscar')
      .setRequired(true),
  );

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

  const query = interaction.options.getString('query', true);

  const result = await ctx.playTrack.execute({
    guildId: guard.guildId,
    voiceChannelId: guard.voiceChannelId,
    query,
    requestedBy: interaction.user.id,
  });

  if (result.type === 'error') {
    await interaction.editReply({ embeds: [buildErrorEmbed(result.message)] });
    return;
  }

  if (result.type === 'playlist') {
    await interaction.editReply({ embeds: [buildPlaylistEmbed(result.name, result.count, result.first)] });
    return;
  }

  const position = result.type === 'playing' ? 0 : result.position;
  await interaction.editReply({ embeds: [buildAddedEmbed(result.track, position)] });
}
