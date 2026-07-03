# 🧪 Guía de Pruebas de Audio y Funcionalidades — Fase 2

Esta guía contiene los pasos específicos para verificar que las mejoras y correcciones de la **Fase 2** en la rama `rankine` funcionan correctamente en Discord.

---

## 1. Prueba de Autocompletado Inteligente (`/play`)

El bot ahora realiza búsquedas paralelas e intercaladas en **YouTube** y **Spotify** mientras escribes.

### Pasos de prueba:
1. Entra a tu servidor de Discord y escribe `/play` en un canal de texto.
2. Posiciónate sobre el parámetro `query`.
3. Comienza a escribir el nombre de una canción conocida (por ejemplo: `Gold Spandau`).
4. **Verificación:**
   - Después de escribir al menos 2 caracteres, deberías ver una ventana flotante de Discord con un listado de hasta 5 sugerencias de autocompletado.
   - Las sugerencias de YouTube deben tener el prefijo: 🔴
   - Las sugerencias de Spotify deben tener el prefijo: 🟢
5. Selecciona una sugerencia con las flechas y presiona Enter. El bot debe unirse al canal de voz y reproducir la canción inmediatamente.

---

## 2. Prueba de Reconexión Automática (Solución de "Player Zombie")

Corregimos el bug donde el bot se quedaba en silencio si se unía, se desconectaba por inactividad (o expulsión manual) e intentaba reproducir otra canción.

### Pasos de prueba:
1. Únete a un canal de voz en Discord.
2. Ejecuta `/play query: [canción]` para que el bot se una y comience a sonar.
3. Desconecta al bot manualmente (click derecho → Desconectar del canal de voz) o usa el comando `/stop`.
4. Espera 10 segundos.
5. Ejecuta un nuevo comando `/play query: [otra canción]`.
6. **Verificación:**
   - El bot debe unirse exitosamente al canal de voz y empezar a reproducir la música de inmediato.
   - Si revisas los logs con `docker logs discord-music-bot`, no debe haber errores de tipo `connect ECONNREFUSED` ni advertencias sobre sesiones muertas.

---

## 3. Prueba de Actualización Automática de Embeds (Avance de Cola Limpio)

El bot ahora edita el mensaje del embed existente cuando la canción cambia sola o se salta, manteniendo el chat limpio de mensajes duplicados.

### Pasos de prueba:
1. Agrega varias canciones cortas o de prueba a la cola:
   - `/play query: [canción 1]`
   - `/play query: [canción 2]`
   - `/play query: [canción 3]`
2. Verifica que el bot publique el embed inicial de reproducción.
3. Deja que la primera canción termine (o escribe `/skip` para forzar el avance).
4. **Verificación:**
   - El bot debe avanzar a la siguiente canción.
   - En lugar de enviar un mensaje nuevo al canal de texto, el embed original de "Reproduciendo ahora" debe **editarse** para mostrar el título y artista de la nueva canción (marcado con el encabezado `⏭ Siguiente en la cola`).

---

## 4. Prueba del Comando `/help`

Implementamos un listado completo y estéticamente premium de comandos para los usuarios.

### Pasos de prueba:
1. Ejecuta `/help` en cualquier canal de texto del servidor.
2. **Verificación:**
   - El bot debe responder de manera **efímera** (el mensaje solo es visible para ti, no satura el servidor).
   - El embed debe estar ordenado en secciones con emojis (`╔══ 🎶 REPRODUCCIÓN ══╗` y `╔══ 📋 INFORMACIÓN ══╗`) detallando cómo usar `/play`, `/skip`, `/pause`, `/resume`, `/stop`, `/queue`, `/nowplaying` y `/help`.

---

## 5. Prueba de Estabilidad de Spotify (Clientes OAuth Prioritarios)

Reordenamos los clientes en `lavalink/application.yml` para intentar primero los de TV/VR que usan autenticación segura de YouTube OAuth.

### Pasos de prueba:
1. Copia un enlace directo de Spotify (por ejemplo, de un single o playlist de Spotify).
2. Ejecuta `/play query: [URL de Spotify]`.
3. **Verificación:**
   - La canción debe empezar a sonar de manera rápida (el delay de resolución ISRC a YouTube Music debe ser inferior a 3-5 segundos).
   - Lavalink no debe arrojar logs de error de descifrado de firmas (`SignatureCipherManager`).
