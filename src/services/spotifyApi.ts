import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifySearchResult,
  SearchTypeFilter,
  SpotifyAlbum,
  SpotifyTrack,
} from "../types/spotify";

export const SPOTIFY_CLIENT_ID =
  (import.meta.env.FLOWKEY_SPOTIFY_CLIENT_ID as string) || "edb94d6fe42449359ed58f8d18371c96";
export const SPOTIFY_CLIENT_SECRET =
  (import.meta.env.FLOWKEY_SPOTIFY_CLIENT_SECRET as string) || "cc0965fe0b53468a8cbd549be2198a28";

const ACCESS_TOKEN_KEY = "flowkey_spotify_access_token";
const REFRESH_TOKEN_KEY = "flowkey_spotify_refresh_token";
const TOKEN_EXPIRY_KEY = "flowkey_spotify_token_expiry";
const REDIRECT_URI_KEY = "flowkey_spotify_redirect_uri";

export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:8888/callback";

export function getStoredRedirectUri(): string {
  return (
    (typeof window !== "undefined" && localStorage.getItem(REDIRECT_URI_KEY)) ||
    (import.meta.env.FLOWKEY_SPOTIFY_REDIRECT_URI as string) ||
    "http://127.0.0.1:8888/callback"
  );
}

export function setStoredRedirectUri(uri: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(REDIRECT_URI_KEY, uri.trim());
  }
}

export const authBroadcastChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("flowkey_spotify_auth")
    : null;

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-library-read",
  "user-library-modify",
  "user-follow-read",
];

