import { Music2, Trash2 } from "lucide-react";
import { OverlayActionItem } from "../components/OverlayActionsMenuPopover";
import {
  ActionPlayIcon,
  ActionPauseIcon,
  ActionLikeIcon,
  ActionUnlikeIcon,
  ActionNextIcon,
  ActionPrevIcon,
  ActionRadioIcon,
  ActionAlbumIcon,
  ActionPlaylistIcon,
  ActionSearchIcon,
  ActionSpotifyIcon,
  ActionQueueIcon,
  ActionShuffleIcon,
} from "../components/OverlayActionIcons";
import { SpotifyArtist, SpotifyAlbum, SpotifyPlaylist } from "../types/spotify";
import { spotifyService, openExternalLink } from "../services/spotifyApi";
import { invoke } from "@tauri-apps/api/core";

export interface HotkeyShortcutInfo {
  keys: string[];
  enabled: boolean;
}

export interface NowPlayingActionsConfig {
  isPlaying: boolean;
  isLiked: boolean;
  shortcuts: {
    playPause: HotkeyShortcutInfo;
    like: HotkeyShortcutInfo;
    next: HotkeyShortcutInfo;
    prev: HotkeyShortcutInfo;
    radio: HotkeyShortcutInfo;
    album: HotkeyShortcutInfo;
    playlist: HotkeyShortcutInfo;
    queue?: HotkeyShortcutInfo;
    search: HotkeyShortcutInfo;
    spotify: HotkeyShortcutInfo;
  };
  handlers: {
    onTogglePlay: () => void | Promise<void>;
    onToggleLike: () => void | Promise<void>;
    onNext: () => void | Promise<void>;
    onPrev: () => void | Promise<void>;
    onStartRadio: () => void | Promise<void>;
    onGoToAlbum: () => void | Promise<void>;
    onOpenPlaylist: () => void;
    onAddToQueue?: () => void | Promise<void>;
    onOpenSpotify: () => void | Promise<void>;
  };
}

export function buildNowPlayingActions(
  config: NowPlayingActionsConfig,
): OverlayActionItem[] {
  const { isPlaying, isLiked, shortcuts, handlers } = config;
  return [
    {
      id: "play_pause",
      label: isPlaying ? "Pause" : "Play",
      icon: isPlaying ? <ActionPauseIcon /> : <ActionPlayIcon />,
      shortcut: shortcuts.playPause.keys,
      action: handlers.onTogglePlay,
      disabled: !shortcuts.playPause.enabled,
    },
    {
      id: "like",
      label: isLiked ? "Unlike" : "Like",
      icon: isLiked ? (
        <ActionLikeIcon />
      ) : (
        <ActionUnlikeIcon className="text-white" />
      ),
      shortcut: shortcuts.like.keys,
      action: handlers.onToggleLike,
      disabled: !shortcuts.like.enabled,
    },
    {
      id: "next",
      label: "Next",
      icon: <ActionNextIcon />,
      shortcut: shortcuts.next.keys,
      action: handlers.onNext,
      disabled: !shortcuts.next.enabled,
    },
    {
      id: "prev",
      label: "Previous",
      icon: <ActionPrevIcon />,
      shortcut: shortcuts.prev.keys,
      action: handlers.onPrev,
      disabled: !shortcuts.prev.enabled,
    },
    {
      id: "radio",
      label: "Start Radio",
      icon: <ActionRadioIcon />,
      shortcut: shortcuts.radio.keys,
      action: handlers.onStartRadio,
      disabled: !shortcuts.radio.enabled,
    },
    {
      id: "album",
      label: "Go to Album",
      icon: <ActionAlbumIcon />,
      shortcut: shortcuts.album.keys,
      action: handlers.onGoToAlbum,
      disabled: !shortcuts.album.enabled,
    },
    {
      id: "playlist",
      label: "Add to Playlist...",
      icon: <ActionPlaylistIcon />,
      shortcut: shortcuts.playlist.keys,
      action: handlers.onOpenPlaylist,
      disabled: !shortcuts.playlist.enabled,
    },
    ...(handlers.onAddToQueue
      ? [
          {
            id: "queue",
            label: "Add to Queue",
            icon: <ActionQueueIcon />,
            shortcut: shortcuts.queue?.keys || ["Alt", "Q"],
            action: handlers.onAddToQueue,
            disabled: shortcuts.queue ? !shortcuts.queue.enabled : false,
          },
        ]
      : []),
    {
      id: "search",
      label: "Search Spotify...",
      icon: <ActionSearchIcon className="text-white" />,
      shortcut: shortcuts.search.keys,
      action: async () => {
        try {
          await invoke("show_search_overlay");
        } catch (e) {
          console.error(e);
        }
      },
      disabled: !shortcuts.search.enabled,
    },
    {
      id: "spotify",
      label: "Open in Spotify",
      icon: <ActionSpotifyIcon />,
      shortcut: shortcuts.spotify.keys,
      action: handlers.onOpenSpotify,
      disabled: !shortcuts.spotify.enabled,
    },
  ];
}

