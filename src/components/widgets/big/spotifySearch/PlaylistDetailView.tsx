import React, { useEffect, useState, useRef } from "react";
import { ListMusic, Play, ChevronLeft, Music2 } from "lucide-react";
import { SpotifyPlaylist, SpotifyTrack } from "@/types/spotify";
import { spotifySearchApi } from "@/services/spotifySearchApi";

interface PlaylistDetailViewProps {
  playlistId: string;
  playlistName?: string;
  playlistCover?: string;
  isUserOwned?: boolean;
  onBack: () => void;
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

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlistId,
  playlistName,
  playlistCover,
  isUserOwned,
  onBack,
  onPlayTrack,
  selectedIndex,
  setSelectedIndex,
}) => {
  const [playlist, setPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePlayingUri, setActivePlayingUri] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    spotifySearchApi.getPlaylistDetails(playlistId).then((res) => {
      if (mounted) {
        setPlaylist(res);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [playlistId]);

  const rawItems: any[] =
    playlist?.tracks?.items ||
    (playlist as any)?.items?.items ||
    (Array.isArray((playlist as any)?.items) ? (playlist as any)?.items : []) ||
    (Array.isArray(playlist?.tracks) ? playlist?.tracks : []) ||
    [];

  const tracks: SpotifyTrack[] = rawItems
    .map((ti: any) => (ti?.track ? ti.track : ti?.item ? ti.item : ti))
    .filter((t: any) => t && (t.name || t.id || t.uri)) as SpotifyTrack[];

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-playlist-track-item]");
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation within playlist tracks
  useEffect(() => {
    if (tracks.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(tracks.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const track = tracks[selectedIndex];
        if (track) {
          handlePlayTrack(track, selectedIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, tracks, setSelectedIndex]);

  const handlePlayTrack = (track: SpotifyTrack, index: number) => {
    setActivePlayingUri(track.uri);
    onPlayTrack(track.uri, playlist?.uri, index);
  };

  const handlePlayFullPlaylist = () => {
    if (playlist?.uri) {
      if (tracks.length > 0) {
        setActivePlayingUri(tracks[0].uri);
      }
      spotifySearchApi.playContext(playlist.uri, 0);
    }
  };

  const displayCover = playlist?.images?.[0]?.url || playlistCover;
  const displayTitle = playlist?.name || playlistName || "Carregando Playlist...";
  const displayOwner = playlist?.owner?.display_name || "";
  const isCreatedByMe = isUserOwned ?? playlist?.is_user_owned;

  return (
    <div className="flex-1 flex flex-col min-h-0 text-foreground select-none">
      {/* Playlist Header Banner */}
      <div className="flex items-center gap-4 p-3.5 border-b border-border bg-muted/20">
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center justify-center flex-shrink-0"
          title="Voltar (Esc ou Backspace)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border shadow-lg flex-shrink-0 flex items-center justify-center">
          {displayCover ? (
            <img src={displayCover} alt={displayTitle} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-primary">Playlist</span>
            {isCreatedByMe && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary border border-primary/30">
                Sua Playlist
              </span>
            )}
          </div>
          <h2 className="text-sm font-bold text-foreground truncate leading-tight">{displayTitle}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-0.5">
            {displayOwner && <span className="truncate text-foreground/80">Por {displayOwner}</span>}
            {playlist?.tracks?.total && <span>• {playlist.tracks.total} faixas</span>}
          </div>
        </div>

        <button
          onClick={handlePlayFullPlaylist}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 transition-all flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-primary-foreground" />
          <span>Tocar Playlist</span>
        </button>
      </div>

      {/* Tracks List */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 px-2.5 py-2 space-y-1 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <ListMusic className="w-6 h-6 animate-pulse text-primary" />
            <span className="text-xs">Carregando faixas da playlist...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">Nenhuma faixa encontrada nesta playlist.</div>
        ) : (
          tracks.map((track, idx) => {
            const isSelected = selectedIndex === idx;
            const isPlaying = activePlayingUri === track.uri;
            const trackCover = track.album?.images?.[0]?.url;

            return (
              <div
                key={track.id || track.uri || idx}
                data-playlist-track-item
                onClick={() => {
                  setSelectedIndex(idx);
                  handlePlayTrack(track, idx);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accent-foreground border border-border shadow-sm"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                    {trackCover ? (
                      <img src={trackCover} alt={track.name} className="w-full h-full object-cover" />
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
                  <span>{formatDuration(track.duration_ms)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
