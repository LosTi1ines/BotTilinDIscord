// ═══════════════════════════════════════════════════════════════
// src/domain/entities/Queue.ts
// Capa de Dominio — Cola de Reproducción en Memoria
//
// Implementación de cola con:
//   - Navegación O(1) (next, previous, skip, getCurrent)
//   - Shuffle por índices indirectos (preserva orden original)
//   - Tres modos de repetición (OFF, TRACK, QUEUE)
//   - Sin dependencias externas
//
// Complejidades:
//   addTrack: O(1) amortizado | next/prev/skip: O(1)
//   shuffle: O(n)             | remove: O(n)
//   clear: O(1)               | getCurrent: O(1)
// ═══════════════════════════════════════════════════════════════

import type { Track } from './Track.js';

// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

/**
 * Modos de repetición de la cola.
 *
 * - OFF:   La cola termina cuando se reproduce el último track.
 * - TRACK: El track actual se repite indefinidamente.
 * - QUEUE: Al llegar al final, la cola vuelve al inicio.
 */
export enum RepeatMode {
  OFF = 'OFF',
  TRACK = 'TRACK',
  QUEUE = 'QUEUE',
}

// ═══════════════════════════════════════════════════════════════
// Interfaz IQueue (Puerto de Dominio)
// ═══════════════════════════════════════════════════════════════

/**
 * Contrato de la cola de reproducción.
 *
 * Define las operaciones que cualquier implementación de cola debe
 * soportar. Permite sustituir la implementación sin afectar los
 * use cases (principio de inversión de dependencias).
 */
export interface IQueue {
  // ── Estado de solo lectura ──
  readonly tracks: ReadonlyArray<Track>;
  readonly currentIndex: number;
  readonly repeatMode: RepeatMode;
  readonly isShuffled: boolean;

  // ── Mutaciones ──
  addTrack(track: Track): number;
  addTracks(tracks: Track[]): number;
  removeTrack(index: number): Track | null;
  next(): Track | null;
  previous(): Track | null;
  skipTo(index: number): Track | null;
  shuffle(): void;
  unshuffle(): void;
  clear(): void;
  setRepeatMode(mode: RepeatMode): void;

  // ── Consultas ──
  getCurrent(): Track | null;
  getUpcoming(limit?: number): Track[];
  getHistory(limit?: number): Track[];
  size(): number;
  isEmpty(): boolean;
  totalDuration(): number;
}

// ═══════════════════════════════════════════════════════════════
// Implementación: Queue
// ═══════════════════════════════════════════════════════════════

/**
 * Implementación en memoria de la cola de reproducción.
 *
 * Diseño clave: El shuffle NO reordena el array `_tracks`. En su
 * lugar, genera un array de índices `_shuffleOrder` que actúa como
 * capa de indirección. Esto permite hacer `unshuffle()` para
 * restaurar el orden original sin perder datos — comportamiento
 * consistente con Spotify y YouTube Music.
 *
 * @example
 * ```
 * tracks:        [A, B, C, D, E]   // Orden original preservado
 * shuffleOrder:  [3, 0, 4, 1, 2]   // Orden de reproducción: D, A, E, B, C
 * currentIndex:  1                  // Posición lógica → shuffleOrder[1] = 0 → track A
 * ```
 */
export class Queue implements IQueue {
  private _tracks: Track[] = [];
  private _currentIndex: number = -1;
  private _repeatMode: RepeatMode = RepeatMode.OFF;
  private _isShuffled: boolean = false;
  private _shuffleOrder: number[] = [];

  // ── Getters públicos (readonly) ───────────────────────────

