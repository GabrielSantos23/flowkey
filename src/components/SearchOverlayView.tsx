import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Music2,
  User,
  Disc3,
  Trash2,
  History,
  ListMusic,
  Shuffle,
} from "lucide-react";
import { Kbd, KbdGroup } from "./ui/kbd";
import { Skeleton } from "./ui/skeleton";
import { useHotkeyBindings } from "../hooks/useHotkeyBindings";
import { ActionBackIcon } from "./OverlayActionIcons";
import {
  OverlayActionsMenuPopover,
  OverlayActionItem,
} from "./OverlayActionsMenuPopover";
import { OverlayToast } from "./toasts/OverlayToast";
import {
  buildRecentSearchActions,
  buildArtistActions,
  buildTrackActions,
  buildAlbumActions,
  buildPlaylistActions,
} from "../utils/overlayActions";
import { spotifyService } from "../services/spotifyApi";
import {
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyPlaylist,
  SearchTypeFilter,
} from "../types/spotify";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpotifyIcon } from "@/assets/spotify-icon";

type SearchCategory = "all" | "artists" | "songs" | "albums" | "playlists";

type SearchItem =
  | { type: "artist"; data: SpotifyArtist }
  | { type: "track"; data: SpotifyTrack }
  | { type: "album"; data: SpotifyAlbum }
  | { type: "playlist"; data: SpotifyPlaylist }
  | { type: "recent"; query: string };

const RECENT_SEARCHES_STORAGE_KEY = "flowkey_recent_searches";

interface SearchOverlayViewProps {
  onBack: () => void;
  onSelectAlbum: (albumId: string) => void;
  onSelectArtistAlbums: (artist: SpotifyArtist) => void;
  onSelectArtistTopTracks: (artist: SpotifyArtist) => void;
}

