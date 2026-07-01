import type { Interaction } from 'discord.js';
import type { BotContext, Command } from '../commands/index.js';
import type { ILogger } from '../../domain/ports/LoggerPort.js';

export function handleInteractionCreate(
  interaction: Interaction,
  commands: Map<string, Command>,
  ctx: BotContext,
  logger: ILogger,
): void {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  logger.debug('Command invoked', {
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? 'DM',
  });

  command.execute(interaction, ctx).catch(async (err: unknown) => {
    logger.error('Command failed', err, { command: interaction.commandName });
    const msg = { content: 'Ocurrió un error al ejecutar el comando.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch { /* ignore secondary failure */ }
  });
}