  get tracks(): ReadonlyArray<Track> {
    return this._tracks;
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get repeatMode(): RepeatMode {
    return this._repeatMode;
  }

  get isShuffled(): boolean {
    return this._isShuffled;
  }

  // ── Resolución de índice ──────────────────────────────────

  /**
   * Traduce un índice lógico (posición en la secuencia de reproducción)
   * a un índice real en el array `_tracks`.
   *
   * - Sin shuffle: identidad (lógico === real)
   * - Con shuffle: usa la tabla de indirección `_shuffleOrder`
   */
  private resolveIndex(logicalIndex: number): number {
    if (!this._isShuffled) return logicalIndex;

    const resolved = this._shuffleOrder[logicalIndex];
    if (resolved === undefined) return -1;
    return resolved;
  }

  // ── Mutaciones: Agregar ───────────────────────────────────

  /**
   * Agrega un track al final de la cola.
   * Si shuffle está activo, lo inserta en una posición aleatoria
   * DESPUÉS del índice actual en `_shuffleOrder`.
   *
   * @returns Nuevo tamaño de la cola
   */
  addTrack(track: Track): number {
    this._tracks.push(track);
    const newRealIndex = this._tracks.length - 1;

    if (this._isShuffled) {
      // Insertar en posición aleatoria después del track actual
      const insertAfter = this._currentIndex + 1;
      const insertAt = insertAfter + Math.floor(
        Math.random() * (this._shuffleOrder.length - insertAfter + 1),
      );
      this._shuffleOrder.splice(insertAt, 0, newRealIndex);
    }

    return this._tracks.length;
  }

  /**
   * Agrega múltiples tracks al final de la cola.
   *
   * @returns Nuevo tamaño de la cola
   */
  addTracks(tracks: Track[]): number {
    for (const track of tracks) {
      this.addTrack(track);
    }
    return this._tracks.length;
  }

  // ── Mutaciones: Eliminar ──────────────────────────────────

  /**
   * Elimina un track por su índice lógico.
   *
   * Ajusta `_currentIndex` y `_shuffleOrder` según corresponda.
   * No permite eliminar el track actualmente en reproducción.
   *
   * @param logicalIndex - Posición lógica en la secuencia de reproducción
   * @returns El track eliminado, o null si el índice es inválido
   */
  removeTrack(logicalIndex: number): Track | null {
    if (logicalIndex < 0 || logicalIndex >= this._tracks.length) return null;
    if (logicalIndex === this._currentIndex) return null; // No permitir eliminar track actual

    const realIndex = this.resolveIndex(logicalIndex);
    if (realIndex < 0 || realIndex >= this._tracks.length) return null;

    const [removed] = this._tracks.splice(realIndex, 1);

    if (this._isShuffled) {
      // Eliminar de shuffleOrder y ajustar índices reales
      this._shuffleOrder.splice(logicalIndex, 1);
      this._shuffleOrder = this._shuffleOrder.map(
        (idx) => (idx > realIndex ? idx - 1 : idx),
      );
    }

    // Ajustar currentIndex si el eliminado estaba antes
    if (logicalIndex < this._currentIndex) {
      this._currentIndex--;
    }

    return removed ?? null;
  }

  // ── Mutaciones: Navegación ────────────────────────────────

  /**
   * Avanza al siguiente track según el modo de repetición.
   *
   * - OFF: Avanza linealmente; retorna null al final de la cola.
   * - TRACK: Retorna el mismo track (sin mover el índice).
   * - QUEUE: Vuelve al inicio al llegar al final.
   *
   * @returns El siguiente track, o null si no hay más
   */
  next(): Track | null {
    if (this.isEmpty()) return null;

    switch (this._repeatMode) {
      case RepeatMode.TRACK:
        // Mantener el índice, retornar el mismo track
        return this.getCurrent();

      case RepeatMode.QUEUE:
        this._currentIndex = (this._currentIndex + 1) % this.size();
        return this.getCurrent();

      case RepeatMode.OFF:
      default: {
        const nextIndex = this._currentIndex + 1;
        if (nextIndex >= this.size()) {
          return null; // Fin de la cola
        }
        this._currentIndex = nextIndex;
        return this.getCurrent();
      }
    }
  }

  /**
   * Retrocede al track anterior.
   *
   * - Si el modo es QUEUE, cicla al final al retroceder desde el inicio.
   * - Si el modo es OFF, no retrocede más allá del primer track.
   *
   * @returns El track anterior, o null si no es posible retroceder
   */
  previous(): Track | null {
    if (this.isEmpty()) return null;

    switch (this._repeatMode) {
      case RepeatMode.TRACK:
        return this.getCurrent();

      case RepeatMode.QUEUE: {
        this._currentIndex =
          this._currentIndex <= 0 ? this.size() - 1 : this._currentIndex - 1;
        return this.getCurrent();
      }

      case RepeatMode.OFF:
      default: {
        if (this._currentIndex <= 0) {
          return null; // Ya estamos en el primer track
        }
        this._currentIndex--;
        return this.getCurrent();
      }
    }
  }

  /**
   * Salta directamente a un índice lógico específico.
   *
   * @param logicalIndex - Posición lógica de destino (0-based)
   * @returns El track en la posición indicada, o null si inválido
   */
  skipTo(logicalIndex: number): Track | null {
    if (logicalIndex < 0 || logicalIndex >= this.size()) return null;
    this._currentIndex = logicalIndex;
    return this.getCurrent();
  }

  // ── Mutaciones: Shuffle ───────────────────────────────────

  /**
   * Activa el modo shuffle usando el algoritmo Fisher-Yates.
   *
   * Genera un array de índices barajados que mapean posiciones lógicas
   * a posiciones reales en `_tracks`. El track actual se mueve a la
   * posición 0 del `_shuffleOrder` para que continue reproduciéndose.
   *
   * Complejidad: O(n)
   */
  shuffle(): void {
    if (this._isShuffled || this.size() <= 1) return;

    const currentRealIndex = this._currentIndex;

    // Crear array de índices [0, 1, 2, ..., n-1]
    this._shuffleOrder = Array.from({ length: this.size() }, (_, i) => i);

    // Fisher-Yates shuffle (desde el final hacia el inicio)
    for (let i = this._shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._shuffleOrder[i]!, this._shuffleOrder[j]!] = [
        this._shuffleOrder[j]!,
        this._shuffleOrder[i]!,
      ];
    }

    // Mover el track actual a la posición 0 del shuffleOrder
    // para que la reproducción continúe sin interrupción
    const currentShufflePos = this._shuffleOrder.indexOf(currentRealIndex);
    if (currentShufflePos > 0) {
      [this._shuffleOrder[0]!, this._shuffleOrder[currentShufflePos]!] = [
        this._shuffleOrder[currentShufflePos]!,
        this._shuffleOrder[0]!,
      ];
    }

    this._currentIndex = 0;
    this._isShuffled = true;
  }

