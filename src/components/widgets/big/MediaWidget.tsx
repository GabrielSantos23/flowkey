import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats } from "../../../types";
import { Play, Pause, SkipBack, SkipForward, Music } from "lucide-react";
import { motion } from "framer-motion";

export const MediaWidget: React.FC = () => {
  const [media, setMedia] = useState<MediaStats>({
    is_available: true,
    is_playing: false,
    title: "No Media Playing",
    artist: "Spotify / Media Player",
    album: "",
    art_url: "",
    position_secs: 0,
    duration_secs: 200,
    app_name: "Spotify",
  });

  const fetchMedia = async () => {
    try {
      const data = await invoke<MediaStats>("get_media_info");
      if (data) setMedia(data);
    } catch {}
  };

  useEffect(() => {
    fetchMedia();
    const interval = setInterval(fetchMedia, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("media_play_pause");
      setMedia((prev) => ({ ...prev, is_playing: !prev.is_playing }));
      setTimeout(fetchMedia, 300);
    } catch {}
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("media_next");
      setTimeout(fetchMedia, 400);
    } catch {}
  };

  const handlePrev = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("media_prev");
      setTimeout(fetchMedia, 400);
    } catch {}
  };

  const isSpotify = media.app_name.toLowerCase().includes("spotify");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card backdrop-blur-md p-4 flex flex-col justify-between border border-border shadow-inner transition-all hover:border-border group min-w-[240px] flex-1">
      {/* Background glowing accent */}
      {isSpotify && (
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary/15 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
            {media.art_url ? (
              <img
                src={media.art_url}
                alt={media.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : isSpotify ? (
              <img src="/icons/home/Spotify.png" alt="Spotify" className="w-6 h-6 object-contain" />
            ) : (
              <Music className="w-5 h-5 text-primary" />
            )}
            {media.is_playing && (
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
              {media.title || "No Media"}
            </h4>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {media.artist || "DynamicWin"}
            </p>
          </div>
        </div>

        {/* Animated Visualizer Spectrum */}
        <div className="flex items-end gap-0.5 h-6 px-2">
          {[0.3, 0.8, 0.5, 0.9, 0.6, 0.4].map((h, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary"
              animate={
                media.is_playing
                  ? {
                      height: [`${Math.max(4, 20 * h * 0.3)}px`, `${Math.max(6, 20 * h)}px`, `${Math.max(4, 20 * h * 0.5)}px`],
                    }
                  : { height: "4px" }
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

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 mt-3 z-10">
        <button
          onClick={handlePrev}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all"
          title="Previous Track"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-90 transition-all shadow-md"
          title={media.is_playing ? "Pause" : "Play"}
        >
          {media.is_playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          onClick={handleNext}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all"
          title="Next Track"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
