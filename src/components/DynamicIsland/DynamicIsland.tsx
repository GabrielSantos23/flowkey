import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";



import { useMediaStats, useIslandMask, useSystemEvents } from "./islandHooks";
import { CollapsedContent } from "./CollapsedContent";
import { ExpandedContent } from "./ExpandedContent";
import { TraySavingToast, TrayConfirmedToast } from "./TrayOverlays";
import { useSettings } from "@/context/SettingsContext";
import { usePomodoro } from "@/context/PomodoroContext";
import { OverlayType, ViewMode } from "@/types";
import { useLocalSend } from "@/context/LocalSendContext";
import { extractDropContent, ExtractedDropContent, saveExtractedContentToTray, sendExtractedContentToDevice } from "@/utils/dropContent";
import { NotchCurves } from "../NotchCurves";
import { IncomingTransferOverlay } from "../overlays/IncomingTransferOverlay";
import { TransferProgressOverlay } from "../overlays/TransferProgressOverlay";
import { VolumeOverlay } from "../overlays/VolumeOverlay";
import { BrightnessOverlay } from "../overlays/BrightnessOverlay";
import { TimerOverOverlay } from "../overlays/TimerOverOverlay";
import { DropFileOverlay } from "../overlays/DropFileOverlay";
import { DropLocalSendOverlay } from "../overlays/DropLocalSendOverlay";
import { PomodoroBubbleWidget } from "../widgets/small/PomodoroBubbleWidget";
import { SpotifySearchWidget } from "../widgets/big/spotifySearch/SpotifySearchWidget";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";



