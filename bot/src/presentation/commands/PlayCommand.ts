import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { BotContext } from './index.js';
import { checkVoiceChannel } from '../middleware/VoiceChannelGuard.js';
import { buildAddedEmbed, buildPlaylistEmbed, buildErrorEmbed } from '../embeds/MusicEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce una canción o añade a la cola')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('Nombre de la canción, URL de YouTube o Spotify')
      .setRequired(true)
      .setAutocomplete(true),
  );

export async function autocomplete(
  interaction: AutocompleteInteraction,
  ctx: BotContext,
): Promise<void> {
  const focused = interaction.options.getFocused();

  // No buscar si el texto es muy corto (evitar peticiones innecesarias a Lavalink)
  if (!focused || focused.length < 2) {
    await interaction.respond([]);
    return;
  }

  try {
    const results = await ctx.playTrack.searchForAutocomplete(focused);
    await interaction.respond(
      results.slice(0, 5).map(t => ({
        // 🟢 Spotify | 🔴 YouTube  — Límite de 100 chars por la API de Discord
        name: `${t.source === 'spotify' ? '🟢' : '🔴'} ${t.title} — ${t.author}`.slice(0, 100),
        value: t.uri,
      })),
    );
  } catch {
    // Si falla la búsqueda (Lavalink offline, timeout), responder vacío
    await interaction.respond([]);
  }
}

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
    textChannelId: interaction.channelId,
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
  const reply = await interaction.editReply({ embeds: [buildAddedEmbed(result.track, position)] });

  // Guardar el messageId del embed para editarlo cuando la cola avance automáticamente
  ctx.guildStateStore.setNowPlayingMessage(guard.guildId, reply.id);
}
