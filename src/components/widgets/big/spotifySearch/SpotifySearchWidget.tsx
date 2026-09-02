import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, X, ChevronLeft, AlertCircle } from "lucide-react";
import {
  SpotifySearchResult,
  SearchCategoryFilter,
  SpotifySearchViewState,
} from "@/types/spotify";
import { spotifySearchApi } from "@/services/spotifySearchApi";
import { SearchMainView, FlatSearchItem } from "./SearchMainView";
import { ArtistDetailView } from "./ArtistDetailView";
import { AlbumDetailView } from "./AlbumDetailView";
import { PlaylistDetailView } from "./PlaylistDetailView";

interface SpotifySearchWidgetProps {
  onClose: () => void;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export const SpotifySearchWidget: React.FC<SpotifySearchWidgetProps> = ({
  onClose,
  isExpanded,
  onExpandChange,
}) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategoryFilter>("all");
  const [results, setResults] = useState<SpotifySearchResult>({});
  const [loading, setLoading] = useState(false);
  const [activePlayingUri, setActivePlayingUri] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Stack navigation
  const [viewStack, setViewStack] = useState<SpotifySearchViewState[]>([{ type: "search" }]);
  const currentView = viewStack[viewStack.length - 1];

  const isWidgetExpanded = isExpanded ?? (query.trim().length > 0 || viewStack.length > 1);

  // Notify parent of expansion changes so input mask is synchronized
  useEffect(() => {
    const shouldExpand = query.trim().length > 0 || viewStack.length > 1;
    onExpandChange?.(shouldExpand);
  }, [query, viewStack.length, onExpandChange]);

  // Selection index for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check auth
  useEffect(() => {
    spotifySearchApi.getAccessToken().then((token) => {
      setIsAuthed(Boolean(token));
    });
  }, []);

