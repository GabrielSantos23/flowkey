import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Radio, Disc3 } from "lucide-react";
import { Kbd, KbdGroup } from "./ui/kbd";
import { Skeleton } from "./ui/skeleton";
import { useHotkeyBindings } from "../hooks/useHotkeyBindings";
import { ActionBackIcon } from "./OverlayActionIcons";
import { OverlayActionsMenuPopover, OverlayActionItem } from "./OverlayActionsMenuPopover";
import { OverlayToast } from "./toasts/OverlayToast";
import { buildAlbumActions } from "../utils/overlayActions";
import { spotifyService } from "../services/spotifyApi";
import { SpotifyArtist, SpotifyAlbum } from "../types/spotify";

interface ArtistAlbumsOverlayViewProps {
  artist: SpotifyArtist;
  onBack: () => void;
  onSelectAlbum: (albumId: string) => void;
}

export const ArtistAlbumsOverlayView: React.FC<ArtistAlbumsOverlayViewProps> = ({
  artist,
  onBack,
  onSelectAlbum,
}) => {
  const { getShortcut } = useHotkeyBindings();

  const playPauseShortcut = getShortcut("play_pause", ["↵"]);
  const albumShortcut = getShortcut("view_album", ["Ctrl", "Shift", "O"]);
  const likeShortcut = getShortcut("toggle_liked", ["Ctrl", "L"]);
  const spotifyShortcut = getShortcut("open_spotify", ["Ctrl", "S"]);

  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Fetch artist albums on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    spotifyService
      .getArtistAlbums(artist.id, artist.name)
      .then((res) => {
        if (mounted) {
          // Deduplicate albums by ID or clean name
          const seen = new Set<string>();
          const deduped = (res.items || []).filter((item) => {
            const key = item.id || item.name.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setAlbums(deduped);
        }
      })
      .catch((err) => {
        console.warn("Failed to load artist albums:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [artist.id]);

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    const q = searchQuery.toLowerCase();
    return albums.filter((a) => a.name.toLowerCase().includes(q));
  }, [albums, searchQuery]);

  const selectedAlbum: SpotifyAlbum | undefined = filteredAlbums[selectedIndex];

  const handlePlayAlbum = useCallback(async (album?: SpotifyAlbum) => {
    const target = album || selectedAlbum;
    if (!target) return;
    try {
      await spotifyService.playContext(target.uri || `spotify:album:${target.id}`);
      showToast(`Playing ${target.name}`);
    } catch (e: any) {
      showToast(e?.message || "Play album failed");
    }
  }, [selectedAlbum, showToast]);

  const actionsList: OverlayActionItem[] = useMemo(() => {
    if (!selectedAlbum) return [];
    return buildAlbumActions({
      album: selectedAlbum,
      shortcuts: {
        playPause: playPauseShortcut,
        album: albumShortcut,
        like: likeShortcut,
        spotify: spotifyShortcut,
      },
      onPlay: handlePlayAlbum,
      onSelectAlbum,
      showToast,
    });
  }, [
    selectedAlbum,
    handlePlayAlbum,
    onSelectAlbum,
    showToast,
    playPauseShortcut,
    albumShortcut,
    likeShortcut,
    spotifyShortcut,
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt" || (e.altKey && (e.key === " " || e.key === "Space"))) {
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setIsActionsOpen((prev) => !prev);
        return;
      }

      if (isActionsOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }

      const COLS = 5;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredAlbums.length > 0 ? (prev + 1) % filteredAlbums.length : 0
        );
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredAlbums.length > 0
            ? (prev - 1 + filteredAlbums.length) % filteredAlbums.length
            : 0
        );
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev + COLS;
          return next < filteredAlbums.length ? next : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev - COLS;
          return next >= 0 ? next : prev;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedAlbum) {
          onSelectAlbum(selectedAlbum.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActionsOpen, filteredAlbums, selectedAlbum, onBack, onSelectAlbum]);

  // Auto-scroll selected item
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
      <OverlayToast message={toastMessage} />

      {/* Header matching Image 2: [ ← ] + Search albums input */}
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
            placeholder="Search albums..."
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

      {/* Artist Name Subheader */}
      <div className="pt-2 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">
        {artist.name}
      </div>

      {/* 5-Columns Grid View matching Image 2 */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1 scroll-smooth pr-1 my-0.5">
        {loading ? (
          <div className="grid grid-cols-5 gap-3 py-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="w-full aspect-square rounded-md" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-2.5 w-14 rounded" />
              </div>
            ))}
          </div>
        ) : filteredAlbums.length > 0 ? (
          <div className="grid grid-cols-5 gap-3 py-1">
            {filteredAlbums.map((album, index) => {
              const isSelected = selectedIndex === index;
              const img = album.images?.[0]?.url;
              const releaseYear = album.release_date?.substring(0, 4) || "";
              const artistNames =
                album.artists?.map((a) => a.name).join(", ") || artist.name;

              return (
                <div
                  key={album.id || index}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => setSelectedIndex(index)}
                  onDoubleClick={() => onSelectAlbum(album.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex flex-col rounded-md p-1 transition-all cursor-pointer group ${
                    isSelected
                      ? "ring-2 ring-primary/80 bg-secondary/50 shadow-md"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  {/* Square Artwork */}
                  <div className="w-full aspect-square rounded-sm bg-muted border border-border/40 overflow-hidden relative flex items-center justify-center mb-1.5 shadow-sm">
                    {img ? (
                      <img
                        src={img}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <Disc3 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Album Name */}
                  <span className="text-[11px] font-bold text-foreground truncate block leading-tight">
                    {album.name}
                  </span>

                  {/* Artist & Year */}
                  <span className="text-[10px] text-muted-foreground truncate block leading-tight mt-0.5">
                    {artistNames} {releaseYear ? `• ${releaseYear}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground font-mono">
            <span>No albums found</span>
          </div>
        )}
      </div>

      {/* Actions Popover */}
      <OverlayActionsMenuPopover
        isOpen={isActionsOpen}
        onClose={() => setIsActionsOpen(false)}
        actions={actionsList}
        trackName={selectedAlbum?.name}
        onShowToast={showToast}
        className="bottom-14 right-0"
      />

      {/* Bottom Footer matching Image 2 */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center text-black">
            <Radio className="w-3 h-3 text-black fill-black" />
          </div>
          <span className="font-semibold text-foreground text-xs">Search</span>
        </div>

        <div className="flex items-center gap-2.5 text-muted-foreground font-medium text-[11px]">
          <button
            onClick={() => handlePlayAlbum()}
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
