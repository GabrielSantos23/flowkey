import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Settings,
  Music,
  Globe,
  Headphones,
  Volume2,
  Radio,
  Music2,
} from "lucide-react";
import { SpotifyIcon } from "../assets/spotify-icon";
import { SpotifyPlaybackState, SpotifyTrack } from "../types/spotify";
import { spotifyService, openExternalLink } from "../services/spotifyApi";
import {
  getNativeMediaInfo,
  NativeMediaMetadata,
} from "../services/nativeMedia";
import { getStoredOverlayStyle } from "../services/overlaySettings";

const getExternalMediaAppIcon = (appName: string) => {
  const lower = appName.toLowerCase();
  if (lower.includes("apple") || lower.includes("itunes")) {
    return <Music className="w-3 h-3 text-[#fa2d48]" />;
  }
  if (lower.includes("chrome") || lower.includes("google")) {
    return <Globe className="w-3 h-3 text-[#4285F4]" />;
  }
  if (lower.includes("edge")) {
    return <Globe className="w-3 h-3 text-[#0078D7]" />;
  }
  if (lower.includes("youtube")) {
    return <Play className="w-3 h-3 text-[#FF0000] fill-current" />;
  }
  if (lower.includes("firefox")) {
    return <Globe className="w-3 h-3 text-[#FF7139]" />;
  }
  if (lower.includes("brave")) {
    return <Globe className="w-3 h-3 text-[#FB542B]" />;
  }
  if (lower.includes("tidal")) {
    return <Music className="w-3 h-3 text-cyan-400" />;
  }
  if (lower.includes("deezer")) {
    return <Music className="w-3 h-3 text-purple-400" />;
  }
  if (lower.includes("vlc")) {
    return <Radio className="w-3 h-3 text-amber-500" />;
  }
  if (lower.includes("discord")) {
    return <Headphones className="w-3 h-3 text-[#5865F2]" />;
  }
  return <Volume2 className="w-3 h-3 text-emerald-400" />;
};

interface SavedSpotifyState {
  item: SpotifyTrack;
  progress_ms: number;
  shuffle_state?: boolean;
  repeat_state?: string;
  timestamp: number;
}

const getSavedSpotifyState = (): SavedSpotifyState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("flowkey_last_spotify_playback");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

interface NowPlayingDynamicIslandProps {
  onSettingsClick?: () => void;
  className?: string;
}

export const NowPlayingDynamicIsland: React.FC<
  NowPlayingDynamicIslandProps
