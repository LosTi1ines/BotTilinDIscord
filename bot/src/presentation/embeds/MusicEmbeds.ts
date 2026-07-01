import { EmbedBuilder } from 'discord.js';
import { formatDuration } from '../../domain/entities/Track.js';
import type { Track } from '../../domain/entities/Track.js';

const COLOR_DEFAULT = 0x5865f2;
const COLOR_ERROR = 0xed4245;
const COLOR_SUCCESS = 0x57f287;

function progressBar(position: number, duration: number, length = 20): string {
  if (duration <= 0) return '🔴 LIVE';
  const ratio = Math.min(position / duration, 1);
  const filled = Math.round(ratio * length);
  return '▬'.repeat(filled) + '🔘' + '▬'.repeat(length - filled);
}

export function buildNowPlayingEmbed(track: Track, position: number): EmbedBuilder {
  const { title, author, duration, uri, artworkUrl } = track.info;
  const bar = progressBar(position, duration);

  return new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setAuthor({ name: 'Reproduciendo ahora' })
    .setTitle(title)
    .setURL(uri || null)
    .setThumbnail(artworkUrl)
    .addFields(
      { name: 'Artista', value: author, inline: true },
      { name: 'Duración', value: `${formatDuration(position)} / ${formatDuration(duration)}`, inline: true },
      { name: 'Solicitado por', value: `<@${track.requestedBy}>`, inline: true },
      { name: '​', value: bar },
    );
}

export function buildAddedEmbed(track: Track, position: number): EmbedBuilder {
  const { title, author, duration, artworkUrl } = track.info;
  return new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setAuthor({ name: position === 0 ? 'Reproduciendo ahora' : `Añadido a la cola (#${position})` })
    .setTitle(title)
    .setThumbnail(artworkUrl)
    .addFields(
      { name: 'Artista', value: author, inline: true },
      { name: 'Duración', value: formatDuration(duration), inline: true },
    );
}

export function buildPlaylistEmbed(name: string, count: number, first: Track): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setAuthor({ name: 'Playlist añadida a la cola' })
    .setTitle(name)
    .addFields(
      { name: 'Tracks', value: `${count}`, inline: true },
      { name: 'Primero', value: first.info.title, inline: true },
    );
}

export function buildQueueEmbed(
  current: Track | null,
  upcoming: Track[],
  totalSize: number,
  currentIndex: number,
  totalDuration: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setTitle('Cola de reproducción')
    .setFooter({ text: `${totalSize} tracks · ${formatDuration(totalDuration)} total` });

  if (current) {
    embed.addFields({ name: '▶ Reproduciendo ahora', value: `**${current.info.title}** — ${current.info.author}` });
  }

  if (upcoming.length > 0) {
    const list = upcoming
      .map((t, i) => `\`${currentIndex + i + 2}.\` **${t.info.title}** — ${t.info.author} [${formatDuration(t.info.duration)}]`)
      .join('\n');
    embed.addFields({ name: 'Próximos tracks', value: list });
  } else if (!current) {
    embed.setDescription('La cola está vacía.');
  }

  return embed;
}

export function buildSkippedEmbed(skipped: Track, next: Track | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setTitle('Track saltado')
    .setDescription(`~~${skipped.info.title}~~`);

  if (next) embed.addFields({ name: 'Reproduciendo ahora', value: next.info.title });

  return embed;
}

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLOR_ERROR).setDescription(`❌ ${message}`);
}

export function buildSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLOR_SUCCESS).setDescription(`✅ ${message}`);
}
