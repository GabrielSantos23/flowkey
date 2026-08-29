import { invoke } from "@tauri-apps/api/core";

export interface NativeActionResult {
  success: boolean;
  action: string;
  virtualKey: string;
  vkCodeHex: string;
  latencyMs: number;
  message: string;
}

export interface NativeMediaMetadata {
  title: string;
  artist: string;
  album: string;
  album_art: string;
  source_app?: string;
  is_playing?: boolean;
}

export async function getNativeMediaInfo(): Promise<NativeMediaMetadata> {
  try {
    return await invoke<NativeMediaMetadata>("get_native_media_info");
  } catch (e) {
    console.warn("Failed to get native media info:", e);
    return { title: "", artist: "", album: "", album_art: "", source_app: "", is_playing: false };
  }
}

export async function triggerNativePlayPause(): Promise<NativeActionResult> {
  const start = performance.now();
  try {
    const result = await invoke<string>("native_play_pause");
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Play / Pause",
      virtualKey: "VK_MEDIA_PLAY_PAUSE",
      vkCodeHex: "0xB3 (179)",
      latencyMs: Math.max(0.1, latency),
      message: result || "VK_MEDIA_PLAY_PAUSE sent to Windows OS subsystem",
    };
  } catch {
    
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Play / Pause",
      virtualKey: "VK_MEDIA_PLAY_PAUSE",
      vkCodeHex: "0xB3 (179)",
      latencyMs: Math.max(0.1, latency),
      message: "Browser Emulation: Simulated Windows VK_MEDIA_PLAY_PAUSE event",
    };
  }
}

export async function triggerNativeNextTrack(): Promise<NativeActionResult> {
  const start = performance.now();
  try {
    const result = await invoke<string>("native_next_track");
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Next Track",
      virtualKey: "VK_MEDIA_NEXT_TRACK",
      vkCodeHex: "0xB0 (176)",
      latencyMs: Math.max(0.1, latency),
      message: result || "VK_MEDIA_NEXT_TRACK sent to Windows OS subsystem",
    };
  } catch {
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Next Track",
      virtualKey: "VK_MEDIA_NEXT_TRACK",
      vkCodeHex: "0xB0 (176)",
      latencyMs: Math.max(0.1, latency),
      message: "Browser Emulation: Simulated Windows VK_MEDIA_NEXT_TRACK event",
    };
  }
}

export async function triggerNativePrevTrack(): Promise<NativeActionResult> {
  const start = performance.now();
  try {
    const result = await invoke<string>("native_prev_track");
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Previous Track",
      virtualKey: "VK_MEDIA_PREV_TRACK",
      vkCodeHex: "0xB1 (177)",
      latencyMs: Math.max(0.1, latency),
      message: result || "VK_MEDIA_PREV_TRACK sent to Windows OS subsystem",
    };
  } catch {
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      action: "Previous Track",
      virtualKey: "VK_MEDIA_PREV_TRACK",
      vkCodeHex: "0xB1 (177)",
      latencyMs: Math.max(0.1, latency),
      message: "Browser Emulation: Simulated Windows VK_MEDIA_PREV_TRACK event",
    };
  }
}
