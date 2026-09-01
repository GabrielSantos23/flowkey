import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { usePomodoro } from "../context/PomodoroContext";
import { NotchCurves } from "./NotchCurves";
import { PomodoroBubbleWidget } from "./widgets/small/PomodoroBubbleWidget";
import { SpotifyExpandedPlayer } from "./widgets/big/SpotifyExpandedPlayer";
import { PomodoroExpandedWidget } from "./widgets/big/PomodoroExpandedWidget";
import { ClipboardHistory } from "./widgets/big/ClipboardHistory";
import { MinimalClockCapsule } from "./widgets/small/MinimalClockCapsule";
import { TrayExpandedWidget } from "./widgets/big/TrayExpandedWidget";
import { VolumeOverlay } from "./overlays/VolumeOverlay";
import { BrightnessOverlay } from "./overlays/BrightnessOverlay";
import { TimerOverOverlay } from "./overlays/TimerOverOverlay";
import { DropFileOverlay } from "./overlays/DropFileOverlay";
import { DropLocalSendOverlay } from "./overlays/DropLocalSendOverlay";
import { IncomingTransferOverlay } from "./overlays/IncomingTransferOverlay";
import { TransferProgressOverlay } from "./overlays/TransferProgressOverlay";
import { OverlayType, ViewMode, MediaStats } from "../types";
import { Settings as SettingsIcon, Inbox, Music, Timer as PomodoroIcon, ClipboardList, Copy, Check } from "lucide-react";
import { SizeTransitionBlur } from "./common/SizeTransitionBlur";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { useLocalSend } from "../context/LocalSendContext";
import {
  ExtractedDropContent,
  extractDropContent,
  sendExtractedContentToDevice,
  saveExtractedContentToTray,
} from "../utils/dropContent";

