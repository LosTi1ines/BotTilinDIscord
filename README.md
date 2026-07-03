# Orpheus

[![CI](https://github.com/LosTi1ines/Orpheus/actions/workflows/ci.yml/badge.svg)](https://github.com/LosTi1ines/Orpheus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Bot de música privado para Discord. Reproduce desde YouTube, YouTube Music y
Spotify (resolución por ISRC) apoyándose en [Lavalink](https://github.com/lavalink-devs/Lavalink),
de modo que la extracción de audio vive en un servidor dedicado y actualizable
— no en el bot. Cuando YouTube cambia algo, se actualiza un plugin; el bot no se toca.

## Comandos

| Comando | Descripción |
|---|---|
| `/play <búsqueda o URL>` | Reproduce una canción o la añade a la cola. Autocompletado con resultados de YouTube y Spotify. |
| `/skip` | Salta el track actual. |
| `/pause` / `/resume` | Pausa y reanuda la reproducción. |
| `/queue` | Muestra la cola de reproducción. |
| `/nowplaying` | Muestra el track en reproducción. |
| `/stop` | Detiene todo, limpia la cola y desconecta al bot. |
| `/help` | Lista los comandos disponibles. |

## Arquitectura

Dos servicios orquestados con Docker Compose:

```
┌─────────────────┐   WebSocket / REST   ┌──────────────────────┐
│  bot (Node.js)  │ ───────────────────► │  Lavalink v4 (Java)  │
│  discord.js 14  │                      │  · youtube-source    │
│  Shoukaku 4     │                      │  · LavaSrc (Spotify) │
└─────────────────┘                      └──────────────────────┘
   plano de control                          plano de datos (audio)
```

El bot sigue una arquitectura por capas (dominio → aplicación → infraestructura →
presentación): las entidades de dominio (`Queue`, `Track`) no conocen Discord ni
Lavalink, y los adaptadores externos se conectan mediante puertos.

```
bot/src/
  domain/          entidades y puertos (sin dependencias externas)
  application/     casos de uso (play, skip, pause, stop, queue, nowplaying)
  infrastructure/  adaptadores: Lavalink (Shoukaku), estado en memoria, logger
  presentation/    slash commands, embeds y eventos de Discord
lavalink/          application.yml: config del servidor y sus plugins
```

## Puesta en marcha

Requisitos: Docker y Docker Compose.

1. **Crear la aplicación de Discord** en el
   [Developer Portal](https://discord.com/developers/applications): copiar el
   *token* del bot y el *Application ID*, e invitar el bot a tu servidor con los
   permisos de voz (`Connect`, `Speak`) y `applications.commands`.

2. **Configurar el entorno:**

   ```bash
   cp .env.example .env
   # completar DISCORD_TOKEN, DISCORD_CLIENT_ID y las credenciales de Spotify
   ```

3. **Levantar el stack:**

   ```bash
   docker compose up -d --build
   docker compose logs -f bot
   ```

4. **YouTube OAuth (primera vez):** Lavalink imprime en sus logs un enlace para
   autorizar una cuenta de Google. Tras autorizar, copiar el *refresh token* a
   `YOUTUBE_OAUTH_REFRESH_TOKEN` en `.env` y poner
   `YOUTUBE_OAUTH_SKIP_INITIALIZATION=true`.

### Variables principales

| Variable | Descripción |
|---|---|
| `DISCORD_TOKEN` / `DISCORD_CLIENT_ID` | Credenciales del bot ([Developer Portal](https://discord.com/developers/applications)). |
| `DISCORD_GUILD_ID` | Opcional: registra los comandos solo en ese servidor (registro instantáneo, ideal en desarrollo). |
| `LAVALINK_PASSWORD` | Contraseña compartida bot ↔ Lavalink. Generar una fuerte: `openssl rand -hex 32`. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Credenciales de la [API de Spotify](https://developer.spotify.com/dashboard). |
| `SPOTIFY_SP_DC` | Opcional: cookie de sesión para playlists algorítmicas (Daily Mix, Discover). |

La lista completa, con comentarios, está en [`.env.example`](.env.example).

## Desarrollo

Requisitos: Node.js 22+ y pnpm 9 (`corepack enable`).

```bash
cd bot
pnpm install
pnpm run dev        # modo watch contra un Lavalink levantado (LAVALINK_HOST=localhost)
pnpm run lint       # ESLint
pnpm run typecheck  # tsc --noEmit
```

Guías adicionales en [`docs/`](docs/): equivalencias de shell para el equipo
multiplataforma y pruebas manuales de audio.

## Modelo de despliegue

Cada integrante levanta **su propia instancia** con su propio token: Discord no
permite dos procesos con el mismo token, y las instancias separadas dan
redundancia de IP frente a los bloqueos de YouTube. Los secretos viven en el
`.env` local de cada uno y nunca se suben al repositorio.

## Licencia

[MIT](LICENSE) © LosTi1ines
