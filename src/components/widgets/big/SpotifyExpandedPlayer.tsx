import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats, SpotifyQueueTrack } from "../../../types";
import { Play, Pause, Music, Shuffle, List, X, GripVertical, Settings, ChevronsLeft, ChevronsRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SizeTransitionBlur } from "../../common/SizeTransitionBlur";

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
  const [isSpotifyAuthed, setIsSpotifyAuthed] = useState(false);

  // Check Spotify API authorization on mount
  const checkAuth = async () => {
    try {
      const authed = await invoke<boolean>("check_spotify_auth");
      setIsSpotifyAuthed(authed);
    } catch {}
  };

  useEffect(() => {
    checkAuth();
  }, []);

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

  // Fetch queue from real Spotify API
  const fetchQueue = async () => {
    try {
      const q = await invoke<SpotifyQueueTrack[]>("get_spotify_queue");
      if (q) {
        setQueueTracks(q);
      }
    } catch {}
  };

  const toggleQueue = () => {
    const nextState = !isQueueOpen;
    setIsQueueOpen(nextState);
    if (onQueueToggle) onQueueToggle(nextState);
    if (nextState) {
      checkAuth();
      fetchQueue();
    }
  };

  const handleShuffleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSpotifyAuthed) {
      // Open settings if not connected
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
    <div className="w-full flex flex-col justify-between p-4 bg-transparent text-white select-none">
      {/* Top Section: Album Cover + Title / Artist + Equalizer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Album Cover Art */}
          <div className="relative w-11 h-11 rounded-lg bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 shadow-md flex items-center justify-center">
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
            <h3 className="text-[13px] font-semibold text-white tracking-tight truncate leading-tight">
              {media.title || "No Media Playing"}
            </h3>
            <p className="text-[11px] text-neutral-400 font-normal truncate mt-0.5">
              {media.artist || "Spotify"}
            </p>
          </div>
        </div>

        {/* Equalizer Waveform & Settings Button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-end gap-0.5 h-4 px-1">
            {[0.4, 0.9, 0.6, 0.85, 0.4].map((h, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-orange-400"
                animate={
                  media.is_playing
                    ? {
                        height: [
                          `${Math.max(2, 14 * h * 0.3)}px`,
                          `${Math.max(3, 14 * h)}px`,
                          `${Math.max(2, 14 * h * 0.5)}px`,
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

          <button
            onClick={openSettings}
            className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: Progress Scrubber Bar */}
      <div className="flex items-center justify-between gap-2.5 my-2.5 text-[10px] font-mono text-neutral-400">
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

      {/* Controls Row: Left (Queue), Center (Prev, Play, Next), Right (Shuffle) */}
      <div className="flex items-center justify-between pt-0.5 px-1">
        {/* Left Button: List / Queue Button */}
        <button
          onClick={toggleQueue}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isQueueOpen
              ? "bg-white text-black shadow-sm"
              : isSpotifyAuthed
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white/5 text-neutral-500 hover:text-neutral-300"
          }`}
          title={isSpotifyAuthed ? "Playing Next Queue" : "Connect Spotify API in Settings to view queue"}
        >
          <List className="w-4 h-4" />
        </button>

        {/* Center Playback Controls */}
        <div className="flex items-center gap-5">
          <button
            onClick={handlePrev}
            className="p-1 text-white hover:opacity-80 active:scale-90 transition-all"
            title="Previous"
          >
            <ChevronsLeft  className="w-10 h-10 fill-white stroke-none" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-1.5 text-white hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
            title={media.is_playing ? "Pause" : "Play"}
          >
            {media.is_playing ? (
              <Pause className="w-10 h-10 fill-white stroke-none" />
            ) : (
              <Play className="w-10 h-10 fill-white stroke-none ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            className="p-1 text-white hover:opacity-80 active:scale-90 transition-all"
            title="Next"
          >
            <ChevronsRight  className="w-10 h-10 fill-white stroke-none" />
          </button>
        </div>

        {/* Right Button: Shuffle Button */}
        <button
          onClick={handleShuffleToggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isShuffle
              ? "bg-emerald-500 text-black shadow-sm"
              : isSpotifyAuthed
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white/5 text-neutral-500 hover:text-neutral-300"
          }`}
          title={isSpotifyAuthed ? "Toggle Shuffle" : "Connect Spotify API in Settings to toggle shuffle"}
        >
          <Shuffle className="w-4 h-4" />
        </button>
      </div>

      {/* "Playing Next" Queue Drawer with Motion Blur */}
      <AnimatePresence>
        {isQueueOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3 pt-2 border-t border-white/10 flex flex-col gap-2"
          >
            <SizeTransitionBlur triggerKey={isQueueOpen}>
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-neutral-400">
                  Playing Next
                </span>
                {!isSpotifyAuthed && (
                  <button
                    onClick={openSettings}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:underline"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Connect Spotify</span>
                  </button>
                )}
              </div>

              {/* If Not Connected -> Show Connect Prompt (NO PLACEHOLDERS) */}
              {!isSpotifyAuthed ? (
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 text-center flex flex-col items-center gap-2">
                  <p className="text-xs text-neutral-400">
                    Spotify API is not connected.
                  </p>
                  <button
                    onClick={openSettings}
                    className="px-3 py-1 rounded-lg bg-[#1DB954] text-black text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                  >
                    Connect in Settings
                  </button>
                </div>
              ) : queueTracks.length === 0 ? (
                /* If Connected but Queue is Empty */
                <div className="p-3 text-center text-xs text-neutral-500">
                  No upcoming tracks in queue.
                </div>
              ) : (
                /* Real Live Queue Tracks */
                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-0.5">
                  {queueTracks.map((track) => (
                    <div
                      key={track.id || track.uri}
                      className="group/item flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
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

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-white truncate max-w-[170px]">
                            {track.title}
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                            {track.artist}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <GripVertical className="w-3.5 h-3.5 text-neutral-600 group-hover/item:text-neutral-400" />
                        <button
                          onClick={(e) => removeQueueItem(track.id, e)}
                          className="p-1 rounded-full text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SizeTransitionBlur>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
