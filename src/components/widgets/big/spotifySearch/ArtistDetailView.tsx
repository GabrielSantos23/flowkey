import React, { useEffect, useState, useRef } from "react";
import { User, Play, Disc3, ChevronLeft, Music2 } from "lucide-react";
import { SpotifyArtist, SpotifyTrack, SpotifyAlbum } from "@/types/spotify";
import { spotifySearchApi } from "@/services/spotifySearchApi";

interface ArtistDetailViewProps {
  artist: SpotifyArtist;
  onBack: () => void;
  onSelectAlbum: (albumId: string, albumName?: string, albumCover?: string, artistName?: string) => void;
  onPlayTrack: (trackUri: string, contextUri?: string, offsetPosition?: number) => void;
  selectedIndex: number;
  setSelectedIndex: (action: number | ((prev: number) => number)) => void;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({
  artist,
  onBack,
  onSelectAlbum,
  onPlayTrack,
  selectedIndex,
  setSelectedIndex,
}) => {
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayingUri, setActivePlayingUri] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      spotifySearchApi.getArtistTopTracks(artist.id, artist.name),
      spotifySearchApi.getArtistAlbums(artist.id),
    ]).then(([tracks, albs]) => {
      if (mounted) {
        setTopTracks(tracks.slice(0, 10));
        setAlbums(albs.slice(0, 12));
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [artist.id]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-artist-item]");
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation within artist view (tracks & albums)
  useEffect(() => {
    const totalItems = topTracks.length + albums.length;
    if (totalItems === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(totalItems - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        if (selectedIndex >= topTracks.length && selectedIndex < totalItems - 1) {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(totalItems - 1, prev + 1));
          return;
        }
      }
      if (e.key === "ArrowLeft") {
        if (selectedIndex > topTracks.length) {
          e.preventDefault();
          setSelectedIndex((prev) => prev - 1);
          return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex < topTracks.length) {
          const track = topTracks[selectedIndex];
          if (track) handlePlayTopTrack(track, selectedIndex);
        } else {
          const albIdx = selectedIndex - topTracks.length;
          const alb = albums[albIdx];
          if (alb) {
            onSelectAlbum(alb.id, alb.name, alb.images?.[0]?.url, artist.name);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, topTracks, albums, onSelectAlbum, artist.name, setSelectedIndex]);

  const handlePlayTopTrack = (track: SpotifyTrack, index: number) => {
    setActivePlayingUri(track.uri);
    onPlayTrack(track.uri, artist.uri, index);
  };

  const handlePlayArtistContext = () => {
    if (artist.uri) {
      if (topTracks.length > 0) {
        setActivePlayingUri(topTracks[0].uri);
      }
      spotifySearchApi.playContext(artist.uri, 0);
    }
  };

  const displayImage = artist.images?.[0]?.url;
  const genresText = artist.genres && artist.genres.length > 0 ? artist.genres.slice(0, 3).join(", ") : "";

  return (
    <div className="flex-1 flex flex-col min-h-0 text-foreground select-none">
      {/* Artist Header Banner */}
      <div className="flex items-center gap-4 p-3.5 border-b border-border bg-muted/20">
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center justify-center flex-shrink-0"
          title="Voltar (Esc ou Backspace)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-full overflow-hidden bg-muted border border-border shadow-lg flex-shrink-0 flex items-center justify-center">
          {displayImage ? (
            <img src={displayImage} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-wider uppercase text-primary">Artista</div>
          <h2 className="text-sm font-bold text-foreground truncate leading-tight">{artist.name}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-0.5">
            {genresText && <span className="truncate capitalize text-foreground/80">{genresText}</span>}
            {artist.followers?.total && (
              <span>• {artist.followers.total.toLocaleString()} seguidores</span>
            )}
          </div>
        </div>

        <button
          onClick={handlePlayArtistContext}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 transition-all flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-primary-foreground" />
          <span>Tocar Artista</span>
        </button>
      </div>

      {/* Main Content: Top Tracks + Albums */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-2.5 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <User className="w-6 h-6 animate-pulse text-primary" />
            <span className="text-xs">Carregando perfil do artista...</span>
          </div>
        ) : (
          <>
            {/* Top Tracks Section */}
            {topTracks.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  Músicas Populares
                </div>
                <div className="space-y-1">
                  {topTracks.map((track, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isPlaying = activePlayingUri === track.uri;
                    const cover = track.album?.images?.[0]?.url;

                    return (
                      <div
                        key={track.id || track.uri || idx}
                        data-artist-item
                        onClick={() => {
                          setSelectedIndex(idx);
                          handlePlayTopTrack(track, idx);
                        }}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-foreground border border-border shadow-sm"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                            {cover ? (
                              <img src={cover} alt={track.name} className="w-full h-full object-cover" />
                            ) : (
                              <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
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
                            <span
                              className={`text-xs font-medium truncate block ${
                                isPlaying ? "text-primary font-bold" : isSelected ? "text-accent-foreground font-semibold" : "text-foreground"
                              }`}
                            >
                              {track.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {track.album?.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground text-xs">
                          <span>{formatDuration(track.duration_ms)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Albums & Discography Section */}
            {albums.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  Discografia
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {albums.map((alb, albIdx) => {
                    const globalIdx = topTracks.length + albIdx;
                    const isSelected = selectedIndex === globalIdx;
                    const albCover = alb.images?.[0]?.url;
                    const year = alb.release_date ? alb.release_date.split("-")[0] : "";

                    return (
                      <div
                        key={alb.id || alb.uri || albIdx}
                        data-artist-item
                        onClick={() => {
                          setSelectedIndex(globalIdx);
                          onSelectAlbum(alb.id, alb.name, albCover, artist.name);
                        }}
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-foreground border border-border shadow-sm"
                            : "bg-card hover:bg-accent border border-border"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                          {albCover ? (
                            <img src={albCover} alt={alb.name} className="w-full h-full object-cover" />
                          ) : (
                            <Disc3 className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold truncate ${isSelected ? "text-accent-foreground" : "text-foreground"}`}>
                            {alb.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {alb.album_type === "single" ? "Single" : "Álbum"} {year && `• ${year}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
