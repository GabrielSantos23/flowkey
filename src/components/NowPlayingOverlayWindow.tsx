import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { NowPlayingDynamicIsland } from "./NowPlayingDynamicIsland";
import { NowPlayingClassicOverlay } from "./NowPlayingClassicOverlay";
import {
  getStoredOverlayStyle,
  OverlayStyle,
} from "../services/overlaySettings";

export const NowPlayingOverlayWindow: React.FC = () => {
  const [style, setStyle] = useState<OverlayStyle>(getStoredOverlayStyle());

  useEffect(() => {
    const syncStyle = (newStyle?: OverlayStyle) => {
      const current = newStyle || getStoredOverlayStyle();
      setStyle((prev) => (prev !== current ? current : prev));
    };

    const handleDomEvent = (e: any) => {
      syncStyle(e?.detail?.style);
    };

    window.addEventListener("flowkey_overlay_style_changed", handleDomEvent);
    window.addEventListener("storage", () => syncStyle());
    window.addEventListener("focus", () => syncStyle());

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_overlay_style_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "OVERLAY_STYLE_CHANGED" && event.data.style) {
          syncStyle(event.data.style);
        }
      };
    }

    let unlistenTauriEvent: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen<{ style: OverlayStyle }>(
          "flowkey_overlay_style_changed",
          (event) => {
            if (event.payload?.style) {
              syncStyle(event.payload.style);
            }
          },
        )
        .then((fn) => {
          unlistenTauriEvent = fn;
        });
    } catch {}

    return () => {
      window.removeEventListener(
        "flowkey_overlay_style_changed",
        handleDomEvent,
      );
      window.removeEventListener("storage", () => syncStyle());
      window.removeEventListener("focus", () => syncStyle());
      bc?.close();
      unlistenTauriEvent?.();
    };
  }, []);

  useEffect(() => {
    const adjustWindow = async (targetStyle?: OverlayStyle) => {
      const currentStyle = targetStyle || style;
      try {
        if (currentStyle === "island") {
          await invoke("resize_now_playing_overlay", { expanded: false });
        } else {
          await invoke("set_overlay_classic_mode");
        }
      } catch (err) {
        console.warn("Failed to adjust overlay window geometry:", err);
      }
    };

    adjustWindow();

    let unlistenTrigger: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen("overlay_trigger", () => {
          const freshStyle = getStoredOverlayStyle();
          setStyle(freshStyle);
          adjustWindow(freshStyle);
        })
        .then((fn) => {
          unlistenTrigger = fn;
        });
    } catch {}

    return () => {
      unlistenTrigger?.();
    };
  }, [style]);

  return (
    <div
      className={`w-screen h-screen bg-transparent flex justify-center overflow-hidden select-none ${
        style === "island" ? "items-start" : "items-center"
      }`}
    >
      {style === "island" ? (
        <NowPlayingDynamicIsland />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <NowPlayingClassicOverlay />
        </div>
      )}
    </div>
  );
};
