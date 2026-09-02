import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats, SpotifyQueueTrack } from "../../../types";
import { Play, Pause, Music, Shuffle, List, X, Settings, ChevronsLeft, ChevronsRight, Mic2 } from "lucide-react";
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
  const [processingTrackId, setProcessingTrackId] = useState<string | null>(null);

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

  const handlePromoteToNext = (track: SpotifyQueueTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const trackIdentifier = track.id || track.uri;
    if (processingTrackId || !trackIdentifier) return;

    const currIndex = queueTracks.findIndex(
      (t) => (t.id || t.uri) === trackIdentifier
    );
    if (currIndex <= 0) return; // already top item or not found

    setProcessingTrackId(trackIdentifier);

    setTimeout(() => {
      setQueueTracks((prev) => {
        const item = prev.find((t) => (t.id || t.uri) === trackIdentifier);
        if (!item) return prev;
        const rest = prev.filter((t) => (t.id || t.uri) !== trackIdentifier);
        return [item, ...rest];
      });
      setProcessingTrackId(null);
    }, 400);
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
      await invoke("media_next");
      if (onRefreshMedia) setTimeout(onRefreshMedia, 300);
    } catch {}
  };

  const handlePrev = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("media_prev");
      if (onRefreshMedia) setTimeout(onRefreshMedia, 300);
    } catch {}
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

  const removeQueueItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueueTracks((prev) => prev.filter((t) => t.id !== id));
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
        {/* LEFT COLUMN: Main Player */}
        <div
          className={`flex flex-col justify-between h-[142px] transition-all ${
            activePanel !== null ? "w-[295px] pr-3.5 flex-shrink-0" : "w-full"
          }`}
        >
        {/* Top: Cover, Info & Lyrics Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Album Art */}
            <div
              onClick={handleOpenSpotify}
              className="relative w-12 h-12 rounded-xl bg-muted border border-border overflow-hidden flex-shrink-0 shadow-lg flex items-center justify-center cursor-pointer group/art transition-transform duration-300 hover:scale-108 hover:shadow-[0_6px_20px_rgba(0,0,0,0.6)] active:scale-95"
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

            {/* Title & Artist */}
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
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 ${
              activePanel === "lyrics"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Lyrics (LRCLIB)"
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
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-7 text-right">-{formatTime(remainingSecs)}</span>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between pt-0.5 px-0.5">
          {/* Queue Button */}
          <button
            onClick={toggleQueue}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              activePanel === "queue"
                ? "bg-primary text-primary-foreground shadow-sm"
                : isSpotifyAuthed
                ? "bg-secondary text-foreground hover:bg-accent"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
            title={isSpotifyAuthed ? "Playing Next" : "Connect Spotify API in Settings to view queue"}
          >
            <List className="w-4 h-4" />
          </button>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              className="p-1 text-foreground hover:opacity-80 active:scale-90 transition-all"
              title="Previous"
            >
              <ChevronsLeft className="w-7 h-7 fill-foreground stroke-none" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-1 text-foreground hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
              title={media.is_playing ? "Pause" : "Play"}
            >
              {media.is_playing ? (
                <Pause className="w-7 h-7 fill-foreground stroke-none" />
              ) : (
                <Play className="w-7 h-7 fill-foreground stroke-none ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              className="p-1 text-foreground hover:opacity-80 active:scale-90 transition-all"
              title="Next"
            >
              <ChevronsRight className="w-7 h-7 fill-foreground stroke-none" />
            </button>
          </div>

          {/* Shuffle Button */}
          <button
            onClick={handleShuffleToggle}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              isShuffle
                ? "bg-primary text-primary-foreground shadow-sm"
                : isSpotifyAuthed
                ? "bg-secondary text-foreground hover:bg-accent"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
            title={
              isSpotifyAuthed
                ? isShuffle
                  ? "Shuffle: On"
                  : "Shuffle: Off"
                : "Connect Spotify in Settings"
            }
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
            className="overflow-hidden h-[142px] flex flex-col justify-between"
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
                className="w-[275px] pl-4 border-l border-border flex flex-col justify-between h-[142px] overflow-hidden select-none"
              >
                <div className="flex flex-col h-full gap-1">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1 flex-shrink-0">
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

                  {/* Queue Items or Skeletons */}
                  {!isSpotifyAuthed ? (
                    <div className="p-2.5 rounded-xl bg-card border border-border text-center flex flex-col items-center gap-1.5 my-auto">
                      <p className="text-[11px] text-muted-foreground">
                        Spotify API not connected.
                      </p>
                      <button
                        onClick={openSettings}
                        className="px-2.5 py-0.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 active:scale-95 transition-all"
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
                        const isProcessing = processingTrackId === (track.id || track.uri);
                        const isNext = idx === 0;

                        return (
                          <motion.div
                            key={trackId}
                            layout
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            onClick={(e) => handlePromoteToNext(track, e)}
                            className={`group/item flex items-center justify-between p-1 rounded-lg transition-all cursor-pointer ${
                              isProcessing
                                ? "bg-primary/20 border border-primary/40 shadow-sm"
                                : isNext
                                ? "bg-card hover:bg-accent border border-border"
                                : "hover:bg-accent border border-transparent"
                            }`}
                            title={isNext ? "Next Track" : "Click to promote to next"}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Track Album Art */}
                              <div className="w-7 h-7 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm relative">
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
                              </div>

                              {/* Track Info */}
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-[11.5px] font-semibold truncate max-w-[145px] leading-tight transition-all ${
                                    isProcessing
                                      ? "animate-pulse text-primary font-bold"
                                      : "text-foreground group-hover/item:text-primary"
                                  }`}
                                >
                                  {track.title}
                                </div>
                                <div
                                  className={`text-[10px] truncate max-w-[145px] mt-0.5 transition-all ${
                                    isProcessing
                                      ? "animate-pulse text-primary/80"
                                      : "text-muted-foreground group-hover/item:text-foreground"
                                  }`}
                                >
                                  {track.artist}
                                </div>
                              </div>
                            </div>

                            {/* Remove Button */}
                            <button
                              onClick={(e) => removeQueueItem(track.id, e)}
                              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0"
                              title="Remove from queue"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
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