export const DynamicIsland: React.FC = () => {
  const { settings, isSettingsOpen, setIsSettingsOpen } = useSettings();
  const pomodoro = usePomodoro();
  const {
    devices,
    sendFiles,
    sendText,
    incomingTransfer,
    activeTransfers,
    cancelTransfer,
    acceptTransfer,
    rejectTransfer,
  } = useLocalSend();

  const [draggedFiles, setDraggedFiles] = useState<string[]>([]);
  const draggedFilesRef = useRef<string[]>([]);
  const dragLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredFingerprint, setHoveredFingerprint] = useState<string | null>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isLockedOpen, setIsLockedOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("spotify");
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>("none");
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [hoveredDropZone, setHoveredDropZone] = useState<"tray" | "localsend" | null>(null);

  const activeOverlayRef = useRef<OverlayType>("none");
  const devicesRef = useRef(devices);
  const isDraggingRef = useRef<boolean>(false);
  const hoveredFingerprintRef = useRef<string | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);

  useEffect(() => {
    activeOverlayRef.current = activeOverlay;
  }, [activeOverlay]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    hoveredFingerprintRef.current = hoveredFingerprint;
  }, [hoveredFingerprint]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Listen to Tauri system-level native file drag-and-drop events
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
            if (event.payload.paths && event.payload.paths.length > 0) {
              setDraggedFiles(event.payload.paths);
              draggedFilesRef.current = event.payload.paths;
            }
            if (activeOverlayRef.current !== "drop-localsend") {
              triggerOverlay("drop-file", 10000);
            }
          } else if (event.payload.type === "over") {
            isDraggingRef.current = true;
            const dpr = window.devicePixelRatio || 1;
            const x = event.payload.position.x / dpr;
            const y = event.payload.position.y / dpr;
            const targetEl = document.elementFromPoint(x, y);

            if (targetEl) {
              const deviceEl = targetEl.closest("[data-device-fingerprint]");
              if (deviceEl) {
                const fp = deviceEl.getAttribute("data-device-fingerprint");
                setHoveredFingerprint(fp);
              } else if (hoveredFingerprintRef.current) {
                setHoveredFingerprint(null);
              }

              const dropZone = targetEl.closest("[data-drop-zone]");
              const zone = dropZone?.getAttribute("data-drop-zone") as "tray" | "localsend" | null;
              setHoveredDropZone(zone || null);
            }
          } else if (event.payload.type === "drop") {
            isDraggingRef.current = false;
            setHoveredDropZone(null);

            const paths =
              event.payload.paths && event.payload.paths.length > 0
                ? event.payload.paths
                : draggedFilesRef.current;

            const dpr = window.devicePixelRatio || 1;
            const x = event.payload.position.x / dpr;
            const y = event.payload.position.y / dpr;
            const targetEl = document.elementFromPoint(x, y);

            if (paths && paths.length > 0) {
              // A. If LocalSend overlay is open → send to device
              if (activeOverlayRef.current === "drop-localsend") {
                const deviceEl = targetEl?.closest("[data-device-fingerprint]");
                const targetFp =
                  deviceEl?.getAttribute("data-device-fingerprint") ||
                  hoveredFingerprintRef.current;
                const targetDevice = targetFp
                  ? devicesRef.current.find((d) => d.fingerprint === targetFp)
                  : devicesRef.current.length === 1
                  ? devicesRef.current[0]
                  : null;

                if (targetDevice) {
                  sendFiles(targetDevice, paths).catch((err) =>
                    console.error("Send files error:", err)
                  );
                  if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
                  setActiveOverlay("none");
                  setDraggedFiles([]);
                  draggedFilesRef.current = [];
                  setHoveredFingerprint(null);
                  return;
                }
              }

              // B. If Tray screen is active → save to tray
              if (viewModeRef.current === "tray") {
                invoke("add_tray_files", { paths }).catch(() => {});
                setIsHovered(false);
                setIsLockedOpen(false);
                setDraggedFiles([]);
                draggedFilesRef.current = [];
                if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
                setConfirmationToast({ text: "Saved to File Tray", type: "in" });
                setActiveOverlay("tray-confirmed");
                overlayTimeoutRef.current = setTimeout(() => {
                  setActiveOverlay("none");
                }, 1800);
                return;
              }
            }

            // C. On the 2-options confirmation overlay, ignore drop (just a selector)
            // (falls through to here naturally when not in localsend/tray)
          } else if (event.payload.type === "leave") {
            isDraggingRef.current = false;
            setHoveredDropZone(null);
            if (dragLeaveTimeoutRef.current) clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = setTimeout(() => {
              if (!isDraggingRef.current) {
                if (
                  activeOverlayRef.current === "drop-file" ||
                  activeOverlayRef.current === "drop-localsend"
                ) {
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
      } catch (e) {
        console.error("Failed to setup onDragDropEvent listener:", e);
      }
    };

    setupListener();

    return () => {
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, [sendFiles]);

  // Active file transfer taking priority in Dynamic Island
  const activeTransferList = Object.values(activeTransfers);
  const currentTransfer = activeTransferList.length > 0 ? activeTransferList[0] : null;

  // Media Playback Info state
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

  // Volume & Brightness HUD state
  const [volumeLevel, setVolumeLevel] = useState(65);
  const [isMuted, setIsMuted] = useState(false);
  const [brightnessLevel, setBrightnessLevel] = useState(80);



  // Confirmation Toast notification state
  const [confirmationToast, setConfirmationToast] = useState<{
    text: string;
    type: "in" | "out";
  } | null>(null);

  useEffect(() => {
    const handleTrayAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string; type: "in" | "out"; minimize?: boolean }>;
      if (customEvent.detail) {
        if (customEvent.detail.minimize || customEvent.detail.type === "in") {
          setIsHovered(false);
          setIsLockedOpen(false);
        }
        setConfirmationToast(customEvent.detail);
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
        setActiveOverlay("tray-confirmed");
        overlayTimeoutRef.current = setTimeout(() => {
          setActiveOverlay("none");
        }, 1800);
      }
    };
    window.addEventListener("dynamicwin-tray-action", handleTrayAction);
    return () => window.removeEventListener("dynamicwin-tray-action", handleTrayAction);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollThrottleRef = useRef<boolean>(false);

  const isExpanded =
    (isHovered || isLockedOpen) &&
    activeOverlay === "none" &&
    !incomingTransfer &&
    !currentTransfer;
  const isPomodoroActive = pomodoro.isRunning || (pomodoro.isPaused && pomodoro.timeRemaining > 0);
  const isDualActive = media.is_playing && isPomodoroActive;

  // Global Pointer tracking — sole controller of hover state
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isLockedOpen) return;
      // When the user is in tray or clipboard view, do NOT auto-close on pointer movement.
      // The user navigated there intentionally; auto-closing causes flicker.
      if (viewMode === "tray" || viewMode === "clipboard") return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Generous margin to prevent edge flicker
      const margin = 20;
      const isInside =
        e.clientX >= rect.left - margin &&
        e.clientX <= rect.right + margin &&
        e.clientY >= rect.top - margin &&
        e.clientY <= rect.bottom + margin;

      if (isInside) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setIsHovered(true);
      } else {
        if (!hoverTimeoutRef.current) {
          hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
            hoverTimeoutRef.current = null;
          }, 400);
        }
      }
    };

    // When the cursor leaves the entire Tauri window
    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && !isLockedOpen && viewMode !== "clipboard" && viewMode !== "tray") {
        setIsHovered(false);
      }
    };

    const handleBlur = () => {
      if (document.activeElement && containerRef.current?.contains(document.activeElement)) {
        return;
      }
      if (!isLockedOpen && viewMode !== "clipboard" && viewMode !== "tray") {
        setIsHovered(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mouseout", handleMouseOut);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isLockedOpen, viewMode]);

  // Poll Media Info from system / Spotify
  const fetchMedia = async () => {
    try {
      const data = await invoke<MediaStats>("get_media_info");
      if (data) {
        setMedia(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMedia();
    const interval = setInterval(fetchMedia, 1500);
    return () => clearInterval(interval);
  }, []);

  // Update dynamic input shape mask and dimensions
  useEffect(() => {
    try {
      if (isSettingsOpen) {
        invoke("clear_input_mask").catch(() => {});
        return;
      }

      let targetW = 270;
      let targetH = 36;

      if (incomingTransfer) {
        targetW = 340;
        targetH = 48;
      } else if (currentTransfer) {
        targetW = 360;
        targetH = 54;
      } else if (activeOverlay === "drop-localsend") {
        targetW = 380;
        targetH = 260;
      } else if (activeOverlay === "drop-file") {
        targetW = 280;
        targetH = 90;
      } else if (activeOverlay === "tray-saving") {
        targetW = 340;
        targetH = 54;
      } else if (activeOverlay === "tray-confirmed") {
        targetW = 320;
        targetH = 50;
      } else if (activeOverlay === "volume" || activeOverlay === "brightness") {
        targetW = 260;
        targetH = 36;
      } else if (isExpanded) {
        if (viewMode === "clipboard") {
          targetW = 600;
          targetH = 440;
        } else if (viewMode === "tray") {
          targetW = 540;
          targetH = 260;
        } else if (viewMode === "spotify" || viewMode === "pomodoro") {
          targetW = 340;
          targetH =
            viewMode === "spotify"
              ? isQueueOpen
                ? 350
                : 170
              : 180;
        } else {
          targetW = 440;
          targetH = 320;
        }
      } else {
        targetW = isDualActive ? 230 : media.is_playing || isPomodoroActive ? 210 : 128;
        targetH = 36;
      }

      // During active drops, open the input mask to the full window area so no drag is clipped
      const isDropping = activeOverlay === "drop-file" || activeOverlay === "drop-localsend";
      if (isDropping) {
        invoke("update_input_mask", {
          x: 0,
          y: 0,
          width: 660,
          height: 520,
        }).catch(() => {});
        return;
      }

      const buffer = isExpanded ? 40 : 16;
      const maskW = Math.min(660, targetW + buffer * 2);
      const maskH = Math.min(520, targetH + buffer);
      const windowTotalWidth = 660;
      const maskX = Math.max(0, Math.round((windowTotalWidth - maskW) / 2));

      invoke("update_input_mask", {
        x: maskX,
        y: 0,
        width: maskW,
        height: maskH,
      }).catch(() => {});
    } catch {}
  }, [
    isExpanded,
    isSettingsOpen,
    activeOverlay,
    incomingTransfer,
    currentTransfer,
    media.is_playing,
    viewMode,
    isQueueOpen,
    isDualActive,
    isPomodoroActive,
  ]);

  // Listen to system audio volume changes from backend in real-time
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      listen<{ volume_percent: number; is_muted: boolean }>(
        "volume-changed",
        (event) => {
          if (event.payload) {
            setVolumeLevel(event.payload.volume_percent);
            setIsMuted(event.payload.is_muted);
            if (settings.volume_popup) {
              triggerOverlay("volume", 2000);
            }
          }
        }
      ).then((u) => {
        unlisten = u;
      });
    } catch {}

    return () => {
      if (unlisten) unlisten();
    };
  }, [settings.volume_popup]);

  // Listen to Tauri tray menu "open-settings" event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      listen("open-settings", () => {
        setIsSettingsOpen(true);
      }).then((u) => {
        unlisten = u;
      });
    } catch {}
    return () => {
      if (unlisten) unlisten();
    };
  }, [setIsSettingsOpen]);

  // Mouse wheel scroll to change views / windows
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = true;
    setTimeout(() => {
      scrollThrottleRef.current = false;
    }, 250);

    const modes: ViewMode[] = [];
    if (media.is_playing) modes.push("spotify");
    if (isPomodoroActive) modes.push("pomodoro");
    modes.push("tray");

    const currentIndex = modes.indexOf(viewMode);
    if (e.deltaY > 0) {
      const nextIdx = (currentIndex + 1) % modes.length;
      setViewMode(modes[nextIdx]);
    } else if (e.deltaY < 0) {
      const prevIdx = (currentIndex - 1 + modes.length) % modes.length;
      setViewMode(modes[prevIdx]);
    }
  };

  // Show temporary overlay HUD helper
  const triggerOverlay = (type: OverlayType, durationMs = 2500) => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    setActiveOverlay(type);
    overlayTimeoutRef.current = setTimeout(() => {
      setActiveOverlay("none");
    }, durationMs);
  };

  // Keyboard shortcut listener for overlay testing & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeUp" || e.key === "VolumeUp") {
        setVolumeLevel((v) => Math.min(100, v + 5));
        setIsMuted(false);
        if (settings.volume_popup) triggerOverlay("volume");
      } else if (e.key === "AudioVolumeDown" || e.key === "VolumeDown") {
        setVolumeLevel((v) => Math.max(0, v - 5));
        if (settings.volume_popup) triggerOverlay("volume");
      } else if (e.key === "AudioVolumeMute" || e.key === "VolumeMute") {
        setIsMuted((m) => !m);
        if (settings.volume_popup) triggerOverlay("volume");
      } else if (e.key === "F5" && e.altKey) {
        setBrightnessLevel((b) => Math.max(0, b - 10));
        if (settings.brightness_popup) triggerOverlay("brightness");
      } else if (e.key === "F6" && e.altKey) {
        setBrightnessLevel((b) => Math.min(100, b + 10));
        if (settings.brightness_popup) triggerOverlay("brightness");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.volume_popup, settings.brightness_popup]);

  // Ref to persist browser drag content captured during dragEnter/dragOver.
  // On Linux, Tauri's native onDragDropEvent may consume dataTransfer before the HTML5 onDrop fires.
  const browserDragContentRef = useRef<ExtractedDropContent | null>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    // Capture browser drag content early (URLs, HTML img tags, in-memory files)
    // before the native handler has a chance to consume it.
    const content = extractDropContent(e);
    if (content.type !== "none") {
      browserDragContentRef.current = content;
    }
    if (activeOverlayRef.current !== "drop-localsend") {
      triggerOverlay("drop-file", 10000);
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // No-op: global pointermove handler manages hover state reliably.
    // React onMouseLeave fires spuriously when crossing child elements on WebKit/Linux.
  };



  const isNotch = settings.island_mode === "notch";

  const springTransition = settings.allow_animation
    ? { type: "spring", stiffness: 420, damping: 28, mass: 0.65 }
    : { duration: 0.01 };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleContainerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Try extracting from the current drop event first
    let content = extractDropContent(e, draggedFiles, draggedFilesRef.current);
    // Fallback: use cached browser drag content captured during dragEnter
    // (Tauri's native handler on Linux may have consumed the dataTransfer by now)
    if (content.type === "none" && browserDragContentRef.current) {
      content = browserDragContentRef.current;
    }
    browserDragContentRef.current = null;

    if (content.type === "none") return;

    const targetEl = document.elementFromPoint(e.clientX, e.clientY);

    // 1. If LocalSend overlay is currently open → send to device
    if (activeOverlayRef.current === "drop-localsend") {
      const deviceEl = targetEl?.closest("[data-device-fingerprint]");
      const targetFp =
        deviceEl?.getAttribute("data-device-fingerprint") ||
        hoveredFingerprintRef.current;
      const targetDevice = targetFp
        ? devicesRef.current.find((d) => d.fingerprint === targetFp)
        : devicesRef.current.length === 1
        ? devicesRef.current[0]
        : null;

      if (targetDevice) {
        await sendExtractedContentToDevice(
          targetDevice,
          content,
          sendFiles,
          sendText,
          () => {
            if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
            setActiveOverlay("none");
            setDraggedFiles([]);
            draggedFilesRef.current = [];
            setHoveredFingerprint(null);
          }
        );
      }
      return;
    }

    // 2. If Tray screen is active → save to tray
    if (viewMode === "tray") {
      setIsHovered(false);
      setIsLockedOpen(false);
      setDraggedFiles([]);
      draggedFilesRef.current = [];

      try {
        await saveExtractedContentToTray(content);
        setConfirmationToast({ text: "Saved to File Tray", type: "in" });
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
        setActiveOverlay("tray-confirmed");
        overlayTimeoutRef.current = setTimeout(() => {
          setActiveOverlay("none");
        }, 1800);
      } catch {
        setActiveOverlay("none");
      }
      return;
    }

    // 3. On drop-file (2-options selector) or any other overlay → ignore drop
  };

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col items-center pointer-events-none z-40 select-none"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        e.preventDefault();
        if (dragLeaveTimeoutRef.current) {
          clearTimeout(dragLeaveTimeoutRef.current);
          dragLeaveTimeoutRef.current = null;
        }
        if (activeOverlayRef.current === "none") {
          triggerOverlay("drop-file", 10000);
        }
      }}
      onDrop={handleContainerDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        try {
          invoke("open_settings_window");
        } catch {}
      }}
    >
      {/* Outer row container (supports split layout when both music and pomodoro are active) */}
      <div className="flex items-center gap-2">
        <motion.div
          ref={containerRef}
          layout
          transition={springTransition}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragLeaveTimeoutRef.current) {
              clearTimeout(dragLeaveTimeoutRef.current);
              dragLeaveTimeoutRef.current = null;
            }
          }}
          onDrop={handleContainerDrop}
          onWheel={handleWheel}
          className={`relative pointer-events-auto flex flex-col items-center border-0 ${
            settings.allow_blur ? "backdrop-blur-2xl" : ""
          } ${
            isNotch
              ? isExpanded
                ? "rounded-b-[36px] border-t-0 shadow-notch"
                : "rounded-b-[20px] border-t-0 shadow-notch"
              : isExpanded
              ? "rounded-[36px] mt-2 shadow-island"
              : "rounded-full mt-1.5 shadow-island"
          }`}
          style={{
            backgroundColor: "var(--color-island-bg)",
            boxShadow: isExpanded
              ? "0 25px 50px -10px rgba(0, 0, 0, 0.75)"
              : "0 8px 20px -4px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Notch Top Bezier Wings */}
          {isNotch && <NotchCurves />}

          {/* CONTINUOUS CONTAINER WITH FLUID SPRING TRANSITIONS */}
          <motion.div
            layout
            transition={springTransition}
            className={`w-full flex flex-col overflow-hidden ${
              isNotch
                ? isExpanded
                  ? "rounded-b-[36px]"
                  : "rounded-b-[20px]"
                : isExpanded
                ? "rounded-[36px]"
                : "rounded-full"
            }`}
          >
            <SizeTransitionBlur triggerKey={`${isExpanded}-${viewMode}-${activeOverlay}-${isQueueOpen}-${isDualActive}-${Boolean(incomingTransfer)}-${Boolean(currentTransfer)}-${currentTransfer?.transferId}`}>
              <AnimatePresence mode="popLayout" initial={false}>
              {incomingTransfer ? (
                <motion.div
                  key="overlay-incoming-transfer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="w-[340px]"
                >
                  <IncomingTransferOverlay
                    transfer={incomingTransfer}
                    onAccept={() => acceptTransfer(incomingTransfer.sessionId)}
                    onReject={() => rejectTransfer(incomingTransfer.sessionId)}
                  />
                </motion.div>
              ) : currentTransfer ? (
                <motion.div
                  key={`overlay-transfer-${currentTransfer.transferId}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="w-[360px]"
                >
                  <TransferProgressOverlay
                    transfer={currentTransfer}
                    onCancel={cancelTransfer}
                  />
                </motion.div>
              ) : activeOverlay === "volume" ? (
                <motion.div
                  key="overlay-volume"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <VolumeOverlay volume={volumeLevel} isMuted={isMuted} />
                </motion.div>
              ) : activeOverlay === "brightness" ? (
                <motion.div
                  key="overlay-brightness"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <BrightnessOverlay brightness={brightnessLevel} />
                </motion.div>
              ) : activeOverlay === "timer-over" ? (
                <motion.div
                  key="overlay-timer-over"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <TimerOverOverlay onDismiss={() => setActiveOverlay("none")} />
                </motion.div>
              ) : activeOverlay === "drop-file" ? (
                <motion.div
                  key="overlay-drop"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <DropFileOverlay
                    externalHoveredZone={hoveredDropZone}
                    onSelectLocalSend={() => {
                      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
                      setActiveOverlay("drop-localsend");
                    }}
                    onSelectTray={() => {
                      setViewMode("tray");
                      setIsHovered(true);
                      setActiveOverlay("none");
                    }}
                  />
                </motion.div>
              ) : activeOverlay === "drop-localsend" ? (
                <motion.div
                  key="overlay-drop-localsend"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <DropLocalSendOverlay
                    draggedFiles={draggedFiles}
                    draggedFilesRef={draggedFilesRef}
                    hoveredFingerprint={hoveredFingerprint}
                    onClose={() => {
                      if (dragLeaveTimeoutRef.current) clearTimeout(dragLeaveTimeoutRef.current);
                      setActiveOverlay("none");
                      setDraggedFiles([]);
                      draggedFilesRef.current = [];
                      setHoveredFingerprint(null);
                    }}
                  />
                </motion.div>
              ) : activeOverlay === "tray-saving" ? (
                <motion.div
                  key="overlay-tray-saving"
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="flex items-center justify-between gap-3 px-4 py-2 w-[340px] select-none text-white"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <Inbox className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">Saving to File Tray...</div>
                      <div className="text-[10px] text-neutral-400">Downloading & caching file</div>
                    </div>
                  </div>
                  <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden relative flex-shrink-0">
                    <div className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-emerald-400 rounded-full animate-pulse w-full" />
                  </div>
                </motion.div>
              ) : activeOverlay === "tray-confirmed" ? (
                <motion.div
                  key="overlay-tray-confirmed"
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="flex items-center justify-between gap-3 px-4 py-2 w-[320px] select-none text-white"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        confirmationToast?.type === "in"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      }`}
                    >
                      {confirmationToast?.type === "in" ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <Copy className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {confirmationToast?.type === "in" ? "Saved to File Tray" : "Copied to Clipboard"}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {confirmationToast?.type === "in" ? "Ready in File Tray" : "Ready to paste (Ctrl+V)"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                      confirmationToast?.type === "in"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                    }`}
                  >
                    {confirmationToast?.type === "in" ? "Saved" : "Copied"}
                  </span>
                </motion.div>
              ) : !isExpanded ? (
                /* COLLAPSED BAR */
                <motion.div
                  key="collapsed-bar"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className={`flex items-center justify-between h-8 ${
                    isDualActive
                      ? "w-[170px] px-2.5 cursor-pointer"
                      : media.is_playing || isPomodoroActive
                      ? "w-[210px] px-2.5 cursor-pointer"
                      : "w-[128px] cursor-pointer"
                  }`}
                  onClick={() => {
                    if (isDualActive || media.is_playing) {
                      setViewMode("spotify");
                      setIsHovered(true);
                    } else if (isPomodoroActive) {
                      setViewMode("pomodoro");
                      setIsHovered(true);
                    } else {
                      setViewMode("spotify");
                      setIsHovered(true);
                    }
                  }}
                >
                  {/* CASE 1: Split Mode (Music Playing while Pomodoro is also active - Image 2) */}
                  {isDualActive ? (
                    <div className="flex items-center justify-between w-full">
                      {/* Left: Album Cover */}
                      <div className="w-5 h-5 rounded-md bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
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
                          <Music className="w-3 h-3 text-white/50" />
                        )}
                      </div>

                      <div className="flex-1" />

                      {/* Right: Purple/Orange Equalizer Bars (Image 2) */}
                      <div className="flex items-end gap-[2px] h-3.5 px-0.5">
                        {[0.35, 0.9, 0.55, 0.8, 0.45].map((h, i) => (
                          <motion.div
                            key={i}
                            className="w-[2.5px] rounded-full bg-gradient-to-t from-purple-500 to-orange-400"
                            animate={
                              media.is_playing
                                ? {
                                    height: [
                                      `${Math.max(2, 12 * h * 0.3)}px`,
                                      `${Math.max(3, 12 * h)}px`,
                                      `${Math.max(2, 12 * h * 0.5)}px`,
                                    ],
                                  }
                                : { height: "2px" }
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
                  ) : media.is_playing ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="w-5 h-5 rounded-md bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
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
                          <Music className="w-3 h-3 text-white/50" />
                        )}
                      </div>

                      <div className="flex-1" />

                      <div className="flex items-end gap-[2px] h-3.5 px-0.5">
                        {[0.35, 0.9, 0.55, 0.8, 0.45].map((h, i) => (
                          <motion.div
                            key={i}
                            className="w-[2.5px] rounded-full bg-[#d8c3a5]"
                            animate={
                              media.is_playing
                                ? {
                                    height: [
                                      `${Math.max(2, 12 * h * 0.3)}px`,
                                      `${Math.max(3, 12 * h)}px`,
                                      `${Math.max(2, 12 * h * 0.5)}px`,
                                    ],
                                  }
                                : { height: "2px" }
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
                  ) : isPomodoroActive ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="w-5 h-5 rounded-full bg-[#ff9f0a]/20 border border-[#ff9f0a]/40 flex items-center justify-center flex-shrink-0">
                        <PomodoroIcon className="w-3 h-3 text-[#ff9f0a]" />
                      </div>

                      <span className="text-[11px] font-semibold text-neutral-300 capitalize">
                        {pomodoro.mode}
                      </span>

                      <span className="text-xs font-mono font-bold text-[#ff9f0a]">
                        {formatTime(pomodoro.timeRemaining)}
                      </span>
                    </div>
                  ) : (
                    /* CASE 4: Minimalist Clock Capsule when idle */
                    <MinimalClockCapsule />
                  )}
                </motion.div>
              ) : (
                /* EXPANDED HUB */
                <motion.div
                  key="expanded-hub"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={springTransition}
                  className={`flex flex-col ${
                    viewMode === "spotify" || viewMode === "pomodoro"
                      ? "w-[340px]"
                      : viewMode === "clipboard"
                      ? "p-2.5 gap-2 w-[590px]"
                      : viewMode === "tray"
                      ? "p-2.5 gap-2 w-[490px]"
                      : "p-3 gap-2.5 min-w-[440px] max-w-[500px]"
                  }`}
                >
                  {/* Header View Switcher (Only shown on non-spotify/pomodoro/tray multi-view modes) */}
                  {viewMode !== "spotify" && viewMode !== "pomodoro" && viewMode !== "tray" && (
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/5">
                        {media.is_available && (
                          <button
                            onClick={() => setViewMode("spotify")}
                            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white"
                          >
                            <Music className="w-3 h-3" />
                            <span>Player</span>
                          </button>
                        )}

                        <button
                          onClick={() => setViewMode("pomodoro")}
                          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white"
                        >
                          <PomodoroIcon className="w-3 h-3 text-[#ff9f0a]" />
                          <span>Pomodoro</span>
                        </button>

                        <button
                          onClick={() => setViewMode("tray")}
                          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white"
                        >
                          <Inbox className="w-3 h-3" />
                          <span>Tray</span>
                        </button>

                        <button
                          onClick={() => setViewMode("clipboard")}
                          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all bg-white text-black shadow-sm"
                        >
                          <ClipboardList className="w-3 h-3" />
                          <span>Clipboard</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsLockedOpen((prev) => !prev)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                            isLockedOpen
                              ? "bg-white/20 text-white border border-white/30"
                              : "text-neutral-500 hover:text-neutral-300"
                          }`}
                          title="Keep island expanded"
                        >
                          {isLockedOpen ? "Pinned" : "Pin"}
                        </button>

                        <button
                          onClick={() => {
                            try {
                              invoke("open_settings_window");
                            } catch {
                              setIsSettingsOpen(true);
                            }
                          }}
                          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                          title="Settings"
                        >
                          <SettingsIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active View Mode Content */}
                  <div className="w-full">
                    <AnimatePresence mode="wait">
                      {viewMode === "spotify" && (
                        <motion.div
                          key="spotify"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                        >
                          <SpotifyExpandedPlayer
                            media={media}
                            onRefreshMedia={fetchMedia}
                            onQueueToggle={(open) => setIsQueueOpen(open)}
                          />
                        </motion.div>
                      )}

                      {viewMode === "pomodoro" && (
                        <motion.div
                          key="pomodoro"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                        >
                          <PomodoroExpandedWidget />
                        </motion.div>
                      )}

                      {viewMode === "tray" && (
                        <motion.div
                          key="tray"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                        >
                          <TrayExpandedWidget
                            onMinimize={() => setIsHovered(false)}
                            onViewChange={(view) => setViewMode(view)}
                          />
                        </motion.div>
                      )}

                      {viewMode === "clipboard" && (
                        <motion.div
                          key="clipboard"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ClipboardHistory />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SizeTransitionBlur>
        </motion.div>
      </motion.div>

        {/* Standalone Circular Pomodoro Bubble (Appears on right side only when both Music & Pomodoro are active - Image 2) */}
        {!isExpanded && isDualActive && (
          <div className="mt-1">
            <PomodoroBubbleWidget
              onClick={() => {
                setViewMode("pomodoro");
                setIsHovered(true);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
