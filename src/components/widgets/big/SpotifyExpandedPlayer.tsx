import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats, SpotifyQueueTrack } from "../../../types";
import { Play, Pause, Music, Shuffle, List, X, Settings, ChevronsLeft, ChevronsRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SpotifyQueueSkeleton } from "@/components/skeletons";
import { SizeTransitionBlur } from "@/components/common/SizeTransitionBlur";

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
  const [isQueueOpen, setIsQueueOpen] = useState(false);
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
    const nextState = !isQueueOpen;
    setIsQueueOpen(nextState);
    if (onQueueToggle) onQueueToggle(nextState);
    if (nextState) {
      checkAuthAndShuffle();
      fetchQueue();
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

  const removeQueueItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueueTracks((prev) => prev.filter((t) => t.id !== id));
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
    <SizeTransitionBlur triggerKey={isQueueOpen} maxBlur={8} className="w-full">
      <div className="w-full flex items-start p-3.5 bg-transparent text-white select-none">
        {/* LEFT COLUMN: Main Player */}
      <div className="w-[305px] h-[142px] flex-shrink-0 flex flex-col justify-between">
        {/* Top: Cover, Info & Waveform */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Album Art */}
            <div className="relative w-12 h-12 rounded-xl bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 shadow-lg flex items-center justify-center">
              {media.art_url ? (
                <img
                  src={media.art_url}
                  alt={media.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center text-white/40">
                  <Music className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Title & Artist */}
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-bold text-white tracking-tight truncate leading-tight">
                {media.title || "No Media Playing"}
              </h3>
              <p className="text-[11px] text-neutral-400 font-medium truncate mt-0.5">
                {media.artist || "Spotify"}
              </p>
            </div>
          </div>

          {/* Equalizer Waveform */}
          <div className="flex items-end gap-[2.5px] h-3.5 px-1 flex-shrink-0">
            {[0.35, 0.9, 0.55, 0.85, 0.4].map((h, i) => (
              <motion.div
                key={i}
                className="w-[2.5px] rounded-full bg-white/90"
                animate={
                  media.is_playing
                    ? {
                        height: [
                          `${Math.max(2, 13 * h * 0.3)}px`,
                          `${Math.max(3, 13 * h)}px`,
                          `${Math.max(2, 13 * h * 0.5)}px`,
                        ],
                      }
                    : { height: "2.5px" }
                }
                transition={
                  media.is_playing
                    ? {
                        duration: 0.5 + (i % 3) * 0.15,
                        repeat: Infinity,
                        repeatType: "mirror",
                        ease: "easeInOut",
                      }
                    : { duration: 0.2 }
                }
              />
            ))}
          </div>
        </div>

        {/* Middle: Progress Bar */}
        <div className="flex items-center justify-between gap-2.5 my-2 text-[10px] font-mono text-neutral-400">
          <span className="w-7 text-left">{formatTime(localPos)}</span>
          <div
            onClick={handleSeek}
            className="group/bar relative flex-1 h-1 bg-white/20 rounded-full cursor-pointer overflow-hidden transition-all hover:h-1.5"
          >
            <div
              className="h-full bg-white/90 rounded-full transition-all"
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
              isQueueOpen
                ? "bg-white text-black shadow-sm"
                : isSpotifyAuthed
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white/5 text-neutral-500 hover:text-neutral-300"
            }`}
            title={isSpotifyAuthed ? "Playing Next" : "Connect Spotify API in Settings to view queue"}
          >
            <List className="w-4 h-4" />
          </button>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              className="p-1 text-white hover:opacity-80 active:scale-90 transition-all"
              title="Previous"
            >
              <ChevronsLeft className="w-7 h-7 fill-white stroke-none" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-1 text-white hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
              title={media.is_playing ? "Pause" : "Play"}
            >
              {media.is_playing ? (
                <Pause className="w-7 h-7 fill-white stroke-none" />
              ) : (
                <Play className="w-7 h-7 fill-white stroke-none ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              className="p-1 text-white hover:opacity-80 active:scale-90 transition-all"
              title="Next"
            >
              <ChevronsRight className="w-7 h-7 fill-white stroke-none" />
            </button>
          </div>

          {/* Shuffle Button */}
          <button
            onClick={handleShuffleToggle}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              isShuffle
                ? "bg-[#1DB954] text-black shadow-sm"
                : isSpotifyAuthed
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white/5 text-neutral-500 hover:text-neutral-300"
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
        {isQueueOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{
              opacity: 1,
              width: 270,
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
            <div className="w-[270px] pl-4 border-l border-white/10 flex flex-col justify-between h-[142px]">
              <SizeTransitionBlur triggerKey={isQueueOpen} maxBlur={8} className="w-full h-full">
                <div className="flex flex-col gap-1.5">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="text-[13px] font-bold text-white tracking-tight">
                      Playing Next
                    </span>
                    {!isSpotifyAuthed && (
                      <button
                        onClick={openSettings}
                        className="flex items-center gap-1 text-[10px] text-[#1DB954] hover:underline"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>

                  {/* Queue Items or Skeletons */}
                  {!isSpotifyAuthed ? (
                    <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-white/5 text-center flex flex-col items-center gap-1.5 my-auto">
                      <p className="text-[11px] text-neutral-400">
                        Spotify API not connected.
                      </p>
                      <button
                        onClick={openSettings}
                        className="px-2.5 py-0.5 rounded-lg bg-[#1DB954] text-black text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all"
                      >
                        Connect in Settings
                      </button>
                    </div>
                  ) : isLoadingQueue ? (
                    <SpotifyQueueSkeleton count={3} />
                  ) : queueTracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-500">
                      No upcoming tracks in queue.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 overflow-hidden">
                      {queueTracks.slice(0, 3).map((track) => (
                        <div
                          key={track.id || track.uri}
                          className="group/item flex items-center justify-between p-1 rounded-lg hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Track Album Art */}
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
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
                                <Music className="w-3.5 h-3.5 text-neutral-500" />
                              )}
                            </div>

                            {/* Track Info */}
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-semibold text-white truncate max-w-[140px] leading-tight">
                                {track.title}
                              </div>
                              <div className="text-[10px] text-neutral-400 truncate max-w-[140px] mt-0.5">
                                {track.artist}
                              </div>
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={(e) => removeQueueItem(track.id, e)}
                            className="p-1 rounded-full text-neutral-500 hover:text-white hover:bg-white/10 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0"
                            title="Remove from queue"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SizeTransitionBlur>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </SizeTransitionBlur>
  );
};
