import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Music2, User, Disc3, ListMusic, Play } from "lucide-react";
import {
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyPlaylist,
  SearchCategoryFilter,
} from "@/types/spotify";

export interface FlatSearchItem {
  id: string;
  type: "track" | "artist" | "album" | "playlist";
  data: any;
}

interface SearchMainViewProps {
  loading: boolean;
  category: SearchCategoryFilter;
  searchQuery: string;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  onSelectTrack: (track: SpotifyTrack, index: number) => void;
  onSelectArtist: (artist: SpotifyArtist) => void;
  onSelectAlbum: (album: SpotifyAlbum) => void;
  onSelectPlaylist: (playlist: SpotifyPlaylist) => void;
  flatItems: FlatSearchItem[];
  activePlayingUri?: string | null;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export const SearchMainView: React.FC<SearchMainViewProps> = ({
  loading,
  category,
  searchQuery,
  selectedIndex,
  setSelectedIndex,
  onSelectTrack,
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  flatItems,
  activePlayingUri,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-search-item]");
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!searchQuery.trim()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 text-primary shadow-inner">
          <Music2 className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Buscar no Spotify</h3>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          Digite para pesquisar por músicas, artistas, álbuns e playlists.
        </p>
        <div className="flex items-center gap-2 mt-4 text-[11px] text-muted-foreground">
          <span className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-foreground">↑ / ↓</span>
          <span>Navegar</span>
          <span className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-foreground">↵</span>
          <span>Selecionar</span>
          <span className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-foreground">Esc</span>
          <span>Fechar</span>
        </div>
      </div>
    );
  }

  if (loading && flatItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2.5 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Buscando no Spotify...</span>
      </div>
    );
  }

  if (flatItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
        <Music2 className="w-8 h-8 text-muted-foreground/60 mb-2" />
        <div className="text-xs font-semibold text-foreground">Nenhum resultado encontrado</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Tente buscar com outros termos ou selecione outra categoria</div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-2 custom-scrollbar">
      <motion.div
        key={`${searchQuery}-${category}`}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-1.5"
      >
        {flatItems.map((item, idx) => {
          const isSelected = selectedIndex === idx;

          if (item.type === "track") {
            const track = item.data as SpotifyTrack;
            const isPlaying = activePlayingUri === track.uri;
            const cover = track.album?.images?.[0]?.url;

            return (
              <motion.div
                key={`track-${track.id || track.uri || idx}`}
                variants={itemVariants}
                data-search-item
                onClick={() => {
                  setSelectedIndex(idx);
                  onSelectTrack(track, idx);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground border border-border shadow-sm"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt={track.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music2 className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div
                      className={`absolute inset-0 bg-background/50 items-center justify-center ${
                        isPlaying ? "flex" : "hidden group-hover:flex"
                      }`}
                    >
                      {isPlaying ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="w-1 h-3 bg-primary rounded-full animate-bounce" />
                          <span className="w-1 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1 h-3 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                        </div>
                      ) : (
                        <Play className="w-3.5 h-3.5 text-foreground fill-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium truncate ${
                          isPlaying ? "text-primary font-bold" : isSelected ? "text-accent-foreground font-semibold" : "text-foreground"
                        }`}
                      >
                        {track.name}
                      </span>
                      {track.explicit && (
                        <span className="px-1 text-[9px] font-bold bg-muted text-muted-foreground rounded border border-border">
                          E
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {track.artists?.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground text-xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Música</span>
                  <span>{formatDuration(track.duration_ms)}</span>
                </div>
              </motion.div>
            );
          }

          if (item.type === "artist") {
            const artist = item.data as SpotifyArtist;
            const img = artist.images?.[0]?.url;

            return (
              <motion.div
                key={`artist-${artist.id || idx}`}
                variants={itemVariants}
                data-search-item
                onClick={() => {
                  setSelectedIndex(idx);
                  onSelectArtist(artist);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground border border-border shadow-sm"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                    {img ? (
                      <img src={img} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold truncate block ${isSelected ? "text-accent-foreground" : "text-foreground"}`}>
                      {artist.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block capitalize">
                      {artist.genres && artist.genres.length > 0 ? artist.genres.slice(0, 2).join(", ") : "Artista"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Artista</span>
                  <span className="text-muted-foreground text-xs">→</span>
                </div>
              </motion.div>
            );
          }

          if (item.type === "album") {
            const album = item.data as SpotifyAlbum;
            const cover = album.images?.[0]?.url;
            const year = album.release_date ? album.release_date.split("-")[0] : "";

            return (
              <motion.div
                key={`album-${album.id || idx}`}
                variants={itemVariants}
                data-search-item
                onClick={() => {
                  setSelectedIndex(idx);
                  onSelectAlbum(album);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground border border-border shadow-sm"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt={album.name} className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold truncate block ${isSelected ? "text-accent-foreground" : "text-foreground"}`}>
                      {album.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {album.artists?.map((a) => a.name).join(", ")} {year && `• ${year}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Álbum</span>
                  <span className="text-muted-foreground text-xs">→</span>
                </div>
              </motion.div>
            );
          }

          if (item.type === "playlist") {
            const playlist = item.data as SpotifyPlaylist;
            const cover = playlist.images?.[0]?.url;
            const isMine = playlist.is_user_owned;

            return (
              <motion.div
                key={`playlist-${playlist.id || idx}`}
                variants={itemVariants}
                data-search-item
                onClick={() => {
                  setSelectedIndex(idx);
                  onSelectPlaylist(playlist);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground border border-border shadow-sm"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : (
                      <ListMusic className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold truncate ${isSelected ? "text-accent-foreground" : "text-foreground"}`}>
                        {playlist.name}
                      </span>
                      {isMine && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 rounded">
                          Sua Playlist
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Por {playlist.owner?.display_name || "Spotify"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Playlist</span>
                  <span className="text-muted-foreground text-xs">→</span>
                </div>
              </motion.div>
            );
          }

          return null;
        })}
      </motion.div>
    </div>
  );
};