  // Autofocus input aggressively on open so the first keystroke is never swallowed
  useEffect(() => {
    searchInputRef.current?.focus();
    const t1 = setTimeout(() => searchInputRef.current?.focus(), 25);
    const t2 = setTimeout(() => searchInputRef.current?.focus(), 80);
    const t3 = setTimeout(() => searchInputRef.current?.focus(), 160);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Guarantee that typing printable characters on the search view routes directly to the input
  useEffect(() => {
    const handleDocumentTyping = (e: KeyboardEvent) => {
      if (
        currentView.type === "search" &&
        document.activeElement !== searchInputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleDocumentTyping);
    return () => window.removeEventListener("keydown", handleDocumentTyping);
  }, [currentView.type]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setResults({});
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const data = await spotifySearchApi.search(query, category);
      setResults(data);
      setLoading(false);
      setSelectedIndex(0);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, category]);

  // Compute flattened items for SearchMainView based on active category
  const flatSearchItems = useMemo<FlatSearchItem[]>(() => {
    const items: FlatSearchItem[] = [];

    const tracks = results.tracks?.items || [];
    const artists = results.artists?.items || [];
    const albums = results.albums?.items || [];
    const playlists = results.playlists?.items || [];

    if (category === "all") {
      // Interleave or section logically: Tracks first, then artists, albums, playlists
      tracks.slice(0, 6).forEach((t) => items.push({ id: t.id || t.uri, type: "track", data: t }));
      artists.slice(0, 4).forEach((a) => items.push({ id: a.id, type: "artist", data: a }));
      albums.slice(0, 4).forEach((al) => items.push({ id: al.id, type: "album", data: al }));
      playlists.slice(0, 6).forEach((p) => items.push({ id: p.id, type: "playlist", data: p }));
    } else if (category === "tracks") {
      tracks.forEach((t) => items.push({ id: t.id || t.uri, type: "track", data: t }));
    } else if (category === "artists") {
      artists.forEach((a) => items.push({ id: a.id, type: "artist", data: a }));
    } else if (category === "albums") {
      albums.forEach((al) => items.push({ id: al.id, type: "album", data: al }));
    } else if (category === "playlists") {
      playlists.forEach((p) => items.push({ id: p.id, type: "playlist", data: p }));
    }

    return items;
  }, [results, category]);

  const pushView = useCallback((newView: SpotifySearchViewState) => {
    setViewStack((prev) => [...prev, newView]);
    setSelectedIndex(0);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, prev.length - 1);
      }
      return prev;
    });
    setSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handlePlayTrack = useCallback(
    async (trackUri: string, contextUri?: string, offsetPosition?: number) => {
      setActivePlayingUri(trackUri);
      await spotifySearchApi.playTrack(trackUri, contextUri, offsetPosition);
    },
    []
  );

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Go back if in detail view, or close widget if on main search
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (viewStack.length > 1) {
          popView();
        } else {
          onClose();
        }
        return;
      }

      // Backspace: if search input is empty and in subview, go back
      if (e.key === "Backspace" && viewStack.length > 1 && query === "") {
        const isInputFocused = document.activeElement === searchInputRef.current;
        if (isInputFocused) {
          e.preventDefault();
          popView();
          return;
        }
      }

      // Arrow & Enter navigation only for the primary search view (subviews handle their own lists)
      if (currentView.type === "search") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(flatSearchItems.length - 1, prev + 1));
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return;
        }

        if (e.key === "Enter") {
          const item = flatSearchItems[selectedIndex];
          if (item) {
            e.preventDefault();
            if (item.type === "track") {
              handlePlayTrack(item.data.uri);
            } else if (item.type === "artist") {
              pushView({ type: "artist", artist: item.data });
            } else if (item.type === "album") {
              pushView({
                type: "album",
                albumId: item.data.id,
                albumName: item.data.name,
                albumCover: item.data.images?.[0]?.url,
                artistName: item.data.artists?.[0]?.name,
              });
            } else if (item.type === "playlist") {
              pushView({
                type: "playlist",
                playlistId: item.data.id,
                playlistName: item.data.name,
                playlistCover: item.data.images?.[0]?.url,
                isUserOwned: item.data.is_user_owned,
              });
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewStack, currentView, selectedIndex, flatSearchItems, query, popView, onClose, handlePlayTrack, pushView]);

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={`bg-transparent text-foreground flex flex-col select-none overflow-hidden transition-all ${
        isWidgetExpanded
          ? "w-[600px] h-[415px]"
          : "w-[360px] h-8"
      }`}
    >
      {/* Top Header / Search Bar */}
      <div
        className={`flex flex-col ${
          isWidgetExpanded ? "border-b border-border bg-muted/25" : "bg-transparent h-full justify-center"
        }`}
      >
        <div className={`flex items-center gap-2 ${isWidgetExpanded ? "px-4 py-2.5" : "px-3 h-full"}`}>
          {viewStack.length > 1 ? (
            <button
              onClick={popView}
              className="p-1 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center justify-center flex-shrink-0"
              title="Voltar (Esc)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-4 h-4 flex items-center justify-center text-primary flex-shrink-0">
              <Search className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="flex-1 relative flex items-center h-full">
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (viewStack.length > 1) {
                  // If typing while on a detail view, pop back to main search
                  setViewStack([{ type: "search" }]);
                }
              }}
              placeholder="O que você quer ouvir hoje?"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none pr-6 leading-none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-all absolute right-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Close button with Esc indicator */}
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground text-[9px] font-mono transition-all flex-shrink-0"
            title="Fechar (Esc)"
          >
            <span>Esc</span>
            <X className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Category Pills (Visible only when expanded and on search view) */}
        {isWidgetExpanded && currentView.type === "search" && (
          <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Tudo" },
              { id: "tracks", label: "Músicas" },
              { id: "artists", label: "Artistas" },
              { id: "albums", label: "Álbuns" },
              { id: "playlists", label: "Playlists" },
            ].map((cat) => {
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategory(cat.id as SearchCategoryFilter);
                    setSelectedIndex(0);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md font-bold"
                      : "bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Content View Body */}
      {isWidgetExpanded && (
        <>
          {/* Auth warning if disconnected */}
          {isAuthed === false && (
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Spotify desconectado. Conecte sua conta para buscar e tocar músicas.</span>
              </div>
              <button
                onClick={() => spotifySearchApi.getAccessToken()}
                className="text-[11px] font-bold underline hover:text-destructive/80"
              >
                Verificar
              </button>
            </div>
          )}

          {/* Dynamic View Body */}
          {currentView.type === "search" && (
            <SearchMainView
              loading={loading}
              category={category}
              searchQuery={query}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              onSelectTrack={(t, i) => handlePlayTrack(t.uri, undefined, i)}
              onSelectArtist={(artist) => pushView({ type: "artist", artist })}
              onSelectAlbum={(album) =>
                pushView({
                  type: "album",
                  albumId: album.id,
                  albumName: album.name,
                  albumCover: album.images?.[0]?.url,
                  artistName: album.artists?.[0]?.name,
                })
              }
              onSelectPlaylist={(playlist) =>
                pushView({
                  type: "playlist",
                  playlistId: playlist.id,
                  playlistName: playlist.name,
                  playlistCover: playlist.images?.[0]?.url,
                  isUserOwned: playlist.is_user_owned,
                })
              }
              flatItems={flatSearchItems}
              activePlayingUri={activePlayingUri}
            />
          )}

          {currentView.type === "artist" && (
            <ArtistDetailView
              artist={currentView.artist}
              onBack={popView}
              onSelectAlbum={(albumId, albumName, albumCover, artistName) =>
                pushView({ type: "album", albumId, albumName, albumCover, artistName })
              }
              onPlayTrack={handlePlayTrack}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          )}

          {currentView.type === "album" && (
            <AlbumDetailView
              albumId={currentView.albumId}
              albumName={currentView.albumName}
              albumCover={currentView.albumCover}
              artistName={currentView.artistName}
              onBack={popView}
              onPlayTrack={handlePlayTrack}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          )}

          {currentView.type === "playlist" && (
            <PlaylistDetailView
              playlistId={currentView.playlistId}
              playlistName={currentView.playlistName}
              playlistCover={currentView.playlistCover}
              isUserOwned={currentView.isUserOwned}
              onBack={popView}
              onPlayTrack={handlePlayTrack}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          )}
        </>
      )}
    </motion.div>
  );
};
