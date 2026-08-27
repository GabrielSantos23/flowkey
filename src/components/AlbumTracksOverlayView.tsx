import React, { useState, useEffect, useRef, useMemo } from "react";
import { Music2 } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Kbd, KbdGroup } from "./ui/kbd";
import { useHotkeyBindings } from "../hooks/useHotkeyBindings";
import { spotifyService } from "../services/spotifyApi";
import { OverlayToast } from "./toasts/OverlayToast";
import {
  OverlayActionsMenuPopover,
  OverlayActionItem,
} from "./OverlayActionsMenuPopover";
import { buildTrackActions } from "../utils/overlayActions";
import { ActionBackIcon } from "./OverlayActionIcons";
import { SpotifyIcon } from "../assets/spotify-icon";

interface AlbumTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  uri: string;
  artists?: { id: string; name: string }[];
}

interface AlbumData {
  id: string;
  name: string;
  uri: string;
  images?: { url: string }[];
  artists?: { id: string; name: string }[];
  tracks?: { items: AlbumTrack[] };
}

interface AlbumTracksOverlayViewProps {
  albumId: string;
  onBack: () => void;
}

export const AlbumTracksOverlayView: React.FC<AlbumTracksOverlayViewProps> = ({
  albumId,
  onBack,
}) => {
  const { getShortcut } = useHotkeyBindings();

  const playPauseShortcut = getShortcut("play_pause", ["↵"]);
  const radioShortcut = getShortcut("artist_radio", ["Ctrl", "Shift", "R"]);
  const playlistShortcut = getShortcut("add_to_playlist", ["Alt", "A"]);
  const queueShortcut = getShortcut("add_to_queue", ["Alt", "Q"]);

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);
  const [popoverMode, setPopoverMode] = useState<"actions" | "playlist">("actions");
  const [isActionsOpen, setIsActionsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const trackListRef = useRef<HTMLDivElement>(null);
  const trackItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    spotifyService
      .getAlbumDetails(albumId)
      .then((res) => {
        if (isMounted && res.data) {
          setAlbum(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load album tracks:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [albumId]);

  const tracks = album?.tracks?.items || [];
  const albumImage = album?.images?.[0]?.url;
  const albumArtist = album?.artists?.map((a) => a.name).join(", ") || "";

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.artists && t.artists.some((a) => a.name.toLowerCase().includes(q))),
    );
  }, [tracks, searchQuery]);

  const selectedTrack = filteredTracks[selectedTrackIndex] || filteredTracks[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handlePlayTrack = async (track?: AlbumTrack) => {
    if (!playPauseShortcut.enabled) return;
    const target = track || selectedTrack;
    if (!target) return;
    try {
      await spotifyService.playTrack(target.uri, album?.uri);
      showToast(`Playing ${target.name}`);
    } catch (e) {
      console.error("Play track error:", e);
      showToast(`Play failed: ${target.name}`);
    }
  };

  const handleStartRadio = async (track?: AlbumTrack) => {
    if (!radioShortcut.enabled) return;
    const target = track || selectedTrack;
    if (!target) return;
    const artistId = target.artists?.[0]?.id || album?.artists?.[0]?.id;
    if (!artistId) return;
    try {
      await spotifyService.playArtistRadio(artistId, target.id);
      showToast(`Started Radio for ${target.name}`);
    } catch (e) {
      console.error("Start Radio error:", e);
    }
  };

  const handleAddToQueue = async (track?: AlbumTrack) => {
    if (!queueShortcut.enabled) return;
    const target = track || selectedTrack;
    if (!target) return;
    try {
      await spotifyService.addTrackToQueue(target.uri);
      showToast(`Added to Queue: ${target.name}`);
    } catch (e) {
      console.error("Add to queue error:", e);
      showToast(`Queue failed`);
    }
  };

  const actionsList: OverlayActionItem[] = selectedTrack
    ? buildTrackActions({
        track: selectedTrack,
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
      })
    : [];

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
  }, [playlistShortcut.enabled, queueShortcut.enabled, selectedTrack]);

  useEffect(() => {
    if (trackItemRefs.current[selectedTrackIndex]) {
      trackItemRefs.current[selectedTrackIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedTrackIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Alt" ||
        (e.altKey && (e.key === " " || e.key === "Space"))
      ) {
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPopoverMode("actions");
        setIsActionsOpen((prev) => !prev);
        return;
      }

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        if (!playlistShortcut.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        setPopoverMode("playlist");
        setIsActionsOpen(true);
        return;
      }

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
        if (!queueShortcut.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        handleAddToQueue();
        return;
      }

      if (isActionsOpen) {
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        handleStartRadio();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }

      if (document.activeElement === searchInputRef.current) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          searchInputRef.current?.blur();
          setSelectedTrackIndex(0);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedTrackIndex((prev) =>
          filteredTracks.length > 0 ? (prev + 1) % filteredTracks.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedTrackIndex((prev) =>
          filteredTracks.length > 0
            ? (prev - 1 + filteredTracks.length) % filteredTracks.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePlayTrack();
      } else if (e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "f")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isActionsOpen,
    filteredTracks,
    selectedTrackIndex,
    selectedTrack,
    onBack,
  ]);

  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="w-full h-full flex flex-col justify-between select-none font-sans relative ">
      <OverlayToast message={toastMessage} />

      <div className="flex items-center gap-2 pb-2.5 border-b border-border/50 relative z-10 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md bg-card/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          title="Back to Now Playing (Esc)"
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
              setSelectedTrackIndex(0);
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

      <div
        ref={trackListRef}
        className="flex-1 min-h-0 overflow-y-auto py-1.5 space-y-0.5 scroll-smooth pr-1 my-0.5"
      >
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
            const isSelected = selectedTrackIndex === index;
            const artistNames =
              item.artists?.map((a) => a.name).join(", ") || albumArtist;

            return (
              <div
                key={item.id || index}
                ref={(el) => {
                  trackItemRefs.current[index] = el;
                }}
                onClick={() => setSelectedTrackIndex(index)}
                onDoubleClick={() => handlePlayTrack(item)}
                onMouseEnter={() => setSelectedTrackIndex(index)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer group ${
                  isSelected
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <div className="w-5.5 h-5.5 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {albumImage ? (
                      <img
                        src={albumImage}
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

                <div className="text-xs font-mono text-muted-foreground shrink-0 font-medium">
                  {formatDuration(item.duration_ms)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground font-mono">
            <span>No matching songs found</span>
          </div>
        )}
      </div>

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

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center text-black">
            <SpotifyIcon color="#1ED760" lineColor="#00000" />
          </div>
          <span className="font-semibold text-foreground text-xs truncate max-w-50">
            {album?.name || "Album Tracks"}
          </span>
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg  font-medium transition-all cursor-pointer ${
              isActionsOpen
                ? "bg-primary/20 border-primary text-foreground"
                : "  border-border text-muted-foreground hover:text-foreground"
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
    </div>
  );
};