export function getSpotifyAuthorizeUrl(redirectUri?: string): string {
  const uri = redirectUri || getStoredRedirectUri();
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: uri,
    scope: SPOTIFY_SCOPES.join(" "),
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function openSpotifyLoginInBrowser(redirectUri?: string): Promise<string> {
  const uri = redirectUri || getStoredRedirectUri();
  const authUrl = getSpotifyAuthorizeUrl(uri);

  if (uri.includes("127.0.0.1")) {
    try {
      const urlObj = new URL(uri);
      const port = Number(urlObj.port) || 8888;
      
      invoke<{ access_token: string; expires_in: number; refresh_token?: string }>(
        "start_spotify_oauth_listener",
        {
          clientId: SPOTIFY_CLIENT_ID,
          clientSecret: SPOTIFY_CLIENT_SECRET,
          port,
        }
      )
        .then((res) => {
          spotifyService.setAccessToken(res.access_token, res.expires_in);
          if (res.refresh_token) {
            spotifyService.setRefreshToken(res.refresh_token);
          }
          authBroadcastChannel?.postMessage({ type: "TOKEN_RECEIVED", token: res.access_token });
        })
        .catch((err) => {
          console.warn("Loopback listener ended/error:", err);
        });
    } catch (e) {
      console.error("Error setting up loopback listener:", e);
    }
  }

  try {
    await openUrl(authUrl);
  } catch {
    window.open(authUrl, "_blank");
  }
  return authUrl;
}

export async function openExternalLink(urlOrUri: string): Promise<void> {
  try {
    await invoke("open_in_spotify", { target: urlOrUri });
    return;
  } catch (e) {
    console.warn("invoke open_in_spotify fallback:", e);
  }

  try {
    await openUrl(urlOrUri);
  } catch {
    window.open(urlOrUri, "_blank");
  }
}

export function getTrackCount(item: any): number {
  if (!item) return 0;
  if (typeof item.total_tracks === "number") return item.total_tracks;
  if (typeof item.tracks?.total === "number") return item.tracks.total;
  if (typeof item.items?.total === "number") return item.items.total;
  if (typeof item.total_episodes === "number") return item.total_episodes;
  if (typeof item.episodes?.total === "number") return item.episodes.total;
  if (Array.isArray(item.tracks?.items)) return item.tracks.items.length;
  if (Array.isArray(item.tracks)) return item.tracks.length;
  if (Array.isArray(item.items)) return item.items.length;
  return 0;
}

class SpotifyService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private clientCredentialsToken: string | null = null;
  private likedCache = new Map<string, { isLiked: boolean; timestamp: number }>();
  private rateLimitUntil: number = 0;
  private lastPlaybackState: SpotifyPlaybackState | null = null;
  private lastNowPlayingTime: number = 0;
  private inFlightNowPlaying: Promise<{
    data: SpotifyPlaybackState;
    status: number;
    latencyMs: number;
  }> | null = null;
  private cachedQueue: SpotifyTrack[] = [];
  private lastQueueFetchTime: number = 0;

  public getCachedQueue(): SpotifyTrack[] {
    return this.cachedQueue;
  }

  public popNextFromQueue(): SpotifyTrack | null {
    if (this.cachedQueue.length > 0) {
      const next = this.cachedQueue.shift() || null;
      if (this.cachedQueue.length <= 1) {
        this.fetchQueue(true).catch(() => {});
      }
      return next;
    }
    return null;
  }

  public async fetchQueue(force = false): Promise<SpotifyTrack[]> {
    if (this.isRateLimited()) return this.cachedQueue;
    const now = Date.now();
    if (!force && now - this.lastQueueFetchTime < 15000 && this.cachedQueue.length > 0) {
      return this.cachedQueue;
    }

    try {
      const token = await this.ensureValidToken();
      if (!token) return this.cachedQueue;

      const res = await fetch("https://api.spotify.com/v1/me/player/queue", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
        return this.cachedQueue;
      }

      if (res.ok && res.status === 200) {
        const data = await res.json();
        if (data && Array.isArray(data.queue)) {
          this.cachedQueue = data.queue;
          this.lastQueueFetchTime = Date.now();
          return this.cachedQueue;
        }
      }
    } catch (e) {
      console.warn("Fetch queue failed:", e);
    }
    return this.cachedQueue;
  }

  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitUntil;
  }

  public getRateLimitRemainingSec(): number {
    return Math.max(0, Math.ceil((this.rateLimitUntil - Date.now()) / 1000));
  }

  public handleRateLimitResponse(res: Response) {
    if (res.status === 429) {
      const retryHeader = res.headers.get("Retry-After");
      const retrySec = retryHeader ? parseInt(retryHeader, 10) : 5;
      const waitMs = (isNaN(retrySec) ? 5 : Math.max(1, retrySec)) * 1000;
      this.rateLimitUntil = Date.now() + waitMs;
      console.warn(`[Spotify API] 429 Rate limited. Backing off for ${waitMs / 1000}s until ${new Date(this.rateLimitUntil).toLocaleTimeString()}`);
    }
  }

  public getLastKnownPlaybackState(): SpotifyPlaybackState | null {
    return this.lastPlaybackState;
  }

  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || null;
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    this.tokenExpiry = expiryStr ? Number(expiryStr) : 0;

    this.handleUrlAuthRedirect();
  }

  public handleUrlAuthRedirect(): boolean {
    if (typeof window === "undefined") return false;

    if (window.location.search) {
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get("code");
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        this.exchangeAuthCode(code, getStoredRedirectUri()).catch(console.error);
        return true;
      }
    }

    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const token = hashParams.get("access_token");
      const expiresIn = hashParams.get("expires_in");

      if (token) {
        this.setAccessToken(token, expiresIn ? Number(expiresIn) : 3600);
        authBroadcastChannel?.postMessage({ type: "TOKEN_RECEIVED", token });
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
    }

    return false;
  }

  private lastTrackId: string | null = null;

  public getLastTrackId(): string | null {
    return this.lastTrackId;
  }

  public setLastTrackId(id: string | null) {
    this.lastTrackId = id;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public getTokenExpiry(): number {
    return this.tokenExpiry;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setAccessToken(token: string | null, expiresInSeconds?: number) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      if (expiresInSeconds) {
        const expiryTime = Date.now() + expiresInSeconds * 1000;
        this.tokenExpiry = expiryTime;
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
      }
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }

  public setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  public isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    const token = this.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
    const refresh = this.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    return Boolean(token || refresh);
  }

  public async ensureValidToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    if (!this.refreshToken) {
      this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    if (!this.tokenExpiry) {
      const exp = localStorage.getItem(TOKEN_EXPIRY_KEY);
      this.tokenExpiry = exp ? Number(exp) : 0;
    }

    const isExpiredOrClose =
      !this.accessToken ||
      (this.tokenExpiry > 0 && Date.now() >= this.tokenExpiry - 60000);

    if (isExpiredOrClose && (this.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY))) {
      await this.tryAutoRefreshToken();
    }

    return this.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  public logout() {
    this.setAccessToken(null);
    this.setRefreshToken(null);
    this.clientCredentialsToken = null;
  }

  public async exchangeAuthCode(codeOrUrl: string, redirectUri?: string): Promise<string> {
    let cleanCode = codeOrUrl.trim();
    let effectiveRedirectUri = redirectUri || getStoredRedirectUri();

    if (codeOrUrl.includes("code=")) {
      try {
        const urlObj = new URL(codeOrUrl.trim());
        const extractedCode = urlObj.searchParams.get("code");
        if (extractedCode) {
          cleanCode = extractedCode;
          effectiveRedirectUri = urlObj.origin + urlObj.pathname;
        }
      } catch {
        const match = codeOrUrl.match(/code=([^&]+)/);
        if (match && match[1]) {
          cleanCode = decodeURIComponent(match[1]);
        }
      }
    }

    try {
      let accessToken = "";
      let expiresIn = 3600;
      let refreshToken: string | undefined = undefined;

      try {
        const result = await invoke<{
          access_token: string;
          expires_in: number;
          refresh_token?: string;
        }>("spotify_exchange_code", {
          clientId: SPOTIFY_CLIENT_ID,
          clientSecret: SPOTIFY_CLIENT_SECRET,
          code: cleanCode,
          redirectUri: effectiveRedirectUri,
        });
        accessToken = result.access_token;
        expiresIn = result.expires_in;
        refreshToken = result.refresh_token;
      } catch (rustErr) {
        
        const basic = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code: cleanCode,
          redirect_uri: effectiveRedirectUri,
        });
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.error || `Token exchange failed: ${rustErr}`);
        accessToken = data.access_token;
        expiresIn = data.expires_in;
        refreshToken = data.refresh_token;
      }

      this.setAccessToken(accessToken, expiresIn);
      if (refreshToken) {
        this.setRefreshToken(refreshToken);
      }
      authBroadcastChannel?.postMessage({ type: "TOKEN_RECEIVED", token: accessToken });
      return accessToken;
    } catch (err) {
      console.error("Exchange auth code failed:", err);
      throw err;
    }
  }

  public async getAppClientToken(): Promise<string> {
    if (this.clientCredentialsToken) {
      return this.clientCredentialsToken;
    }

    try {
      const result = await invoke<{ access_token: string }>("spotify_get_client_credentials", {
        clientId: SPOTIFY_CLIENT_ID,
        clientSecret: SPOTIFY_CLIENT_SECRET,
      });
      this.clientCredentialsToken = result.access_token;
      return result.access_token;
    } catch {
      
      const basic = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const data = await res.json();
      if (data.access_token) {
        this.clientCredentialsToken = data.access_token;
        return data.access_token;
      }
      throw new Error("Unable to obtain Spotify client token");
    }
  }

  public async tryAutoRefreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || this.refreshToken;
    if (!refreshToken) return false;

    try {
      let newAccessToken = "";
      let newExpiresIn = 3600;

      try {
        const result = await invoke<{ access_token: string; expires_in: number }>("spotify_refresh_token", {
          clientId: SPOTIFY_CLIENT_ID,
          clientSecret: SPOTIFY_CLIENT_SECRET,
          refreshToken,
        });
        newAccessToken = result.access_token;
        newExpiresIn = result.expires_in;
      } catch {
        const basic = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
        if (!res.ok) return false;
        const data = await res.json();
        newAccessToken = data.access_token;
        newExpiresIn = data.expires_in || 3600;
      }

      if (newAccessToken) {
        this.setAccessToken(newAccessToken, newExpiresIn);
        authBroadcastChannel?.postMessage({ type: "TOKEN_RECEIVED", token: newAccessToken });
        return true;
      }
    } catch (e) {
      console.warn("Auto-refresh token failed:", e);
    }
    return false;
  }

  public async getNowPlaying(force = false): Promise<{
    data: SpotifyPlaybackState;
    status: number;
    latencyMs: number;
  }> {
    if (this.isRateLimited()) {
      return {
        data: this.lastPlaybackState || {
          is_playing: false,
          item: null,
          progress_ms: 0,
        },
        status: 429,
        latencyMs: 0,
      };
    }

    const now = Date.now();
    if (!force && this.lastPlaybackState && now - this.lastNowPlayingTime < 1500) {
      return {
        data: this.lastPlaybackState,
        status: 200,
        latencyMs: 0,
      };
    }

    if (this.inFlightNowPlaying) {
      return this.inFlightNowPlaying;
    }

    const executeFetch = async () => {
      try {
        const token = await this.ensureValidToken();
        if (!token) {
          throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
        }

        const start = performance.now();
        let res = await fetch("https://api.spotify.com/v1/me/player", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          const refreshed = await this.tryAutoRefreshToken();
          if (refreshed && this.accessToken) {
            res = await fetch("https://api.spotify.com/v1/me/player", {
              headers: { Authorization: `Bearer ${this.accessToken}` },
            });
          }
        }

        const latencyMs = Math.round(performance.now() - start);
        this.lastNowPlayingTime = Date.now();

        if (res.status === 429) {
          this.handleRateLimitResponse(res);
          return {
            data: this.lastPlaybackState || {
              is_playing: false,
              item: null,
              progress_ms: 0,
            },
            status: 429,
            latencyMs,
          };
        }

        if (res.ok && res.status === 200) {
          try {
            const data = await res.json();
            if (data && data.item) {
              if (data.item.id) {
                this.lastTrackId = data.item.id;
              }
              this.lastPlaybackState = data;
              if (data.is_playing && this.cachedQueue.length === 0) {
                this.fetchQueue().catch(() => {});
              }
              return { data, status: 200, latencyMs };
            }
          } catch {}
        }

        if (res.status === 204) {
          const emptyData = {
            is_playing: false,
            item: null,
            progress_ms: 0,
          };
          this.lastPlaybackState = emptyData;
          return {
            data: emptyData,
            status: 204,
            latencyMs,
          };
        }

        return {
          data: this.lastPlaybackState || {
            is_playing: false,
            item: null,
            progress_ms: 0,
          },
          status: res.status,
          latencyMs,
        };
      } finally {
        this.inFlightNowPlaying = null;
      }
    };

    this.inFlightNowPlaying = executeFetch();
    return this.inFlightNowPlaying;
  }

  public async fetchNewTrackAfterSkip(
    previousTrackId?: string | null,
    maxWaitMs = 3000
  ): Promise<SpotifyTrack | null> {
    const startTime = Date.now();
    const checkDelays = [200, 350, 600, 900, 1200];
    let idx = 0;

    while (Date.now() - startTime < maxWaitMs) {
      const delay = checkDelays[Math.min(idx++, checkDelays.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (this.isRateLimited()) break;

      try {
        const res = await this.getNowPlaying(true);
        const currentItem = res.data.item;
        if (currentItem) {
          if (!previousTrackId || currentItem.id !== previousTrackId) {
            this.lastTrackId = currentItem.id;
            this.fetchQueue(true).catch(() => {});
            return currentItem;
          }
        }
      } catch {
        break;
      }
    }

    return null;
  }

  public async setVolume(
    volumePercent: number
  ): Promise<{ status: number; latencyMs: number; volume: number }> {
    if (!this.accessToken) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to adjust volume.");
    }

    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const start = performance.now();

    const res = await fetch(
      `https://api.spotify.com/v1/me/player/volume?volume_percent=${clamped}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );
    const latencyMs = Math.round(performance.now() - start);

    if (res.status === 401) {
      this.logout();
      throw new Error("AUTH_EXPIRED: Token expired.");
    }

    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      throw new Error(`Set Volume failed (${res.status}): ${errText}`);
    }

    return { status: res.status, latencyMs, volume: clamped };
  }

  public async play(trackUri?: string, positionMs?: number): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    try {
      const body = trackUri
        ? JSON.stringify({
            uris: [trackUri],
            position_ms: positionMs ? Math.floor(positionMs) : 0,
          })
        : undefined;

      const res = await fetch("https://api.spotify.com/v1/me/player/play", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }

      // If no active device (404) and we have a URI, try transfer/play on first available device
      if (res.status === 404 && trackUri) {
        try {
          const devRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const devData = await devRes.json();
          const firstDev = devData.devices?.[0];
          if (firstDev?.id) {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${firstDev.id}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uris: [trackUri],
                position_ms: positionMs ? Math.floor(positionMs) : 0,
              }),
            });
          }
        } catch {}
      }

      if (this.lastPlaybackState) {
        this.lastPlaybackState.is_playing = true;
      }

      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Spotify Play error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async pause(): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/pause", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }

      if (this.lastPlaybackState) {
        this.lastPlaybackState.is_playing = false;
      }

      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Spotify Pause error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async togglePlay(
    currentlyPlaying?: boolean,
    fallbackUri?: string,
    fallbackPositionMs?: number
  ): Promise<{ status: number; isPlaying: boolean }> {
    const isPlaying =
      currentlyPlaying !== undefined
        ? currentlyPlaying
        : this.lastPlaybackState?.is_playing ?? false;

    if (isPlaying) {
      const res = await this.pause();
      return { status: res.status, isPlaying: false };
    } else {
      const res = await this.play(fallbackUri, fallbackPositionMs);
      return { status: res.status, isPlaying: true };
    }
  }

  public async nextTrack(): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/next", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }

      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Spotify Next Track error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async previousTrack(): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/previous", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }

      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Spotify Previous Track error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async setShuffle(state: boolean): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to adjust shuffle.");
    }
    const start = performance.now();
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }

      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Set shuffle error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async setRepeat(
    state: "off" | "context" | "track" | boolean
  ): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to adjust repeat.");
    }
    const repeatParam =
      typeof state === "boolean" ? (state ? "context" : "off") : state;
    const start = performance.now();
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/repeat?state=${repeatParam}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }
      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Set repeat error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async seekPosition(
    positionMs: number
  ): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to seek.");
    }
    const start = performance.now();
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 429) {
        this.handleRateLimitResponse(res);
      }
      const latencyMs = Math.round(performance.now() - start);
      return { status: res.status, latencyMs };
    } catch (e) {
      console.warn("Seek error:", e);
      return { status: 500, latencyMs: Math.round(performance.now() - start) };
    }
  }

  public async addTrackToPlaylist(
    playlistId: string,
    trackIdOrUri: string
  ): Promise<{ status: number; latencyMs: number; snapshot_id: string }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }

    const cleanId = trackIdOrUri.replace("spotify:track:", "").trim();
    const uri = `spotify:track:${cleanId}`;
    const cleanPlaylistId = playlistId.replace("spotify:playlist:", "").trim();

    const start = performance.now();

    let res = await fetch(`https://api.spotify.com/v1/playlists/${cleanPlaylistId}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      res = await fetch(`https://api.spotify.com/v1/playlists/${cleanPlaylistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [uri] }),
      });
    }

    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const errText = await res.text();
      console.error("Add to Playlist error:", res.status, errText);
      if (res.status === 403) {
        throw new Error(
          "PERMISSION_DENIED: Spotify returned 403. If you created this playlist, please disconnect and reconnect Spotify in the main app to grant the new 'playlist-modify-public' and 'playlist-modify-private' scopes."
        );
      }
      throw new Error(`Add to Playlist failed (${res.status}): ${errText}`);
    }

    const json = await res.json();
    return { status: res.status, latencyMs, snapshot_id: json.snapshot_id };
  }

  public async checkIsTrackLiked(trackId: string): Promise<boolean> {
    if (!trackId) return false;
    const cleanId = trackId.replace("spotify:track:", "").trim();

    const cached = this.likedCache.get(cleanId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.isLiked;
    }

    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const res = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${cleanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) {
        console.warn("Rate limited on checkIsTrackLiked (429)");
        return cached ? cached.isLiked : false;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const isLiked = Boolean(data[0]);
          this.likedCache.set(cleanId, { isLiked, timestamp: Date.now() });
          return isLiked;
        }
      }
    } catch {
      
    }

    return cached ? cached.isLiked : false;
  }

  public async saveTrackToLiked(trackIdOrUri: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const cleanId = trackIdOrUri.replace("spotify:track:", "").trim();
    const uri = `spotify:track:${cleanId}`;
    const start = performance.now();

    this.likedCache.set(cleanId, { isLiked: true, timestamp: Date.now() });
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const ch = new BroadcastChannel("flowkey_liked_sync");
        ch.postMessage({ type: "LIKED_CHANGED", trackId: cleanId, isLiked: true });
        ch.close();
      }
    } catch {}

    let res = await fetch(`https://api.spotify.com/v1/me/library?uris=${uri}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || "3");
      const waitMs = Math.min(retryAfter * 1000, 10000);
      console.warn(`Rate limited on saveTrackToLiked, retrying after ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      res = await fetch(`https://api.spotify.com/v1/me/library?uris=${uri}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 204) {
      const errText = await res.text();
      console.error("Save to Liked Songs error:", res.status, errText);
      throw new Error(`Save to Liked Songs failed (${res.status}): ${errText}`);
    }
    return { status: res.status, latencyMs };
  }

  public async removeTrackFromLiked(trackIdOrUri: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const cleanId = trackIdOrUri.replace("spotify:track:", "").trim();
    const uri = `spotify:track:${cleanId}`;
    const start = performance.now();

    this.likedCache.set(cleanId, { isLiked: false, timestamp: Date.now() });
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const ch = new BroadcastChannel("flowkey_liked_sync");
        ch.postMessage({ type: "LIKED_CHANGED", trackId: cleanId, isLiked: false });
        ch.close();
      }
    } catch {}

    let res = await fetch(`https://api.spotify.com/v1/me/library?uris=${uri}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || "3");
      const waitMs = Math.min(retryAfter * 1000, 10000);
      console.warn(`Rate limited on removeTrackFromLiked, retrying after ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      res = await fetch(`https://api.spotify.com/v1/me/library?uris=${uri}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 200 && res.status !== 204) {
      const errText = await res.text();
      console.error("Remove from Liked Songs error:", res.status, errText);
      throw new Error(`Remove from Liked Songs failed (${res.status}): ${errText}`);
    }
    return { status: res.status, latencyMs };
  }

  public async playArtistRadio(artistId: string, trackId?: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }

    const start = performance.now();

    try {
      const seedParam = trackId
        ? `seed_tracks=${trackId}&seed_artists=${artistId}&limit=30`
        : `seed_artists=${artistId}&limit=30`;
      const recRes = await fetch(`https://api.spotify.com/v1/recommendations?${seedParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        const uris = recData.tracks?.map((t: any) => t.uri).filter(Boolean);
        if (uris && uris.length > 0) {
          const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris }),
          });
          if (playRes.ok || playRes.status === 204) {
            return { status: 200, latencyMs: Math.round(performance.now() - start) };
          }
        }
      }
    } catch (e) {
      console.warn("Recommendations radio fetch failed, falling back to context_uri:", e);
    }

    const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: `spotify:artist:${artistId}` }),
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!playRes.ok && playRes.status !== 204) {
      const errText = await playRes.text();
      throw new Error(`Start Radio playback failed (${playRes.status}): ${errText}`);
    }
    return { status: playRes.status, latencyMs };
  }

  public async getAlbumDetails(albumId: string): Promise<{
    data: any;
    status: number;
    latencyMs: number;
  }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Get Album details failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return { data, status: res.status, latencyMs };
  }

  public async playTrack(trackUri: string, contextUri?: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    const body = contextUri
      ? { context_uri: contextUri, offset: { uri: trackUri } }
      : { uris: [trackUri] };

    const res = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      throw new Error(`Play Track failed (${res.status}): ${errText}`);
    }
    return { status: res.status, latencyMs };
  }

  public async playContext(contextUri: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();
    const res = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: contextUri }),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      throw new Error(`Play Context failed (${res.status}): ${errText}`);
    }
    return { status: res.status, latencyMs };
  }

  public async addTrackToQueue(trackUri: string, deviceId?: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const start = performance.now();

    let targetDeviceId = deviceId;
    if (!targetDeviceId) {
      try {
        const devRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (devRes.ok) {
          const devData = await devRes.json();
          const active = devData.devices?.find((d: any) => d.is_active) || devData.devices?.[0];
          if (active?.id) {
            targetDeviceId = active.id;
          }
        }
      } catch (e) {
        console.warn("Could not fetch Spotify devices for queue:", e);
      }
    }

    let url = `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`;
    if (targetDeviceId) {
      url += `&device_id=${encodeURIComponent(targetDeviceId)}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      let errorMsg = `Add to Queue failed (${res.status}): ${errText}`;
      if (res.status === 404) {
        errorMsg = "No active Spotify player found. Please start playing music in Spotify first.";
      }
      throw new Error(errorMsg);
    }
    return { status: res.status, latencyMs };
  }

  private currentUserId: string | null = null;

  public async getCurrentUser(): Promise<{ id: string; display_name: string } | null> {
    const token = await this.ensureValidToken();
    if (!token) return null;
    try {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUserId = data.id;
        return data;
      }
    } catch (e) {
      console.warn("Failed to fetch user profile:", e);
    }
    return null;
  }

  public async getPlaylists(onlyEditable = false): Promise<{
    items: SpotifyPlaylist[];
    status: number;
    latencyMs: number;
  }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to load playlists.");
    }

    
    if (!this.currentUserId) {
      await this.getCurrentUser();
    }

    const start = performance.now();
    let allRawItems: any[] = [];
    let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
    let pages = 0;
    const MAX_PAGES = 20; 

    while (nextUrl && pages < MAX_PAGES) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const refreshed = await this.tryAutoRefreshToken();
        if (refreshed && this.accessToken) {
          return this.getPlaylists(onlyEditable);
        }
        throw new Error("AUTH_EXPIRED: Token expired.");
      }

      if (!res.ok) {
        if (pages === 0) {
          const errText = await res.text();
          throw new Error(`Get Playlists failed (${res.status}): ${errText}`);
        }
        break;
      }

      const json = await res.json();
      allRawItems = allRawItems.concat(json.items || []);
      nextUrl = json.next;
      pages++;
    }

    const latencyMs = Math.round(performance.now() - start);

    let items: SpotifyPlaylist[] = allRawItems
      .filter(Boolean)
      .map((p: any) => ({
        ...p,
        tracks: { total: getTrackCount(p) },
      }));

    if (onlyEditable) {

      
      items = items.filter((p) => {
        if (!p) return false;
        
        if (this.currentUserId && p.owner?.id === this.currentUserId) return true;
        
        if (p.collaborative === true) return true;
        return false;
      });
    }

    return { items, status: 200, latencyMs };
  }

  public async search(
    query: string,
    types: SearchTypeFilter[]
  ): Promise<{ data: SpotifySearchResult; status: number; latencyMs: number }> {
    if (!query.trim() || types.length === 0) {
      return { data: {}, status: 200, latencyMs: 0 };
    }

    let token = this.accessToken;
    if (!token) {
      try {
        token = await this.getAppClientToken();
      } catch {
        throw new Error("NOT_AUTHENTICATED: No Spotify token available for search.");
      }
    }

    const start = performance.now();
    const typeParam = types.join(",");
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${typeParam}&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Search failed (${res.status}): ${errText}`);
    }

    const json = await res.json();
    return { data: json, status: res.status, latencyMs };
  }

  public async getLibrary(tab: "playlists" | "albums" | "artists" | "podcasts"): Promise<{
    items: any[];
    status: number;
    latencyMs: number;
  }> {
    if (!this.accessToken) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account to view your library.");
    }

    let endpoint = "https://api.spotify.com/v1/me/playlists?limit=30";
    if (tab === "albums") endpoint = "https://api.spotify.com/v1/me/albums?limit=30";
    if (tab === "artists") endpoint = "https://api.spotify.com/v1/me/following?type=artist&limit=30";
    if (tab === "podcasts") endpoint = "https://api.spotify.com/v1/me/shows?limit=30";

    const start = performance.now();
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const latencyMs = Math.round(performance.now() - start);

    if (res.status === 401) {
      this.logout();
      throw new Error("AUTH_EXPIRED: Token expired.");
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Library fetch failed (${res.status}): ${errText}`);
    }

    const json = await res.json();

    let items: any[] = [];
    if (tab === "playlists") {
      items = (json.items || []).filter(Boolean).map((p: any) => ({
        ...p,
        tracks: { total: getTrackCount(p) },
      }));
    }
    if (tab === "albums") {
      items = (json.items || [])
        .map((i: any) => i?.album || i)
        .filter(Boolean)
        .map((a: any) => ({
          ...a,
          total_tracks: getTrackCount(a),
          tracks: { total: getTrackCount(a) },
        }));
    }
    if (tab === "artists") {
      items = (json.artists?.items || json.items || []).filter(Boolean);
    }
    if (tab === "podcasts") {
      items = (json.items || [])
        .map((i: any) => i?.show || i)
        .filter(Boolean)
        .map((s: any) => ({
          ...s,
          total_episodes: getTrackCount(s),
        }));
    }

    return { items, status: res.status, latencyMs };
  }

  public async getArtistAlbums(
    artistId: string,
    artistName?: string
  ): Promise<{ items: SpotifyAlbum[]; status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const cleanId = artistId.replace("spotify:artist:", "").trim();
    const start = performance.now();

    const albumMap = new Map<string, SpotifyAlbum>();

    const addAlbums = (items: SpotifyAlbum[], filterByArtistId?: string) => {
      (items || []).forEach((alb) => {
        if (!alb?.id) return;
        if (albumMap.has(alb.id)) return;

        
        if (alb.album_type === "single" || alb.album_group === "single") return;
        if (alb.album_type === "compilation" || alb.album_group === "appears_on") return;
        if (typeof alb.total_tracks === "number" && alb.total_tracks <= 3) return;

        if (filterByArtistId) {
          const hasArtist = alb.artists?.some((a) => a.id === filterByArtistId);
          if (!hasArtist) return;
        }
        albumMap.set(alb.id, alb);
      });
    };

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/artists/${cleanId}/albums?include_groups=album&market=US`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        addAlbums(json.items || []);
        
        let next = json.next;
        let pages = 0;
        while (next && pages < 4) {
          try {
            const nextRes = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
            if (nextRes.ok) {
              const nextJson = await nextRes.json();
              addAlbums(nextJson.items || []);
              next = nextJson.next;
            } else {
              break;
            }
          } catch { break; }
          pages++;
        }
      }
    } catch (e) {
      console.warn("Direct artist albums fetch error:", e);
    }

    if (artistName) {
      const queries = [
        `artist:"${artistName}"`,
        artistName,
      ];
      for (const q of queries) {
        try {
          const res = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=50`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const json = await res.json();
            addAlbums(json.albums?.items || [], cleanId);
          }
        } catch (e) {
          console.warn("Search albums error:", e);
        }
      }
    }

    const latencyMs = Math.round(performance.now() - start);
    const items = Array.from(albumMap.values()).sort((a, b) => {
      
      const da = a.release_date || "";
      const db = b.release_date || "";
      return db.localeCompare(da);
    });
    return { items, status: 200, latencyMs };
  }

  public async getArtistTopTracks(
    artistId: string,
    artistName?: string
  ): Promise<{ items: SpotifyTrack[]; status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const cleanId = artistId.replace("spotify:artist:", "").trim();
    const start = performance.now();

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/artists/${cleanId}/top-tracks?market=US`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.tracks && json.tracks.length > 0) {
          const latencyMs = Math.round(performance.now() - start);
          return { items: json.tracks, status: res.status, latencyMs };
        }
      }
    } catch (e) {
      console.warn("Direct top tracks fetch error:", e);
    }

    const searchQuery = artistName ? `artist:"${artistName}"` : `artist:${cleanId}`;
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const latencyMs = Math.round(performance.now() - start);
    if (!searchRes.ok) {
      const err = await searchRes.text();
      throw new Error(`Get Artist Top Tracks failed (${searchRes.status}): ${err}`);
    }
    const searchJson = await searchRes.json();
    return { items: searchJson.tracks?.items || [], status: searchRes.status, latencyMs };
  }

  public async saveAlbumToLibrary(albumId: string): Promise<{ status: number; latencyMs: number }> {
    const token = await this.ensureValidToken();
    if (!token) {
      throw new Error("NOT_AUTHENTICATED: Please connect your Spotify account.");
    }
    const cleanId = albumId.replace("spotify:album:", "").trim();
    const start = performance.now();
    const res = await fetch(`https://api.spotify.com/v1/me/albums?ids=${cleanId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const err = await res.text();
      throw new Error(`Save Album failed (${res.status}): ${err}`);
    }
    return { status: res.status, latencyMs };
  }
}

export const spotifyService = new SpotifyService();
