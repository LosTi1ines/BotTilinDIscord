import type { Interaction } from 'discord.js';
import type { BotContext, Command } from '../commands/index.js';
import type { ILogger } from '../../domain/ports/LoggerPort.js';

export function handleInteractionCreate(
  interaction: Interaction,
  commands: Map<string, Command>,
  ctx: BotContext,
  logger: ILogger,
): void {
  // ── Autocompletado ───────────────────────────────────────────
  // Debe evaluarse ANTES del guard isChatInputCommand()
  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    command.autocomplete(interaction, ctx).catch((err: unknown) => {
      logger.warn('Autocomplete handler failed', { command: interaction.commandName, err });
      // Intentar responder vacío para que Discord no muestre error de timeout
      interaction.respond([]).catch(() => { /* ignore */ });
    });
    return;
  }

  // ── Comandos normales de chat ────────────────────────────────
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
