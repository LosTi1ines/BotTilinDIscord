// ═══════════════════════════════════════════════════════════════
// src/domain/ports/QueueManagerPort.ts
//
// Puerto para la gestión de colas por guild.
// Define el contrato para almacenar, recuperar y manipular colas.
// ═══════════════════════════════════════════════════════════════

import type { IQueue } from '../entities/Queue.js';

/**
 * Puerto de gestión de colas.
 * 
 * Abstracción que permite implementar diferentes estrategias
 * de almacenamiento de colas (en memoria, Redis, base de datos, etc.).
 * 
 * El adaptador (InMemoryQueueManager) implementa esta interfaz
 * usando un Map<guildId, Queue>.
 */
export interface IQueueManager {
  /**
   * Obtiene o crea la cola para un guild.
   * 
   * Si no existe, inicializa una nueva cola vacía.
   * 
   * @param guildId - ID del servidor Discord
   * @returns La cola del guild
   */
  getOrCreate(guildId: string): IQueue;

  /**
   * Obtiene la cola de un guild sin crear una nueva.
   * 
   * @param guildId - ID del servidor Discord
   * @returns La cola si existe, null en caso contrario
   */
  get(guildId: string): IQueue | null;

  /**
   * Verifica si existe una cola para un guild.
   * 
   * @param guildId - ID del servidor Discord
   */
  has(guildId: string): boolean;

  /**
   * Destruye la cola de un guild (libera memoria).
   * Típicamente se llama cuando el bot se desconecta del guild.
   * 
   * @param guildId - ID del servidor Discord
   */
  destroy(guildId: string): void;

  /**
   * Obtiene todos los guildIds que tienen colas activas.
   * 
   * @returns Array de IDs de guilds con colas
   */
  getActiveGuilds(): string[];

  /**
   * Destruye todas las colas (limpieza completa).
   */
  clearAll(): void;
}
