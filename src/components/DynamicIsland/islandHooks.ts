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
  isWheelPreviewing?: boolean;
  isSearchExpanded?: boolean;
}) {
  const {
    isSettingsOpen, activeOverlay, incomingTransfer, currentTransfer,
    isExpanded, viewMode, isQueueOpen, isDualActive, isPlaying, isPomodoroActive,
    showIdleClock = false, isWheelPreviewing = false, isSearchExpanded = false
  } = dependencies;

  const lastMaskRef = useRef<{ w: number; h: number } | null>(null);

  const syncInputMask = useCallback(() => {
    try {
      if (isSettingsOpen) {
        invoke("clear_input_mask").catch(() => {});
        return;
      }

      let targetW = 210;
      let targetH = 48;

      if (activeOverlay === "volume" || activeOverlay === "brightness") {
        targetW = 240;
        targetH = 50;
      } else if (activeOverlay === "drop-file") {
        targetW = 460;
        targetH = 150;
      } else if (activeOverlay === "drop-localsend") {
        targetW = 480;
        targetH = 250;
      } else if (activeOverlay === "tray-confirmed") {
        targetW = 260;
        targetH = 48;
      } else if (activeOverlay === "spotify-search") {
        if (isSearchExpanded) {
          targetW = 636;
          targetH = 425;
        } else {
          targetW = 396;
          targetH = 48;
        }
      } else if (incomingTransfer) {
        targetW = 380;
        targetH = 175;
      } else if (currentTransfer) {
        targetW = 340;
        targetH = 110;
      } else if (isExpanded) {
        if (viewMode === "clipboard") {
          targetW = 600;
          targetH = 430;
        } else if (viewMode === "translate") {
          targetW = 600;
          targetH = 310;
        } else if (viewMode === "tray") {
          targetW = 510;
          targetH = 160;
        } else if (viewMode === "spotify") {
          targetW = isQueueOpen ? 610 : 340;
          targetH = 235;
        } else if (viewMode === "pomodoro") {
          targetW = 380;
          targetH = 270;
        } else {
          targetW = 460;
          targetH = 380;
        }
      } else {
        if (isDualActive) {
          targetW = 270;
          targetH = 48;
        } else if (!isWheelPreviewing) {
          if (isPlaying) {
            targetW = 230;
            targetH = 48;
          } else if (isPomodoroActive) {
            targetW = 210;
            targetH = 48;
          } else {
            targetW = 150;
            targetH = 48;
          }
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
  }, [isSettingsOpen, activeOverlay, incomingTransfer, currentTransfer, isExpanded, viewMode, isQueueOpen, isDualActive, isPlaying, isPomodoroActive, showIdleClock, isWheelPreviewing, isSearchExpanded]);

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

  const volumePopupRef = useRef(volumePopup);
  const brightnessPopupRef = useRef(brightnessPopup);
  const triggerOverlayRef = useRef(triggerOverlay);
  const setVolumeLevelRef = useRef(setVolumeLevel);
  const setIsMutedRef = useRef(setIsMuted);
  const setBrightnessLevelRef = useRef(setBrightnessLevel);

  useEffect(() => {
    volumePopupRef.current = volumePopup;
    brightnessPopupRef.current = brightnessPopup;
    triggerOverlayRef.current = triggerOverlay;
    setVolumeLevelRef.current = setVolumeLevel;
    setIsMutedRef.current = setIsMuted;
    setBrightnessLevelRef.current = setBrightnessLevel;
  }, [volumePopup, brightnessPopup, triggerOverlay, setVolumeLevel, setIsMuted, setBrightnessLevel]);

  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen<{ volume_percent: number; is_muted: boolean }>("volume-changed", (event) => {
      if (event.payload) {
        setVolumeLevelRef.current(event.payload.volume_percent);
        setIsMutedRef.current(event.payload.is_muted);
        if (volumePopupRef.current) {
          triggerOverlayRef.current("volume");
        }
      }
    }).then((u) => {
      if (isCancelled) {
        u();
      } else {
        unlistenFn = u;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen("open-settings", () => setIsSettingsOpen(true)).then((u) => {
      if (isCancelled) {
        u();
      } else {
        unlistenFn = u;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, [setIsSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeUp" || e.key === "VolumeUp") {
        setVolumeLevelRef.current((v) => Math.min(100, v + 5));
        setIsMutedRef.current(false);
        if (volumePopupRef.current) triggerOverlayRef.current("volume");
      } else if (e.key === "AudioVolumeDown" || e.key === "VolumeDown") {
        setVolumeLevelRef.current((v) => Math.max(0, v - 5));
        if (volumePopupRef.current) triggerOverlayRef.current("volume");
      } else if (e.key === "AudioVolumeMute" || e.key === "VolumeMute") {
        setIsMutedRef.current((m) => !m);
        if (volumePopupRef.current) triggerOverlayRef.current("volume");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
