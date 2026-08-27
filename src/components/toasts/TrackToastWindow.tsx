import React, { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  FastForward,
  Rewind,
  Music2,
  Heart,
  HeartOff,
  ListPlus,
} from "lucide-react";
import { SpotifyIcon } from "../../assets/spotify-icon";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface TrackToastPayload {
  action: "next" | "prev" | "like" | "dislike" | "queue" | string;
  title?: string;
  artist?: string;
  album_art?: string;
}

const TOAST_DURATION_MS = 2800;

export const TrackToastWindow: React.FC = () => {
  const [toastData, setToastData] = useState<TrackToastPayload | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handlePayload = (payload: TrackToastPayload) => {
      if (!payload) return;
      setToastData(payload);
      setIsVisible(true);

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      hideTimerRef.current = setTimeout(async () => {
        setIsVisible(false);
        setTimeout(async () => {
          try {
            await invoke("hide_track_toast");
          } catch (e) {
            console.warn("Failed to hide toast window:", e);
          }
        }, 250);
      }, TOAST_DURATION_MS);
    };

    let unlistenApp: (() => void) | undefined;
    let unlistenWin: (() => void) | undefined;
    let bc: BroadcastChannel | null = null;

    listen<TrackToastPayload>("track_toast_event", (event) => {
      if (event.payload) handlePayload(event.payload);
    }).then((fn) => {
      unlistenApp = fn;
    });

    try {
      const appWin = getCurrentWebviewWindow();
      appWin
        .listen<TrackToastPayload>("track_toast_event", (event) => {
          if (event.payload) handlePayload(event.payload);
        })
        .then((fn) => {
          unlistenWin = fn;
        });
    } catch {}

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_track_toast");
      bc.onmessage = (e) => {
        if (e.data) handlePayload(e.data);
      };
    }

    return () => {
      unlistenApp?.();
      unlistenWin?.();
      bc?.close();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!toastData && !isVisible) {
    return (
      <div className="w-full h-full bg-transparent select-none pointer-events-none" />
    );
  }

  const action = toastData?.action || "next";
  const isNext = action === "next";
  const isPrev = action === "prev";
  const isLike = action === "like";
  const isDislike = action === "dislike";

  const defaultTitle = isNext
    ? "Next Track"
    : isPrev
      ? "Previous Track"
      : isLike
        ? "Saved to Liked Songs"
        : isDislike
          ? "Removed from Liked Songs"
          : "FlowKey Notification";

  const title = toastData?.title || defaultTitle;
  const artist = toastData?.artist || "Spotify Playback";
  const albumArt = toastData?.album_art;

  const headerTag = isNext
    ? "Advancing Track"
    : isPrev
      ? "Previous Track"
      : isLike
        ? "Saved to Liked Songs"
        : isDislike
          ? "Removed from Liked Songs"
          : "Track Queued";

  return (
    <div className="w-screen h-screen flex items-center justify-center p-2 bg-transparent select-none pointer-events-none overflow-hidden font-sans">
      <div
        className={`w-full h-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-card border shadow-2xl backdrop-blur-2xl text-foreground transition-all duration-200 ${
          isLike ? "" : isDislike ? "border-zinc-500/40" : "border-border/70"
        } ${
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-95"
        }`}
      >
        <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-muted/40 border border-white/10 flex items-center justify-center shadow-md">
          {albumArt ? (
            <img
              src={albumArt}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-card">
              <Music2 className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          <div className="absolute bottom-0 right-0 w-4.5 h-4.5 bg-background/90 rounded-tl-md flex items-center justify-center border-t border-l border-white/10">
            {isLike ? (
              <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
            ) : isDislike ? (
              <HeartOff className="w-2.5 h-2.5 text-zinc-400" />
            ) : isNext ? (
              <FastForward className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
            ) : isPrev ? (
              <Rewind className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
            ) : (
              <ListPlus className="w-2.5 h-2.5 text-emerald-400" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div
            className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
              isLike
                ? "text-rose-400"
                : isDislike
                  ? "text-zinc-400"
                  : "text-emerald-400"
            }`}
          >
            <SpotifyIcon
              className="w-2.5 h-2.5 shrink-0"
              color={isLike ? "#F43F5E" : "#1ED760"}
              lineColor="#00000"
            />
            <span>{headerTag}</span>
          </div>

          <div className="text-xs font-bold text-foreground truncate leading-tight">
            {title}
          </div>

          <div className="text-[11px] text-muted-foreground truncate leading-tight">
            {artist}
          </div>
        </div>
      </div>
    </div>
  );
};
