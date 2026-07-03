import type { Client } from 'discord.js';
import type { Command } from '../commands/index.js';
import type { AppConfig } from '../../config/index.js';
import type { ILogger } from '../../domain/ports/LoggerPort.js';

export async function handleReady(
  client: Client<true>,
  commands: Map<string, Command>,
  config: AppConfig,
  logger: ILogger,
): Promise<void> {
  const commandData = [...commands.values()].map(c => c.data.toJSON());

  if (config.discord.guildId) {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (guild) {
      await guild.commands.set(commandData);
      logger.info('Slash commands registered (guild)', { guildId: config.discord.guildId, count: commandData.length });
    }
  } else {
    await client.application.commands.set(commandData);
    logger.info('Slash commands registered (global)', { count: commandData.length });
  }
}