> = ({ onSettingsClick, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<
    "auto" | "spotify" | "external"
  >("auto");
  const [playbackState, setPlaybackState] =
    useState<SpotifyPlaybackState | null>(null);
  const [savedSpotify, setSavedSpotify] = useState<SavedSpotifyState | null>(
    getSavedSpotifyState(),
  );
  const [nativeInfo, setNativeInfo] = useState<NativeMediaMetadata | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [displayProgressMs, setDisplayProgressMs] = useState<number>(0);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "context" | "track">(
    "off",
  );
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(
    null,
  );

  const lastFetchRef = useRef<number>(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnchorRef = useRef<{
    baseMs: number;
    timestamp: number;
    isPlaying: boolean;
    durationMs: number;
  }>({
    baseMs: 0,
    timestamp: Date.now(),
    isPlaying: false,
    durationMs: 0,
  });
  const trackEndedHandledRef = useRef<boolean>(false);
  const islandRef = useRef<HTMLDivElement>(null);
  const expandedTimestampRef = useRef<number>(0);

  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const fetchState = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    try {
      let spotifyPlaying = false;
      let spotifyHasData = false;
      if (spotifyService.isAuthenticated()) {
        try {
          const res = await spotifyService.getNowPlaying(force);
          if (res.data?.item) {
            spotifyHasData = true;
            spotifyPlaying = Boolean(res.data.is_playing);
            setPlaybackState(res.data);
            setOptimisticPlaying(null);
            trackEndedHandledRef.current = false;

            const baseProg = res.data.progress_ms || 0;
            const dur = res.data.item.duration_ms || 0;
            progressAnchorRef.current = {
              baseMs: baseProg,
              timestamp: Date.now(),
              isPlaying: spotifyPlaying,
              durationMs: dur,
            };
            setDisplayProgressMs(baseProg);

            if (typeof res.data.shuffle_state === "boolean") {
              setIsShuffle(res.data.shuffle_state);
            }
            if (res.data.repeat_state) {
              setRepeatMode(
                res.data.repeat_state as "off" | "context" | "track",
              );
            }
            const saved: SavedSpotifyState = {
              item: res.data.item,
              progress_ms: baseProg,
              shuffle_state: res.data.shuffle_state,
              repeat_state: res.data.repeat_state,
              timestamp: Date.now(),
            };
            setSavedSpotify((prev) => {
              if (prev?.item?.id !== res.data?.item?.id) {
                try {
                  localStorage.setItem(
                    "flowkey_last_spotify_playback",
                    JSON.stringify(saved),
                  );
                } catch {}
              }
              return saved;
            });
          } else {
            setPlaybackState(null);
          }
        } catch {
          setPlaybackState(null);
        }
      }

      let nativePlaying = false;
      let nativeHasData = false;
      try {
        const native = await getNativeMediaInfo();
        if (native && native.title) {
          nativeHasData = true;
          nativePlaying = Boolean(native.is_playing);
          setNativeInfo(native);
        } else {
          setNativeInfo(null);
        }
      } catch {
        setNativeInfo(null);
      }

      const isAnyActive =
        spotifyPlaying ||
        nativePlaying ||
        spotifyHasData ||
        nativeHasData;
      if (isAnyActive) {
        setIsVisible(true);
        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
          pauseTimeoutRef.current = null;
        }
      } else {
        if (!pauseTimeoutRef.current) {
          pauseTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setIsExpanded(false);
          }, 5000);
        }
      }
    } catch {}
  }, []);

  const spotifyTrack: SpotifyTrack | undefined =
    playbackState?.item || savedSpotify?.item || undefined;
  const spotifyHasTrack = Boolean(spotifyTrack);
  const spotifyIsPlaying = Boolean(
    playbackState?.is_playing && playbackState?.item,
  );
  const externalHasTrack = Boolean(nativeInfo?.title);
  const externalIsPlaying = Boolean(
    nativeInfo?.is_playing && nativeInfo?.title,
  );

  const rawSourceApp = nativeInfo?.source_app || "";
  const externalAppName =
    rawSourceApp && rawSourceApp.toLowerCase() !== "spotify"
      ? rawSourceApp
      : externalHasTrack
        ? "Media Player"
        : null;

  const effectiveSource: "spotify" | "external" = (() => {
    if (selectedSource === "spotify") return "spotify";
    if (selectedSource === "external") return "external";
    if (spotifyIsPlaying) return "spotify";
    if (externalIsPlaying) return "external";
    if (spotifyHasTrack) return "spotify";
    if (externalHasTrack) return "external";
    return "spotify";
  })();

  const isSpotifyActive = effectiveSource === "spotify";
  const isExternalActive = effectiveSource === "external";

  const track: SpotifyTrack | undefined = isSpotifyActive
    ? spotifyTrack
    : undefined;
  const baseIsPlaying = isSpotifyActive
    ? spotifyIsPlaying
    : externalIsPlaying || externalHasTrack;
  const isPlaying =
    optimisticPlaying !== null ? optimisticPlaying : baseIsPlaying;
  const durationMs = isSpotifyActive ? track?.duration_ms || 0 : 0;

  // Initial fetch on mount
  useEffect(() => {
    fetchState(true);
  }, [fetchState]);

  // Client-side progress bar extrapolation (only while expanded, visible & playing)
  useEffect(() => {
    if (!isVisible || !isPlaying || !isExpanded) return;

    const timer = setInterval(() => {
      const { baseMs, timestamp, isPlaying: anchorPlaying, durationMs: anchorDur } =
        progressAnchorRef.current;
      if (anchorPlaying) {
        const elapsed = Date.now() - timestamp;
        const current =
          anchorDur > 0 ? Math.min(anchorDur, baseMs + elapsed) : baseMs + elapsed;
        setDisplayProgressMs(current);

        // Catch track transition when calculated end time is reached
        if (
          anchorDur > 0 &&
          current >= anchorDur &&
          !trackEndedHandledRef.current
        ) {
          trackEndedHandledRef.current = true;
          const previousTrackId = track?.id;

          // 0ms Optimistic Queue Pop on natural track completion
          if (isSpotifyActive && spotifyService.isAuthenticated()) {
            const nextTrack = spotifyService.popNextFromQueue();
            if (nextTrack) {
              setPlaybackState((prev) =>
                prev
                  ? { ...prev, item: nextTrack, progress_ms: 0, is_playing: true }
                  : { is_playing: true, item: nextTrack, progress_ms: 0 }
              );
              progressAnchorRef.current = {
                baseMs: 0,
                timestamp: Date.now(),
                isPlaying: true,
                durationMs: nextTrack.duration_ms || 0,
              };
              setDisplayProgressMs(0);
            }
          }

          // Fast GSMTC check at 60ms
          setTimeout(async () => {
            try {
              const native = await getNativeMediaInfo();
              if (native && native.title) {
                setNativeInfo(native);
              }
            } catch {}
          }, 60);

          // Fetch confirmed new track in background
          if (isSpotifyActive && spotifyService.isAuthenticated()) {
            spotifyService.fetchNewTrackAfterSkip(previousTrackId).then((newItem) => {
              if (newItem) {
                fetchState(true);
              }
            });
          }
        }
      } else {
        setDisplayProgressMs(baseMs);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [fetchState, isVisible, isPlaying, isExpanded, isSpotifyActive, track?.id]);

  // Real-time Windows GSMTC Polling (800ms local Win32 call, 0 network requests)
  useEffect(() => {
    if (!isVisible) return;

    const pollNative = async () => {
      try {
        const native = await getNativeMediaInfo();
        if (native && native.title) {
          setNativeInfo((prev) => {
            if (
              prev?.title === native.title &&
              prev?.artist === native.artist &&
              prev?.is_playing === native.is_playing &&
              prev?.album_art === native.album_art
            ) {
              return prev;
            }
            return native;
          });

          if (native.duration_ms && native.duration_ms > 0) {
            const currentAnchor = progressAnchorRef.current;
            const elapsed = currentAnchor.isPlaying
              ? Date.now() - currentAnchor.timestamp
              : 0;
            const estimatedCurrent = currentAnchor.baseMs + elapsed;
            const drift = Math.abs(estimatedCurrent - (native.position_ms || 0));

            if (
              currentAnchor.durationMs !== native.duration_ms ||
              currentAnchor.isPlaying !== Boolean(native.is_playing) ||
              drift > 2500
            ) {
              progressAnchorRef.current = {
                baseMs: native.position_ms || 0,
                timestamp: Date.now(),
                isPlaying: Boolean(native.is_playing),
                durationMs: native.duration_ms,
              };
              if (isExpanded) {
                setDisplayProgressMs(native.position_ms || 0);
              }
            }
          }
        }
      } catch {}
    };

    pollNative();
    const interval = setInterval(pollNative, 800);
    return () => clearInterval(interval);
  }, [isVisible, isExpanded]);

  // Reconciliation polling (60s background sanity check)
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      fetchState(false);
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchState, isVisible]);

  // Global overlay trigger & cross-window sync listener
  useEffect(() => {
    let unlistenTrigger: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen("overlay_trigger", () => {
          setIsVisible(true);
          invoke("ensure_overlay_topmost").catch(() => {});
          fetchState(true);
        })
        .then((fn) => {
          unlistenTrigger = fn;
        });
    } catch {}

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_playback_sync");
      bc.onmessage = (e) => {
        if (e.data?.type === "TRACK_SKIPPED") {
          setTimeout(async () => {
            try {
              const native = await getNativeMediaInfo();
              if (native && native.title) setNativeInfo(native);
            } catch {}
          }, 60);
          if (spotifyService.isAuthenticated()) {
            spotifyService.fetchNewTrackAfterSkip().then((newItem) => {
              if (newItem) fetchState(true);
            });
          }
        }
      };
    }

    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      unlistenTrigger?.();
      bc?.close();
    };
  }, [fetchState]);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (Date.now() - expandedTimestampRef.current < 350) return;
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleWindowBlur = () => {
      if (Date.now() - expandedTimestampRef.current < 500) return;
      setIsExpanded(false);
    };

    let unlistenTauriBlur: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen("tauri://blur", () => {
          if (Date.now() - expandedTimestampRef.current < 500) return;
          setIsExpanded(false);
        })
        .then((fn) => {
          unlistenTauriBlur = fn;
        });
    } catch {}

    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 100);

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("blur", handleWindowBlur);
      unlistenTauriBlur?.();
    };
  }, [isExpanded]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const adjustWindowSize = async () => {
      try {
        if (getStoredOverlayStyle() !== "island") return;
        if (isExpanded) {
          await invoke("resize_now_playing_overlay", { expanded: true });
        } else {
          timer = setTimeout(async () => {
            if (getStoredOverlayStyle() !== "island") return;
            await invoke("resize_now_playing_overlay", { expanded: false });
          }, 250);
        }
      } catch (err) {
        console.warn("Failed to resize island window:", err);
      }
    };

    adjustWindowSize();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isExpanded]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isExpanded) {
          setIsExpanded(false);
        } else {
          invoke("hide_now_playing_overlay").catch(() => {});
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const handleTogglePlay = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextPlaying = !isPlaying;
    setOptimisticPlaying(nextPlaying);
    progressAnchorRef.current = {
      baseMs: displayProgressMs,
      timestamp: Date.now(),
      isPlaying: nextPlaying,
      durationMs,
    };
    setDisplayProgressMs(displayProgressMs);

    try {
      if (isSpotifyActive && spotifyService.isAuthenticated()) {
        const fallbackUri = spotifyTrack?.uri;
        const fallbackPos = displayProgressMs || savedSpotify?.progress_ms || 0;
        spotifyService
          .togglePlay(!nextPlaying, fallbackUri, fallbackPos)
          .catch((err) => {
            console.warn("Optimistic togglePlay error:", err);
          });
        return;
      }
      await invoke("native_play_pause");
    } catch (err) {
      console.error("Play/Pause error:", err);
    }
  };

  const handleNext = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const previousTrackId = track?.id;

    // 0ms Optimistic Queue Pop!
    if (isSpotifyActive && spotifyService.isAuthenticated()) {
      const nextTrack = spotifyService.popNextFromQueue();
      if (nextTrack) {
        setPlaybackState((prev) =>
          prev
            ? { ...prev, item: nextTrack, progress_ms: 0, is_playing: true }
            : { is_playing: true, item: nextTrack, progress_ms: 0 }
        );
      }
    }

    progressAnchorRef.current = {
      baseMs: 0,
      timestamp: Date.now(),
      isPlaying: true,
      durationMs: 0,
    };
    setDisplayProgressMs(0);
    trackEndedHandledRef.current = false;

    // 1. Immediately poll Windows GSMTC for 0ms metadata update
    setTimeout(async () => {
      try {
        const native = await getNativeMediaInfo();
        if (native && native.title) {
          setNativeInfo(native);
        }
      } catch {}
    }, 50);

    try {
      if (isSpotifyActive && spotifyService.isAuthenticated()) {
        spotifyService.nextTrack().catch((err) => {
          console.warn("Next track error:", err);
        });
        spotifyService.fetchNewTrackAfterSkip(previousTrackId).then((newItem) => {
          if (newItem) {
            fetchState(true);
          }
        });
        return;
      }
      await invoke("native_next_track");
      setTimeout(() => fetchState(true), 350);
    } catch (err) {
      console.error("Next error:", err);
    }
  };

  const handlePrev = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const previousTrackId = track?.id;

    progressAnchorRef.current = {
      baseMs: 0,
      timestamp: Date.now(),
      isPlaying: true,
      durationMs: 0,
    };
    setDisplayProgressMs(0);
    trackEndedHandledRef.current = false;

    // 1. Immediately poll Windows GSMTC for 0ms metadata update
    setTimeout(async () => {
      try {
        const native = await getNativeMediaInfo();
        if (native && native.title) {
          setNativeInfo(native);
        }
      } catch {}
    }, 60);

    try {
      if (isSpotifyActive && spotifyService.isAuthenticated()) {
        spotifyService.previousTrack().catch((err) => {
          console.warn("Prev track error:", err);
        });
        spotifyService.fetchNewTrackAfterSkip(previousTrackId).then((newItem) => {
          if (newItem) {
            fetchState(true);
          }
        });
        return;
      }
      await invoke("native_prev_track");
      setTimeout(() => fetchState(true), 350);
    } catch (err) {
      console.error("Prev error:", err);
    }
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!durationMs) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const targetMs = Math.floor(ratio * durationMs);

    progressAnchorRef.current = {
      baseMs: targetMs,
      timestamp: Date.now(),
      isPlaying,
      durationMs,
    };
    setDisplayProgressMs(targetMs);

    if (isSpotifyActive && spotifyService.isAuthenticated()) {
      try {
        await spotifyService.seekPosition(targetMs);
      } catch (err) {
        console.error("Seek error:", err);
      }
    }
  };

  const handleToggleShuffle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSpotifyActive) return;
    const next = !isShuffle;
    setIsShuffle(next);
    try {
      await spotifyService.setShuffle(next);
    } catch (err) {
      console.warn("Shuffle error:", err);
    }
  };

  const handleToggleRepeat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSpotifyActive) return;
    const nextMode: "off" | "context" | "track" =
      repeatMode === "off"
        ? "context"
        : repeatMode === "context"
          ? "track"
          : "off";
    setRepeatMode(nextMode);
    try {
      await spotifyService.setRepeat(nextMode);
    } catch (err) {
      console.warn("Repeat error:", err);
    }
  };

  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      invoke("show_main_window").catch(() => {});
    }
  };

  const handleOpenSpotify = (e: React.MouseEvent) => {
    e.stopPropagation();
    openExternalLink("spotify:");
  };

  if (!isVisible && !track && !nativeInfo?.title) {
    return null;
  }

  const isNativeSpotify =
    nativeInfo?.source_app?.toLowerCase().includes("spotify") ?? false;

  const albumArt = isSpotifyActive
    ? isNativeSpotify
      ? nativeInfo?.album_art || track?.album?.images?.[0]?.url || ""
      : track?.album?.images?.[0]?.url || ""
    : nativeInfo?.album_art || track?.album?.images?.[0]?.url || "";

  const trackTitle = isSpotifyActive
    ? isNativeSpotify
      ? nativeInfo?.title || track?.name || "FlowKey"
      : track?.name || (spotifyHasTrack ? "Spotify" : "No active Spotify track")
    : nativeInfo?.title || track?.name || "Now Playing";

  const artistName = isSpotifyActive
    ? isNativeSpotify
      ? nativeInfo?.artist || track?.artists?.map((a) => a.name).join(", ") || "Spotify"
      : track?.artists?.map((a) => a.name).join(", ") || "Spotify"
    : nativeInfo?.artist ||
      track?.artists?.map((a) => a.name).join(", ") ||
      externalAppName ||
      "System Audio";

  const progressPercent =
    durationMs > 0
      ? Math.min(100, (displayProgressMs / durationMs) * 100)
      : isPlaying
        ? 100
        : 0;

  return (
    <div
      ref={islandRef}
      className={`relative select-none flex flex-col items-center ${className}`}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (!isExpanded) {
            expandedTimestampRef.current = Date.now();
            setIsExpanded(true);
          }
        }}
        className={`relative bg-black text-white cursor-pointer overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.175,0.885,0.32,1.15)] ${
          isExpanded
            ? "w-85 h-42.5 rounded-b-[22px]"
            : "w-43 h-8.5 rounded-b-[18px]"
        }`}
      >
        {!isExpanded && (
          <div className="w-full h-full flex items-center justify-between px-2.5 py-1 animate-fade-in">
            <div className="w-5.5 h-5.5 rounded-lg overflow-hidden bg-[#181818] shrink-0 border border-white/10 relative shadow-inner">
              {albumArt ? (
                <img
                  src={albumArt}
                  alt={trackTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 bg-zinc-900">
                  <Music2 className="w-3 h-3" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-[2.5px] h-3.5">
              <span
                className={`w-[2.5px] bg-white rounded-full transition-all ${
                  isPlaying
                    ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5"
                    : "h-1"
                }`}
              />
              <span
                className={`w-[2.5px] bg-white rounded-full transition-all ${
                  isPlaying
                    ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-3.5"
                    : "h-1.5"
                }`}
              />
              <span
                className={`w-[2.5px] bg-white rounded-full transition-all ${
                  isPlaying
                    ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-2"
                    : "h-1"
                }`}
              />
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="w-full h-full flex flex-col justify-between p-3.5 pt-2.5 animate-fade-in">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSource("spotify");
                    if (spotifyService.isAuthenticated()) {
                      fetchState(true);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleOpenSpotify(e);
                  }}
                  className={`h-5.5 px-2 rounded-full flex items-center gap-1 border border-white/5 cursor-pointer transition-colors shrink-0 ${
                    isSpotifyActive
                      ? "bg-[#1c1c1e] text-white border-white/10"
                      : "bg-transparent text-zinc-400 hover:text-white"
                  }`}
                  title="Spotify (Click to select, double click to open)"
                >
                  <SpotifyIcon size={12} color="#1ED760" lineColor="#000000" />
                  <span className="text-[11px] font-medium tracking-tight">
                    Spotify
                  </span>
                </button>

                {externalAppName && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSource("external");
                    }}
                    className={`h-5.5 px-2 rounded-full flex items-center gap-1.5 border border-white/5 cursor-pointer transition-colors shrink-0 ${
                      isExternalActive
                        ? "bg-[#1c1c1e] text-white border-white/10"
                        : "bg-transparent text-zinc-400 hover:text-white"
                    }`}
                    title={`Source: ${externalAppName} (Click to switch controls)`}
                  >
                    {getExternalMediaAppIcon(externalAppName)}
                    <span className="text-[11px] font-medium tracking-tight truncate max-w-22.5">
                      {externalAppName}
                    </span>
                  </button>
                )}
              </div>

              <button
                onClick={handleOpenSettings}
                className="w-5.5 h-5.5 rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title="Settings & Commands"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between w-full my-auto py-0.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-[7px] overflow-hidden bg-[#111111] shrink-0 border border-white/10 shadow-lg relative">
                  {albumArt ? (
                    <img
                      src={albumArt}
                      alt={trackTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60 bg-zinc-900">
                      <Music2 className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0 justify-center">
                  <h2 className="text-[13.5px] font-semibold text-white leading-snug truncate">
                    {trackTitle}
                  </h2>
                  <span className="text-[11px] font-normal text-[#8e8e93] leading-tight mt-0.5 truncate">
                    {artistName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-[2.5px] h-4.5 px-1">
                <span
                  className={`w-[2.5px] bg-white rounded-full transition-all ${
                    isPlaying && isVisible
                      ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5"
                      : "h-1"
                  }`}
                />
                <span
                  className={`w-[2.5px] bg-white rounded-full transition-all ${
                    isPlaying && isVisible
                      ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-4"
                      : "h-1.5"
                  }`}
                />
                <span
                  className={`w-[2.5px] bg-white rounded-full transition-all ${
                    isPlaying && isVisible
                      ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-3"
                      : "h-1"
                  }`}
                />
              </div>
            </div>

            <div className="w-full flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-medium text-[#8e8e93] tracking-tight shrink-0">
                {formatTime(displayProgressMs)}
              </span>

              <div
                onClick={handleSeek}
                className="relative flex-1 h-[3.5px] bg-[#2c2c2e] rounded-full overflow-hidden cursor-pointer group"
              >
                <div
                  className="h-full bg-white rounded-full transition-all group-hover:bg-white/90"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <span className="text-[10px] font-mono font-medium text-[#8e8e93] tracking-tight shrink-0">
                {formatTime(durationMs)}
              </span>
            </div>

            <div className="w-full flex items-center justify-center gap-3.5 pt-0.5">
              <button
                onClick={handleToggleShuffle}
                disabled={!isSpotifyActive}
                title={
                  !isSpotifyActive
                    ? "Shuffle (Spotify only)"
                    : isShuffle
                      ? "Shuffle On"
                      : "Shuffle Off"
                }
                className={`p-1.5 transition-colors ${
                  !isSpotifyActive
                    ? "opacity-25 cursor-not-allowed text-[#8e8e93] pointer-events-none"
                    : isShuffle
                      ? "text-[#1ed760] cursor-pointer"
                      : "text-[#8e8e93] hover:text-white cursor-pointer"
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handlePrev}
                title="Previous Track"
                className="w-7.5 h-7.5 rounded-full bg-[#1c1c1e] hover:bg-[#28282a] text-white transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              >
                <SkipBack className="w-3.5 h-3.5 fill-current" />
              </button>

              <button
                onClick={handleTogglePlay}
                title={isPlaying ? "Pause" : "Play"}
                className="w-12 h-7.5 rounded-[10px] bg-[#27272a] hover:bg-[#323236] text-white transition-all flex items-center justify-center cursor-pointer shadow-md active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={handleNext}
                title="Next Track"
                className="w-7.5 h-7.5 rounded-full bg-[#1c1c1e] hover:bg-[#28282a] text-white transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              >
                <SkipForward className="w-3.5 h-3.5 fill-current" />
              </button>

              <button
                onClick={handleToggleRepeat}
                disabled={!isSpotifyActive}
                title={
                  !isSpotifyActive
                    ? "Repeat (Spotify only)"
                    : repeatMode === "track"
                      ? "Repeat One Track"
                      : repeatMode === "context"
                        ? "Repeat All"
                        : "Repeat Off"
                }
                className={`p-1.5 transition-colors ${
                  !isSpotifyActive
                    ? "opacity-25 cursor-not-allowed text-[#8e8e93] pointer-events-none"
                    : repeatMode !== "off"
                      ? "text-[#1ed760] cursor-pointer"
                      : "text-[#8e8e93] hover:text-white cursor-pointer"
                }`}
              >
                {repeatMode === "track" ? (
                  <Repeat1 className="w-3.5 h-3.5" />
                ) : (
                  <Repeat className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
