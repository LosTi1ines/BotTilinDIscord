// ═══════════════════════════════════════════════════════════════
// src/domain/ports/SpotifyPlaylistPort.ts
//
// Puerto de salida hacia la Web API de Spotify (lectura de playlists).
// Lavalink/LavaSrc ya no puede leer el contenido de playlists de
// Spotify con client_credentials (Spotify exige autenticación de
// usuario real desde 2026). Este puerto expone solo lo que el caso
// de uso necesita en tiempo de ejecución; el intercambio OAuth2
// inicial vive en el adaptador concreto, usado por un script de
// configuración aparte.
// ═══════════════════════════════════════════════════════════════

/**
 * Canción resuelta desde la Web API de Spotify, aún sin mapear
 * a un track reproducible (eso requiere buscarla en Lavalink).
 */
export interface SpotifyResolvedTrack {
  readonly title: string;
  readonly artist: string;
  readonly isrc: string | null;
  readonly durationMs: number;
}

/**
 * Resultado de leer el contenido completo de una playlist.
 */
export interface SpotifyPlaylistResult {
  readonly name: string;
  readonly tracks: SpotifyResolvedTrack[];
  /** true si la playlist tenía más canciones que el límite máximo soportado */
  readonly truncated: boolean;
}

/**
 * Puerto de lectura de playlists de Spotify vía OAuth2 de usuario.
 *
 * Abstracción que desacopla PlayTrackUseCase del mecanismo concreto
 * de autenticación/paginación contra la Web API de Spotify.
 */
export interface ISpotifyPlaylistPort {
  /**
   * Obtiene todas las canciones de una playlist de Spotify.
   *
   * @param playlistId - ID de la playlist (extraído de la URL/URI)
   * @throws Si no hay refresh token configurado o la autorización expiró
   */
  getPlaylistTracks(playlistId: string): Promise<SpotifyPlaylistResult>;
}
