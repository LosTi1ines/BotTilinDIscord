<!-- ESTRUCTURA PASO 1: DOMINIO + CONFIGURACIÓN -->

# 📐 Paso 1: Estructura Base y Puertos del Dominio

## Estructura de Carpetas Creada

```
bot/
└── src/
    ├── index.ts                           ← Barrel export principal
    ├── config/
    │   ├── environment.ts                 ✅ NUEVO: Cargador + validación de .env
    │   └── index.ts
    ├── domain/                            ✅ COMPLETADO
    │   ├── index.ts
    │   ├── entities/
    │   │   ├── Track.ts                   ✅ Ya existía + factory functions
    │   │   ├── Queue.ts                   ✅ Ya existía + implementación completa
    │   │   ├── PlayerState.ts             ✅ Ya existía + enums
    │   │   └── index.ts                   ✅ NUEVO: Barrel export
    │   └── ports/                         ✅ NUEVO: Interfaces/Contratos
    │       ├── MusicPlayerPort.ts         ← IMusicPlayerPort
    │       ├── QueueManagerPort.ts        ← IQueueManager
    │       ├── LoggerPort.ts              ← ILogger + LogLevel enum
    │       ├── DiscordGatewayPort.ts      ← IDiscordGatewayPort
    │       └── index.ts
    ├── application/                       ⏳ PRÓXIMO PASO
    │   └── (Use Cases)
    ├── infrastructure/                    ⏳ PRÓXIMO PASO
    │   ├── lavalink/                      ← LavalinkAdapter (implementa IMusicPlayerPort)
    │   ├── discord/                       ← DiscordClient (implementa IDiscordGatewayPort)
    │   ├── state/                         ← InMemoryQueueManager (implementa IQueueManager)
    │   └── logger/                        ← PinoLogger (implementa ILogger)
    └── presentation/                      ⏳ PRÓXIMO PASO
        ├── commands/                      ← Slash commands (/play, /skip, etc.)
        ├── events/                        ← Event handlers (InteractionCreate, etc.)
        └── middleware/                    ← Guards (VoiceChannelGuard, etc.)
```

## Flujo de Inversión de Dependencias

```
        Presentation Layer
        (SlashCommands, Events)
                 ↓
        Application Layer
        (Use Cases)
                 ↓
        Domain Layer
        (Entities + Ports/Interfaces)
                 ↑
        Infrastructure Layer
        (Adapters que implementan los puertos)
```

### Ejemplo: Reproducción de música

```
User /play query
    ↓
PlayCommand (Presentation)
    ↓
PlayTrackUseCase (Application)
    ↓
Uses: IMusicPlayerPort + IQueueManager (Domain Ports)
    ↓
LavalinkAdapter + InMemoryQueueManager (Infrastructure)
    ↓
Shoukaku + Discord.js
```

## Interfaces Definidas (Contratos)

### 1. IMusicPlayerPort - Control de Reproducción
```typescript
interface IMusicPlayerPort {
  connect(guildId, voiceChannelId): Promise<void>
  play(guildId, track): Promise<void>
  pause(guildId): Promise<void>
  resume(guildId): Promise<void>
  skip(guildId): Promise<void>
  seek(guildId, positionMs): Promise<void>
  setVolume(guildId, volume 0-100): Promise<void>
  loadTracks(query): Promise<LoadResult>
  // ... más métodos
}
```

### 2. IQueueManager - Gestión de Colas
```typescript
interface IQueueManager {
  getOrCreate(guildId): IQueue
  get(guildId): IQueue | null
  destroy(guildId): void
  getActiveGuilds(): string[]
  clearAll(): void
}
```

### 3. ILogger - Logging Tipado
```typescript
interface ILogger {
  debug(message, context?): void
  info(message, context?): void
  warn(message, context?): void
  error(message, error?, context?): void
  fatal(message, error?, context?): void
}
```

### 4. IDiscordGatewayPort - Comunicación Discord
```typescript
interface IDiscordGatewayPort {
  connect(): Promise<void>
  replyToInteraction(interaction, options): Promise<void>
  registerGlobalCommands(commands): Promise<void>
  getGuild(guildId): Promise<Guild>
  // ... más métodos
}
```

## Configuración (environment.ts)

### Validación Automática de .env

```typescript
interface AppConfig {
  discord: { token, clientId, guildId? }
  lavalink: { host, port, password }
  spotify: { clientId, clientSecret }
  bot: { defaultVolume, maxQueueSize, inactivityTimeout, prefix }
  logging: { level, prettyPrint }
  nodeEnv: 'production' | 'development'
}
```

✅ **Valida:**
- Todas las variables requeridas presentes
- Puertos válidos (1-65535)
- Valores numéricos en rangos correctos
- Niveles de log válidos
- Volumen 0-100

❌ **Lanza error si falta algo** (seguridad)

---

## Resumen del Paso 1

| Componente | Estado | Archivos |
|-----------|--------|----------|
| **Carpetas** | ✅ Completadas | 9 directorios |
| **Configuración** | ✅ Implementada | 2 archivos |
| **Puertos (Interfaces)** | ✅ Completados | 4 interfaces |
| **Entidades** | ✅ Ya existían | 3 archivos existentes |
| **Barrel Exports** | ✅ Agregados | 3 archivos |
| **Total Nuevos** | ✅ | 13 archivos |

---

## Validación de Tipos

Todos los archivos usan TypeScript con tipos estrictos:

```bash
# Verificar tipos sin compilar
npm run typecheck

# Compilar TypeScript a JavaScript
npm run build

# Ejecutar linting
npm run lint
```

---

## Próximo Paso (Paso 2)

Implementar la **capa de infraestructura** (Adapters):

1. **LavalinkAdapter** - Implementa IMusicPlayerPort
   - Conectar con Lavalink usando Shoukaku
   - Mapear eventos de Lavalink a llamadas de métodos

2. **DiscordClient** - Implementa IDiscordGatewayPort
   - Inicializar discord.js
   - Registrar slash commands
   - Manejar interacciones

3. **InMemoryQueueManager** - Implementa IQueueManager
   - Map<guildId, Queue> para almacenar colas
   - Métodos de CRUD

4. **PinoLogger** - Implementa ILogger
   - Wrapper alrededor de pino
   - Logging estructurado

Una vez completados los adaptadores, el resto de capas (Application, Presentation) se conectarán automáticamente.
