// ═══════════════════════════════════════════════════════════════
// src/domain/entities/PlayerState.ts
// Capa de Dominio — Estado del reproductor por Guild
//
// Define los enums y tipos que representan el estado completo
// del reproductor de audio para un guild específico.
// ═══════════════════════════════════════════════════════════════

import type { Track } from './Track.js';
import type { IQueue } from './Queue.js';

// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

/**
 * Estado del ciclo de vida del reproductor.
 *
 * Transiciones válidas:
 *   IDLE → LOADING → PLAYING ⇄ PAUSED → IDLE
 *                  ↘ IDLE (error al cargar)
 *   Cualquier estado → DESTROYED (desconexión forzada)
 */
export enum PlayerStatus {
  /** Sin conexión a canal de voz, sin track activo */
  IDLE = 'IDLE',

  /** Conectado, cargando un track desde Lavalink */
  LOADING = 'LOADING',

  /** Reproduciendo audio activamente */
  PLAYING = 'PLAYING',

  /** Reproducción pausada (track y posición preservados) */
  PAUSED = 'PAUSED',

  /** Reproductor destruido, requiere reconexión completa */
  DESTROYED = 'DESTROYED',
}

// ═══════════════════════════════════════════════════════════════
// Audio Filters
// ═══════════════════════════════════════════════════════════════

/**
 * Filtros de audio aplicables a través de Lavalink.
 * Cada filtro modifica el stream de audio en tiempo real.
 */
export interface AudioFilters {
  /** Refuerzo de frecuencias bajas */
  readonly bassboost: boolean;

  /** Acelera el tempo y sube el pitch (estilo nightcore) */
  readonly nightcore: boolean;

  /** Ralentiza el tempo y baja el pitch (estilo vaporwave) */
  readonly vaporwave: boolean;

  /** Intenta aislar/remover la voz del track */
  readonly karaoke: boolean;
}

/**
 * Retorna un objeto AudioFilters con todos los filtros desactivados.
 * Útil como valor inicial al crear un nuevo PlayerState.
 */
export function createDefaultFilters(): AudioFilters {
  return {
    bassboost: false,
    nightcore: false,
    vaporwave: false,
    karaoke: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// Player State
// ═══════════════════════════════════════════════════════════════

/**
 * Snapshot inmutable del estado completo del reproductor para un guild.
 *
 * Este estado se mantiene en memoria y se actualiza a través de
 * los eventos de Lavalink (TrackStart, TrackEnd, WebSocket Updates).
 *
 * La Queue se referencia por interfaz (IQueue) para mantener la
 * inversión de dependencias — el dominio no conoce la implementación.
 */
export interface PlayerState {
  /** Snowflake ID del guild de Discord */
  readonly guildId: string;

  /** ID del canal de voz al que está conectado (null si desconectado) */
  readonly voiceChannelId: string | null;

  /** ID del canal de texto donde se envían las respuestas del bot */
  readonly textChannelId: string;

  /** Estado actual del reproductor */
  readonly status: PlayerStatus;

  /** Nivel de volumen (0 = silencio, 100 = máximo) */
  readonly volume: number;

  /** Posición actual de reproducción en milisegundos */
  readonly position: number;

  /** Track actualmente en reproducción (null si IDLE) */
  readonly currentTrack: Track | null;

  /** Referencia a la cola de reproducción del guild */
  readonly queue: IQueue;

  /** Timestamp de conexión al canal de voz (null si no conectado) */
  readonly connectedAt: Date | null;

  /** Filtros de audio activos */
  readonly filters: AudioFilters;
}

// ═══════════════════════════════════════════════════════════════
// Mutable Player State Manager
// ═══════════════════════════════════════════════════════════════

/**
 * Clase mutable que gestiona el estado del reproductor.
 *
 * Encapsula las transiciones de estado y valida las mutaciones.
 * Cada guild tiene exactamente una instancia de GuildPlayerState.
 */
export class GuildPlayerState {
  private _guildId: string;
  private _voiceChannelId: string | null = null;
  private _textChannelId: string;
  private _status: PlayerStatus = PlayerStatus.IDLE;
  private _volume: number;
  private _position: number = 0;
  private _currentTrack: Track | null = null;
  private _queue: IQueue;
  private _connectedAt: Date | null = null;
  private _filters: AudioFilters;

  constructor(guildId: string, textChannelId: string, queue: IQueue, defaultVolume: number = 80) {
    this._guildId = guildId;
    this._textChannelId = textChannelId;
    this._queue = queue;
    this._volume = Math.max(0, Math.min(100, defaultVolume));
    this._filters = createDefaultFilters();
  }

  // ── Getters (snapshot inmutable) ──

  get guildId(): string {
    return this._guildId;
  }

  get voiceChannelId(): string | null {
    return this._voiceChannelId;
  }

  get textChannelId(): string {
    return this._textChannelId;
  }

  get status(): PlayerStatus {
    return this._status;
  }

  get volume(): number {
    return this._volume;
  }

  get position(): number {
    return this._position;
  }

  get currentTrack(): Track | null {
    return this._currentTrack;
  }

  get queue(): IQueue {
    return this._queue;
  }

  get connectedAt(): Date | null {
    return this._connectedAt;
  }

  get filters(): AudioFilters {
    return this._filters;
  }

  // ── Mutaciones controladas ──

  connect(voiceChannelId: string): void {
    this._voiceChannelId = voiceChannelId;
    this._connectedAt = new Date();
    this._status = PlayerStatus.IDLE;
  }

  disconnect(): void {
    this._voiceChannelId = null;
    this._connectedAt = null;
    this._status = PlayerStatus.IDLE;
    this._currentTrack = null;
    this._position = 0;
  }

  setPlaying(track: Track): void {
    this._currentTrack = track;
    this._status = PlayerStatus.PLAYING;
    this._position = 0;
  }

  setPaused(): void {
    if (this._status === PlayerStatus.PLAYING) {
      this._status = PlayerStatus.PAUSED;
    }
  }

  setResumed(): void {
    if (this._status === PlayerStatus.PAUSED) {
      this._status = PlayerStatus.PLAYING;
    }
  }

  setLoading(): void {
    this._status = PlayerStatus.LOADING;
  }

  setIdle(): void {
    this._status = PlayerStatus.IDLE;
    this._currentTrack = null;
    this._position = 0;
  }

  setDestroyed(): void {
    this._status = PlayerStatus.DESTROYED;
    this._currentTrack = null;
    this._position = 0;
    this._voiceChannelId = null;
    this._connectedAt = null;
  }

  updatePosition(positionMs: number): void {
    this._position = positionMs;
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(100, volume));
  }

  setTextChannel(channelId: string): void {
    this._textChannelId = channelId;
  }

  updateFilters(filters: Partial<AudioFilters>): void {
    this._filters = { ...this._filters, ...filters };
  }

  /**
   * Exporta el estado actual como un snapshot inmutable.
   * Útil para pasar a la capa de presentación sin exponer mutabilidad.
   */
  toSnapshot(): PlayerState {
    return {
      guildId: this._guildId,
      voiceChannelId: this._voiceChannelId,
      textChannelId: this._textChannelId,
      status: this._status,
      volume: this._volume,
      position: this._position,
      currentTrack: this._currentTrack,
      queue: this._queue,
      connectedAt: this._connectedAt,
      filters: { ...this._filters },
    };
  }
}