export interface TrackActionsConfig {
  track: {
    id?: string;
    name: string;
    uri: string;
    artists?: { id?: string; name?: string }[];
    album?: { id?: string; name?: string };
  };
  albumId?: string;
  artistId?: string;
  shortcuts: {
    playPause: HotkeyShortcutInfo;
    radio: HotkeyShortcutInfo;
    playlist: HotkeyShortcutInfo;
    queue?: HotkeyShortcutInfo;
    album?: HotkeyShortcutInfo;
  };
  onPlay?: () => void | Promise<void>;
  onSelectAlbum?: (albumId: string) => void;
  onOpenPlaylist: () => void;
  onAddToQueue?: () => void | Promise<void>;
  showToast: (msg: string) => void;
}

export function buildTrackActions(
  config: TrackActionsConfig,
): OverlayActionItem[] {
  const {
    track,
    albumId,
    artistId,
    shortcuts,
    onPlay,
    onSelectAlbum,
    onOpenPlaylist,
    onAddToQueue,
    showToast,
  } = config;
  const targetArtistId = artistId || track.artists?.[0]?.id;
  const targetAlbumId = albumId || track.album?.id;
  const albumShortcut = shortcuts.album || {
    keys: ["Ctrl", "Shift", "A"],
    enabled: true,
  };

  const actions: OverlayActionItem[] = [
    {
      id: "play",
      label: "Play",
      icon: <ActionPlayIcon />,
      shortcut: shortcuts.playPause.keys,
      action: async () => {
        if (onPlay) {
          await onPlay();
        } else {
          await spotifyService.playTrack(track.uri);
          showToast(`Playing ${track.name}`);
        }
      },
      disabled: !shortcuts.playPause.enabled,
    },
    ...(onSelectAlbum && targetAlbumId
      ? [
          {
            id: "show_album_songs",
            label: "Show Album Songs",
            icon: <ActionAlbumIcon />,
            shortcut: albumShortcut.keys,
            action: () => onSelectAlbum(targetAlbumId),
            disabled: !albumShortcut.enabled,
          },
        ]
      : []),
    {
      id: "queue",
      label: "Add to Queue",
      icon: <ActionQueueIcon />,
      shortcut: shortcuts.queue?.keys || ["Alt", "Q"],
      action: async () => {
        if (onAddToQueue) {
          await onAddToQueue();
        } else {
          try {
            await spotifyService.addTrackToQueue(track.uri);
            showToast(`Queued: ${track.name}`);
          } catch (e: any) {
            showToast(e?.message || "Failed to add to queue");
          }
        }
      },
      disabled: shortcuts.queue ? !shortcuts.queue.enabled : false,
    },
    {
      id: "radio",
      label: "Start Radio",
      icon: <ActionRadioIcon />,
      shortcut: shortcuts.radio.keys,
      action: async () => {
        if (targetArtistId) {
          try {
            await spotifyService.playArtistRadio(targetArtistId, track.id);
            showToast(`Radio for ${track.name}`);
          } catch (e: any) {
            showToast(e?.message || "Failed to start radio");
          }
        }
      },
      disabled: !shortcuts.radio.enabled,
    },
    {
      id: "playlist",
      label: "Add to Playlist...",
      icon: <ActionPlaylistIcon />,
      shortcut: shortcuts.playlist.keys,
      action: onOpenPlaylist,
      disabled: !shortcuts.playlist.enabled,
    },
  ];

  return actions;
}

export interface ArtistActionsConfig {
  artist: SpotifyArtist;
  shortcuts: {
    playPause: HotkeyShortcutInfo;
    album: HotkeyShortcutInfo;
    radio: HotkeyShortcutInfo;
  };
  onPlay?: () => void | Promise<void>;
  onSelectArtistAlbums: (artist: SpotifyArtist) => void;
  onSelectArtistTopTracks: (artist: SpotifyArtist) => void;
  showToast: (msg: string) => void;
}

export function buildArtistActions(
  config: ArtistActionsConfig,
): OverlayActionItem[] {
  const {
    artist,
    shortcuts,
    onPlay,
    onSelectArtistAlbums,
    onSelectArtistTopTracks,
    showToast,
  } = config;

  return [
    {
      id: "play",
      label: "Play",
      icon: <ActionPlayIcon />,
      shortcut: shortcuts.playPause.keys,
      action: async () => {
        if (onPlay) {
          await onPlay();
        } else {
          await spotifyService.playArtistRadio(artist.id);
          showToast(`Playing ${artist.name} Radio`);
        }
      },
      disabled: !shortcuts.playPause.enabled,
    },
    {
      id: "show_albums",
      label: "Show Albums",
      icon: <ActionAlbumIcon />,
      shortcut: shortcuts.album.keys,
      action: () => onSelectArtistAlbums(artist),
      disabled: !shortcuts.album.enabled,
    },
    {
      id: "show_popular_songs",
      label: "Show Popular Songs",
      icon: <Music2 className="w-3.5 h-3.5" />,
      shortcut: ["Ctrl", "Y"],
      action: () => onSelectArtistTopTracks(artist),
    },
    {
      id: "start_radio",
      label: "Start Radio",
      icon: <ActionRadioIcon />,
      shortcut: shortcuts.radio.keys,
      action: async () => {
        try {
          await spotifyService.playArtistRadio(artist.id);
          showToast(`Started ${artist.name} Radio`);
        } catch (e: any) {
          showToast(e?.message || "Failed to start radio");
        }
      },
      disabled: !shortcuts.radio.enabled,
    },
  ];
}

