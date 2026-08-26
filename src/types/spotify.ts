export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
  followers?: { total: number };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  release_date?: string;
  total_tracks?: number;
  uri?: string;
  album_type?: string;
  album_group?: string;
  external_urls?: { spotify: string };
}

export interface SpotifyAlbumTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  explicit?: boolean;
  uri: string;
  artists: SpotifyArtist[];
  preview_url?: string | null;
}

export interface SpotifyAlbumDetails extends SpotifyAlbum {
  label?: string;
  popularity?: number;
  copyrights?: Array<{ text: string; type: string }>;
  tracks: {
    items: SpotifyAlbumTrack[];
    total: number;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  explicit?: boolean;
  uri: string;
  is_playable?: boolean;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number;
  device?: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
    is_active: boolean;
  };
  shuffle_state?: boolean;
  repeat_state?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: SpotifyImage[];
  owner: { display_name: string; id: string };
  tracks: { total: number };
  snapshot_id?: string;
  public?: boolean;
  collaborative?: boolean;
  uri?: string;
  containsCurrentTrack?: boolean;
}

export type SearchTypeFilter = 'track' | 'artist' | 'album' | 'playlist' | 'show' | 'episode';

export interface SpotifySearchResult {
  tracks?: { items: SpotifyTrack[] };
  artists?: { items: SpotifyArtist[] };
  albums?: { items: SpotifyAlbum[] };
  playlists?: { items: SpotifyPlaylist[] };
  shows?: { items: Array<{ id: string; name: string; publisher: string; images: SpotifyImage[]; total_episodes?: number }> };
  episodes?: { items: Array<{ id: string; name: string; description: string; duration_ms: number; images: SpotifyImage[]; release_date: string }> };
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  source: 'NATIVE_WINDOWS' | 'SPOTIFY_API' | 'LOCAL_SYSTEM';
  action: string;
  endpoint?: string;
  status: 'SUCCESS' | 'ERROR' | 'PENDING' | 'INFO';
  statusCode?: number;
  latencyMs: number;
  details?: Record<string, unknown> | string;
}
