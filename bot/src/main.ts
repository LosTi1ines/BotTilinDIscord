import { createServer } from 'node:http';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Shoukaku, Connectors, type NodeOption } from 'shoukaku';
import { getConfig } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/Logger.js';
import { InMemoryQueueManager } from './infrastructure/state/InMemoryQueueManager.js';
import { GuildStateStore } from './infrastructure/state/GuildStateStore.js';
import { LavalinkAdapter } from './infrastructure/lavalink/LavalinkAdapter.js';
import { LavalinkEventHandler } from './infrastructure/lavalink/LavalinkEventHandler.js';
import { PlayTrackUseCase } from './application/PlayTrackUseCase.js';
import { SkipTrackUseCase } from './application/SkipTrackUseCase.js';
import { PauseResumeUseCase } from './application/PauseResumeUseCase.js';
import { StopUseCase } from './application/StopUseCase.js';
import { QueueViewUseCase } from './application/QueueViewUseCase.js';
import { NowPlayingUseCase } from './application/NowPlayingUseCase.js';
import { buildCommandRegistry } from './presentation/commands/index.js';
import { handleInteractionCreate } from './presentation/events/InteractionCreate.js';
import { handleReady } from './presentation/events/Ready.js';
import { buildAutoNowPlayingEmbed } from './presentation/embeds/MusicEmbeds.js';
import type { BotContext } from './presentation/commands/index.js';
import type { Track } from './domain/entities/Track.js';

async function bootstrap(): Promise<void> {
  // ── Config & Logger ──────────────────────────────────────────
  const config = getConfig();
  const logger = new PinoLogger(config.logging.level, config.logging.prettyPrint);
  logger.info('Starting Discord Music Bot', { env: config.nodeEnv });

  // ── Discord Client ───────────────────────────────────────────
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  // ── Shoukaku (Lavalink) ──────────────────────────────────────
  const nodes: NodeOption[] = [{
    name: 'main',
    url: `${config.lavalink.host}:${config.lavalink.port}`,
    auth: config.lavalink.password,
  }];

  const shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    nodes,
    { reconnectTries: 5, reconnectInterval: 5000, resume: false, moveOnDisconnect: false },
  );

  // ── Infrastructure ───────────────────────────────────────────
  const queueManager = new InMemoryQueueManager();
  const guildStateStore = new GuildStateStore();
  const lavalinkAdapter = new LavalinkAdapter(shoukaku, logger);

  // ── Event Handler (auto-advance queue + nowPlaying events) ───
  const eventHandler = new LavalinkEventHandler(
    lavalinkAdapter,
    lavalinkAdapter,
    queueManager,
    logger,
    config.bot.inactivityTimeoutSeconds,
  );

  // Cuando la cola avanza automáticamente, editar el embed anterior en Discord
  eventHandler.on('nowPlaying', async (guildId: string, track: Track) => {
    const state = guildStateStore.get(guildId);
    if (!state?.textChannelId) return;

    try {
      const channel = client.channels.cache.get(state.textChannelId);
      // Verificar que sea un canal de guild con capacidad de enviar mensajes
      // (excluye PartialGroupDMChannel y DMs que no tienen .send fiable en bots)
      if (!channel || !('send' in channel) || channel.isDMBased()) return;

      const embed = buildAutoNowPlayingEmbed(track);

      if (state.nowPlayingMessageId) {
        // Editar el mensaje existente (chat más limpio)
        const msg = await channel.messages.fetch(state.nowPlayingMessageId).catch(() => null);
        if (msg?.editable) {
          await msg.edit({ embeds: [embed] });
          return;
        }
      }

      // Si no hay mensaje previo o no se puede editar, enviar uno nuevo
      const sent = await channel.send({ embeds: [embed] });
      guildStateStore.setNowPlayingMessage(guildId, sent.id);
    } catch (err) {
      logger.warn('Failed to update now-playing embed', { guildId, err });
    }
  });

  // Limpiar estado del guild cuando el player se cierra
  eventHandler.on('playerClosed', (guildId: string) => {
    guildStateStore.delete(guildId);
  });

  // ── Use Cases ────────────────────────────────────────────────
  const ctx: BotContext = {
    playTrack: new PlayTrackUseCase(lavalinkAdapter, queueManager, logger, guildStateStore),
    skipTrack: new SkipTrackUseCase(lavalinkAdapter, queueManager, logger),
    pauseResume: new PauseResumeUseCase(lavalinkAdapter, queueManager, logger),
    stop: new StopUseCase(lavalinkAdapter, queueManager, logger),
    viewQueue: new QueueViewUseCase(queueManager),
    nowPlaying: new NowPlayingUseCase(lavalinkAdapter, queueManager),
    logger,
    guildStateStore,
  };

  // ── Commands ─────────────────────────────────────────────────
  const commands = buildCommandRegistry();

  // ── Shoukaku Events ──────────────────────────────────────────
  shoukaku.on('ready', (name) => logger.info('Lavalink node connected', { node: name }));
  shoukaku.on('error', (name, err) => logger.error('Lavalink node error', err, { node: name }));
  shoukaku.on('close', (name, code) => logger.warn('Lavalink node closed', { node: name, code }));
  shoukaku.on('disconnect', (name, moved) => logger.warn('Lavalink node disconnected', { node: name, moved }));

  // ── Discord Events ───────────────────────────────────────────
  client.once(Events.ClientReady, (readyClient) => {
    logger.info('Bot online', { tag: readyClient.user.tag, guilds: readyClient.guilds.cache.size });
    handleReady(readyClient, commands, config, logger).catch(err => {
      logger.error('Failed to register slash commands', err);
    });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    handleInteractionCreate(interaction, commands, ctx, logger);
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    // Solo nos importan los cambios de estado del propio bot
    if (oldState.member?.id !== client.user?.id) return;

    // Bot fue desconectado del canal de voz (manualmente o por inactividad)
    if (oldState.channelId && !newState.channelId) {
      const guildId = oldState.guild.id;
      queueManager.destroy(guildId);
      guildStateStore.delete(guildId);
      // Destruir el player de Lavalink para evitar estado zombie
      void lavalinkAdapter.destroyPlayer(guildId);
    }
  });

  client.on(Events.Error, (err) => logger.error('Discord client error', err));

  // ── Graceful Shutdown ────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    void client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => { logger.fatal('Uncaught exception', err); process.exit(1); });
  process.on('unhandledRejection', (reason) => { logger.fatal('Unhandled rejection', reason); process.exit(1); });

  // ── Login ────────────────────────────────────────────────────
  await client.login(config.discord.token);

  // ── Health Check Server (para Docker) ─────────────────────
  const healthServer = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  healthServer.listen(3000, () => logger.debug('Health server listening', { port: 3000 }));
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to start bot', err);
  process.exit(1);
});
