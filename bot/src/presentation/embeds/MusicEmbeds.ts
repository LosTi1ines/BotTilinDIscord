import { EmbedBuilder } from 'discord.js';
import { formatDuration } from '../../domain/entities/Track.js';
import type { Track } from '../../domain/entities/Track.js';

// ── Paleta de colores ─────────────────────────────────────────
const COLOR_BLURPLE  = 0x5865f2;  // Discord Blurple (comandos generales)
const COLOR_PLAYING  = 0xff0000;  // Rojo YouTube (reproduciendo)
const COLOR_QUEUED   = 0x1db954;  // Verde Spotify (añadido a cola)
const COLOR_PLAYLIST = 0x1db954;  // Verde Spotify (playlist)
const COLOR_ERROR    = 0xed4245;  // Rojo error
const COLOR_SUCCESS  = 0x57f287;  // Verde éxito

// Thumbnail por defecto cuando el track no tiene artwork
const DEFAULT_THUMBNAIL = 'https://i.imgur.com/ufxvZ0j.png';

function getThumbnail(artworkUrl: string | null): string {
  return artworkUrl ?? DEFAULT_THUMBNAIL;
}

function progressBar(position: number, duration: number, length = 20): string {
  if (duration <= 0) return '🔴 LIVE';
  const ratio = Math.min(position / duration, 1);
  const filled = Math.round(ratio * length);
  return '▬'.repeat(filled) + '🔘' + '▬'.repeat(length - filled);
}

// ── Embeds públicos ───────────────────────────────────────────

export function buildNowPlayingEmbed(track: Track, position: number): EmbedBuilder {
  const { title, author, duration, uri, artworkUrl } = track.info;
  const bar = progressBar(position, duration);

  return new EmbedBuilder()
    .setColor(COLOR_PLAYING)
    .setAuthor({ name: '▶  Reproduciendo ahora', iconURL: 'https://i.imgur.com/ufxvZ0j.png' })
    .setTitle(title)
    .setURL(uri || null)
    .setThumbnail(getThumbnail(artworkUrl))
    .addFields(
      { name: '🎤 Artista', value: author, inline: true },
      { name: '⏱ Duración', value: `${formatDuration(position)} / ${formatDuration(duration)}`, inline: true },
      { name: '👤 Pedido por', value: `<@${track.requestedBy}>`, inline: true },
      { name: '\u200b', value: bar },
    )
    .setFooter({ text: 'Bot Music • Usa /help para ver todos los comandos' });
}

/**
 * Embed compacto de "Reproduciendo ahora" para el avance automático de cola.
 * Se usa para EDITAR el mensaje anterior (sin barra de progreso).
 */
export function buildAutoNowPlayingEmbed(track: Track): EmbedBuilder {
  const { title, author, duration, uri, artworkUrl } = track.info;

  return new EmbedBuilder()
    .setColor(COLOR_PLAYING)
    .setAuthor({ name: '⏭  Siguiente en la cola' })
    .setTitle(title)
    .setURL(uri || null)
    .setThumbnail(getThumbnail(artworkUrl))
    .addFields(
      { name: '🎤 Artista', value: author, inline: true },
      { name: '⏱ Duración', value: formatDuration(duration), inline: true },
      { name: '👤 Pedido por', value: `<@${track.requestedBy}>`, inline: true },
    )
    .setFooter({ text: 'Bot Music • Cola avanzando automáticamente' });
}

export function buildAddedEmbed(track: Track, position: number): EmbedBuilder {
  const { title, author, duration, artworkUrl } = track.info;
  return new EmbedBuilder()
    .setColor(position === 0 ? COLOR_PLAYING : COLOR_QUEUED)
    .setAuthor({ name: position === 0 ? '▶  Reproduciendo ahora' : `📋 Añadido a la cola (#${position})` })
    .setTitle(title)
    .setThumbnail(getThumbnail(artworkUrl))
    .addFields(
      { name: '🎤 Artista', value: author, inline: true },
      { name: '⏱ Duración', value: formatDuration(duration), inline: true },
    )
    .setFooter({ text: 'Bot Music • Usa /queue para ver la cola completa' });
}

export function buildPlaylistEmbed(name: string, count: number, first: Track, truncated = false): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_PLAYLIST)
    .setAuthor({ name: '📂 Playlist añadida a la cola' })
    .setTitle(name)
    .setThumbnail(getThumbnail(first.info.artworkUrl))
    .addFields(
      { name: '🎵 Tracks', value: `${count}`, inline: true },
      { name: '▶ Primero', value: first.info.title, inline: true },
    )
    .setFooter({
      text: truncated
        ? 'Bot Music • Playlist truncada al límite de 600 canciones'
        : 'Bot Music • Reproduciendo ahora el primer track',
    });
}

export function buildQueueEmbed(
  current: Track | null,
  upcoming: Track[],
  totalSize: number,
  currentIndex: number,
  totalDuration: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_BLURPLE)
    .setTitle('📋 Cola de reproducción')
    .setFooter({ text: `${totalSize} tracks · ${formatDuration(totalDuration)} total` });

  if (current) {
    embed.addFields({
      name: '▶ Reproduciendo ahora',
      value: `**${current.info.title}** — ${current.info.author}`,
    });
    embed.setThumbnail(getThumbnail(current.info.artworkUrl));
  }

  if (upcoming.length > 0) {
    const list = upcoming
      .map((t, i) => `\`${currentIndex + i + 2}.\` **${t.info.title}** — ${t.info.author} [${formatDuration(t.info.duration)}]`)
      .join('\n');
    embed.addFields({ name: '⏭ Próximos tracks', value: list });
  } else if (!current) {
    embed.setDescription('La cola está vacía. Usa **/play** para añadir una canción.');
  }

  return embed;
}

export function buildSkippedEmbed(skipped: Track, next: Track | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_BLURPLE)
    .setTitle('⏭ Track saltado')
    .setDescription(`~~${skipped.info.title}~~`);

  if (next) {
    embed.addFields({ name: '▶ Reproduciendo ahora', value: `**${next.info.title}** — ${next.info.author}` });
    embed.setThumbnail(getThumbnail(next.info.artworkUrl));
  }

  return embed;
}

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setDescription(`❌ ${message}`)
    .setFooter({ text: 'Bot Music • Usa /help si necesitas ayuda' });
}

export function buildSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setDescription(`✅ ${message}`);
}
