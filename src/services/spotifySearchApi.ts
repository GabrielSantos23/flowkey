import { invoke } from "@tauri-apps/api/core";
import {
  SpotifyTrack,
  SpotifyAlbum,
  SpotifyPlaylist,
  SpotifySearchResult,
  SpotifyUser,
} from "../types/spotify";

class SpotifySearchApiService {
  private currentUserId: string | null = null;
  private userPlaylistsCache: SpotifyPlaylist[] | null = null;
  private userPlaylistsTimestamp = 0;

  public async getAccessToken(): Promise<string | null> {
    try {
      const token = await invoke<string | null>("get_spotify_access_token");
      return token;
    } catch {
      return null;
    }
  }

  public async getCurrentUser(): Promise<SpotifyUser | null> {
    const token = await this.getAccessToken();
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
      console.warn("Failed to fetch Spotify user:", e);
    }
    return null;
  }

  public async getUserPlaylists(forceRefresh = false): Promise<SpotifyPlaylist[]> {
    const now = Date.now();
    if (!forceRefresh && this.userPlaylistsCache && now - this.userPlaylistsTimestamp < 60000) {
      return this.userPlaylistsCache;
    }

    const token = await this.getAccessToken();
    if (!token) return [];

    if (!this.currentUserId) {
      await this.getCurrentUser();
    }

    try {
      const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const items = (json.items || []).filter(Boolean).map((p: any) => ({
          ...p,
          is_user_owned: this.currentUserId ? p.owner?.id === this.currentUserId : false,
        }));
        this.userPlaylistsCache = items;
        this.userPlaylistsTimestamp = now;
        return items;
      } else {
        const errText = await res.text();
        console.warn("Failed to fetch user playlists:", res.status, errText);
      }
    } catch (e) {
      console.warn("Failed to fetch user playlists:", e);
    }
    return [];
  }

  public async search(query: string, category: string = "all"): Promise<SpotifySearchResult> {
    const trimmed = query.trim();
    if (!trimmed) return {};

    const token = await this.getAccessToken();
    if (!token) return {};

    if (!this.currentUserId) {
      this.getCurrentUser().catch(() => {});
    }

    try {
      let types = "track,artist,album,playlist";
      if (category === "tracks") types = "track";
      else if (category === "artists") types = "artist";
      else if (category === "albums") types = "album";
      else if (category === "playlists") types = "playlist";

      // Spotify API enforces maximum limit=10
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=${types}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const json = await res.json();

        // Check and prioritize user-owned playlists
        let playlists: SpotifyPlaylist[] = (json.playlists?.items || []).filter(Boolean).map((p: any) => ({
          ...p,
          is_user_owned: Boolean(this.currentUserId && p.owner?.id === this.currentUserId),
        }));

        // Search user's own playlists for direct local matches to favor them at the very top!
        const userPlaylists = await this.getUserPlaylists();
        const localMatches = userPlaylists.filter((up) =>
          up.name.toLowerCase().includes(trimmed.toLowerCase())
        );

        // Merge and deduplicate by id, placing user's playlists FIRST
        const seenIds = new Set<string>();
        const prioritizedPlaylists: SpotifyPlaylist[] = [];

        for (const p of localMatches) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            prioritizedPlaylists.push({ ...p, is_user_owned: true });
          }
        }

        for (const p of playlists) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            prioritizedPlaylists.push(p);
          }
        }

        return {
          tracks: json.tracks,
          artists: json.artists,
          albums: json.albums,
          playlists: { items: prioritizedPlaylists },
        };
      } else {
        const errText = await res.text();
        console.warn(`Spotify Search API error (${res.status}):`, errText);
      }
    } catch (e) {
      console.warn("Spotify Search error:", e);
    }
    return {};
  }

  public async getArtistTopTracks(artistId: string, artistName?: string): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken();
    if (!token) return [];

    // Modern search-based retrieval (since GET /artists/{id}/top-tracks was deprecated in 2026)
    if (artistName) {
      try {
        const q = `artist:"${artistName}"`;
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.tracks?.items?.length) {
            return json.tracks.items;
          }
        }
      } catch {}
    }

    try {
      const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        return json.tracks || [];
      }
    } catch (e) {
      console.warn("Get artist top tracks error:", e);
    }
    return [];
  }

  public async getArtistAlbums(artistId: string): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const json = await res.json();
        const seen = new Set<string>();
        return (json.items || []).filter((a: any) => {
          const key = a.name.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (e) {
      console.warn("Get artist albums error:", e);
    }
    return [];
  }

  public async getAlbumDetails(albumId: string): Promise<SpotifyAlbum | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Get album details error:", e);
    }
    return null;
  }

  public async getPlaylistDetails(playlistId: string): Promise<SpotifyPlaylist | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();

        // Check if items/tracks are present in the response
        let rawList: any[] = [];
        if (data.items?.items && Array.isArray(data.items.items)) {
          rawList = data.items.items;
        } else if (Array.isArray(data.items)) {
          rawList = data.items;
        } else if (data.tracks?.items && Array.isArray(data.tracks.items)) {
          rawList = data.tracks.items;
        }

        // If items are still empty, fetch explicitly from the new /items endpoint (or fallback to /tracks)
        if (rawList.length === 0) {
          try {
            // Modern 2026 endpoint: /playlists/{id}/items
            const itemsRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (itemsRes.ok) {
              const itemsJson = await itemsRes.json();
              rawList = itemsJson.items || (Array.isArray(itemsJson) ? itemsJson : []);
            } else {
              // Legacy fallback: /playlists/{id}/tracks
              const tracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (tracksRes.ok) {
                const tracksJson = await tracksRes.json();
                rawList = tracksJson.items || [];
              }
            }
          } catch (err) {
            console.warn("Failed to fetch playlist items:", err);
          }
        }

        // Normalize tracks array
        const normalizedTracks = rawList
          .map((entry: any) => {
            if (!entry) return null;
            const t = entry.track || entry.item || entry;
            return t && (t.id || t.uri || t.name) ? t : null;
          })
          .filter(Boolean);

        return {
          ...data,
          tracks: {
            items: normalizedTracks.map((t: any) => ({ track: t })),
          },
          items: {
            items: normalizedTracks.map((t: any) => ({ track: t })),
          },
          is_user_owned: Boolean(this.currentUserId && data.owner?.id === this.currentUserId),
        } as SpotifyPlaylist;
      } else {
        const errText = await res.text();
        console.warn(`Get playlist details error (${res.status}):`, errText);
      }
    } catch (e) {
      console.warn("Get playlist details error:", e);
    }
    return null;
  }

  public async playTrack(trackUri: string, contextUri?: string, offsetPosition?: number): Promise<boolean> {
    try {
      if (contextUri) {
        return await invoke<boolean>("spotify_play", {
          contextUri,
          offsetPosition: offsetPosition ?? 0,
        });
      }
      return await invoke<boolean>("spotify_play", {
        uris: [trackUri],
      });
    } catch (e) {
      console.warn("Play track error:", e);
      return false;
    }
  }

  public async playContext(contextUri: string, offsetPosition?: number): Promise<boolean> {
    try {
      return await invoke<boolean>("spotify_play", {
        contextUri,
        offsetPosition: offsetPosition ?? 0,
      });
    } catch (e) {
      console.warn("Play context error:", e);
      return false;
    }
  }
}

export const spotifySearchApi = new SpotifySearchApiService();
