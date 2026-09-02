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
  uri?: string;
}

export interface SpotifyAlbumTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  explicit?: boolean;
  uri: string;
  artists?: Array<{ id: string; name: string }>;
  preview_url?: string | null;
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
  tracks?: {
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

export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack | null;
  added_at?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: SpotifyImage[];
  owner: { display_name: string; id: string };
  tracks: { total: number; items?: SpotifyPlaylistTrackItem[] };
  snapshot_id?: string;
  public?: boolean;
  collaborative?: boolean;
  uri?: string;
  is_user_owned?: boolean;
}

export type SearchCategoryFilter = "all" | "tracks" | "artists" | "albums" | "playlists";

export interface SpotifySearchResult {
  tracks?: { items: SpotifyTrack[] };
  artists?: { items: SpotifyArtist[] };
  albums?: { items: SpotifyAlbum[] };
  playlists?: { items: SpotifyPlaylist[] };
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  images?: SpotifyImage[];
}

export type SpotifySearchViewState =
  | { type: "search" }
  | { type: "artist"; artist: SpotifyArtist }
  | { type: "album"; albumId: string; albumName?: string; albumCover?: string; artistName?: string }
  | { type: "playlist"; playlistId: string; playlistName?: string; playlistCover?: string; isUserOwned?: boolean };
