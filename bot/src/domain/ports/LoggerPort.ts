// ═══════════════════════════════════════════════════════════════
// src/domain/ports/LoggerPort.ts
//
// Puerto de logging. Define el contrato para emitir logs
// desde la aplicación (debug, info, warn, error, fatal).
// ═══════════════════════════════════════════════════════════════

/**
 * Niveles de severidad de logs.
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Contexto opcional para logs estructurados.
 * 
 * Permite agregar campos adicionales a cada log entry
 * (ej: userId, guildId, requestId, etc.).
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Puerto de logging.
 * 
 * Abstracción que desacopla la aplicación de la librería de logging
 * específica (Pino, Winston, Bunyan, etc.).
 * 
 * El adaptador (PinoLogger) implementa esta interfaz.
 */
export interface ILogger {
  /**
   * Emite un log de debug.
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Emite un log informativo.
   */
  info(message: string, context?: LogContext): void;

  /**
   * Emite un log de advertencia.
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Emite un log de error.
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void;

  /**
   * Emite un log de error fatal (requiere acción inmediata).
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void;

  /**
   * Establece el nivel de logging mínimo.
   */
  setLevel(level: LogLevel): void;
}
