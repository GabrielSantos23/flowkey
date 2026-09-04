import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats, SpotifyQueueTrack } from "../../../types";
import { Play, Music, Shuffle, List, Settings, Mic2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SpotifyQueueSkeleton } from "@/components/skeletons";
import { SizeTransitionBlur } from "@/components/common/SizeTransitionBlur";
import { SpotifyLyrics } from "./SpotifyLyrics";

interface SpotifyExpandedPlayerProps {
  media: MediaStats;
  onRefreshMedia?: () => void;
  onQueueToggle?: (isOpen: boolean) => void;
}

export const SpotifyExpandedPlayer: React.FC<SpotifyExpandedPlayerProps> = ({
  media,
  onRefreshMedia,
  onQueueToggle,
}) => {
  const [localPos, setLocalPos] = useState(media.position_secs);
  const [isShuffle, setIsShuffle] = useState(false);
  const [activePanel, setActivePanel] = useState<"queue" | "lyrics" | null>(null);
  const [queueTracks, setQueueTracks] = useState<SpotifyQueueTrack[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isSpotifyAuthed, setIsSpotifyAuthed] = useState(false);

  // Check Spotify API authorization and shuffle state on mount
  const checkAuthAndShuffle = async () => {
    try {
      const authed = await invoke<boolean>("check_spotify_auth");
      setIsSpotifyAuthed(authed);
      if (authed) {
        const shuffle = await invoke<boolean>("get_spotify_shuffle_state");
        setIsShuffle(shuffle);
      }
    } catch {}
  };

  useEffect(() => {
    checkAuthAndShuffle();
  }, []);

  // Periodically check shuffle state
  useEffect(() => {
    if (!isSpotifyAuthed) return;
    const interval = setInterval(async () => {
      try {
        const shuffle = await invoke<boolean>("get_spotify_shuffle_state");
        setIsShuffle(shuffle);
      } catch {}
    }, 8000);
    return () => clearInterval(interval);
  }, [isSpotifyAuthed]);

  // Sync position
  useEffect(() => {
    setLocalPos(media.position_secs);
  }, [media.position_secs]);

  useEffect(() => {
    if (!media.is_playing) return;
    const interval = setInterval(() => {
      setLocalPos((pos) => {
        if (media.duration_secs > 0 && pos >= media.duration_secs) return pos;
        return pos + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [media.is_playing, media.duration_secs]);

  // Fetch queue from Spotify API
  const fetchQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const q = await invoke<SpotifyQueueTrack[]>("get_spotify_queue");
      if (q) {
        setQueueTracks(q);
      }
    } catch {} finally {
      setIsLoadingQueue(false);
    }
  };

  const toggleQueue = () => {
    const nextPanel = activePanel === "queue" ? null : "queue";
    setActivePanel(nextPanel);
    if (onQueueToggle) onQueueToggle(nextPanel !== null);
    if (nextPanel === "queue") {
      checkAuthAndShuffle();
      fetchQueue();
    }
  };

  const toggleLyrics = () => {
    const nextPanel = activePanel === "lyrics" ? null : "lyrics";
    setActivePanel(nextPanel);
    if (onQueueToggle) onQueueToggle(nextPanel !== null);
  };

  const handlePlayQueueTrack = async (track: SpotifyQueueTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const uri = track.uri || (track.id ? `spotify:track:${track.id}` : null);
    if (!uri) return;
    try {
      await invoke("spotify_play", { uris: [uri] });
      if (onRefreshMedia) setTimeout(onRefreshMedia, 300);
      setTimeout(fetchQueue, 800);
    } catch (err) {
      console.error("Failed to play track directly", err);
    }
  };

  const handleShuffleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSpotifyAuthed) {
      try {
        await invoke("open_settings_window");
      } catch {}
      return;
    }
    const nextState = !isShuffle;
    setIsShuffle(nextState);
    try {
      await invoke("set_spotify_shuffle", { shuffleState: nextState });
    } catch {}
  };

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("media_play_pause");
      if (onRefreshMedia) setTimeout(onRefreshMedia, 200);
    } catch {}
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("spotify_next");
      if (onRefreshMedia) setTimeout(onRefreshMedia, 300);
    } catch {
      await invoke("media_next");
    }
  };

  const handlePrev = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("spotify_previous");
      if (onRefreshMedia) setTimeout(onRefreshMedia, 300);
    } catch {
      await invoke("media_prev");
    }
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = pct * media.duration_secs;
    const diff = targetSec - localPos;
    setLocalPos(targetSec);
    try {
      await invoke("media_seek", { offsetSecs: diff });
      if (onRefreshMedia) setTimeout(onRefreshMedia, 200);
    } catch {}
  };

  const handleSeekSecs = async (targetSec: number) => {
    const diff = targetSec - localPos;
    setLocalPos(targetSec);
    try {
      await invoke("media_seek", { offsetSecs: diff });
      if (onRefreshMedia) setTimeout(onRefreshMedia, 200);
    } catch {}
  };


  const handleOpenSpotify = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("open_spotify");
    } catch {
      try {
        window.open("spotify:", "_self");
      } catch {}
    }
  };

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      invoke("open_settings_window");
    } catch {}
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const progressPercent =
    media.duration_secs > 0
      ? Math.min(100, (localPos / media.duration_secs) * 100)
      : 0;

  const remainingSecs = Math.max(0, media.duration_secs - localPos);

  return (
    <SizeTransitionBlur triggerKey={activePanel || "none"} maxBlur={8} className="w-full">
      <div className="w-full flex items-start p-3.5 bg-transparent text-foreground select-none">
        <div
          className={`flex flex-col justify-between h-35.5 transition-all ${
            activePanel !== null ? "w-73.75 pr-3.5 shrink-0" : "w-full"
          }`}
        >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              onClick={handleOpenSpotify}
              className="relative w-12 h-12 rounded-xl bg-muted border border-border overflow-hidden shrink-0 shadow-lg flex items-center justify-center cursor-pointer group/art transition-transform duration-300 hover:scale-108 hover:shadow-[0_6px_20px_rgba(0,0,0,0.6)] active:scale-95"
            >
              {media.art_url ? (
                <img
                  src={media.art_url}
                  alt={media.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/art:scale-110"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-300 group-hover/art:scale-110">
                  <Music className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-bold text-foreground tracking-tight truncate leading-tight">
                {media.title || "No Media Playing"}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                {media.artist || "Spotify"}
              </p>
            </div>
          </div>

          <button
            onClick={toggleLyrics}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
              activePanel === "lyrics"
                ? "bg-white text-secondary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Mic2 className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Progress Bar */}
        <div className="flex items-center justify-between gap-2.5 my-2 text-[10px] font-mono text-muted-foreground">
          <span className="w-7 text-left">{formatTime(localPos)}</span>
          <div
            onClick={handleSeek}
            className="group/bar relative flex-1 h-1 bg-muted rounded-full cursor-pointer overflow-hidden transition-all hover:h-1.5"
          >
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-7 text-right">-{formatTime(remainingSecs)}</span>
        </div>

        <div className="flex items-center justify-between pt-0.5 px-0.5">
          <button
            onClick={toggleQueue}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              activePanel === "queue"
                ? "bg-white text-secondary shadow-sm"
                : isSpotifyAuthed
                ? "bg-secondary text-foreground hover:bg-accent"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
           title={!isSpotifyAuthed ? "Connect Spotify API in Settings to view queue" : undefined}
          >
            <List className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              className="p-1 text-foreground hover:scale-110 active:scale-90 transition-all focus:outline-none"
            >

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-8">
                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V8.69c0-1.44-1.555-2.343-2.805-1.628L12 11.029v-2.34c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z" />
              </svg>

            </button>

            <button
              onClick={handlePlayPause}
              className="p-1 text-foreground hover:scale-110 active:scale-95 transition-all flex items-center justify-center focus:outline-none"
            >
              {media.is_playing ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-9">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                </svg>

                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-9">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                  </svg>
              )}
            </button>

            <button
              onClick={handleNext}
              className="p-1 text-foreground hover:scale-110 active:scale-90 transition-all focus:outline-none"
            >

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-8">
                <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v8.122c0 1.44 1.555 2.343 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.346 12 7.249 12 8.689v2.34L5.055 7.061Z" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleShuffleToggle}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              isShuffle
                ? "bg-white text-secondary shadow-sm"
                : isSpotifyAuthed
                ? "bg-secondary text-foreground hover:bg-accent"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}

          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {activePanel !== null && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, width: 0 }}
            animate={{
              opacity: 1,
              width: 275,
              transition: {
                width: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
                opacity: { duration: 0.18, delay: 0.08 },
              },
            }}
            exit={{
              opacity: 0,
              width: 0,
              transition: {
                opacity: { duration: 0.12 },
                width: { duration: 0.28, ease: [0.32, 0.72, 0, 1], delay: 0.06 },
              },
            }}
            className="overflow-hidden h-35.5 flex flex-col justify-between"
          >
            {activePanel === "lyrics" ? (
              <SpotifyLyrics
                trackTitle={media.title}
                artistName={media.artist}
                albumName={media.album}
                durationSecs={media.duration_secs}
                currentPosSecs={localPos}
                isPlaying={media.is_playing}
                onSeek={handleSeekSecs}
              />
            ) : (
              <div
                data-scrollable="true"
                onWheel={(e) => e.stopPropagation()}
                className="w-68.75 pl-4 border-l border-border flex flex-col justify-between h-35.5 overflow-hidden select-none"
              >
                <div className="flex flex-col h-full gap-1">
                  <div className="flex items-center justify-between pb-1 shrink-0">
                    <span className="text-[13px] font-bold text-foreground tracking-tight">
                      Playing Next
                    </span>
                    {!isSpotifyAuthed && (
                      <button
                        onClick={openSettings}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>

                  {!isSpotifyAuthed ? (
                    <div className="p-2.5 rounded-xl bg-card border border-border text-center flex flex-col items-center gap-1.5 my-auto">
                      <p className="text-[11px] text-muted-foreground">
                        Spotify API not connected.
                      </p>
                      <button
                        onClick={openSettings}
                        className="px-2.5 py-0.5 rounded-lg bg-white text-primary-foreground text-[11px] font-bold hover:bg-primary/90 active:scale-95 transition-all"
                      >
                        Connect in Settings
                      </button>
                    </div>
                  ) : isLoadingQueue ? (
                    <SpotifyQueueSkeleton count={3} />
                  ) : queueTracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No upcoming tracks in queue.
                    </div>
                  ) : (
                    <div
                      data-scrollable="true"
                      onWheel={(e) => e.stopPropagation()}
                      className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 relative flex flex-col gap-1.5 mask-linear-fade"
                      style={{ scrollBehavior: "smooth" }}
                    >
                      {queueTracks.slice(0, 5).map((track, idx) => {
                        const trackId = track.id || track.uri || String(idx);
                        const isNext = idx === 0;

                        return (
                          <div
                            key={trackId}
                            className={`group/item flex items-center justify-between p-1 rounded-lg transition-all ${
                              isNext
                                ? "bg-card hover:bg-accent border border-border"
                                : "hover:bg-accent border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                onClick={(e) => handlePlayQueueTrack(track, e)}
                                className="w-7 h-7 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center shadow-sm relative group/art cursor-pointer hover:border-foreground/50 transition-all"
                              >
                                {track.album_art ? (
                                  <img
                                    src={track.album_art}
                                    alt={track.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <Music className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                                <div className="absolute inset-0 bg-background/60 items-center justify-center hidden group-hover/art:flex">
                                  <Play className="w-3 h-3 text-foreground fill-foreground" />
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold truncate max-w-36.25 leading-tight text-foreground/90 group-hover/item:text-foreground transition-all">
                                  {track.title}
                                </div>
                                <div className="text-[10px] truncate max-w-36.25 mt-0.5 text-muted-foreground group-hover/item:text-foreground transition-all">
                                  {track.artist}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </SizeTransitionBlur>
  );
};
