import type { ChatInputCommandInteraction, AutocompleteInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { PlayTrackUseCase } from '../../application/PlayTrackUseCase.js';
import type { SkipTrackUseCase } from '../../application/SkipTrackUseCase.js';
import type { PauseResumeUseCase } from '../../application/PauseResumeUseCase.js';
import type { StopUseCase } from '../../application/StopUseCase.js';
import type { QueueViewUseCase } from '../../application/QueueViewUseCase.js';
import type { NowPlayingUseCase } from '../../application/NowPlayingUseCase.js';
import type { ILogger } from '../../domain/ports/LoggerPort.js';
import type { GuildStateStore } from '../../infrastructure/state/GuildStateStore.js';

import * as Play from './PlayCommand.js';
import * as Skip from './SkipCommand.js';
import * as Pause from './PauseCommand.js';
import * as Resume from './ResumeCommand.js';
import * as Stop from './StopCommand.js';
import * as Queue from './QueueCommand.js';
import * as NowPlaying from './NowPlayingCommand.js';
import * as Help from './HelpCommand.js';

export interface BotContext {
  playTrack: PlayTrackUseCase;
  skipTrack: SkipTrackUseCase;
  pauseResume: PauseResumeUseCase;
  stop: StopUseCase;
  viewQueue: QueueViewUseCase;
  nowPlaying: NowPlayingUseCase;
  logger: ILogger;
  guildStateStore: GuildStateStore;
}

export interface Command {
  data: { readonly name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction, ctx: BotContext): Promise<void>;
  /** Handler de autocompletado (opcional — solo comandos que lo necesiten) */
  autocomplete?(interaction: AutocompleteInteraction, ctx: BotContext): Promise<void>;
}

const allCommands: Command[] = [Play, Skip, Pause, Resume, Stop, Queue, NowPlaying, Help];

export function buildCommandRegistry(): Map<string, Command> {
  const map = new Map<string, Command>();
  for (const cmd of allCommands) {
    map.set(cmd.data.name, cmd);
  }
  return map;
}
