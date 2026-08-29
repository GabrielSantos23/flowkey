import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

export type OverlayStyle = "island" | "classic";

const OVERLAY_STYLE_STORAGE_KEY = "flowkey_overlay_style";

export const getStoredOverlayStyle = (): OverlayStyle => {
  if (typeof window === "undefined") return "island";
  const stored = localStorage.getItem(OVERLAY_STYLE_STORAGE_KEY);
  if (stored === "classic" || stored === "island") {
    return stored;
  }
  return "island";
};

export const setStoredOverlayStyle = (style: OverlayStyle) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(OVERLAY_STYLE_STORAGE_KEY, style);
  
  if (style === "classic") {
    invoke("set_overlay_classic_mode").catch(() => {});
  } else {
    invoke("resize_now_playing_overlay", { expanded: false }).catch(() => {});
  }

  try {
    emit("flowkey_overlay_style_changed", { style }).catch(() => {});
  } catch {}

  try {
    const bc = new BroadcastChannel("flowkey_overlay_style_sync");
    bc.postMessage({ type: "OVERLAY_STYLE_CHANGED", style });
    bc.close();
  } catch {}
  window.dispatchEvent(
    new CustomEvent("flowkey_overlay_style_changed", { detail: { style } })
  );
};
