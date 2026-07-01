// ═══════════════════════════════════════════════════════════════
// src/config/environment.ts
//
// Cargador y validador de variables de entorno tipado.
// Centraliza toda la configuración del bot con validación.
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config.js';

/**
 * Esquema de configuración tipado.
 * Todos los campos son requeridos; agregar valores por defecto según sea necesario.
 */
export interface AppConfig {
  // ── Discord ──────────────────────────────────────────────
  discord: {
    token: string;
    clientId: string;
    guildId?: string; // Opcional: para registrar comandos en dev
  };

  // ── Lavalink ─────────────────────────────────────────────
  lavalink: {
    host: string;
    port: number;
    password: string;
  };

  // ── Spotify API ──────────────────────────────────────────
  spotify: {
    clientId: string;
    clientSecret: string;
  };

  // ── Bot Settings ─────────────────────────────────────────
  bot: {
    defaultVolume: number; // 0-100
    maxQueueSize: number;
    inactivityTimeoutSeconds: number;
    prefix: string;
  };

  // ── Logging ──────────────────────────────────────────────
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    prettyPrint: boolean;
  };

  // ── Environment ──────────────────────────────────────────
  nodeEnv: 'production' | 'development';
}

/**
 * Carga y valida las variables de entorno.
 * Lanza un error si falta alguna variable requerida.
 * 
 * @throws {Error} Si falta una variable requerida o es inválida
 */
function loadEnvironment(): AppConfig {
  const requiredVars = {
    discord: ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'],
    lavalink: ['LAVALINK_HOST', 'LAVALINK_PORT', 'LAVALINK_PASSWORD'],
    spotify: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
  };

  const missing: string[] = [];

  // Validar variables requeridas
  for (const [group, vars] of Object.entries(requiredVars)) {
    for (const varName of vars) {
      if (!process.env[varName]) {
        missing.push(`${varName} (${group})`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno faltantes:\n  - ${missing.join('\n  - ')}\n\n` +
      'Copiar .env.example a .env y completar los valores.',
    );
  }

  // Validar valores numéricos
  const port = parseInt(process.env.LAVALINK_PORT ?? '2333', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('LAVALINK_PORT debe ser un número entre 1 y 65535');
  }

  const defaultVolume = parseInt(process.env.BOT_DEFAULT_VOLUME ?? '80', 10);
  if (isNaN(defaultVolume) || defaultVolume < 0 || defaultVolume > 100) {
    throw new Error('BOT_DEFAULT_VOLUME debe ser un número entre 0 y 100');
  }

  const maxQueueSize = parseInt(process.env.BOT_MAX_QUEUE_SIZE ?? '500', 10);
  if (isNaN(maxQueueSize) || maxQueueSize < 1) {
    throw new Error('BOT_MAX_QUEUE_SIZE debe ser un número > 0');
  }

  const inactivityTimeout = parseInt(process.env.BOT_INACTIVITY_TIMEOUT ?? '300', 10);
  if (isNaN(inactivityTimeout) || inactivityTimeout < 0) {
    throw new Error('BOT_INACTIVITY_TIMEOUT debe ser un número >= 0');
  }

  // Retornar configuración tipada
  return {
    discord: {
      token: process.env.DISCORD_TOKEN!,
      clientId: process.env.DISCORD_CLIENT_ID!,
      guildId: process.env.DISCORD_GUILD_ID,
    },
    lavalink: {
      host: process.env.LAVALINK_HOST ?? 'lavalink',
      port,
      password: process.env.LAVALINK_PASSWORD!,
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    },
    bot: {
      defaultVolume,
      maxQueueSize,
      inactivityTimeoutSeconds: inactivityTimeout,
      prefix: process.env.BOT_PREFIX ?? '!',
    },
    logging: {
      level: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error' | 'fatal',
      prettyPrint: process.env.NODE_ENV !== 'production',
    },
    nodeEnv: (process.env.NODE_ENV ?? 'development') as 'production' | 'development',
  };
}

// Singleton: carga una sola vez
let config: AppConfig | null = null;

/**
 * Obtiene la configuración global del bot.
 * La primera vez que se llama, valida y carga las variables de entorno.
 * 
 * @returns Configuración tipada
 * @throws {Error} Si las variables de entorno son inválidas
 */
export function getConfig(): AppConfig {
  if (!config) {
    config = loadEnvironment();
  }
  return config;
}

/**
 * Resetea la configuración (útil para tests).
 */
export function resetConfig(): void {
  config = null;
}
