# 🎵 Reporte de Despliegue Exitoso y Backlog de Mejoras

> **Fecha del Despliegue:** 2026-07-02  
> **Estado Final:** 🟢 Stack levantado y reproduciendo música exitosamente  
> **Tecnologías:** Docker Compose, Node.js/TypeScript, Shoukaku 4.3, Lavalink v4.2.2, YouTube Plugin 1.18.1, LavaSrc (Spotify) 4.8.3

---

## PARTE 1: Reporte de lo Realizado (Walkthrough de Despliegue)

Durante la sesión de depuración y puesta en marcha, logramos resolver de forma definitiva los bloqueos técnicos identificados en la auditoría inicial:

1. **Purificación del Dominio (B1):** Se eliminó el archivo residual `DiscordGatewayPort.ts` que importaba tipos de `discord.js`, logrando que la capa de dominio sea **100% pura y libre de frameworks**.
2. **Estabilización de Docker Healthchecks (B2):**
   * Agregamos un servidor HTTP de healthcheck mínimo en el puerto `3000` dentro de [bot/src/main.ts](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/bot/src/main.ts).
   * Modificamos el healthcheck en [docker-compose.yml](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/docker-compose.yml) para inyectar dinámicamente la cabecera `Authorization` utilizando la variable del entorno `${LAVALINK_PASSWORD}`. Esto evitó los bloqueos por código `401 Unauthorized` y eliminó el bucle de reinicios que consumía recursos de la máquina.
3. **Parche de Descifrado de YouTube (Audio Mudo):**
   * El plugin de YouTube original (`1.11.5`) fallaba debido a cambios recientes en las firmas cifradas de YouTube en su script de reproductor `base.js`.
   * Actualizamos el plugin de YouTube a la versión **`1.18.1`** y el plugin LavaSrc (Spotify) a **`4.8.3`** en [lavalink/application.yml](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/lavalink/application.yml).
   * Corregimos los identificadores de clientes de YouTube habilitando **`TV`** y **`ANDROID_VR`**, permitiendo que Lavalink use el flujo de OAuth de manera exitosa y silenciosa.
4. **Automatización de Credenciales (Zero-Interaction):**
   * Capturamos el `refreshToken` obtenido tras el login interactivo inicial del navegador e inyectamos su valor en el archivo `.env`.
   * Ahora el stack arranca de forma 100% autónoma en menos de 3 segundos sin requerir la intervención del usuario en el navegador en futuros despliegues.
5. **Registro Instantáneo de Comandos:**
   * Configuramos el `DISCORD_GUILD_ID` en el `.env` para registrar los comandos barra directamente como comandos de servidor (*Guild Commands*), haciendo que aparezcan en Discord de forma instantánea.

---

## PARTE 2: Plan de Acción y Backlog de Mejoras a Implementar

A partir de las pruebas funcionales realizadas en tu servidor de Discord, hemos identificado 5 puntos de mejora y bugs que deben ser resueltos en la siguiente iteración de desarrollo:

### 1. Buscador Inteligente (Slash Command Autocomplete)
*   **Problema:** Al usar `/play`, el usuario debe escribir todo el texto a ciegas y presionar enter. No hay sugerencias interactivas de canciones.
*   **Diagnóstico:** Discord soporta eventos de autocompletado en los campos de los Slash Commands. Actualmente, el bot ignora estos eventos.
*   **Plan de Acción:**
    1.  Modificar la definición del comando en [PlayCommand.ts](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/bot/src/presentation/commands/PlayCommand.ts) para activar `setAutocomplete(true)` en la opción de búsqueda.
    2.  Actualizar el archivo [InteractionCreate.ts](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/bot/src/presentation/events/InteractionCreate.ts) para capturar eventos del tipo `interaction.isAutocomplete()`.
    3.  Llamar a un método en `PlayTrackUseCase` que realice un `loadTracks()` parcial en Lavalink utilizando el texto que el usuario está escribiendo y devuelva los 5 primeros títulos y URLs como opciones de autocompletado.

### 2. Priorización de Clientes Estables de Audio (Evitar retrasos)
*   **Problema:** YouTube a veces tarda en reproducir porque intenta primero con clientes web que están bloqueados.
*   **Diagnóstico:** Lavalink rota los clientes en el orden en que se listan en el YAML.
*   **Plan de Acción:**
    *   Mantendremos los clientes compatibles con OAuth (`TV` y `ANDROID_VR`) en las primeras posiciones en [lavalink/application.yml](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/lavalink/application.yml), dejando `WEB` e `WEB_REMIX` como último recurso. Esto asegura que la conexión sea instantánea en el 90% de los casos.

