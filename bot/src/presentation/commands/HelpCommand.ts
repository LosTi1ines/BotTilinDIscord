import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from './index.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Muestra todos los comandos disponibles del bot de música');

export async function execute(
  interaction: ChatInputCommandInteraction,
  _ctx: BotContext,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎵 Bot Music — Comandos Disponibles')
    .setDescription('Aquí están todos los comandos que puedes usar. ¡Únete a un canal de voz y comienza!')
    .addFields(
      {
        name: '╔══ 🎶 REPRODUCCIÓN ══╗',
        value: '\u200b',
      },
      {
        name: '🔍 `/play <canción o URL>`',
        value: 'Busca y reproduce una canción, o la añade a la cola si ya hay música.\n> Soporta: YouTube, YouTube Music, Spotify (tracks, álbumes, playlists)\n> *Ejemplo: `/play Bohemian Rhapsody` o pega una URL de Spotify*',
      },
      {
        name: '⏭️ `/skip`',
        value: 'Salta al siguiente track de la cola.',
      },
      {
        name: '⏸️ `/pause`',
        value: 'Pausa la reproducción actual.',
      },
      {
        name: '▶️ `/resume`',
        value: 'Reanuda la reproducción si estaba pausada.',
      },
      {
        name: '⏹️ `/stop`',
        value: 'Detiene la reproducción, limpia la cola y desconecta el bot del canal de voz.',
      },
      {
        name: '╔══ 📋 INFORMACIÓN ══╗',
        value: '\u200b',
      },
      {
        name: '🎧 `/nowplaying`',
        value: 'Muestra información detallada del track actual con barra de progreso.',
      },
      {
        name: '📋 `/queue`',
        value: 'Muestra la cola de reproducción con los próximos tracks.',
      },
      {
        name: '❓ `/help`',
        value: 'Muestra este mensaje de ayuda.',
      },
    )
    .setFooter({ text: 'Bot Music • Usa /play para comenzar a reproducir música' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
