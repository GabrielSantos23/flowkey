import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Heart, HeartOff, Music2, RotateCw, Disc } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { useHotkeyBindings } from "../hooks/useHotkeyBindings";
import { SpotifyPlaybackState, SpotifyTrack } from "../types/spotify";
import { spotifyService, openExternalLink } from "../services/spotifyApi";
import { AlbumTracksOverlayView } from "./AlbumTracksOverlayView";
import { SpotifyIcon } from "../assets/spotify-icon";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { OverlayToast } from "./toasts/OverlayToast";
import {
  OverlayActionsMenuPopover,
  OverlayActionItem,
} from "./OverlayActionsMenuPopover";
import { buildNowPlayingActions } from "../utils/overlayActions";
import { ActionCloseIcon } from "./OverlayActionIcons";

type OverlayView = "now_playing" | "album_tracks";

const OVERLAY_STATE_STORAGE_KEY = "flowkey_overlay_saved_view";
const RESTORE_TIMEOUT_MS = 60 * 1000; // 1 minute (60 seconds)

interface SavedOverlayState {
  view: OverlayView;
  albumId: string | null;
  timestamp: number;
}

const getInitialOverlayState = (): {
  view: OverlayView;
  albumId: string | null;
} => {
  try {
    const raw = localStorage.getItem(OVERLAY_STATE_STORAGE_KEY);
    if (raw) {
      const saved: SavedOverlayState = JSON.parse(raw);
      if (Date.now() - saved.timestamp < RESTORE_TIMEOUT_MS) {
        if (saved.view === "album_tracks" && saved.albumId) {
          return { view: "album_tracks", albumId: saved.albumId };
        }
      }
    }
  } catch (e) {
    console.warn("Error reading initial overlay state:", e);
  }
  return { view: "now_playing", albumId: null };
};

