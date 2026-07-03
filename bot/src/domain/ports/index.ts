// ═══════════════════════════════════════════════════════════════
// src/domain/ports/index.ts
//
// Exporta todos los puertos (interfaces) del dominio.
// ═══════════════════════════════════════════════════════════════

export type { IMusicPlayerPort, LoadResult, RawTrack, PlaylistMetadata } from './MusicPlayerPort.js';
export type { IQueueManager } from './QueueManagerPort.js';
export type { ILogger, LogContext } from './LoggerPort.js';
export { LogLevel } from './LoggerPort.js';
