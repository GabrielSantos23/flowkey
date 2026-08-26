import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { ListMusic, ArrowLeft, Loader2 } from "lucide-react";
import { SpotifyPlaylist } from "../types/spotify";
import { spotifyService } from "../services/spotifyApi";
import { Kbd, KbdGroup } from "./ui/kbd";
import { ActionSearchIcon } from "./OverlayActionIcons";

export interface OverlayActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut: string[];
  action: () => void | Promise<void>;
  disabled?: boolean;
}

interface OverlayActionsMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  actions: OverlayActionItem[];
  trackUri?: string;
  trackName?: string;
  onShowToast: (message: string, type?: "success" | "error" | "info") => void;
  className?: string;
  initialMode?: "actions" | "playlist";
}

export const OverlayActionsMenuPopover: React.FC<
  OverlayActionsMenuPopoverProps
> = ({
  isOpen,
  onClose,
  actions,
  trackUri,
  trackName,
  onShowToast,
  className = "bottom-14 right-6",
  initialMode = "actions",
}) => {
  const [mode, setMode] = useState<"actions" | "playlist">(initialMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Playlists state
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filtered actions
  const filteredActions = useMemo(() => {
    if (mode !== "actions") return [];
    return actions.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [actions, searchQuery, mode]);

  // Filtered playlists
  const filteredPlaylists = useMemo(() => {
    if (mode !== "playlist") return [];
    return playlists.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [playlists, searchQuery, mode]);

  // Helper to find next enabled index
  const getNextEnabledIndex = useCallback(
    (
      currentIndex: number,
      direction: 1 | -1,
      items: OverlayActionItem[],
    ): number => {
      if (items.length === 0) return 0;
      const hasEnabled = items.some((it) => !it.disabled);
      if (!hasEnabled) return currentIndex;

      let next = currentIndex;
      for (let step = 0; step < items.length; step++) {
        next = (next + direction + items.length) % items.length;
        if (!items[next]?.disabled) {
          return next;
        }
      }
      return currentIndex;
    },
    [],
  );

  // Load playlists when opened or mode changed to playlist
  useEffect(() => {
    if (
      isOpen &&
      mode === "playlist" &&
      playlists.length === 0 &&
      !loadingPlaylists
    ) {
      setLoadingPlaylists(true);
      spotifyService
        .getPlaylists(true)
        .then((res) => {
          setPlaylists(res.items || []);
        })
        .catch((err) => {
          console.error("Failed to load playlists in menu:", err);
          onShowToast("Failed to load playlists", "error");
        })
        .finally(() => {
          setLoadingPlaylists(false);
        });
    }
  }, [isOpen, mode, playlists.length, loadingPlaylists, onShowToast]);

  // Sync mode with initialMode on open
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMode(initialMode);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMode]);

  // Reset search and selection on open or mode switch
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      if (mode === "actions") {
        const firstEnabled = filteredActions.findIndex((a) => !a.disabled);
        setSelectedIndex(firstEnabled >= 0 ? firstEnabled : 0);
      } else {
        setSelectedIndex(0);
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setMode(initialMode);
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen, mode, initialMode]);

  // Adjust selected index when filteredActions change so we never stay on a disabled item
  useEffect(() => {
    if (mode === "actions" && filteredActions.length > 0) {
      if (filteredActions[selectedIndex]?.disabled) {
        const next = getNextEnabledIndex(selectedIndex, 1, filteredActions);
        setSelectedIndex(next);
      }
    }
  }, [filteredActions, mode, selectedIndex, getNextEnabledIndex]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    if (!trackUri || addingToPlaylistId) return;
    setAddingToPlaylistId(playlist.id);
    try {
      await spotifyService.addTrackToPlaylist(playlist.id, trackUri);
      onShowToast(`Added to ${playlist.name}!`, "success");
      onClose();
    } catch (e: any) {
      console.error("Add to playlist error:", e);
      const errMsg = e?.message || "Failed to add to playlist";
      onShowToast(
        errMsg.includes("PERMISSION_DENIED")
          ? "Permission denied (not editable)"
          : "Failed to add to playlist",
        "error",
      );
    } finally {
      setAddingToPlaylistId(null);
    }
  };

  const handleActionClick = (item: OverlayActionItem) => {
    if (item.disabled) return;
    if (item.id === "playlist") {
      setMode("playlist");
      setSearchQuery("");
      setSelectedIndex(0);
      return;
    }
    item.action();
    onClose();
  };

  // Keyboard navigation inside popover
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Windows OS window menu
      if (
        e.key === "Alt" ||
        (e.altKey && (e.key === " " || e.key === "Space"))
      ) {
        e.preventDefault();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (mode === "playlist") {
          setMode("actions");
          setSearchQuery("");
          setSelectedIndex(0);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (mode === "actions") {
          setSelectedIndex((prev) =>
            getNextEnabledIndex(prev, 1, filteredActions),
          );
        } else {
          const total = filteredPlaylists.length;
          setSelectedIndex((prev) => (total > 0 ? (prev + 1) % total : 0));
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (mode === "actions") {
          setSelectedIndex((prev) =>
            getNextEnabledIndex(prev, -1, filteredActions),
          );
        } else {
          const total = filteredPlaylists.length;
          setSelectedIndex((prev) =>
            total > 0 ? (prev - 1 + total) % total : 0,
          );
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "actions") {
          const target = filteredActions[selectedIndex];
          if (target && !target.disabled) {
            handleActionClick(target);
          }
        } else {
          const target = filteredPlaylists[selectedIndex];
          if (target) {
            handleSelectPlaylist(target);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    mode,
    filteredActions,
    filteredPlaylists,
    selectedIndex,
    trackUri,
    addingToPlaylistId,
    getNextEnabledIndex,
  ]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute ${className} w-64 rounded-xl bg-card border border-border shadow-2xl backdrop-blur-2xl z-50 overflow-hidden flex flex-col animate-fade-in select-none font-sans`}
    >
      {/* Playlist Mode Header */}
      {mode === "playlist" && (
        <div className="px-2.5 py-2 border-b border-border/50 flex items-center justify-between text-xs font-semibold text-muted-foreground bg-secondary/30">
          <div className="flex items-center gap-1.5 truncate">
            <button
              onClick={() => {
                setMode("actions");
                setSearchQuery("");
                setSelectedIndex(0);
              }}
              className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Back to Actions (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="truncate">Add to Playlist...</span>
          </div>
          {trackName && (
            <span className="text-[10px] text-muted-foreground/80 truncate max-w-[90px] font-normal">
              {trackName}
            </span>
          )}
        </div>
      )}

      {/* Items Scrollable List */}
      <div className="p-1.5 space-y-0.5 max-h-52 overflow-y-auto scroll-smooth">
        {mode === "actions" ? (
          filteredActions.length > 0 ? (
            filteredActions.map((item, index) => {
              const isSelected = selectedIndex === index;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => handleActionClick(item)}
                  onMouseEnter={() => {
                    if (!item.disabled) setSelectedIndex(index);
                  }}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    item.disabled
                      ? "opacity-30 cursor-not-allowed pointer-events-none text-muted-foreground"
                      : isSelected
                        ? "bg-secondary text-foreground shadow-sm cursor-pointer"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="shrink-0">{item.icon}</div>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.shortcut && item.shortcut.length > 0 && (
                    <KbdGroup className="shrink-0 ml-2">
                      {item.shortcut.map((key, i) => (
                        <Kbd key={i} className="text-[9px] h-4 min-w-4 px-1">
                          {key}
                        </Kbd>
                      ))}
                    </KbdGroup>
                  )}
                </button>
              );
            })
          ) : (
            <div className="py-3 text-center text-[11px] text-muted-foreground font-mono">
              No matching actions
            </div>
          )
        ) : loadingPlaylists ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span>Loading playlists...</span>
          </div>
        ) : filteredPlaylists.length > 0 ? (
          filteredPlaylists.map((playlist, index) => {
            const isSelected = selectedIndex === index;
            const cover = playlist.images?.[0]?.url;
            const isAdding = addingToPlaylistId === playlist.id;

            return (
              <button
                key={playlist.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => handleSelectPlaylist(playlist)}
                onMouseEnter={() => setSelectedIndex(index)}
                disabled={isAdding}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                  <div className="w-5.5 h-5.5 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img
                        src={cover}
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate text-left">{playlist.name}</span>
                </div>

                {isAdding && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                )}
              </button>
            );
          })
        ) : (
          <div className="py-3 text-center text-[11px] text-muted-foreground font-mono">
            No playlists found
          </div>
        )}
      </div>

      {/* Search Bar at Bottom */}
      <div className="p-2 border-t border-border bg-card/90 flex items-center gap-1.5">
        <ActionSearchIcon />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            mode === "actions" ? "Search for actions..." : "Search..."
          }
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
};
