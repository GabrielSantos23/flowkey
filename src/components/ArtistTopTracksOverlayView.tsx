import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Radio, Music2 } from "lucide-react";
import { Kbd, KbdGroup } from "./ui/kbd";
import { Skeleton } from "./ui/skeleton";
import { useHotkeyBindings } from "../hooks/useHotkeyBindings";
import { ActionBackIcon } from "./OverlayActionIcons";
import { OverlayActionsMenuPopover, OverlayActionItem } from "./OverlayActionsMenuPopover";
import { OverlayToast } from "./toasts/OverlayToast";
import { buildTrackActions } from "../utils/overlayActions";
import { spotifyService } from "../services/spotifyApi";
import { SpotifyArtist, SpotifyTrack } from "../types/spotify";

interface ArtistTopTracksOverlayViewProps {
  artist: SpotifyArtist;
  onBack: () => void;
}

export const ArtistTopTracksOverlayView: React.FC<ArtistTopTracksOverlayViewProps> = ({
  artist,
  onBack,
}) => {
  const { getShortcut } = useHotkeyBindings();

  const playPauseShortcut = getShortcut("play_pause", ["↵"]);
  const radioShortcut = getShortcut("artist_radio", ["Ctrl", "Shift", "R"]);
  const playlistShortcut = getShortcut("add_to_playlist", ["Alt", "A"]);
  const queueShortcut = getShortcut("add_to_queue", ["Alt", "Q"]);

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popoverMode, setPopoverMode] = useState<"actions" | "playlist">("actions");
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Fetch top 10 tracks
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    spotifyService
      .getArtistTopTracks(artist.id, artist.name)
      .then((res) => {
        if (mounted) {
          setTracks(res.items || []);
        }
      })
      .catch((err) => {
        console.warn("Failed to load top tracks:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [artist.id, artist.name]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artists?.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [tracks, searchQuery]);

  const selectedTrack: SpotifyTrack | undefined = filteredTracks[selectedIndex];

  const handlePlayTrack = useCallback(async (track?: SpotifyTrack) => {
    if (!playPauseShortcut.enabled) return;
    const target = track || selectedTrack;
    if (!target) return;
    try {
      await spotifyService.playTrack(target.uri);
      showToast(`Playing ${target.name}`);
    } catch (e: any) {
      showToast(e?.message || "Play track failed");
    }
  }, [selectedTrack, playPauseShortcut.enabled, showToast]);

  const handleAddToQueue = useCallback(async (track?: SpotifyTrack) => {
    if (!queueShortcut.enabled) return;
    const target = track || selectedTrack;
    if (!target?.uri) return;
    try {
      await spotifyService.addTrackToQueue(target.uri);
      showToast(`Added to Queue: ${target.name}`);
    } catch (e: any) {
      showToast(e?.message || "Failed to add to queue");
    }
  }, [selectedTrack, queueShortcut.enabled, showToast]);

  const actionsList: OverlayActionItem[] = useMemo(() => {
    if (!selectedTrack) return [];
    return buildTrackActions({
      track: selectedTrack,
      artistId: artist.id,
      shortcuts: {
        playPause: playPauseShortcut,
        radio: radioShortcut,
        playlist: playlistShortcut,
        queue: queueShortcut,
      },
      onPlay: handlePlayTrack,
      onOpenPlaylist: () => {
        setPopoverMode("playlist");
        setIsActionsOpen(true);
      },
      onAddToQueue: () => handleAddToQueue(),
      showToast,
    });
  }, [
    selectedTrack,
    handlePlayTrack,
    handleAddToQueue,
    artist.id,
    showToast,
    playPauseShortcut,
    radioShortcut,
    playlistShortcut,
    queueShortcut,
  ]);

  // Broadcast channel sync for overlay actions
  useEffect(() => {
    let actionBc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      actionBc = new BroadcastChannel("flowkey_overlay_action_sync");
      actionBc.onmessage = (event) => {
        if (event.data?.type === "OPEN_PLAYLIST_MENU") {
          if (playlistShortcut.enabled && selectedTrack) {
            setPopoverMode("playlist");
            setIsActionsOpen(true);
          }
        } else if (event.data?.type === "TRIGGER_QUEUE") {
          if (queueShortcut.enabled && selectedTrack) {
            handleAddToQueue();
          }
        }
      };
    }
    return () => {
      actionBc?.close();
    };
  }, [playlistShortcut.enabled, queueShortcut.enabled, selectedTrack, handleAddToQueue]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt" || (e.altKey && (e.key === " " || e.key === "Space"))) {
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPopoverMode("actions");
        setIsActionsOpen((prev) => !prev);
        return;
      }

      // Add to Playlist (Alt+A or custom shortcut)
      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        if (!playlistShortcut.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        setPopoverMode("playlist");
        setIsActionsOpen(true);
        return;
      }

      // Add to Queue (Alt+Q or custom shortcut)
      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
        if (!queueShortcut.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        handleAddToQueue();
        return;
      }

      if (isActionsOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredTracks.length > 0 ? (prev + 1) % filteredTracks.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredTracks.length > 0
            ? (prev - 1 + filteredTracks.length) % filteredTracks.length
            : 0
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePlayTrack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isActionsOpen,
    filteredTracks,
    handlePlayTrack,
    handleAddToQueue,
    playlistShortcut.enabled,
    queueShortcut.enabled,
    onBack,
  ]);

  // Auto-scroll selected item
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="w-full h-full flex flex-col justify-between select-none font-sans relative">
      <OverlayToast message={toastMessage} />

      {/* Header matching Image 3: [ ← ] + Search songs input */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-border/50 relative z-10 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md bg-card/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          title="Back (Esc)"
        >
          <ActionBackIcon />
        </button>

        <div className="flex-1 flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search songs..."
            className="w-full bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none px-1 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Popular Songs Scrollable List */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5 space-y-0.5 scroll-smooth pr-1 my-0.5">
        {loading ? (
          <div className="space-y-1.5 py-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-5.5 h-5.5 rounded-xs" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3.5 w-10 rounded" />
              </div>
            ))}
          </div>
        ) : filteredTracks.length > 0 ? (
          filteredTracks.map((item, index) => {
            const isSelected = selectedIndex === index;
            const artistNames =
              item.artists?.map((a) => a.name).join(", ") || artist.name;
            const img = item.album?.images?.[0]?.url;

            return (
              <div
                key={item.id || index}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => setSelectedIndex(index)}
                onDoubleClick={() => handlePlayTrack(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer group ${
                  isSelected
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                {/* Left: Thumbnail & Inline Title + Artist */}
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <div className="w-5.5 h-5.5 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {img ? (
                      <img
                        src={img}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music2 className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex items-baseline gap-2 truncate">
                    <span className="text-xs font-bold text-foreground truncate">
                      {item.name}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground truncate">
                      {artistNames}
                    </span>
                  </div>
                </div>

                {/* Right: Duration */}
                <div className="text-xs font-mono text-muted-foreground shrink-0 font-medium">
                  {formatDuration(item.duration_ms)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground font-mono">
            <span>No songs found</span>
          </div>
        )}
      </div>

      {/* Actions Popover */}
      <OverlayActionsMenuPopover
        isOpen={isActionsOpen}
        onClose={() => setIsActionsOpen(false)}
        initialMode={popoverMode}
        actions={actionsList}
        trackUri={selectedTrack?.uri}
        trackName={selectedTrack?.name}
        onShowToast={showToast}
        className="bottom-14 right-0"
      />

      {/* Bottom Footer matching Image 3 */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center text-black">
            <Radio className="w-3 h-3 text-black fill-black" />
          </div>
          <span className="font-semibold text-foreground text-xs">Search</span>
        </div>

        <div className="flex items-center gap-2.5 text-muted-foreground font-medium text-[11px]">
          <button
            onClick={() => handlePlayTrack()}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
          >
            <span>Play</span>
            <KbdGroup>
              <Kbd className="text-[10px] h-4.5 px-1.5 text-foreground">↵</Kbd>
            </KbdGroup>
          </button>

          <span className="text-border">|</span>

          <button
            onClick={() => setIsActionsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
          >
            <span>Actions</span>
            <KbdGroup>
              <Kbd className="text-[10px] h-4.5 px-1 text-foreground">Ctrl</Kbd>
              <Kbd className="text-[10px] h-4.5 px-1 text-foreground">K</Kbd>
            </KbdGroup>
          </button>
        </div>
      </div>
    </div>
  );
};
