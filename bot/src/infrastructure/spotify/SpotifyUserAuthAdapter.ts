// ═══════════════════════════════════════════════════════════════
// src/infrastructure/spotify/SpotifyUserAuthAdapter.ts
//
// Adaptador que implementa ISpotifyPlaylistPort usando el flujo
// OAuth2 Authorization Code de Spotify (token de usuario real).
//
// Necesario porque, desde 2026, la Web API de Spotify exige
// autenticación de usuario para leer el contenido de playlists
// (GET /v1/playlists/{id}/items) — client_credentials ya no alcanza,
// y LavaSrc (el plugin de Lavalink) no soporta tokens de usuario.
//
// Los métodos de configuración inicial (buildAuthorizationUrl,
// exchangeAuthorizationCode) NO forman parte de ISpotifyPlaylistPort:
// solo los usa el script de configuración en scripts/spotify-login.ts,
// una vez, fuera del proceso normal del bot.
// ═══════════════════════════════════════════════════════════════

import type { ILogger } from '../../domain/ports/LoggerPort.js';
import type {
  ISpotifyPlaylistPort,
  SpotifyPlaylistResult,
  SpotifyResolvedTrack,
} from '../../domain/ports/SpotifyPlaylistPort.js';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const PAGE_SIZE = 100;
const MAX_TRACKS = 600;
const TOKEN_REFRESH_MARGIN_MS = 30_000;

/**
 * La autorización de usuario expiró o fue revocada.
 * Requiere rehacer el login (scripts/spotify-login.ts).
 */
export class SpotifyAuthExpiredError extends Error {
  constructor(message = 'La autorización de Spotify expiró o fue revocada. Hay que rehacer el login (scripts/spotify-login.ts).') {
    super(message);
    this.name = 'SpotifyAuthExpiredError';
  }
}

/**
 * Spotify solo permite leer el contenido de playlists que la cuenta
 * autorizada es dueña o sigue — no cualquier playlist ajena.
 */
export class SpotifyPlaylistNotAccessibleError extends Error {
  constructor(message = 'Esta playlist no es tuya ni la seguís en la cuenta de Spotify conectada al bot. Seguila desde la app de Spotify e intentá de nuevo.') {
    super(message);
    this.name = 'SpotifyPlaylistNotAccessibleError';
  }
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

interface SpotifyPlaylistItemsPage {
  items: Array<{
    // Spotify renombró este campo de "track" a "item" en /v1/playlists/{id}/items.
    item: {
      name: string;
      artists: Array<{ name: string }>;
      external_ids?: { isrc?: string };
      duration_ms: number;
    } | null;
  }>;
  next: string | null;
}

export class SpotifyUserAuthAdapter implements ISpotifyPlaylistPort {
  private accessTokenCache: AccessTokenCache | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly logger: ILogger,
  ) {}

  // ── ISpotifyPlaylistPort ────────────────────────────────────

  async getPlaylistTracks(playlistId: string): Promise<SpotifyPlaylistResult> {
    const token = await this.ensureAccessToken();

    const name = await this.fetchPlaylistName(playlistId, token);

    const tracks: SpotifyResolvedTrack[] = [];
    let truncated = false;
    let offset = 0;

    while (tracks.length < MAX_TRACKS) {
      const url = `${API_BASE}/playlists/${playlistId}/items`
        + `?fields=items(item(name,artists(name),external_ids(isrc),duration_ms)),next`
        + `&limit=${PAGE_SIZE}&offset=${offset}`;

      const page = await this.fetchJson<SpotifyPlaylistItemsPage>(url, token);

      for (const entry of page.items) {
        if (!entry.item) continue; // canción eliminada/no disponible en la región
        tracks.push({
          title: entry.item.name,
          artist: entry.item.artists.map(a => a.name).join(', '),
          isrc: entry.item.external_ids?.isrc ?? null,
          durationMs: entry.item.duration_ms,
        });
        if (tracks.length >= MAX_TRACKS) {
          truncated = page.next !== null;
          break;
        }
      }

      if (!page.next || tracks.length >= MAX_TRACKS) break;
      offset += PAGE_SIZE;
    }

    return { name, tracks, truncated };
  }

  // ── Setup (usado solo por scripts/spotify-login.ts) ─────────

  buildAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'playlist-read-private playlist-read-collaborative',
      state,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const json = await this.postToken(body);
    if (!json.refresh_token) {
      throw new Error('Spotify no devolvió un refresh_token en el intercambio del código.');
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
    };
  }

  // ── Internos ─────────────────────────────────────────────────

  private async ensureAccessToken(): Promise<string> {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.accessTokenCache.token;
    }

    if (!this.refreshToken) {
      throw new SpotifyAuthExpiredError('No hay SPOTIFY_USER_REFRESH_TOKEN configurado. Corré scripts/spotify-login.ts primero.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });

    const json = await this.postToken(body);

    if (json.refresh_token && json.refresh_token !== this.refreshToken) {
      this.logger.warn(
        'Spotify devolvió un refresh_token rotado. El .env sigue con el anterior — ' +
        'si Spotify empieza a exigir el nuevo, la autorización se romperá. Rehacer el login si eso pasa.',
      );
    }

    this.accessTokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return this.accessTokenCache.token;
  }

  private async postToken(body: URLSearchParams): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 400 && errorBody.includes('invalid_grant')) {
        throw new SpotifyAuthExpiredError();
      }
      throw new Error(`Spotify token endpoint respondió ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>;
  }

  private async fetchPlaylistName(playlistId: string, token: string): Promise<string> {
    const json = await this.fetchJson<{ name: string }>(
      `${API_BASE}/playlists/${playlistId}?fields=name`,
      token,
    );
    return json.name;
  }

  private async fetchJson<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new SpotifyAuthExpiredError();
      }
      if (response.status === 403) {
        throw new SpotifyPlaylistNotAccessibleError();
      }
      throw new Error(`Spotify API respondió ${response.status} en ${url}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }
}
