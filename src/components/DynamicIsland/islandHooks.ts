import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MediaStats, OverlayType, ViewMode } from "@/types";

export function useMediaStats() {
  const [media, setMedia] = useState<MediaStats>({
    is_available: false,
    is_playing: false,
    title: "",
    artist: "",
    album: "",
    art_url: "",
    position_secs: 0,
    duration_secs: 200,
    app_name: "Spotify",
  });

  const isPlayingRef = useRef(false);
  const lastJsonRef = useRef("");

  const fetchMedia = useCallback(async () => {
    try {
      const data = await invoke<MediaStats>("get_media_info");
      if (data) {
        isPlayingRef.current = data.is_playing;
        const jsonKey = `${data.title}::${data.artist}::${data.is_playing}::${data.is_available}::${Math.floor(data.position_secs)}`;
        if (jsonKey !== lastJsonRef.current) {
          lastJsonRef.current = jsonKey;
          setMedia(data);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchMedia();
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      await fetchMedia();
      const nextDelay = isPlayingRef.current ? 1200 : 3500;
      timer = setTimeout(loop, nextDelay);
    };

    timer = setTimeout(loop, 1200);
    return () => clearTimeout(timer);
  }, [fetchMedia]);

  return { media, fetchMedia };
}

export function useIslandMask(dependencies: {
  isSettingsOpen: boolean;
  activeOverlay: OverlayType;
  incomingTransfer: any;
  currentTransfer: any;
  isExpanded: boolean;
  viewMode: ViewMode;
  isQueueOpen: boolean;
  isDualActive: boolean;
  isPlaying: boolean;
  isPomodoroActive: boolean;
  showIdleClock?: boolean;
}) {
  const {
    isSettingsOpen, activeOverlay, incomingTransfer, currentTransfer,
    isExpanded, viewMode, isQueueOpen, isDualActive, isPlaying, isPomodoroActive,
    showIdleClock = false
  } = dependencies;

  const lastMaskRef = useRef<{ w: number; h: number } | null>(null);

  const syncInputMask = useCallback(() => {
    try {
      if (isSettingsOpen) {
        invoke("clear_input_mask").catch(() => {});
        return;
      }

      let targetW = 280;
      let targetH = 48;

      if (activeOverlay === "drop-file") {
        targetW = 250;
        targetH = 68;
      } else if (activeOverlay === "drop-localsend") {
        targetW = 380;
        targetH = 190;
      } else if (activeOverlay === "tray-confirmed") {
        targetW = 240;
        targetH = 48;
      } else if (incomingTransfer) {
        targetW = 380;
        targetH = 64;
      } else if (currentTransfer) {
        targetW = 400;
        targetH = 70;
      } else if (activeOverlay === "volume" || activeOverlay === "brightness") {
        targetW = 280;
        targetH = 48;
      } else if (isExpanded) {
        if (viewMode === "clipboard") {
          targetW = 600;
          targetH = 460;
        } else if (viewMode === "translate") {
          targetW = 610;
          targetH = 340;
        } else if (viewMode === "tray") {
          targetW = 510;
          targetH = 175;
        } else if (viewMode === "spotify") {
          targetW = isQueueOpen ? 610 : 340;
          targetH = 195;
        } else if (viewMode === "pomodoro") {
          targetW = 380;
          targetH = 230;
        } else {
          targetW = 460;
          targetH = 340;
        }
      } else {
        if (isDualActive) {
          targetW = 230;
          targetH = 48;
        } else if (showIdleClock && !isPlaying && !isPomodoroActive) {
          targetW = 150;
          targetH = 48;
        } else if (viewMode === "pomodoro" || isPomodoroActive) {
          targetW = 210;
          targetH = 48;
        } else if (isPlaying || viewMode === "spotify") {
          targetW = 230;
          targetH = 48;
        } else if (viewMode === "translate") {
          targetW = 160;
          targetH = 48;
        } else {
          targetW = 170;
          targetH = 48;
        }
      }

      if (lastMaskRef.current?.w === targetW && lastMaskRef.current?.h === targetH) {
        return;
      }
      lastMaskRef.current = { w: targetW, h: targetH };

      const windowTotalWidth = 660;
      const maskX = Math.max(0, Math.round((windowTotalWidth - targetW) / 2));

      invoke("update_input_mask", { x: maskX, y: 0, width: targetW, height: targetH }).catch(() => {});
    } catch {}
  }, [isSettingsOpen, activeOverlay, incomingTransfer, currentTransfer, isExpanded, viewMode, isQueueOpen, isDualActive, isPlaying, isPomodoroActive, showIdleClock]);

  useEffect(() => {
    syncInputMask();
  }, [syncInputMask]);
}

export function useSystemEvents(actions: {
  setVolumeLevel: React.Dispatch<React.SetStateAction<number>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setBrightnessLevel: React.Dispatch<React.SetStateAction<number>>;
  triggerOverlay: (type: OverlayType) => void;
  setIsSettingsOpen: (open: boolean) => void;
  volumePopup: boolean;
  brightnessPopup: boolean;
}) {
  const { setVolumeLevel, setIsMuted, setBrightnessLevel, triggerOverlay, setIsSettingsOpen, volumePopup, brightnessPopup } = actions;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ volume_percent: number; is_muted: boolean }>("volume-changed", (event) => {
      if (event.payload) {
        setVolumeLevel(event.payload.volume_percent);
        setIsMuted(event.payload.is_muted);
        if (volumePopup) triggerOverlay("volume");
      }
    }).then((u) => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, [volumePopup, setVolumeLevel, setIsMuted, triggerOverlay]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("open-settings", () => setIsSettingsOpen(true)).then((u) => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, [setIsSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeUp" || e.key === "VolumeUp") {
        setVolumeLevel((v) => Math.min(100, v + 5));
        setIsMuted(false);
        if (volumePopup) triggerOverlay("volume");
      } else if (e.key === "AudioVolumeDown" || e.key === "VolumeDown") {
        setVolumeLevel((v) => Math.max(0, v - 5));
        if (volumePopup) triggerOverlay("volume");
      } else if (e.key === "AudioVolumeMute" || e.key === "VolumeMute") {
        setIsMuted((m) => !m);
        if (volumePopup) triggerOverlay("volume");
      } else if (e.key === "F5" && e.altKey) {
        setBrightnessLevel((b) => Math.max(0, b - 10));
        if (brightnessPopup) triggerOverlay("brightness");
      } else if (e.key === "F6" && e.altKey) {
        setBrightnessLevel((b) => Math.min(100, b + 10));
        if (brightnessPopup) triggerOverlay("brightness");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [volumePopup, brightnessPopup, setVolumeLevel, setIsMuted, setBrightnessLevel, triggerOverlay]);
}
