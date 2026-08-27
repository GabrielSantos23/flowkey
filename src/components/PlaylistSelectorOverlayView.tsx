import React, { useState, useEffect, useRef } from "react";
import { ListMusic, FolderPlus } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { spotifyService } from "../services/spotifyApi";
import { SpotifyPlaylist } from "../types/spotify";
import { OverlayToast } from "./toasts/OverlayToast";
import { ActionBackIcon, ActionSearchIcon } from "./OverlayActionIcons";

interface PlaylistSelectorOverlayViewProps {
  trackName: string;
  trackUri: string;
  onBack: () => void;
}

export const PlaylistSelectorOverlayView: React.FC<PlaylistSelectorOverlayViewProps> = ({
  trackName,
  trackUri,
  onBack,
}) => {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadPlaylists = async () => {
      try {
        const res = await spotifyService.getPlaylists(true);
        if (isMounted) {
          setPlaylists(res.items || []);
        }
      } catch (e: any) {
        console.error("Load playlists error:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPlaylists();

    setTimeout(() => searchInputRef.current?.focus(), 50);

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    try {
      setFeedback(`Adding to ${playlist.name}...`);
      await spotifyService.addTrackToPlaylist(playlist.id, trackUri);
      setFeedback(`Added to ${playlist.name}!`);
      setTimeout(() => {
        onBack();
      }, 900);
    } catch (e: any) {
      console.error("Add to playlist error:", e);
      const errMsg = e.message || "Failed to add";
      setFeedback(
        errMsg.includes("PERMISSION_DENIED")
          ? "Permission denied (not editable)"
          : "Failed to add to playlist",
      );
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      
      if (e.key === "Alt" || (e.altKey && (e.key === " " || e.key === "Space"))) {
        e.preventDefault();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredPlaylists.length > 0 ? (prev + 1) % filteredPlaylists.length : 0,
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
        const target = filteredPlaylists[selectedIndex];
        if (target) {
          handleSelectPlaylist(target);
        }
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
  }, [filteredPlaylists, selectedIndex, onBack]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="w-full h-full flex flex-col justify-between select-none font-sans relative">
      
      <OverlayToast message={feedback} />

      <div className="flex items-center gap-3 pb-3 border-b border-border relative z-10 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Back (Esc)"
        >
          <ActionBackIcon />
        </button>

        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border focus-within:border-primary/60 transition-all">
          <ActionSearchIcon />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search playlists..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1 scroll-smooth pr-1 my-1"
      >
        {loading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                <Skeleton className="w-9 h-9 rounded-md" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPlaylists.length > 0 ? (
          filteredPlaylists.map((item, index) => {
            const isSelected = selectedIndex === index;
            const cover = item.images?.[0]?.url;

            return (
              <div
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => {
                  setSelectedIndex(index);
                  handleSelectPlaylist(item);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ListMusic className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate block">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono block">
                      {item.tracks?.total ?? 0} tracks
                    </span>
                  </div>
                </div>

                <FolderPlus className="w-4 h-4 text-muted-foreground hover:text-foreground shrink-0" />
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground font-mono">
            <span>No playlists found</span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
        <span className="text-muted-foreground text-xs">
          Select a playlist to add <strong className="text-foreground">"{trackName}"</strong>
        </span>
        <button
          onClick={onBack}
          className="px-2.5 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-[11px]"
        >
          Cancel [Esc]
        </button>
      </div>
    </div>
  );
};