export const DynamicIsland: React.FC = () => {
  const { settings, isSettingsOpen, setIsSettingsOpen } = useSettings();
  const isNotch = settings.island_mode === "notch";
  const pomodoro = usePomodoro();
  const { devices, sendFiles, sendText, incomingTransfer, activeTransfers, cancelTransfer, acceptTransfer, rejectTransfer } = useLocalSend();

  const [isOpen, setIsOpen] = useState(false);
  const [isLockedOpen, setIsLockedOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("spotify");
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>("none");
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [draggedFiles, setDraggedFiles] = useState<string[]>([]);
  const [hoveredFingerprint, setHoveredFingerprint] = useState<string | null>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<"tray" | "localsend" | null>(null);

  const [volumeLevel, setVolumeLevel] = useState(65);
  const [isMuted, setIsMuted] = useState(false);
  const [brightnessLevel, setBrightnessLevel] = useState(80);
  const [confirmationToast, setConfirmationToast] = useState<{ text: string; type: "in" | "out" } | null>(null);

  const [isWheelPreviewing, setIsWheelPreviewing] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const wheelPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedFilesRef = useRef<string[]>([]);
  const dragLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollThrottleRef = useRef<boolean>(false);
  const activeOverlayRef = useRef<OverlayType>("none");
  const devicesRef = useRef(devices);
  const isDraggingRef = useRef<boolean>(false);
  const hoveredFingerprintRef = useRef<string | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);
  const browserDragContentRef = useRef<ExtractedDropContent | null>(null);

  // Sync refs for event listeners
  useEffect(() => { activeOverlayRef.current = activeOverlay; }, [activeOverlay]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { hoveredFingerprintRef.current = hoveredFingerprint; }, [hoveredFingerprint]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  useEffect(() => {
    if (activeOverlay !== "spotify-search") {
      setIsSearchExpanded(false);
    }
  }, [activeOverlay]);

  // Derived states
  const activeTransferList = Object.values(activeTransfers);
  const currentTransfer = activeTransferList.length > 0 ? activeTransferList[0] : null;
  const isExpanded =
    (isOpen || isLockedOpen) && activeOverlay === "none" && !incomingTransfer && !currentTransfer;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const isPomodoroActive = pomodoro.isRunning || (pomodoro.isPaused && pomodoro.timeRemaining > 0);
  const isPomodoroActiveRef = useRef(isPomodoroActive);
  isPomodoroActiveRef.current = isPomodoroActive;

  // Extracted Custom Hooks
  const { media, fetchMedia } = useMediaStats();
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const enabledWidgets =
    settings.enabled_widgets && settings.enabled_widgets.length > 0
      ? settings.enabled_widgets
      : ["spotify", "pomodoro", "tray", "clipboard", "translate"];

  const isSpotifyEnabled = enabledWidgets.includes("spotify");
  const isPomodoroEnabled = enabledWidgets.includes("pomodoro");
  const isTrayEnabled = enabledWidgets.includes("tray");
  const isClipboardEnabled = enabledWidgets.includes("clipboard");
  const isTranslateEnabled = enabledWidgets.includes("translate");

  const isDualActive = isSpotifyEnabled && isPomodoroEnabled && media.is_playing && isPomodoroActive;

  // Ensure viewMode is valid if current widget was disabled
  useEffect(() => {
    if (!enabledWidgets.includes(viewMode)) {
      const fallback = (enabledWidgets[0] as ViewMode) || "spotify";
      setViewMode(fallback);
    }
  }, [enabledWidgets, viewMode]);

  // Auto-switch to active widget when started by user (only if enabled)
  useEffect(() => {
    if (media.is_playing && isSpotifyEnabled) {
      setViewMode("spotify");
      setIsWheelPreviewing(false);
    }
  }, [media.is_playing, isSpotifyEnabled]);

  useEffect(() => {
    if (isPomodoroActive && isPomodoroEnabled) {
      setViewMode("pomodoro");
      setIsWheelPreviewing(false);
    }
  }, [isPomodoroActive, isPomodoroEnabled]);

  const showIdleClock =
    !isWheelPreviewing &&
    !(isSpotifyEnabled && media.is_playing) &&
    !(isPomodoroEnabled && isPomodoroActive);

  const triggerOverlay = useCallback((type: OverlayType, durationMs = 2500) => {
    if (type === "volume" && !settings.volume_popup) return;
    if (type === "brightness") return;
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    setActiveOverlay(type);
    overlayTimeoutRef.current = setTimeout(() => setActiveOverlay("none"), durationMs);
  }, [settings.volume_popup]);

  useEffect(() => {
    if (!settings.volume_popup && activeOverlay === "volume") {
      setActiveOverlay("none");
    }
  }, [settings.volume_popup, activeOverlay]);

  const [isGameModeActive, setIsGameModeActive] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<boolean>("game-mode-animation-state", (event) => {
      setIsGameModeActive(Boolean(event.payload));
    }).then((u) => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    if (settings.anti_aliasing) {
      document.documentElement.classList.add("antialiased-active");
      document.documentElement.classList.remove("antialiased-disabled");
    } else {
      document.documentElement.classList.add("antialiased-disabled");
      document.documentElement.classList.remove("antialiased-active");
    }
  }, [settings.anti_aliasing]);

  useSystemEvents({
    setVolumeLevel, setIsMuted, setBrightnessLevel, triggerOverlay, setIsSettingsOpen,
    volumePopup: settings.volume_popup, brightnessPopup: false
  });

  useIslandMask({
    isSettingsOpen, activeOverlay, incomingTransfer, currentTransfer, isExpanded,
    viewMode, isQueueOpen, isDualActive, isPlaying: media.is_playing, isPomodoroActive,
    showIdleClock, isWheelPreviewing, isSearchExpanded
  });

  useEffect(() => {
    const handleTrayAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string; type: "in" | "out"; minimize?: boolean }>;
      if (customEvent.detail) {
        if (customEvent.detail.minimize || customEvent.detail.type === "in") {
          setIsOpen(false);
          setIsLockedOpen(false);
        }
        setConfirmationToast(customEvent.detail);
        triggerOverlay("tray-confirmed", 1800);
      }
    };
    window.addEventListener("dynamicwin-tray-action", handleTrayAction);
    return () => window.removeEventListener("dynamicwin-tray-action", handleTrayAction);
  }, [triggerOverlay]);

  useEffect(() => {
    let unlistenDragDrop: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const webview = getCurrentWebview();
        unlistenDragDrop = await webview.onDragDropEvent((event) => {
          if (dragLeaveTimeoutRef.current) {
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
          }

          if (event.payload.type === "enter") {
            isDraggingRef.current = true;
            if (event.payload.paths?.length > 0) {
              setDraggedFiles(event.payload.paths);
              draggedFilesRef.current = event.payload.paths;
            }
            if (activeOverlayRef.current !== "drop-localsend") triggerOverlay("drop-file", 10000);
          } else if (event.payload.type === "over") {
            isDraggingRef.current = true;
            const dpr = window.devicePixelRatio || 1;
            const targetEl = document.elementFromPoint(event.payload.position.x / dpr, event.payload.position.y / dpr);
            if (targetEl) {
              const deviceEl = targetEl.closest("[data-device-fingerprint]");
              setHoveredFingerprint(deviceEl ? deviceEl.getAttribute("data-device-fingerprint") : null);
              const dropZone = targetEl.closest("[data-drop-zone]");
              setHoveredDropZone((dropZone?.getAttribute("data-drop-zone") as "tray" | "localsend") || null);
            }
          } else if (event.payload.type === "drop") {
            isDraggingRef.current = false;
            setHoveredDropZone(null);

            const paths = event.payload.paths?.length > 0 ? event.payload.paths : draggedFilesRef.current;
            const dpr = window.devicePixelRatio || 1;
            const targetEl = document.elementFromPoint(event.payload.position.x / dpr, event.payload.position.y / dpr);

            if (paths && paths.length > 0) {
              if (activeOverlayRef.current === "drop-localsend") {
                const deviceEl = targetEl?.closest("[data-device-fingerprint]");
                const targetFp = deviceEl?.getAttribute("data-device-fingerprint") || hoveredFingerprintRef.current;
                const targetDevice = targetFp ? devicesRef.current.find((d) => d.fingerprint === targetFp) : (devicesRef.current.length === 1 ? devicesRef.current[0] : null);

                if (targetDevice) {
                  sendFiles(targetDevice, paths).catch(console.error);
                  if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
                  setActiveOverlay("none");
                  setDraggedFiles([]);
                  draggedFilesRef.current = [];
                  setHoveredFingerprint(null);
                  return;
                }
              }

              // If not sent to LocalSend, save to File Tray
              invoke("add_tray_files", { paths }).catch(() => {});
              setIsOpen(false);
              setIsLockedOpen(false);
              setDraggedFiles([]);
              draggedFilesRef.current = [];
              setConfirmationToast({ text: "Saved to File Tray", type: "in" });
              triggerOverlay("tray-confirmed", 1800);
              return;
            }
          } else if (event.payload.type === "leave") {
            isDraggingRef.current = false;
            setHoveredDropZone(null);
            if (dragLeaveTimeoutRef.current) clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = setTimeout(() => {
              if (!isDraggingRef.current) {
                if (activeOverlayRef.current === "drop-file" || activeOverlayRef.current === "drop-localsend") {
                  setActiveOverlay("none");
                }
                setDraggedFiles([]);
                draggedFilesRef.current = [];
                setHoveredFingerprint(null);
                setHoveredDropZone(null);
              }
            }, 350);
          }
        });
      } catch (e) { console.error("Failed onDragDropEvent:", e); }
    };
    setupListener();
    return () => { if (unlistenDragDrop) unlistenDragDrop(); };
  }, [sendFiles, triggerOverlay]);



  // Click outside and Queue handlers
  useEffect(() => { if (!isOpen) setIsQueueOpen(false); }, [isOpen]);

  const lastSearchToggleRef = useRef<number>(0);

  const openIsland = useCallback((targetMode: ViewMode) => {
    if (wheelPreviewTimeoutRef.current) clearTimeout(wheelPreviewTimeoutRef.current);
    setIsWheelPreviewing(false);
    const validMode = enabledWidgets.includes(targetMode)
      ? targetMode
      : ((enabledWidgets[0] as ViewMode) || "spotify");
    setViewMode(validMode);
    setIsQueueOpen(false);
    setIsOpen(true);
  }, [enabledWidgets]);

  const toggleIsland = useCallback(() => {
    invoke("toggle_island").catch(console.error);
  }, []);

  const toggleSpotifySearch = useCallback(() => {
    const now = Date.now();
    if (now - lastSearchToggleRef.current < 300) {
      return;
    }
    lastSearchToggleRef.current = now;
    getCurrentWindow().setFocus().catch(() => {});
    setActiveOverlay((prev) => (prev === "spotify-search" ? "none" : "spotify-search"));
  }, []);

  // Global shortcut event listeners for Dynamic Island & Spotify Search
  useEffect(() => {
    let unlistenSearch: UnlistenFn | undefined;
    let unlistenToggle: UnlistenFn | undefined;
    let unlistenWidget: UnlistenFn | undefined;

    listen("toggle-spotify-search", () => {
      toggleSpotifySearch();
    }).then((fn) => { unlistenSearch = fn; });

    listen("toggle-island", () => {
      toggleIsland();
    }).then((fn) => { unlistenToggle = fn; });

    listen<string>("open-widget", (event) => {
      if (event.payload) {
        openIsland(event.payload as ViewMode);
      }
    }).then((fn) => { unlistenWidget = fn; });

    return () => {
      if (unlistenSearch) unlistenSearch();
      if (unlistenToggle) unlistenToggle();
      if (unlistenWidget) unlistenWidget();
    };
  }, [toggleSpotifySearch, toggleIsland, openIsland]);

  // In-window keydown listener as responsive fallback for all configured shortcuts
  useEffect(() => {
    const matchShortcut = (e: KeyboardEvent, hotkey?: string): boolean => {
      if (!hotkey) return false;
      const parts = hotkey.toLowerCase().split("+").map((s) => s.trim());
      const needsAlt = parts.includes("alt");
      const needsCtrl = parts.includes("ctrl") || parts.includes("control");
      const needsShift = parts.includes("shift");
      const needsMeta = parts.includes("super") || parts.includes("meta") || parts.includes("win");

      const keyPart = parts.find((p) => !["alt", "ctrl", "control", "shift", "super", "meta", "win"].includes(p));
      if (!keyPart) return false;

      if (needsAlt !== e.altKey) return false;
      if (needsCtrl !== e.ctrlKey) return false;
      if (needsShift !== e.shiftKey) return false;
      if (needsMeta !== e.metaKey) return false;

      let pressedKey = e.key.toLowerCase();
      if (pressedKey === " ") pressedKey = "space";
      if (keyPart === "space" && (e.key === " " || e.code === "Space")) return true;

      return (
        pressedKey === keyPart ||
        e.code.toLowerCase() === `key${keyPart}` ||
        e.code.toLowerCase() === `digit${keyPart}`
      );
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (matchShortcut(e, settings.spotify_search_hotkey || "Alt+F")) {
        e.preventDefault();
        toggleSpotifySearch();
        return;
      }
      if (matchShortcut(e, settings.toggle_island_hotkey || "Ctrl+Space")) {
        e.preventDefault();
        toggleIsland();
        return;
      }
      if (matchShortcut(e, settings.open_spotify_hotkey)) {
        e.preventDefault();
        openIsland("spotify");
        return;
      }
      if (matchShortcut(e, settings.open_pomodoro_hotkey)) {
        e.preventDefault();
        openIsland("pomodoro");
        return;
      }
      if (matchShortcut(e, settings.open_tray_hotkey)) {
        e.preventDefault();
        openIsland("tray");
        return;
      }
      if (matchShortcut(e, settings.open_clipboard_hotkey)) {
        e.preventDefault();
        openIsland("clipboard");
        return;
      }
      if (matchShortcut(e, settings.open_translate_hotkey)) {
        e.preventDefault();
        openIsland("translate");
        return;
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [settings, toggleSpotifySearch, toggleIsland, openIsland]);

  // Synchronize backend global shortcut registration with settings
  useEffect(() => {
    invoke("register_all_shortcuts", { settings }).catch((err) => {
      console.warn("Backend register_all_shortcuts error:", err);
    });
  }, [
    settings.toggle_island_hotkey,
    settings.open_spotify_hotkey,
    settings.open_pomodoro_hotkey,
    settings.open_tray_hotkey,
    settings.open_clipboard_hotkey,
    settings.open_translate_hotkey,
    settings.spotify_search_hotkey,
  ]);

  useEffect(() => {
    if ((!isOpen && activeOverlay !== "spotify-search") || isLockedOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsQueueOpen(false);
        if (activeOverlayRef.current === "spotify-search") {
          setActiveOverlay("none");
        }
      }
    };
    const handleBlur = () => {
      setIsOpen(false);
      setIsQueueOpen(false);
      // Note: Do not close spotify-search on blur so window focus switches don't instantly dismiss it
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isLockedOpen, isOpen, activeOverlay]);

  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement | null;
    // Disable tab switching only when mouse is inside a select component or open dropdown or scrollable lyrics
    if (target?.closest('[data-slot="select-trigger"], [data-slot="select-content"], [data-slot="select-item"], [data-slot="select-group"], [data-slot="select-value"], [data-slot="select-label"], [data-slot="select-separator"], [data-slot="select-scroll-up-button"], [data-slot="select-scroll-down-button"], [data-select-container], [data-lyrics-container], [data-scrollable="true"]')) {
      return;
    }

    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = true;
    setTimeout(() => { scrollThrottleRef.current = false; }, 180);

    const availableModes: ViewMode[] = [];
    if (isSpotifyEnabled) availableModes.push("spotify");
    if (isPomodoroEnabled) availableModes.push("pomodoro");
    if (isTrayEnabled) availableModes.push("tray");
    if (isClipboardEnabled) availableModes.push("clipboard");
    if (isTranslateEnabled) availableModes.push("translate");

    if (availableModes.length === 0) return;

    const currentIndex = availableModes.indexOf(viewMode);
    const validIndex = currentIndex === -1 ? 0 : currentIndex;

    let nextMode = viewMode;
    if (e.deltaY > 0) {
      nextMode = availableModes[(validIndex + 1) % availableModes.length];
    } else if (e.deltaY < 0) {
      nextMode = availableModes[(validIndex - 1 + availableModes.length) % availableModes.length];
    }
    setViewMode(nextMode);

    // Show temporary preview of the selected widget on scroll, then revert to active widget/clock after 3.5s if idle
    setIsWheelPreviewing(true);
    if (wheelPreviewTimeoutRef.current) clearTimeout(wheelPreviewTimeoutRef.current);
    wheelPreviewTimeoutRef.current = setTimeout(() => {
      setIsWheelPreviewing(false);
      if (!isExpandedRef.current) {
        if (mediaRef.current.is_playing && isSpotifyEnabled) {
          setViewMode("spotify");
        } else if (isPomodoroActiveRef.current && isPomodoroEnabled) {
          setViewMode("pomodoro");
        }
      }
    }, 3500);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    const content = extractDropContent(e);
    if (content.type !== "none") browserDragContentRef.current = content;
  };

  const handleContainerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let content = extractDropContent(e, draggedFiles, draggedFilesRef.current);
    if (content.type === "none" && browserDragContentRef.current) content = browserDragContentRef.current;
    browserDragContentRef.current = null;

    if (content.type === "none") return;

    const targetEl = document.elementFromPoint(e.clientX, e.clientY);

    if (activeOverlayRef.current === "drop-localsend") {
      const deviceEl = targetEl?.closest("[data-device-fingerprint]");
      const targetFp = deviceEl?.getAttribute("data-device-fingerprint") || hoveredFingerprintRef.current;
      const targetDevice = targetFp ? devicesRef.current.find((d) => d.fingerprint === targetFp) : (devicesRef.current.length === 1 ? devicesRef.current[0] : null);

      if (targetDevice) {
        await sendExtractedContentToDevice(targetDevice, content, sendFiles, sendText, () => {
          if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
          setActiveOverlay("none");
          setDraggedFiles([]);
          draggedFilesRef.current = [];
          setHoveredFingerprint(null);
        });
      }
      return;
    }

    // If not sending to LocalSend, save to File Tray
    setIsOpen(false);
    setIsLockedOpen(false);
    setDraggedFiles([]);
    draggedFilesRef.current = [];

    try {
      await saveExtractedContentToTray(content);
      setConfirmationToast({ text: "Saved to File Tray", type: "in" });
      triggerOverlay("tray-confirmed", 1800);
    } catch (err) {
      console.error("Save to tray error:", err);
      setActiveOverlay("none");
    }
  };

  const effectiveAllowAnimation = isGameModeActive ? false : settings.allow_animation;

  const springTransition = effectiveAllowAnimation
    ? { type: "spring", stiffness: 380, damping: 30, mass: 0.65 }
    : { duration: 0.001 };

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col items-center pointer-events-none z-40 select-none "
      onContextMenu={(e) => { e.preventDefault(); try { invoke("open_settings_window"); } catch {} }}
    >
      {activeOverlay === "spotify-search" ? (
        <div className="flex items-start justify-center pointer-events-auto " ref={containerRef}>
          <motion.div
            layout
            transition={springTransition}
            style={{
              transformOrigin: "top center",
              backgroundColor: settings.allow_blur ? "rgba(10, 10, 14, 0.75)" : "var(--card)",
              boxShadow: isSearchExpanded
                ? "0 25px 50px -10px rgba(0, 0, 0, 0.75)"
                : "0 8px 20px -4px rgba(0, 0, 0, 0.5)",
              borderTopLeftRadius: isNotch ? 0 : isSearchExpanded ? 36 : 9999,
              borderTopRightRadius: isNotch ? 0 : isSearchExpanded ? 36 : 9999,
              borderBottomLeftRadius: isSearchExpanded ? 36 : isNotch ? 20 : 9999,
              borderBottomRightRadius: isSearchExpanded ? 36 : isNotch ? 20 : 9999,
            }}
            className={`relative flex flex-col items-center origin-top ${
              settings.allow_blur
                ? "backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.08]"
                : "border-0"
            } ${isNotch ? "rounded-t-none border-t-0 shadow-notch" : "mt-1.5 shadow-island"}`}
          >
            {isNotch && <NotchCurves />}
            <div
              className={`overflow-hidden ${
                settings.allow_blur ? "bg-black/60" : "bg-black"
              } ${
                isNotch
                  ? isSearchExpanded
                    ? "rounded-b-[36px] rounded-t-none"
                    : "rounded-b-[20px] rounded-t-none"
                  : isSearchExpanded
                  ? "rounded-[36px]"
                  : "rounded-full"
              }`}
            >
              <SpotifySearchWidget
                isExpanded={isSearchExpanded}
                onExpandChange={setIsSearchExpanded}
                onClose={() => {
                  setActiveOverlay("none");
                  setIsSearchExpanded(false);
                }}
              />
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <motion.div
            ref={containerRef}
            layout
            onWheel={handleWheel}
            onDragEnter={handleDragEnter}
            onDragOver={(e) => {
              e.preventDefault();
              if (activeOverlayRef.current === "none") triggerOverlay("drop-file", 5000);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (activeOverlayRef.current === "drop-file") {
                  setActiveOverlay("none");
                }
              }
            }}
            onDrop={handleContainerDrop}
            transition={springTransition}
            style={{
              transformOrigin: "top center",
              backgroundColor: settings.allow_blur ? "rgba(10, 10, 14, 0.75)" : "var(--card)",
              boxShadow: isExpanded
                ? "0 25px 50px -10px rgba(0, 0, 0, 0.75)"
                : "0 8px 20px -4px rgba(0, 0, 0, 0.5)",
              borderTopLeftRadius: isNotch ? 0 : isExpanded ? 36 : 9999,
              borderTopRightRadius: isNotch ? 0 : isExpanded ? 36 : 9999,
              borderBottomLeftRadius: isExpanded ? 36 : isNotch ? 20 : 9999,
              borderBottomRightRadius: isExpanded ? 36 : isNotch ? 20 : 9999,
            }}
            className={`relative pointer-events-auto flex flex-col items-center origin-top ${
              settings.allow_blur
                ? "backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.08]"
                : "border-0"
            } ${isNotch ? "rounded-t-none border-t-0 shadow-notch" : "mt-1.5 shadow-island"}`}
          >
            {isNotch && <NotchCurves />}

            <div className={`w-full grid grid-cols-1 grid-rows-1 *:col-start-1 *:row-start-1 ${
                settings.allow_blur ? "bg-black/60" : "bg-black"
            } items-center justify-items-center overflow-hidden ${
                isNotch ? (isExpanded ? "rounded-b-[36px] rounded-t-none" : "rounded-b-[20px] rounded-t-none") : (isExpanded ? "rounded-[36px]" : "rounded-full")
            }`}>
              <AnimatePresence initial={false}>
                {incomingTransfer ? (
                  <motion.div key="overlay-incoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="w-[340px]">
                    <IncomingTransferOverlay transfer={incomingTransfer} onAccept={() => acceptTransfer(incomingTransfer.sessionId)} onReject={() => rejectTransfer(incomingTransfer.sessionId)} />
                  </motion.div>
                ) : currentTransfer ? (
                  <motion.div key="overlay-transfer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="w-[360px]">
                    <TransferProgressOverlay transfer={currentTransfer} onCancel={cancelTransfer} />
                  </motion.div>
                ) : activeOverlay === "volume" && settings.volume_popup ? (
                  <motion.div key="overlay-volume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="w-[280px] h-8 flex items-center justify-center">
                    <VolumeOverlay volume={volumeLevel} isMuted={isMuted} />
                  </motion.div>
                ) : activeOverlay === "brightness" ? (
                  <motion.div key="overlay-brightness" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <BrightnessOverlay brightness={brightnessLevel} />
                  </motion.div>
                ) : activeOverlay === "timer-over" ? (
                  <motion.div key="overlay-timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <TimerOverOverlay onDismiss={() => setActiveOverlay("none")} />
                  </motion.div>
                ) : activeOverlay === "drop-file" ? (
                  <motion.div key="overlay-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <DropFileOverlay externalHoveredZone={hoveredDropZone} onSelectLocalSend={() => { if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current); setActiveOverlay("drop-localsend"); }} onSelectTray={() => { openIsland("tray"); setActiveOverlay("none"); }} />
                  </motion.div>
                ) : activeOverlay === "drop-localsend" ? (
                  <motion.div key="overlay-drop-ls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <DropLocalSendOverlay draggedFiles={draggedFiles} draggedFilesRef={draggedFilesRef} hoveredFingerprint={hoveredFingerprint} onClose={() => { if (dragLeaveTimeoutRef.current) clearTimeout(dragLeaveTimeoutRef.current); setActiveOverlay("none"); setDraggedFiles([]); draggedFilesRef.current = []; setHoveredFingerprint(null); }} />
                  </motion.div>
                ) : activeOverlay === "tray-saving" ? (
                  <motion.div key="overlay-tray-saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <TraySavingToast />
                  </motion.div>
                ) : activeOverlay === "tray-confirmed" ? (
                  <motion.div key="overlay-tray-conf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    <TrayConfirmedToast type={confirmationToast?.type} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {!incomingTransfer && !currentTransfer && activeOverlay === "none" && (
                !isExpanded ? (
                  <motion.div
                    key="collapsed-bar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.14 }}
                    style={{ transformOrigin: "top center" }}
                    className={`flex items-center ${showIdleClock ? "justify-center" : "justify-between"} h-8 origin-top ${
                      isDualActive
                        ? "w-52.5 px-3 cursor-pointer"
                        : showIdleClock
                        ? "w-32 px-2 cursor-pointer"
                        : (!isWheelPreviewing && media.is_playing) || viewMode === "spotify"
                        ? "w-52.5 px-2.5 cursor-pointer"
                        : (!isWheelPreviewing && isPomodoroActive) || viewMode === "pomodoro"
                        ? "w-47.5 px-3 cursor-pointer"
                        : viewMode === "tray" || viewMode === "clipboard" || viewMode === "translate"
                        ? "w-37.5 px-3 cursor-pointer"
                        : "w-32 px-2 cursor-pointer"
                    }`}
                    onClick={() => openIsland(viewMode)}
                  >
                    <CollapsedContent
                      isDualActive={isDualActive}
                      media={media}
                      isPomodoroActive={isPomodoroActive}
                      pomodoroMode={pomodoro.mode}
                      pomodoroTimeRemaining={pomodoro.timeRemaining}
                      viewMode={viewMode}
                      showIdleClock={showIdleClock}
                      isWheelPreviewing={isWheelPreviewing}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="expanded-hub"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.14 }}
                    style={{ transformOrigin: "top center" }}
                    className={`flex flex-col origin-top ${
                      viewMode === "spotify"
                        ? isQueueOpen
                          ? "w-[604px]"
                          : "w-[334px]"
                        : viewMode === "pomodoro"
                        ? "w-[340px]"
                        : viewMode === "clipboard"
                        ? "px-2.5 pb-2.5 gap-2 w-[590px]"
                        : viewMode === "tray"
                        ? "px-2.5 pb-2.5 gap-2 w-[490px]"
                        : viewMode === "translate"
                        ? "px-2.5 pb-2.5 gap-2 w-[600px]"
                        : "p-3 gap-2.5 min-w-[440px] max-w-[500px]"
                    }`}
                  >
                    <ExpandedContent viewMode={viewMode} setViewMode={setViewMode} media={media} fetchMedia={fetchMedia} isQueueOpen={isQueueOpen} setIsQueueOpen={setIsQueueOpen} isLockedOpen={isLockedOpen} setIsLockedOpen={setIsLockedOpen} setIsSettingsOpen={setIsSettingsOpen} setIsOpen={setIsOpen} />
                  </motion.div>
                )
              )}
          </div>
        </motion.div>

        {!isExpanded && isDualActive && (
          <div className="mt-1.5">
            <PomodoroBubbleWidget onClick={() => openIsland("pomodoro")} />
          </div>
        )}
      </div>
      )}
    </div>
  );
};
