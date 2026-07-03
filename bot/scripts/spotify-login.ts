// ═══════════════════════════════════════════════════════════════
// scripts/spotify-login.ts
//
// Script standalone de configuración única. Se corre a mano UNA VEZ
// desde el host (no dentro de Docker, no es parte del bot en runtime),
// parado en la carpeta bot/:
//
//   pnpm exec tsx scripts/spotify-login.ts
//
// Abre el flujo de autorización OAuth2 de Spotify, captura el código
// vía un servidor HTTP temporal en 127.0.0.1, lo intercambia por un
// refresh token, y lo imprime en consola para pegarlo a mano en .env
// como SPOTIFY_USER_REFRESH_TOKEN (mismo flujo manual que ya se usa
// hoy para YOUTUBE_OAUTH_REFRESH_TOKEN).
//
// Prerequisito manual: en el Dashboard de Spotify (la app existente,
// la misma de SPOTIFY_CLIENT_ID), agregar como Redirect URI exacto
// el valor de SPOTIFY_REDIRECT_URI (por defecto http://127.0.0.1:8888/callback).
// ═══════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PinoLogger } from '../src/infrastructure/logger/Logger.js';
import { SpotifyUserAuthAdapter } from '../src/infrastructure/spotify/SpotifyUserAuthAdapter.js';

// El .env vive en la raíz del repo (un nivel arriba de bot/), no en bot/ —
// cargarlo por ruta explícita evita depender del cwd desde el que se corra el script.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:8888/callback';

  if (!clientId || !clientSecret) {
    console.error('Faltan SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET en .env');
    process.exit(1);
  }

  const url = new URL(redirectUri);
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    console.error(`SPOTIFY_REDIRECT_URI (${redirectUri}) no apunta a localhost — este script solo captura el callback en esta máquina.`);
    process.exit(1);
  }
  const port = Number(url.port || 80);

  const logger = new PinoLogger('info', true);
  const adapter = new SpotifyUserAuthAdapter(clientId, clientSecret, '', logger);

  const state = randomBytes(16).toString('hex');
  const authUrl = adapter.buildAuthorizationUrl(redirectUri, state);

  console.log('\nAbrí esta URL en tu navegador e iniciá sesión en Spotify:\n');
  console.log(authUrl);
  console.log(`\nEsperando el callback en ${redirectUri} ...\n`);

  const server = createServer((req, res) => {
    void (async () => {
      const reqUrl = new URL(req.url ?? '/', redirectUri);
      if (reqUrl.pathname !== url.pathname) {
        res.writeHead(404).end();
        return;
      }

      const error = reqUrl.searchParams.get('error');
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Autorización rechazada. Podés cerrar esta pestaña.');
        console.error(`Spotify devolvió un error: ${error}`);
        server.close();
        process.exit(1);
      }

      const code = reqUrl.searchParams.get('code');
      const returnedState = reqUrl.searchParams.get('state');
      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Solicitud inválida (falta code o el state no coincide).');
        return;
      }

      try {
        const tokens = await adapter.exchangeAuthorizationCode(code, redirectUri);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('¡Listo! Ya podés cerrar esta pestaña y volver a la consola.');

        console.log('\nAutorización exitosa. Pegá esta línea en tu .env:\n');
        console.log(`SPOTIFY_USER_REFRESH_TOKEN=${tokens.refreshToken}\n`);
        console.log('Después reiniciá el stack (docker compose up -d bot) para que tome el nuevo valor.\n');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Error al intercambiar el código. Revisá la consola.');
        console.error('Falló el intercambio del código de autorización:', err);
      } finally {
        server.close();
        process.exit(0);
      }
    })();
  });

  server.listen(port, '127.0.0.1');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
