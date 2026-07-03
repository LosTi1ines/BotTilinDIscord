// ═══════════════════════════════════════════════════════════════
// src/domain/entities/index.ts
//
// Exporta todas las entidades del dominio.
// ═══════════════════════════════════════════════════════════════

export type { Track, TrackInfo } from './Track.js';
export type { Playlist, PlaylistSource } from './Track.js';
export { createTrack, formatDuration } from './Track.js';
export { RepeatMode, Queue } from './Queue.js';
export type { IQueue } from './Queue.js';
export { PlayerStatus, GuildPlayerState, createDefaultFilters } from './PlayerState.js';
export type { PlayerState, AudioFilters } from './PlayerState.js';
