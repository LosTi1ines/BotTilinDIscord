// ═══════════════════════════════════════════════════════════════
// src/domain/ports/DiscordGatewayPort.ts
//
// Puerto de comunicación con Discord.
// Define el contrato para interactuar con la API de Discord
// (enviar mensajes, editar embeds, registrar comandos, etc.).
// ═══════════════════════════════════════════════════════════════

import type { Interaction, EmbedBuilder } from 'discord.js';

/**
 * Opciones para responder a una interacción de Discord.
 */
export interface InteractionReplyOptions {
  content?: string;
  embeds?: EmbedBuilder[];
  ephemeral?: boolean; // Solo visible para el usuario que ejecutó el comando
  components?: unknown[]; // Buttons, Select menus, etc.
}

/**
 * Puerto de comunicación con Discord.
 * 
 * Abstracción que encapsula la comunicación con Discord,
 * permitiendo desacoplar la lógica de comandos de la API específica.
 */
export interface IDiscordGatewayPort {
  /**
   * Inicia la conexión con Discord Gateway.
   * 
   * @throws Si el token es inválido o la conexión falla
   */
  connect(): Promise<void>;

  /**
   * Desconecta del Gateway y limpia recursos.
   */
  disconnect(): Promise<void>;

  /**
   * Verifica si el bot está conectado a Discord.
   */
  isConnected(): boolean;

  /**
   * Responde a una interacción (slash command).
   * 
   * @param interaction - La interacción de Discord
   * @param options - Contenido de la respuesta
   */
  replyToInteraction(interaction: Interaction, options: InteractionReplyOptions): Promise<void>;

  /**
   * Edita la respuesta de una interacción previa.
   * 
   * @param interaction - La interacción original
   * @param options - Contenido actualizado
   */
  editInteractionReply(interaction: Interaction, options: InteractionReplyOptions): Promise<void>;

  /**
   * Sigue una interacción con un mensaje adicional.
   * 
   * @param interaction - La interacción original
   * @param options - Contenido del follow-up
   */
  followUpInteraction(interaction: Interaction, options: InteractionReplyOptions): Promise<void>;

  /**
   * Registra los slash commands globalmente.
   * 
   * @param commands - Array de comandos a registrar
   */
  registerGlobalCommands(commands: unknown[]): Promise<void>;

  /**
   * Obtiene el usuario de Discord (para verificación).
   */
  getUser(userId: string): Promise<unknown>;

  /**
   * Obtiene el guild (servidor) de Discord.
   */
  getGuild(guildId: string): Promise<unknown>;

  /**
   * Obtiene el canal de voz.
   */
  getVoiceChannel(guildId: string, channelId: string): Promise<unknown>;

  /**
   * Envía un mensaje de error a un canal de log (opcional).
   */
  logError(guildId: string, error: string, context?: Record<string, unknown>): Promise<void>;
}