export interface AlbumActionsConfig {
  album: SpotifyAlbum | { id: string; name: string; uri?: string };
  shortcuts: {
    playPause: HotkeyShortcutInfo;
    album: HotkeyShortcutInfo;
    like: HotkeyShortcutInfo;
    spotify: HotkeyShortcutInfo;
  };
  onPlay?: () => void | Promise<void>;
  onSelectAlbum: (albumId: string) => void;
  showToast: (msg: string) => void;
}

export function buildAlbumActions(
  config: AlbumActionsConfig,
): OverlayActionItem[] {
  const { album, shortcuts, onPlay, onSelectAlbum, showToast } = config;

  return [
    {
      id: "play",
      label: "Play",
      icon: <ActionPlayIcon />,
      shortcut: shortcuts.playPause.keys,
      action: async () => {
        if (onPlay) {
          await onPlay();
        } else {
          await spotifyService.playContext(
            album.uri || `spotify:album:${album.id}`,
          );
          showToast(`Playing ${album.name}`);
        }
      },
      disabled: !shortcuts.playPause.enabled,
    },
    {
      id: "show_songs",
      label: "Show Songs",
      icon: <ActionAlbumIcon />,
      shortcut: shortcuts.album.keys,
      action: () => onSelectAlbum(album.id),
      disabled: !shortcuts.album.enabled,
    },
    {
      id: "save_library",
      label: "Add to Library",
      icon: <ActionLikeIcon />,
      shortcut: shortcuts.like.keys,
      action: async () => {
        try {
          await spotifyService.saveAlbumToLibrary(album.id);
          showToast(`Saved ${album.name} to Library`);
        } catch (e: any) {
          showToast(e?.message || "Failed to add album to library");
        }
      },
      disabled: !shortcuts.like.enabled,
    },
    {
      id: "open_spotify",
      label: "Open on Spotify",
      icon: <ActionSpotifyIcon />,
      shortcut: shortcuts.spotify.keys,
      action: () => {
        openExternalLink(album.uri || `spotify:album:${album.id}`);
      },
      disabled: !shortcuts.spotify.enabled,
    },
  ];
}

export interface PlaylistActionsConfig {
  playlist: SpotifyPlaylist;
  shortcuts: {
    playPause: HotkeyShortcutInfo;
    spotify: HotkeyShortcutInfo;
  };
  onPlay?: () => void | Promise<void>;
  onShufflePlay?: () => void | Promise<void>;
  showToast: (msg: string) => void;
}

export function buildPlaylistActions(
  config: PlaylistActionsConfig,
): OverlayActionItem[] {
  const { playlist, shortcuts, onPlay, onShufflePlay, showToast } = config;

  return [
    {
      id: "play",
      label: "Play",
      icon: <ActionPlayIcon />,
      shortcut: shortcuts.playPause.keys,
      action: async () => {
        if (onPlay) {
          await onPlay();
        } else {
          await spotifyService.playContext(
            playlist.uri || `spotify:playlist:${playlist.id}`,
          );
          showToast(`Playing ${playlist.name}`);
        }
      },
      disabled: !shortcuts.playPause.enabled,
    },
    {
      id: "shuffle",
      label: "Shuffle Play",
      icon: <ActionShuffleIcon />,
      shortcut: ["Alt", "S"],
      action: async () => {
        if (onShufflePlay) {
          await onShufflePlay();
        } else {
          try {
            await spotifyService.setShuffle(true);
            await spotifyService.playContext(
              playlist.uri || `spotify:playlist:${playlist.id}`,
            );
            showToast(`Playing ${playlist.name} on Shuffle`);
          } catch (e: any) {
            showToast(e?.message || "Shuffle playback failed");
          }
        }
      },
    },
    {
      id: "open_spotify",
      label: "Open on Spotify",
      icon: <ActionSpotifyIcon />,
      shortcut: shortcuts.spotify.keys,
      action: () => {
        openExternalLink(playlist.uri || `spotify:playlist:${playlist.id}`);
      },
      disabled: !shortcuts.spotify.enabled,
    },
  ];
}

export interface RecentSearchActionsConfig {
  query: string;
  onSearch: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

export function buildRecentSearchActions(
  config: RecentSearchActionsConfig,
): OverlayActionItem[] {
  const { query, onSearch, onRemove, onClearAll } = config;

  return [
    {
      id: "search_again",
      label: "Search Again",
      icon: <ActionSearchIcon />,
      shortcut: ["↵"],
      action: () => onSearch(query),
    },
    {
      id: "delete_recent",
      label: "Remove from History",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      shortcut: ["Del"],
      action: () => onRemove(query),
    },
    {
      id: "clear_history",
      label: "Clear All History",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      shortcut: ["Ctrl", "Shift", "Del"],
      action: onClearAll,
    },
  ];
}