export const SearchOverlayView: React.FC<SearchOverlayViewProps> = ({
  onBack,
  onSelectAlbum,
  onSelectArtistAlbums,
  onSelectArtistTopTracks,
}) => {
  const { getShortcut } = useHotkeyBindings();

  const playPauseShortcut = getShortcut("play_pause", ["↵"]);
  const likeShortcut = getShortcut("toggle_liked", ["Ctrl", "L"]);
  const radioShortcut = getShortcut("artist_radio", ["Ctrl", "Shift", "R"]);
  const albumShortcut = getShortcut("view_album", ["Ctrl", "Shift", "A"]);
  const playlistShortcut = getShortcut("add_to_playlist", ["Ctrl", "A"]);
  const queueShortcut = getShortcut("add_to_queue", ["Alt", "Q"]);
  const spotifyShortcut = getShortcut("open_spotify", ["Ctrl", "S"]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [popoverMode, setPopoverMode] = useState<"actions" | "playlist">("actions");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const saveRecentSearch = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const updated = [
        clean,
        ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 15);
      try {
        localStorage.setItem(
          RECENT_SEARCHES_STORAGE_KEY,
          JSON.stringify(updated),
        );
      } catch (e) {
        console.warn("Error saving recent search:", e);
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback(
    (text: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s !== text);
        try {
          localStorage.setItem(
            RECENT_SEARCHES_STORAGE_KEY,
            JSON.stringify(updated),
          );
        } catch (e) {
          console.warn("Error removing recent search:", e);
        }
        return updated;
      });
      showToast(`Removed "${text}" from history`);
    },
    [showToast],
  );

  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (e) {
      console.warn("Error clearing recent searches:", e);
    }
    showToast("Cleared search history");
  }, [showToast]);

  useEffect(() => {
    searchInputRef.current?.focus();
    spotifyService.getCurrentUser().then((u) => {
      if (u?.id) setCurrentUserId(u.id);
    });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setArtists([]);
      setTracks([]);
      setAlbums([]);
      setPlaylists([]);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let types: SearchTypeFilter[] = [
          "artist",
          "track",
          "album",
          "playlist",
        ];
        if (category === "artists") types = ["artist"];
        if (category === "songs") types = ["track"];
        if (category === "albums") types = ["album"];
        if (category === "playlists") types = ["playlist"];

        const userPlaylistsPromise =
          category === "all" || category === "playlists"
            ? spotifyService.getPlaylists(false).catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] });

        const [res, userPlaylistsRes] = await Promise.all([
          spotifyService.search(query, types),
          userPlaylistsPromise,
        ]);

        setArtists(res.data.artists?.items || []);
        setTracks(res.data.tracks?.items || []);
        setAlbums(res.data.albums?.items || []);

        if (category === "all" || category === "playlists") {
          const qLower = query.toLowerCase();
          const allPlaylists: SpotifyPlaylist[] = [];
          const seenIds = new Set<string>();

          const userMatches = (userPlaylistsRes.items || []).filter(
            (p: SpotifyPlaylist) => {
              if (!p?.id || !p?.name) return false;
              return p.name.toLowerCase().includes(qLower);
            },
          );

          userMatches.forEach((p: SpotifyPlaylist) => {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allPlaylists.push(p);
            }
          });

          const searchPlaylists = (res.data.playlists?.items || []).filter(
            (p: SpotifyPlaylist) => p && p.id,
          );

          const userOwnedFromSearch: SpotifyPlaylist[] = [];
          const othersFromSearch: SpotifyPlaylist[] = [];

          searchPlaylists.forEach((p: SpotifyPlaylist) => {
            if (seenIds.has(p.id)) return;
            seenIds.add(p.id);
            if (
              currentUserId &&
              (p.owner?.id === currentUserId || p.collaborative)
            ) {
              userOwnedFromSearch.push(p);
            } else {
              othersFromSearch.push(p);
            }
          });

          const finalPlaylists = [
            ...allPlaylists,
            ...userOwnedFromSearch,
            ...othersFromSearch,
          ];
          setPlaylists(finalPlaylists);
        } else {
          setPlaylists([]);
        }

        setSelectedIndex(0);
        saveRecentSearch(query);
      } catch (err: any) {
        console.warn("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, category, currentUserId, saveRecentSearch]);

  const flatItems: SearchItem[] = useMemo(() => {
    if (!query.trim()) {
      return recentSearches.map((s) => ({ type: "recent", query: s }));
    }

    const list: SearchItem[] = [];
    const artistLimit = category === "artists" ? 50 : 4;
    const trackLimit = category === "songs" ? 50 : 6;
    const albumLimit = category === "albums" ? 50 : 4;
    const playlistLimit = category === "playlists" ? 200 : 4;

    if (category === "all" || category === "artists") {
      artists
        .slice(0, artistLimit)
        .forEach((a) => list.push({ type: "artist", data: a }));
    }
    if (category === "all" || category === "songs") {
      tracks
        .slice(0, trackLimit)
        .forEach((t) => list.push({ type: "track", data: t }));
    }
    if (category === "all" || category === "albums") {
      albums
        .slice(0, albumLimit)
        .forEach((al) => list.push({ type: "album", data: al }));
    }
    if (category === "all" || category === "playlists") {
      playlists
        .slice(0, playlistLimit)
        .forEach((pl) => list.push({ type: "playlist", data: pl }));
    }
    return list;
  }, [query, recentSearches, artists, tracks, albums, playlists, category]);

  const selectedItem: SearchItem | undefined = flatItems[selectedIndex];

  const handlePlaySelected = useCallback(
    async (item?: SearchItem) => {
      const target = item || selectedItem;
      if (!target) return;

      if (target.type === "recent") {
        setQuery(target.query);
        return;
      }

      try {
        if (target.type === "track") {
          await spotifyService.playTrack(target.data.uri);
          showToast(`Playing ${target.data.name}`);
        } else if (target.type === "artist") {
          await spotifyService.playArtistRadio(target.data.id);
          showToast(`Playing ${target.data.name} Radio`);
        } else if (target.type === "album") {
          await spotifyService.playContext(
            target.data.uri || `spotify:album:${target.data.id}`,
          );
          showToast(`Playing ${target.data.name}`);
        } else if (target.type === "playlist") {
          await spotifyService.playContext(
            target.data.uri || `spotify:playlist:${target.data.id}`,
          );
          showToast(`Playing ${target.data.name}`);
        }
      } catch (e: any) {
        showToast(e?.message || "Playback failed");
      }
    },
    [selectedItem, showToast],
  );

  const handleShufflePlaySelected = useCallback(
    async (item?: SearchItem) => {
      const target = item || selectedItem;
      if (!target || target.type !== "playlist") return;
      try {
        await spotifyService.setShuffle(true);
        await spotifyService.playContext(
          target.data.uri || `spotify:playlist:${target.data.id}`,
        );
        showToast(`Playing ${target.data.name} on Shuffle`);
      } catch (e: any) {
        showToast(e?.message || "Shuffle playback failed");
      }
    },
    [selectedItem, showToast],
  );

  const actionsList: OverlayActionItem[] = useMemo(() => {
    if (!selectedItem) return [];
    let rawActions: OverlayActionItem[] = [];

    if (selectedItem.type === "recent") {
      rawActions = buildRecentSearchActions({
        query: selectedItem.query,
        onSearch: (q) => setQuery(q),
        onRemove: removeRecentSearch,
        onClearAll: clearAllRecentSearches,
      });
    } else if (selectedItem.type === "artist") {
      rawActions = buildArtistActions({
        artist: selectedItem.data,
        shortcuts: {
          playPause: playPauseShortcut,
          album: albumShortcut,
          radio: radioShortcut,
        },
        onPlay: () => handlePlaySelected(),
        onSelectArtistAlbums,
        onSelectArtistTopTracks,
        showToast,
      });
    } else if (selectedItem.type === "track") {
      rawActions = buildTrackActions({
        track: selectedItem.data,
        shortcuts: {
          playPause: playPauseShortcut,
          radio: radioShortcut,
          playlist: playlistShortcut,
          queue: queueShortcut,
          album: albumShortcut,
        },
        onPlay: () => handlePlaySelected(),
        onSelectAlbum,
        onOpenPlaylist: () => {
          setPopoverMode("playlist");
          setIsActionsOpen(true);
        },
        showToast,
      });
    } else if (selectedItem.type === "album") {
      rawActions = buildAlbumActions({
        album: selectedItem.data,
        shortcuts: {
          playPause: playPauseShortcut,
          album: albumShortcut,
          like: likeShortcut,
          spotify: spotifyShortcut,
        },
        onPlay: () => handlePlaySelected(),
        onSelectAlbum,
        showToast,
      });
    } else if (selectedItem.type === "playlist") {
      rawActions = buildPlaylistActions({
        playlist: selectedItem.data,
        shortcuts: {
          playPause: playPauseShortcut,
          spotify: spotifyShortcut,
        },
        onPlay: () => handlePlaySelected(),
        onShufflePlay: () => handleShufflePlaySelected(),
        showToast,
      });
    }

    return rawActions;
  }, [
    selectedItem,
    handlePlaySelected,
    handleShufflePlaySelected,
    onSelectAlbum,
    onSelectArtistAlbums,
    onSelectArtistTopTracks,
    removeRecentSearch,
    clearAllRecentSearches,
    showToast,
    playPauseShortcut,
    albumShortcut,
    radioShortcut,
    playlistShortcut,
    likeShortcut,
    spotifyShortcut,
  ]);

  const handleBackOrClear = useCallback(() => {
    if (query.trim()) {
      setQuery("");
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    } else {
      onBack();
    }
  }, [query, onBack]);

  const handleQueueAction = useCallback(() => {
    if (!queueShortcut.enabled) return;
    if (selectedItem?.type === "track") {
      spotifyService
        .addTrackToQueue(selectedItem.data.uri)
        .then(() => showToast(`Queued: ${selectedItem.data.name}`))
        .catch((err: any) => showToast(err?.message || "Failed to add to queue"));
    } else {
      spotifyService
        .getNowPlaying()
        .then((res) => {
          const item = res?.data?.item;
          if (item?.uri) {
            spotifyService
              .addTrackToQueue(item.uri)
              .then(() => showToast(`Queued: ${item.name}`))
              .catch((err: any) => showToast(err?.message || "Failed to add to queue"));
          } else {
            showToast("No track currently playing");
          }
        })
        .catch((err: any) => showToast(err?.message || "Failed to add to queue"));
    }
  }, [selectedItem, queueShortcut.enabled, showToast]);

  useEffect(() => {
    let actionBc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      actionBc = new BroadcastChannel("flowkey_overlay_action_sync");
      actionBc.onmessage = (event) => {
        if (event.data?.type === "OPEN_PLAYLIST_MENU") {
          if (playlistShortcut.enabled && selectedItem?.type === "track") {
            setPopoverMode("playlist");
            setIsActionsOpen(true);
          }
        } else if (event.data?.type === "TRIGGER_QUEUE") {
          handleQueueAction();
        }
      };
    }
    return () => {
      actionBc?.close();
    };
  }, [handleQueueAction, playlistShortcut.enabled, selectedItem]);

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

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
        if (!queueShortcut.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        handleQueueAction();
        return;
      }

      if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        if (!playlistShortcut.enabled) return;
        if (selectedItem?.type === "track") {
          e.preventDefault();
          e.stopPropagation();
          setPopoverMode("playlist");
          setIsActionsOpen(true);
        }
        return;
      }

      if (isActionsOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleBackOrClear();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatItems.length > 0 ? (prev + 1) % flatItems.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatItems.length > 0
            ? (prev - 1 + flatItems.length) % flatItems.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedItem) {
          if (selectedItem.type === "recent") {
            setQuery(selectedItem.query);
          } else if (selectedItem.type === "album") {
            onSelectAlbum(selectedItem.data.id);
          } else {
            handlePlaySelected();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isActionsOpen,
    flatItems,
    selectedItem,
    handleBackOrClear,
    onSelectAlbum,
    handlePlaySelected,
  ]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  let runningIndex = 0;

  const items = [
    { label: "All", value: "all" },
    { label: "Artists", value: "artists" },
    { label: "Songs", value: "songs" },
    { label: "Albums", value: "albums" },
    { label: "Playlists", value: "playlists" },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between select-none font-sans relative">
      <OverlayToast message={toastMessage} />

      <div className="flex items-center gap-2 pb-2.5 border-b border-border/50 relative z-10 shrink-0">
        <button
          onClick={handleBackOrClear}
          className="p-1.5 rounded-md bg-card/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          title={query ? "Clear search" : "Back (Esc)"}
        >
          <ActionBackIcon />
        </button>

        <div className="flex-1 flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to listen to..."
            className="w-full bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none px-1 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="relative shrink-0">
          <Select
            value={category}
            onValueChange={(val) => {
              if (val) setCategory(val as SearchCategory);
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-7 text-xs bg-card/80 border-border/60 min-w-24 font-medium capitalize cursor-pointer"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="bg-card border-border/60">
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1.5 space-y-3 scroll-smooth pr-1 my-0.5">
        {!query.trim() ? (
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-muted-foreground/80 uppercase px-2.5 pt-1">
              Recent searches
            </div>

            {recentSearches.length > 0 ? (
              recentSearches.map((item, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <div
                    key={item || index}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    onClick={() => {
                      setSelectedIndex(index);
                      setQuery(item);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-4">
                      <History className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate">{item}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(item);
                      }}
                      className="p-1 text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                No recent searches
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5">
                <Skeleton className="w-6 h-6 rounded-xs" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-32 rounded" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : flatItems.length > 0 ? (
          <>
            {artists.length > 0 &&
              (category === "all" || category === "artists") && (
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-muted-foreground/80 uppercase px-2.5 pt-1">
                    Artists
                  </div>
                  {artists
                    .slice(0, category === "artists" ? 50 : 4)
                    .map((artist) => {
                      const idx = runningIndex++;
                      const isSelected = selectedIndex === idx;
                      const img = artist.images?.[0]?.url;

                      return (
                        <div
                          key={artist.id || idx}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => setSelectedIndex(idx)}
                          onDoubleClick={() => onSelectArtistTopTracks(artist)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <div className="w-6 h-6 rounded-full bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              {img ? (
                                <img
                                  src={img}
                                  alt={artist.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-foreground truncate">
                              {artist.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

            {tracks.length > 0 &&
              (category === "all" || category === "songs") && (
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-muted-foreground/80 uppercase px-2.5 pt-1">
                    Songs
                  </div>
                  {tracks
                    .slice(0, category === "songs" ? 50 : 6)
                    .map((track) => {
                      const idx = runningIndex++;
                      const isSelected = selectedIndex === idx;
                      const img = track.album?.images?.[0]?.url;
                      const artistNames = track.artists
                        ?.map((a) => a.name)
                        .join(", ");

                      return (
                        <div
                          key={track.id || idx}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => setSelectedIndex(idx)}
                          onDoubleClick={() =>
                            handlePlaySelected({ type: "track", data: track })
                          }
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <div className="w-6 h-6 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              {img ? (
                                <img
                                  src={img}
                                  alt={track.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Music2 className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex items-baseline gap-2 truncate">
                              <span className="text-xs font-bold text-foreground truncate">
                                {track.name}
                              </span>
                              <span className="text-xs font-normal text-muted-foreground truncate">
                                {artistNames}
                              </span>
                            </div>
                          </div>

                          {track.album?.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (track.album?.id) {
                                  onSelectAlbum(track.album.id);
                                }
                              }}
                              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                              title={`View Album (${albumShortcut.keys.join("+")})`}
                            >
                              <Disc3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

            {albums.length > 0 &&
              (category === "all" || category === "albums") && (
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-muted-foreground/80 uppercase px-2.5 pt-1">
                    Albums
                  </div>
                  {albums
                    .slice(0, category === "albums" ? 50 : 4)
                    .map((album) => {
                      const idx = runningIndex++;
                      const isSelected = selectedIndex === idx;
                      const img = album.images?.[0]?.url;
                      const artistNames = album.artists
                        ?.map((a) => a.name)
                        .join(", ");

                      return (
                        <div
                          key={album.id || idx}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => setSelectedIndex(idx)}
                          onDoubleClick={() => onSelectAlbum(album.id)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <div className="w-6 h-6 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              {img ? (
                                <img
                                  src={img}
                                  alt={album.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Disc3 className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex items-baseline gap-2 truncate">
                              <span className="text-xs font-bold text-foreground truncate">
                                {album.name}
                              </span>
                              <span className="text-xs font-normal text-muted-foreground truncate">
                                {artistNames}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

            {playlists.length > 0 &&
              (category === "all" || category === "playlists") && (
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-muted-foreground/80 uppercase px-2.5 pt-1 flex items-center justify-between">
                    <span>Playlists</span>
                  </div>
                  {playlists
                    .slice(0, category === "playlists" ? 200 : 4)
                    .map((pl) => {
                      const idx = runningIndex++;
                      const isSelected = selectedIndex === idx;
                      const img = pl.images?.[0]?.url;
                      const isUserCreated =
                        currentUserId &&
                        (pl.owner?.id === currentUserId || pl.collaborative);

                      return (
                        <div
                          key={pl.id || idx}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => setSelectedIndex(idx)}
                          onDoubleClick={() =>
                            handlePlaySelected({ type: "playlist", data: pl })
                          }
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <div className="w-6 h-6 rounded-xs bg-muted border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              {img ? (
                                <img
                                  src={img}
                                  alt={pl.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ListMusic className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex items-baseline gap-2 truncate">
                              <span className="text-xs font-bold text-foreground truncate">
                                {pl.name}
                              </span>
                              <span className="text-[11px] font-normal text-muted-foreground truncate">
                                by {pl.owner?.display_name || "Spotify"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isUserCreated && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                                By you
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShufflePlaySelected({
                                  type: "playlist",
                                  data: pl,
                                });
                              }}
                              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Play on Shuffle (Alt+S)"
                            >
                              <Shuffle className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground font-mono">
            <span>No results found for "{query}"</span>
          </div>
        )}
      </div>

      <OverlayActionsMenuPopover
        isOpen={isActionsOpen}
        onClose={() => setIsActionsOpen(false)}
        actions={actionsList}
        initialMode={popoverMode}
        trackUri={
          selectedItem?.type === "track" ? selectedItem.data.uri : undefined
        }
        trackName={
          selectedItem?.type === "recent"
            ? selectedItem.query
            : selectedItem?.data?.name
        }
        onShowToast={showToast}
        className="bottom-14 right-0"
      />

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center text-black">
            <SpotifyIcon color="#1ED760" lineColor="#00000" />
          </div>
          <span className="font-semibold text-foreground text-xs">Search</span>
        </div>

        <div className="flex items-center gap-2.5 text-muted-foreground font-medium text-[11px]">
          <button
            onClick={() => handlePlaySelected()}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
          >
            <span>{!query.trim() ? "Search Again" : "Play"}</span>
            <KbdGroup>
              <Kbd className="text-[10px] h-4.5 px-1.5 text-foreground">↵</Kbd>
            </KbdGroup>
          </button>

          <span className="text-border">|</span>

          <button
            onClick={() => {
              setPopoverMode("actions");
              setIsActionsOpen((prev) => !prev);
            }}
            className={`${isActionsOpen ? "bg-primary/20 border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground"} flex items-center gap-1.5 px-2.5 py-1 rounded-lg  font-medium transition-all cursor-pointer `}
          >
            <span>Actions</span>
            <KbdGroup>
              <Kbd
                className={`${isActionsOpen ? "text-foreground" : "text-muted-foreground"}  text-[10px] h-4.5 px-1 `}
              >
                Ctrl
              </Kbd>
              <Kbd
                className={`${isActionsOpen ? "text-foreground" : "text-muted-foreground"}  text-[10px] h-4.5 px-1 `}
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