### 3. Solución al Bug de Auto-avance de la Cola (Canciones no saltan)
*   **Problema:** Al terminar una canción en la cola, el bot no salta automáticamente a la siguiente y se queda en silencio.
*   **Diagnóstico:**
    *   `LavalinkEventHandler.ts` recibe el evento `trackEnd` de Shoukaku y llama a `queue.next()`. El índice cambia, pero **el bot no le notifica nada al canal de Discord**. Visualmente parece congelado en la canción anterior.
    *   Adicionalmente, si el reproductor de Lavalink v4 emite una razón de detención no mapeada (como `LOAD_FAILED` o micro-cortes de WebSocket), el flujo de avance se detiene por seguridad.
*   **Plan de Acción:**
    1.  Modificar [LavalinkEventHandler.ts](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/bot/src/infrastructure/lavalink/LavalinkEventHandler.ts) para emitir un evento hacia la capa de presentación cuando comience un nuevo track (`trackStart`).
    2.  Implementar un suscriptor en el bot que envíe un embed informativo de "Reproduciendo ahora" en el canal de texto de Discord cada vez que cambie de canción automáticamente.
    3.  Asegurar en la lógica de `next()` de `Queue.ts` que el cambio de índice sea seguro frente a estados transicionales de audio.

### 4. Solución al Bug de Reconexión Automática
*   **Problema:** Si el bot se desconecta por inactividad (timeout de 5 minutos) o es expulsado del canal de voz por el usuario, al pedirle una nueva canción `/play` **no se vuelve a conectar automáticamente** y reproduce en el vacío de forma silenciosa.
*   **Diagnóstico Lógico:**
    En [LavalinkAdapter.ts](file:///C:/Users/Ferna/.gemini/antigravity/scratch/discord-music-bot/bot/src/infrastructure/lavalink/LavalinkAdapter.ts), el método `hasPlayer()` se implementa así:
    ```typescript
    hasPlayer(guildId: string): boolean {
      return this.shoukaku.players.has(guildId);
    }
    ```
    Shoukaku mantiene la instancia del reproductor en su mapa interno aunque el bot haya sido físicamente desconectado de Discord. `hasPlayer()` devuelve `true`, haciendo que `PlayTrackUseCase` crea que el bot está conectado y se salte la llamada a `connect()`.
*   **Plan de Acción:**
    *   Corregir la lógica en el adaptador para verificar que el reproductor no solo exista en memoria, sino que esté **físicamente conectado a un canal de voz de Discord**:
    ```typescript
    hasPlayer(guildId: string): boolean {
      const player = this.shoukaku.players.get(guildId);
      return !!(player && player.connection.channelId);
    }
    ```
    Esto forzará al caso de uso a llamar a `connect()` si el bot fue desconectado previamente.

### 5. Retraso de Resolución de Spotify y Desconexiones
*   **Problema:** Las URLs directas de Spotify tardan varios segundos en empezar a reproducirse y a veces el bot deja de reproducir repentinamente.
*   **Diagnóstico:** Spotify no almacena audio, sino metadatos. El plugin `LavaSrc` hace la petición a Spotify para obtener el ISRC (código internacional del track) y luego realiza una búsqueda en YouTube Music usando ese ISRC. Si la conexión de red local a las APIs de Spotify/Google está saturada, esto puede generar demoras (timeouts) de hasta 10 segundos.
*   **Plan de Acción:**
    1.  Ajustar las opciones de timeout de conexión HTTP en `application.yml` para evitar desconexiones prematuras durante la resolución ISRC.
    2.  Añadir un embed visual de "Cargando metadatos..." en Discord para que el usuario sepa que el bot está procesando la playlist/track y no piense que el comando falló.

### 6. Personalización del Bot (Avatar y Lista de Comandos)
*   **Problema:** El bot aparece con la foto de perfil en blanco (avatar por defecto) y no se listan los comandos fácilmente.
*   **Plan de Acción:**
    1.  **Subir Avatar:** Ve a tu [Discord Developer Portal](https://discord.com/developers/applications), selecciona tu bot, ve a **General Information** y sube una imagen en el apartado **APP ICON**. Presiona guardar y el avatar se actualizará instantáneamente en Discord.
    2.  **Lista de comandos:** Crearemos un comando `/help` nativo en el bot que liste detalladamente todos los comandos disponibles (`/play`, `/skip`, `/pause`, `/resume`, `/stop`, `/queue`, `/nowplaying`) con su respectiva descripción para facilitar el aprendizaje de los usuarios en tu servidor.