export const NowPlayingOverlayWindow: React.FC = () => {
  const initial = getInitialOverlayState();
  const [currentView, setCurrentView] = useState<OverlayView>(initial.view);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(
    initial.albumId,
  );

  const { getShortcut } = useHotkeyBindings();

  const playPauseShortcut = getShortcut("play_pause", ["↵"]);
  const likeShortcut = getShortcut("toggle_liked", ["Ctrl", "L"]);
  const nextShortcut = getShortcut("next_track", ["Ctrl", "→"]);
  const prevShortcut = getShortcut("prev_track", ["Ctrl", "←"]);
  const radioShortcut = getShortcut("artist_radio", ["Ctrl", "Shift", "R"]);
  const albumShortcut = getShortcut("view_album", ["Ctrl", "Shift", "A"]);
  const playlistShortcut = getShortcut("add_to_playlist", ["Ctrl", "A"]);
  const queueShortcut = getShortcut("add_to_queue", ["Alt", "Q"]);
  const searchShortcut = getShortcut("open_search", ["Ctrl", "F"]);
  const spotifyShortcut = getShortcut("open_spotify", ["Ctrl", "S"]);

  const [playbackState, setPlaybackState] =
    useState<SpotifyPlaybackState | null>(null);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [likeLoading, setLikeLoading] = useState<boolean>(false);
  const [isActionsOpen, setIsActionsOpen] = useState<boolean>(false);
  const [popoverMode, setPopoverMode] = useState<"actions" | "playlist">("actions");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }, []);

  const track = playbackState?.item;
  const isPlaying = playbackState?.is_playing ?? false;
  const trackRef = useRef<SpotifyTrack | undefined>(track);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Persist current view & arguments to localStorage
  const saveCurrentViewState = useCallback(
    (
      view: OverlayView = currentView,
      albumId: string | null = activeAlbumId,
    ) => {
      try {
        const state: SavedOverlayState = {
          view,
          albumId,
          timestamp: Date.now(),
        };
        localStorage.setItem(OVERLAY_STATE_STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("Failed to persist overlay state:", e);
      }
    },
    [currentView, activeAlbumId],
  );

  // Sync state changes to storage
  useEffect(() => {
    saveCurrentViewState(currentView, activeAlbumId);
  }, [currentView, activeAlbumId, saveCurrentViewState]);

  // Restore previous view if within 1 minute, otherwise default to now_playing
  const restoreOrResetView = useCallback(() => {
    try {
      const raw = localStorage.getItem(OVERLAY_STATE_STORAGE_KEY);
      if (raw) {
        const saved: SavedOverlayState = JSON.parse(raw);
        if (Date.now() - saved.timestamp < RESTORE_TIMEOUT_MS) {
          if (saved.view === "album_tracks" && saved.albumId) {
            setCurrentView("album_tracks");
            setActiveAlbumId(saved.albumId);
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Error restoring overlay state:", e);
    }
    // Expired or now_playing
    setCurrentView("now_playing");
    setActiveAlbumId(null);
  }, []);

  const fetchState = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 3000) {
      return;
    }
    lastFetchRef.current = now;

    try {
      const res = await spotifyService.getNowPlaying();
      if (res.data.item) {
        const newTrackId = res.data.item.id;
        setPlaybackState((prev) => {
          if (prev?.item?.id !== newTrackId) {
            spotifyService.checkIsTrackLiked(newTrackId).then((liked) => {
              setIsLiked(liked);
            });
          }
          return res.data;
        });
      }
    } catch (e) {
      console.warn("Overlay fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClose = useCallback(async () => {
    // Record current timestamp upon closing to start the 1-minute countdown
    saveCurrentViewState(currentView, activeAlbumId);
    try {
      await invoke("hide_now_playing_overlay");
    } catch {
      window.close();
    }
  }, [currentView, activeAlbumId, saveCurrentViewState]);

  useEffect(() => {
    fetchState(true);

    let authBc: BroadcastChannel | null = null;
    let likedBc: BroadcastChannel | null = null;
    let actionBc: BroadcastChannel | null = null;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      authBc = new BroadcastChannel("flowkey_spotify_auth");
      authBc.onmessage = (event) => {
        if (event.data?.type === "TOKEN_RECEIVED") {
          fetchState(true);
        }
      };

      likedBc = new BroadcastChannel("flowkey_liked_sync");
      likedBc.onmessage = (event) => {
        if (event.data?.type === "LIKED_CHANGED") {
          const { trackId: changedTrackId, isLiked: newIsLiked } = event.data;
          if (!trackRef.current || trackRef.current.id === changedTrackId) {
            setIsLiked(newIsLiked);
            showToast(newIsLiked ? "Saved to Liked Songs" : "Removed from Liked Songs");
          }
        }
      };

      actionBc = new BroadcastChannel("flowkey_overlay_action_sync");
      actionBc.onmessage = (event) => {
        if (event.data?.type === "OPEN_PLAYLIST_MENU") {
          setPopoverMode("playlist");
          setIsActionsOpen(true);
        } else if (event.data?.type === "TRIGGER_QUEUE") {
          handleAddToQueue();
        }
      };
    }

    let unlistenTrigger: (() => void) | undefined;
    let unlistenBlur: (() => void) | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();

      appWindow
        .listen("overlay_trigger", () => {
          restoreOrResetView();
          fetchState(true);
        })
        .then((fn) => {
          unlistenTrigger = fn;
        });

      appWindow
        .listen("tauri://blur", () => {
          handleClose();
        })
        .then((fn) => {
          unlistenBlur = fn;
        });
    } catch {}

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keyup", handleKeyUpGlobal);

    return () => {
      unlistenTrigger?.();
      unlistenBlur?.();
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keyup", handleKeyUpGlobal);
      authBc?.close();
      likedBc?.close();
      actionBc?.close();
    };
  }, [fetchState, handleClose, restoreOrResetView, showToast]);

  const handleTogglePlay = async () => {
    if (!playPauseShortcut.enabled) return;
    try {
      await invoke("native_play_pause");
      setTimeout(() => fetchState(true), 300);
    } catch (e) {
      console.error("Play/Pause error:", e);
    }
  };

  const handleNext = async () => {
    if (!nextShortcut.enabled) return;
    try {
      await invoke("native_next_track");
      setTimeout(() => fetchState(true), 400);
    } catch (e) {
      console.error("Next track error:", e);
    }
  };

  const handlePrev = async () => {
    if (!prevShortcut.enabled) return;
    try {
      await invoke("native_prev_track");
      setTimeout(() => fetchState(true), 400);
    } catch (e) {
      console.error("Prev track error:", e);
    }
  };

  const handleToggleLike = async () => {
    if (!likeShortcut.enabled || !track?.id || likeLoading) return;
    setLikeLoading(true);
    const target = !isLiked;
    setIsLiked(target);
    try {
      if (target) {
        await spotifyService.saveTrackToLiked(track.id);
        showToast("Saved to Liked Songs");
        await invoke("show_track_toast", {
          payload: {
            action: "like",
            title: "Saved to Liked Songs",
            artist: track.artists?.map((a: any) => a.name).join(", ") || "",
            album_art: track.album?.images?.[0]?.url || "",
          },
        });
      } else {
        await spotifyService.removeTrackFromLiked(track.id);
        showToast("Removed from Liked Songs");
        await invoke("show_track_toast", {
          payload: {
            action: "dislike",
            title: "Removed from Liked Songs",
            artist: track.artists?.map((a: any) => a.name).join(", ") || "",
            album_art: track.album?.images?.[0]?.url || "",
          },
        });
      }
    } catch (e) {
      console.error("Toggle like error:", e);
      setIsLiked(!target);
      showToast("Failed to update Liked status");
    } finally {
      setLikeLoading(false);
    }
  };

  const handleStartRadio = async () => {
    if (!radioShortcut.enabled) return;
    if (track?.artists?.[0]?.id) {
      try {
        await spotifyService.playArtistRadio(track.artists[0].id, track.id);
        setTimeout(() => fetchState(true), 500);
      } catch (e) {
        console.error("Start Radio error:", e);
      }
    }
  };

  const handleGoToAlbum = () => {
    if (!albumShortcut.enabled) return;
    if (track?.album?.id) {
      setActiveAlbumId(track.album.id);
      setCurrentView("album_tracks");
    }
  };

  const handleAddToQueue = async () => {
    if (!queueShortcut.enabled || !track?.uri) return;
    try {
      await spotifyService.addTrackToQueue(track.uri);
      showToast(`Queued: ${track.name}`);
    } catch (e: any) {
      showToast(e?.message || "Failed to add to queue");
    }
  };

  const handleOpenInSpotify = () => {
    if (!spotifyShortcut.enabled) return;
    if (track) {
      openExternalLink(track.uri || `spotify:track:${track.id}`);
    }
  };

  const actionsList: OverlayActionItem[] = buildNowPlayingActions({
    isPlaying,
    isLiked,
    shortcuts: {
      playPause: playPauseShortcut,
      like: likeShortcut,
      next: nextShortcut,
      prev: prevShortcut,
      radio: radioShortcut,
      album: albumShortcut,
      playlist: playlistShortcut,
      queue: queueShortcut,
      search: searchShortcut,
      spotify: spotifyShortcut,
    },
    handlers: {
      onTogglePlay: handleTogglePlay,
      onToggleLike: handleToggleLike,
      onNext: handleNext,
      onPrev: handlePrev,
      onStartRadio: handleStartRadio,
      onGoToAlbum: handleGoToAlbum,
      onOpenPlaylist: () => {
        setPopoverMode("playlist");
        setIsActionsOpen(true);
      },
      onAddToQueue: handleAddToQueue,
      onOpenSpotify: handleOpenInSpotify,
    },
  });

  useEffect(() => {
    if (currentView !== "now_playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Windows OS system menu (Alt / Alt+Space)
      if (
        e.key === "Alt" ||
        (e.altKey && (e.key === " " || e.key === "Space"))
      ) {
        e.preventDefault();
      }

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPopoverMode("actions");
        setIsActionsOpen((prev) => !prev);
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === "a") {
        if (!playlistShortcut.enabled) return;
        e.preventDefault();
        setPopoverMode("playlist");
        setIsActionsOpen(true);
        return;
      }

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
        if (!queueShortcut.enabled) return;
        e.preventDefault();
        handleAddToQueue();
        return;
      }

      if ((e.ctrlKey && e.key.toLowerCase() === "f") || e.key === "/") {
        if (!searchShortcut.enabled) return;
        e.preventDefault();
        invoke("show_search_overlay").catch(console.error);
        return;
      }

      if (isActionsOpen) {
        // OverlayActionsMenuPopover handles its own internal navigation
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Enter" || e.key === " ") {
        if (!playPauseShortcut.enabled) return;
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key.toLowerCase() === "l") {
        if (!likeShortcut.enabled) return;
        e.preventDefault();
        handleToggleLike();
      } else if (e.key === "ArrowRight") {
        if (!nextShortcut.enabled) return;
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        if (!prevShortcut.enabled) return;
        e.preventDefault();
        handlePrev();
      } else if (
        e.key.toLowerCase() === "o" ||
        (e.altKey && e.key.toLowerCase() === "o")
      ) {
        if (!albumShortcut.enabled) return;
        e.preventDefault();
        handleGoToAlbum();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentView,
    isActionsOpen,
    track?.id,
    isLiked,
    isPlaying,
    playPauseShortcut.enabled,
    likeShortcut.enabled,
    nextShortcut.enabled,
    prevShortcut.enabled,
    albumShortcut.enabled,
    playlistShortcut.enabled,
    searchShortcut.enabled,
  ]);

  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const albumImage = track?.album?.images?.[0]?.url;
  const artistNames =
    track?.artists?.map((a) => a.name).join(", ") || "Unknown Artist";

  return (
    <div
      data-tauri-drag-region
      className="w-screen h-screen bg-background/95 backdrop-blur-2xl text-foreground flex flex-col justify-between px-5 py-3.5 select-none font-sans border border-border rounded-xl shadow-2xl overflow-hidden relative"
    >
      {currentView === "now_playing" && albumImage && (
        <div
          className="absolute -top-16 -left-16 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url(${albumImage})`,
            backgroundSize: "cover",
          }}
        />
      )}

      {currentView === "album_tracks" && activeAlbumId ? (
        <AlbumTracksOverlayView
          albumId={activeAlbumId}
          onBack={() => setCurrentView("now_playing")}
        />
      ) : (
        <>
          <OverlayToast message={toastMessage} />
          <div className="flex items-center justify-between pb-2 border-b border-border/50 relative z-20 shrink-0">
            {loading && !track ? (
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
            ) : track ? (
              <div className="flex flex-col min-w-0 pr-3">
                <h1 className="text-sm font-bold text-foreground truncate max-w-90 leading-tight">
                  {track.name}
                </h1>
                <span className="text-[11px] text-muted-foreground truncate max-w-[320px] mt-0.5">
                  by {artistNames}
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                Flowkey Overlay
              </span>
            )}

            <button
              onClick={handleClose}
              className="p-1 rounded-md bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 ml-2"
              title="Close (Esc)"
            >
              <ActionCloseIcon />
            </button>
          </div>

          {loading && !track ? (
            <div className="flex-1 flex gap-5 min-h-0 items-center animate-fade-in py-2">
              <Skeleton className="w-51.25 h-51.25 rounded-xl shrink-0" />

              <div className="w-52 flex flex-col justify-center space-y-3 border-l border-border pl-5 shrink-0">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                    Duration
                  </span>
                  <Skeleton className="h-4 w-20 rounded-md" />
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                    Artist
                  </span>
                  <Skeleton className="h-4 w-36 rounded-md" />
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                    Album
                  </span>
                  <Skeleton className="h-4 w-40 rounded-md" />
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                    Liked
                  </span>
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              </div>
            </div>
          ) : track ? (
            <div className="flex-1 flex gap-5 min-h-0 items-center animate-fade-in py-2">
              <div className="flex items-center justify-center shrink-0">
                <div
                  onClick={handleGoToAlbum}
                  className="w-51.25 h-51.25 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shadow-2xl shrink-0 relative group cursor-pointer"
                  title="Click to view album tracks"
                >
                  {albumImage ? (
                    <img
                      src={albumImage}
                      alt={track.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <Music2 className="w-12 h-12" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-semibold text-white backdrop-blur-xs transition-opacity rounded-xl">
                    View Album
                  </div>
                </div>
              </div>

              <div className="w-52 flex flex-col justify-center space-y-2.5 text-xs border-l border-border pl-5 shrink-0">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Duration
                  </span>
                  <span className="text-xs font-semibold text-foreground font-mono block mt-0.5">
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Artist
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate block mt-0.5">
                    {artistNames}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Album
                  </span>
                  <button
                    onClick={handleGoToAlbum}
                    className="text-xs font-semibold text-primary hover:text-foreground truncate block mt-0.5 text-left hover:underline cursor-pointer"
                  >
                    {track.album?.name || "Single / EP"}
                  </button>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Liked
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isLiked ? (
                      <>
                        <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        <span className="text-xs font-bold text-rose-400">
                          Yes
                        </span>
                      </>
                    ) : (
                      <>
                        <HeartOff className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          No
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <Disc className="w-10 h-10 text-muted-foreground mb-2 animate-spin" />
              <h2 className="text-sm font-bold text-foreground">
                No Track Currently Playing
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Start playing any song in Spotify to view live information.
              </p>
              <button
                onClick={() => fetchState(true)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-card hover:bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Refresh Playback</span>
              </button>
            </div>
          )}

          <OverlayActionsMenuPopover
            isOpen={isActionsOpen}
            onClose={() => setIsActionsOpen(false)}
            actions={actionsList}
            initialMode={popoverMode}
            trackUri={
              track?.uri ||
              (track?.id ? `spotify:track:${track.id}` : undefined)
            }
            trackName={track?.name}
            onShowToast={showToast}
            className="bottom-14 right-6"
          />

          <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center text-black">
                <SpotifyIcon color="#1ED760" lineColor="#00000" />
              </div>
              <span className="font-semibold text-foreground text-xs">
                Now Playing
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-muted-foreground font-medium text-[11px]">
              <button
                onClick={handleTogglePlay}
                disabled={!playPauseShortcut.enabled}
                className={`flex items-center gap-1.5 transition-colors ${
                  !playPauseShortcut.enabled
                    ? "opacity-30 cursor-not-allowed pointer-events-none"
                    : "hover:text-foreground cursor-pointer"
                }`}
              >
                <span>{isPlaying ? "Pause" : "Play"}</span>
                <KbdGroup>
                  {playPauseShortcut.keys.map((k, i) => (
                    <Kbd
                      key={i}
                      className="text-[10px] h-4.5 px-1.5 text-muted-foreground"
                    >
                      {k}
                    </Kbd>
                  ))}
                </KbdGroup>
              </button>

              <span className="text-border">|</span>

              <button
                onClick={() => setIsActionsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  isActionsOpen
                    ? "bg-primary/20 border-primary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                title="Toggle Actions Menu (Ctrl+K or Alt+K)"
              >
                <span>Actions</span>
                <KbdGroup>
                  <Kbd
                    className={`${isActionsOpen ? "text-foreground" : "text-muted-foreground"}text-[10px] h-4.5 px-1`}
                  >
                    Ctrl
                  </Kbd>
                  <Kbd
                    className={`${isActionsOpen ? "text-foreground" : "text-muted-foreground"}text-[10px] h-4.5 px-1`}
                  >
                    K
                  </Kbd>
                </KbdGroup>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
