import pino from 'pino';
import type { ILogger, LogContext } from '../../domain/ports/LoggerPort.js';
import { LogLevel } from '../../domain/ports/LoggerPort.js';

export class PinoLogger implements ILogger {
  private readonly logger: ReturnType<typeof pino>;

  constructor(level: string = 'info', pretty: boolean = false) {
    this.logger = pino({
      level,
      ...(pretty && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }),
    });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context ?? {}, message);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context ?? {}, message);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context ?? {}, message);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : error !== undefined ? new Error(String(error)) : undefined;
    this.logger.error({ err, ...context }, message);
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : error !== undefined ? new Error(String(error)) : undefined;
    this.logger.fatal({ err, ...context }, message);
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }
}
