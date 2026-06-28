import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Shoukaku, Connectors, type NodeOption } from 'shoukaku';
import { getConfig } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/Logger.js';
import { InMemoryQueueManager } from './infrastructure/state/InMemoryQueueManager.js';
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
import type { BotContext } from './presentation/commands/index.js';

async function bootstrap(): Promise<void> {
  // ── Config & Logger ─────────────────────────────────────────
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
  const lavalinkAdapter = new LavalinkAdapter(shoukaku, logger);

  // ── Event Handler (auto-advance queue) ───────────────────────
  new LavalinkEventHandler(
    lavalinkAdapter,
    lavalinkAdapter,
    queueManager,
    logger,
    config.bot.inactivityTimeoutSeconds,
  );

  // ── Use Cases ────────────────────────────────────────────────
  const ctx: BotContext = {
    playTrack: new PlayTrackUseCase(lavalinkAdapter, queueManager, logger),
    skipTrack: new SkipTrackUseCase(lavalinkAdapter, queueManager, logger),
    pauseResume: new PauseResumeUseCase(lavalinkAdapter, queueManager, logger),
    stop: new StopUseCase(lavalinkAdapter, queueManager, logger),
    viewQueue: new QueueViewUseCase(queueManager),
    nowPlaying: new NowPlayingUseCase(lavalinkAdapter, queueManager),
    logger,
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
    if (oldState.member?.id !== client.user?.id) return;
    if (oldState.channelId && !newState.channelId) {
      queueManager.destroy(oldState.guild.id);
    }
  });

  client.on(Events.Error, (err) => logger.error('Discord client error', err));

  // ── Graceful Shutdown ────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => { logger.fatal('Uncaught exception', err); process.exit(1); });
  process.on('unhandledRejection', (reason) => { logger.fatal('Unhandled rejection', reason); process.exit(1); });

  // ── Login ────────────────────────────────────────────────────
  await client.login(config.discord.token);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to start bot', err);
  process.exit(1);
});