  /**
   * Desactiva el shuffle y restaura el orden original.
   *
   * Traduce el `_currentIndex` de posición lógica (shuffle) a posición
   * real, de modo que el track actual siga siendo el mismo.
   */
  unshuffle(): void {
    if (!this._isShuffled) return;

    // Traducir posición actual de shuffle a posición real
    const realIndex = this.resolveIndex(this._currentIndex);
    this._currentIndex = realIndex;
    this._shuffleOrder = [];
    this._isShuffled = false;
  }

  // ── Mutaciones: Estado ────────────────────────────────────

  /**
   * Vacía completamente la cola y reinicia el índice.
   */
  clear(): void {
    this._tracks = [];
    this._currentIndex = -1;
    this._shuffleOrder = [];
    this._isShuffled = false;
  }

  /**
   * Establece el modo de repetición.
   */
  setRepeatMode(mode: RepeatMode): void {
    this._repeatMode = mode;
  }

  // ── Consultas ─────────────────────────────────────────────

  /**
   * Retorna el track actualmente en reproducción.
   * Resuelve correctamente tanto con shuffle activo como sin él.
   *
   * @returns Track actual o null si la cola está vacía/sin iniciar
   */
  getCurrent(): Track | null {
    if (this.isEmpty() || this._currentIndex < 0) return null;

    const realIndex = this.resolveIndex(this._currentIndex);
    return this._tracks[realIndex] ?? null;
  }

  /**
   * Retorna los próximos tracks en la secuencia de reproducción.
   *
   * @param limit - Máximo de tracks a retornar (default: 10)
   * @returns Array de tracks que vienen después del actual
   */
  getUpcoming(limit: number = 10): Track[] {
    const upcoming: Track[] = [];
    const maxItems = Math.min(limit, this.size() - this._currentIndex - 1);

    for (let i = 1; i <= maxItems; i++) {
      const logicalIndex = this._currentIndex + i;
      if (logicalIndex >= this.size()) break;

      const realIndex = this.resolveIndex(logicalIndex);
      const track = this._tracks[realIndex];
      if (track) upcoming.push(track);
    }

    return upcoming;
  }

  /**
   * Retorna los tracks reproducidos anteriormente (historial).
   *
   * @param limit - Máximo de tracks a retornar (default: 10)
   * @returns Array de tracks anteriores al actual (más reciente primero)
   */
  getHistory(limit: number = 10): Track[] {
    const history: Track[] = [];
    const maxItems = Math.min(limit, this._currentIndex);

    for (let i = 1; i <= maxItems; i++) {
      const logicalIndex = this._currentIndex - i;
      if (logicalIndex < 0) break;

      const realIndex = this.resolveIndex(logicalIndex);
      const track = this._tracks[realIndex];
      if (track) history.push(track);
    }

    return history;
  }

  /**
   * Retorna el número total de tracks en la cola.
   */
  size(): number {
    return this._tracks.length;
  }

  /**
   * Indica si la cola está vacía.
   */
  isEmpty(): boolean {
    return this._tracks.length === 0;
  }

  /**
   * Calcula la duración total de todos los tracks en la cola (en ms).
   * Excluye livestreams (duration = 0) del cálculo.
   */
  totalDuration(): number {
    return this._tracks.reduce(
      (total, track) => total + (track.info.isStream ? 0 : track.info.duration),
      0,
    );
  }

  // ── Método de conveniencia: iniciar reproducción ──────────

  /**
   * Establece el índice de reproducción al primer track.
   * Llamar después de agregar tracks a una cola vacía para iniciar.
   *
   * @returns El primer track, o null si la cola está vacía
   */
  start(): Track | null {
    if (this.isEmpty()) return null;
    this._currentIndex = 0;
    return this.getCurrent();
  }
}
