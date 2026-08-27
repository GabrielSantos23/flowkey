import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { spotifyService } from "../services/spotifyApi";
import { SpotifyPlaylist, SpotifyTrack } from "../types/spotify";
import { OverlayToast } from "./toasts/OverlayToast";
import { ActionCloseIcon, ActionSearchIcon } from "./OverlayActionIcons";
import { ListMusic, Check, Loader2 } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

export const PlaylistPickerWindow: React.FC = () => {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await invoke("hide_playlist_picker");
    } catch {
      window.close();
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const nowPlayingRes = await spotifyService.getNowPlaying();
      const item = nowPlayingRes?.data?.item;
      if (!item || !item.uri) {
        showToast("No music currently playing");
        setTimeout(() => handleClose(), 1800);
        return;
      }
      setTrack(item);

      const playlistRes = await spotifyService.getPlaylists(true);
      setPlaylists(playlistRes?.items || []);
      setSelectedIndex(0);
    } catch (e: any) {
      console.error("PlaylistPicker load error:", e);
      showToast("Error loading track/playlists");
    } finally {
      setLoading(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [handleClose, showToast]);

  const handleAddToPlaylist = useCallback(
    async (playlist: SpotifyPlaylist) => {
      if (!track?.uri || addingId) return;
      setAddingId(playlist.id);
      try {
        await spotifyService.addTrackToPlaylist(playlist.id, track.uri);
        setAddedIds((prev) => new Set(prev).add(playlist.id));
        showToast(`Added to ${playlist.name}`);
        setTimeout(() => {
          handleClose();
        }, 1000);
      } catch (e: any) {
        showToast(e?.message || "Failed to add track");
      } finally {
        setAddingId(null);
      }
    },
    [track?.uri, addingId, showToast, handleClose],
  );

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    loadData();

    let unlistenTrigger: (() => void) | undefined;
    let unlistenBlur: (() => void) | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen("playlist_picker_trigger", () => {
          setSearchQuery("");
          setAddedIds(new Set());
          setSelectedIndex(0);
          loadData();
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

    return () => {
      unlistenTrigger?.();
      unlistenBlur?.();
    };
  }, [loadData, handleClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredPlaylists.length > 0
            ? (prev + 1) % filteredPlaylists.length
            : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredPlaylists.length > 0
            ? (prev - 1 + filteredPlaylists.length) % filteredPlaylists.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredPlaylists[selectedIndex]) {
          handleAddToPlaylist(filteredPlaylists[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredPlaylists,
    selectedIndex,
    handleAddToPlaylist,
    handleClose,
  ]);

  return (
    <div className="w-screen h-screen bg-background/95 backdrop-blur-2xl text-foreground flex flex-col justify-between p-3 select-none font-sans border border-border rounded-xl shadow-2xl overflow-hidden relative">
      <OverlayToast message={toastMessage} />

      <div className="flex items-center justify-between pb-2 border-b border-border/50 relative z-20 shrink-0">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Add to Playlist
          </span>
          <h1 className="text-xs font-bold text-foreground truncate max-w-[220px]">
            {track ? track.name : "Loading song..."}
          </h1>
        </div>

        <button
          onClick={handleClose}
          className="p-1 rounded-md bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          title="Close (Esc)"
        >
          <ActionCloseIcon />
        </button>
      </div>

      <div className="py-2 shrink-0">
        <div className="relative flex items-center">
          <div className="absolute left-2.5 text-muted-foreground pointer-events-none">
            <ActionSearchIcon />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search playlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-secondary/40 border border-border/60 rounded-lg text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
        {loading ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ) : filteredPlaylists.length > 0 ? (
          filteredPlaylists.map((pl, idx) => {
            const isAdding = addingId === pl.id;
            const isAdded = addedIds.has(pl.id);
            const isSelected = selectedIndex === idx;
            const img = pl.images?.[0]?.url;

            return (
              <button
                key={pl.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => handleAddToPlaylist(pl)}
                onMouseEnter={() => setSelectedIndex(idx)}
                disabled={isAdding}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-secondary text-foreground border-primary/60 shadow-sm"
                    : "bg-card/60 hover:bg-secondary border-border/40 hover:border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-7 h-7 rounded bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                    {img ? (
                      <img
                        src={img}
                        alt={pl.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold truncate block">
                      {pl.name}
                    </span>
                    <span className="text-[10px] opacity-75 truncate block">
                      {pl.tracks?.total ?? 0} tracks
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : isAdded ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : null}
                </div>
              </button>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground font-mono">
            No playlists found
          </div>
        )}
      </div>
    </div>
  );
};
