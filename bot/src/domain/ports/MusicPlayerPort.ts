// ═══════════════════════════════════════════════════════════════
// src/domain/ports/MusicPlayerPort.ts
// 
// Puerto de salida hacia el sistema de audio.
// Define el contrato que cualquier adaptador de reproducción debe
// cumplir (Lavalink, Lavaclient, Shoukaku, etc.).
// ═══════════════════════════════════════════════════════════════

import type { Track, TrackInfo } from '../entities/Track.js';
import type { AudioFilters } from '../entities/PlayerState.js';

/**
 * Track sin procesar devuelto por el adaptador.
 * El use case es responsable de convertirlo a Track de dominio
 * añadiendo requestedBy y addedAt.
 */
export interface RawTrack {
  readonly encoded: string;
  readonly info: Omit<TrackInfo, 'position'>;
}

/**
 * Resultado de cargar tracks desde una búsqueda o URL.
 *
 * Proviene del servidor Lavalink en respuesta a POST /v4/loadtracks
 */
export interface LoadResult {
  /** Tipo de carga: 'track' | 'playlist' | 'search' | 'empty' | 'error' */
  readonly loadType: 'track' | 'playlist' | 'search' | 'empty' | 'error';

  /** Array de tracks crudos (sin requestedBy ni addedAt) */
  readonly tracks: RawTrack[];

  /** Metadatos de playlist (si loadType === 'playlist') */
  readonly playlist: PlaylistMetadata | null;

  /** Mensaje de error (si loadType === 'error') */
  readonly error: string | null;
}

/**
 * Metadatos de una playlist cargada desde Lavalink.
 */
export interface PlaylistMetadata {
  readonly name: string;
  readonly selectedIndex: number | null;
  readonly duration: number;
}

/**
 * Puerto de reproducción de audio.
 * 
 * Abstracción que desacopla la lógica de negocios (Use Cases)
 * del backend de audio específico (Lavalink).
 * 
 * El adaptador (LavalinkAdapter) implementa esta interfaz usando
 * la librería Shoukaku para comunicarse con Lavalink v4.
 */
export interface IMusicPlayerPort {
  /**
   * Conecta el bot a un canal de voz de Discord.
   * 
   * @param guildId - ID del servidor Discord
   * @param voiceChannelId - ID del canal de voz
   * @throws Si la conexión falla o el canal no existe
   */
  connect(guildId: string, voiceChannelId: string): Promise<void>;

  /**
   * Desconecta el bot del canal de voz y destruye el reproductor.
   * 
   * @param guildId - ID del servidor Discord
   */
  disconnect(guildId: string): Promise<void>;

  /**
   * Inicia la reproducción de un track.
   * El track debe estar en la cola antes de llamar a este método.
   * 
   * @param guildId - ID del servidor Discord
   * @param track - Track a reproducir
   * @throws Si el reproductor no está inicializado
   */
  play(guildId: string, track: Track): Promise<void>;

  /**
   * Pausa la reproducción sin perder la posición.
   * 
   * @param guildId - ID del servidor Discord
   */
  pause(guildId: string): Promise<void>;

  /**
   * Reanuda la reproducción si estaba pausada.
   * 
   * @param guildId - ID del servidor Discord
   */
  resume(guildId: string): Promise<void>;

  /**
   * Detiene la reproducción y destruye el reproductor.
   * 
   * @param guildId - ID del servidor Discord
   */
  stop(guildId: string): Promise<void>;

  /**
   * Cambia la posición actual de reproducción.
   * 
   * @param guildId - ID del servidor Discord
   * @param positionMs - Nueva posición en milisegundos
   */
  seek(guildId: string, positionMs: number): Promise<void>;

  /**
   * Ajusta el volumen de reproducción (0-100).
   * 
   * @param guildId - ID del servidor Discord
   * @param volume - Volumen de 0 a 100
   */
  setVolume(guildId: string, volume: number): Promise<void>;

  /**
   * Aplica filtros de audio (bass boost, nightcore, etc.).
   * 
   * @param guildId - ID del servidor Discord
   * @param filters - Filtros a aplicar
   */
  setFilters(guildId: string, filters: AudioFilters): Promise<void>;

  /**
   * Carga tracks desde una búsqueda o URL.
   * 
   * Soporta múltiples identificadores:
   *   - URL de YouTube: https://youtube.com/watch?v=...
   *   - URL de Spotify: https://open.spotify.com/track/...
   *   - Búsqueda de YouTube: ytsearch:término
   *   - Búsqueda de SoundCloud: scsearch:término
   *   - URL de SoundCloud: https://soundcloud.com/...
   *   - Búsqueda por ISRC: isrc:CÓDIGO
   * 
   * @param query - Identificador o búsqueda
   * @returns Resultado con tracks, playlist o error
   */
  loadTracks(query: string): Promise<LoadResult>;

  /**
   * Destruye el reproductor de un guild (limpieza de recursos).
   * Equivalente a disconnect().
   * 
   * @param guildId - ID del servidor Discord
   */
  destroyPlayer(guildId: string): Promise<void>;

  /**
   * Verifica si existe un reproductor activo para un guild.
   *
   * @param guildId - ID del servidor Discord
   */
  hasPlayer(guildId: string): boolean;

  /**
   * Retorna la posición actual de reproducción en milisegundos.
   * Retorna 0 si no hay reproductor activo.
   *
   * @param guildId - ID del servidor Discord
   */
  getPosition(guildId: string): number;
}
