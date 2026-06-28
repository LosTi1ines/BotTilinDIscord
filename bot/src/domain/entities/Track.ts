// ═══════════════════════════════════════════════════════════════
// src/domain/entities/Track.ts
// Capa de Dominio — Entidad Track (sin dependencias externas)
//
// Representa un track de audio con metadatos resueltos por
// Lavalink. El campo `encoded` es opaco y se usa exclusivamente
// para enviar al servidor Lavalink para reproducción.
// ═══════════════════════════════════════════════════════════════

/**
 * Metadatos de un track de audio.
 *
 * Estos datos provienen de la respuesta `loadtracks` de Lavalink v4
 * y son de solo lectura una vez creados.
 */
export interface TrackInfo {
  /** Título del track */
  readonly title: string;

  /** Artista o canal del track */
  readonly author: string;

  /** Duración total en milisegundos (0 para livestreams) */
  readonly duration: number;

  /** Identificador específico de la plataforma (ej: ID de video YouTube) */
  readonly identifier: string;

  /** URL original del track en la plataforma fuente */
  readonly uri: string;

  /** URL del artwork/thumbnail (puede ser null si no está disponible) */
  readonly artworkUrl: string | null;

  /**
   * International Standard Recording Code.
   * Disponible cuando el track fue resuelto desde Spotify vía lavasrc.
   * Se usa como puente para buscar el audio en YouTube Music.
   */
  readonly isrc: string | null;

  /** Plataforma de origen: 'youtube', 'spotify', 'soundcloud', etc. */
  readonly sourceName: string;

  /** True si el track es un livestream (duración infinita) */
  readonly isStream: boolean;

  /** Posición actual de reproducción en milisegundos */
  readonly position: number;
}

/**
 * Entidad Track del dominio.
 *
 * Combina la cadena codificada de Lavalink (necesaria para playback)
 * con metadatos legibles y contexto de quién solicitó el track.
 *
 * @example
 * ```ts
 * const track: Track = {
 *   encoded: 'QAADjgMAB0...',    // Opaco, solo para Lavalink
 *   info: {
 *     title: 'Bohemian Rhapsody',
 *     author: 'Queen',
 *     duration: 354000,
 *     identifier: 'fJ9rUzIMcZQ',
 *     uri: 'https://youtube.com/watch?v=fJ9rUzIMcZQ',
 *     artworkUrl: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/maxresdefault.jpg',
 *     isrc: 'GBUM71029604',
 *     sourceName: 'youtube',
 *     isStream: false,
 *     position: 0,
 *   },
 *   requestedBy: '123456789012345678',
 *   addedAt: new Date(),
 * };
 * ```
 */
export interface Track {
  /**
   * Cadena codificada opaca generada por Lavalink.
   * Se envía tal cual al endpoint PATCH /v4/sessions/{sid}/players/{gid}
   * para iniciar la reproducción. No debe interpretarse ni modificarse.
   */
  readonly encoded: string;

  /** Metadatos del track */
  readonly info: TrackInfo;

  /** Snowflake ID del usuario de Discord que solicitó este track */
  readonly requestedBy: string;

  /** Momento en que el track fue añadido a la cola */
  readonly addedAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// Entidad Playlist
// ═══════════════════════════════════════════════════════════════

/** Fuente de origen de una playlist */
export type PlaylistSource = 'spotify' | 'youtube' | 'soundcloud';

/**
 * Representa una playlist cargada desde una plataforma externa.
 * Contiene múltiples tracks resueltos y metadatos de la playlist.
 */
export interface Playlist {
  /** Nombre de la playlist tal como aparece en la plataforma */
  readonly name: string;

  /** Tracks resueltos de la playlist */
  readonly tracks: Track[];

  /** Índice del track seleccionado inicialmente (null si no aplica) */
  readonly selectedTrack: number | null;

  /** Plataforma de donde proviene la playlist */
  readonly source: PlaylistSource;
}

// ═══════════════════════════════════════════════════════════════
// Factory Functions (creación de entidades validada)
// ═══════════════════════════════════════════════════════════════

/**
 * Crea una entidad Track a partir de datos crudos de la API Lavalink v4.
 * Centraliza la transformación y garantiza que los campos requeridos existan.
 *
 * @param encoded  - Cadena codificada del track desde Lavalink
 * @param rawInfo  - Objeto `info` de la respuesta de Lavalink
 * @param userId   - Snowflake ID del usuario que solicitó el track
 * @returns Track  - Entidad de dominio validada
 */
export function createTrack(
  encoded: string,
  rawInfo: Omit<TrackInfo, 'position'> & { position?: number },
  userId: string,
): Track {
  return {
    encoded,
    info: {
      title: rawInfo.title,
      author: rawInfo.author,
      duration: rawInfo.duration,
      identifier: rawInfo.identifier,
      uri: rawInfo.uri,
      artworkUrl: rawInfo.artworkUrl ?? null,
      isrc: rawInfo.isrc ?? null,
      sourceName: rawInfo.sourceName,
      isStream: rawInfo.isStream,
      position: rawInfo.position ?? 0,
    },
    requestedBy: userId,
    addedAt: new Date(),
  };
}

/**
 * Formatea la duración de un track en formato legible (MM:SS o HH:MM:SS).
 *
 * @param ms - Duración en milisegundos
 * @returns String formateada, ej: "5:54" o "1:02:30"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '🔴 LIVE';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => n.toString().padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
