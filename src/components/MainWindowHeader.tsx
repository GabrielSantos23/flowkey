import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Minus, Square, Copy, X, Settings, Sparkles } from "lucide-react";
import flowkeyLogo from "../assets/logo.png";
import { Switch } from "./ui/switch";
import { hotkeyService } from "../services/hotkeyService";
import { updaterService } from "../services/updaterService";

interface MainWindowHeaderProps {
  className?: string;
  onOpenSettings?: () => void;
}

export const MainWindowHeader: React.FC<MainWindowHeaderProps> = ({
  className = "",
  onOpenSettings,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCommandsEnabled, setIsCommandsEnabled] = useState<boolean>(
    () => !hotkeyService.isMasterDisabled(),
  );
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  // Check for updates on header mount & listen to update status events
  useEffect(() => {
    let isMounted = true;
    updaterService
      .checkForUpdates()
      .then((res) => {
        if (isMounted && res?.available) {
          setHasUpdate(true);
          setUpdateVersion(res.version || null);
        }
      })
      .catch(() => {});

    const handleUpdateEvent = (e: any) => {
      setHasUpdate(Boolean(e.detail?.available));
      if (e.detail?.version) setUpdateVersion(e.detail.version);
    };

    window.addEventListener("flowkey_update_status", handleUpdateEvent);
    return () => {
      isMounted = false;
      window.removeEventListener("flowkey_update_status", handleUpdateEvent);
    };
  }, []);

  useEffect(() => {
    const handleDisabledChanged = () => {
      setIsCommandsEnabled(!hotkeyService.isMasterDisabled());
    };

    window.addEventListener("flowkey_disabled_changed", handleDisabledChanged);
    window.addEventListener("flowkey_hotkeys_changed", handleDisabledChanged);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_hotkeys_sync");
      bc.onmessage = () => {
        handleDisabledChanged();
      };
    }

    return () => {
      window.removeEventListener(
        "flowkey_disabled_changed",
        handleDisabledChanged,
      );
      window.removeEventListener(
        "flowkey_hotkeys_changed",
        handleDisabledChanged,
      );
      bc?.close();
    };
  }, []);

  const handleToggleEnabled = (checked: boolean) => {
    hotkeyService.setMasterDisabled(!checked);
    setIsCommandsEnabled(checked);
  };

  // Check and sync maximized state
  const checkMaximized = useCallback(async () => {
    try {
      const appWindow = getCurrentWebviewWindow();
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    } catch {
      // In non-Tauri or browser preview mode
    }
  }, []);

  useEffect(() => {
    checkMaximized();

    let unlistenResize: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow
        .listen("tauri://resize", () => {
          checkMaximized();
        })
        .then((fn) => {
          unlistenResize = fn;
        });
    } catch {}

    return () => {
      unlistenResize?.();
    };
  }, [checkMaximized]);

  const handleStartDrag = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest("[data-slot='switch']")
    ) {
      return;
    }
    try {
      const appWindow = getCurrentWebviewWindow();
      await appWindow.startDragging();
    } catch (err) {
      // Handled via data-tauri-drag-region or permission
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("minimize_main_window");
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.minimize();
      } catch (err) {
        console.warn("Minimize error:", err);
      }
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const isMax = await invoke<boolean>("toggle_maximize_main_window");
      setIsMaximized(isMax);
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.toggleMaximize();
        checkMaximized();
      } catch (err) {
        console.warn("Toggle maximize error:", err);
      }
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("close_main_window");
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.close();
      } catch (err) {
        console.warn("Close error:", err);
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleStartDrag}
      onDoubleClick={handleToggleMaximize}
      className={`h-10 pl-3 pr-0 flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0 border-b border-border/40 select-none z-50 cursor-default ${className}`}
    >
      <div
        className="flex items-center gap-2.5 pointer-events-auto"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <img
            src={flowkeyLogo}
            alt="FlowKey"
            className="w-4.5 h-4.5 rounded-md object-contain shadow-xs"
          />
          <p className="text-xs font-semibold tracking-wide">FlowKey</p>
        </div>
      </div>

      <div data-tauri-drag-region className="flex-1 h-full cursor-default" />

      <div className="flex items-center h-full pointer-events-auto z-10">
        {/* Update Available Indicator Button */}
        {hasUpdate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings?.();
            }}
            className="flex items-center gap-1.5 px-2.5 py-0.5 mr-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-semibold transition-all shadow-xs cursor-pointer animate-pulse"
            title="Update available! Click to view update."
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Update {updateVersion ? `v${updateVersion}` : "Available"}</span>
          </button>
        )}

        {/* Master Commands Enable Switch */}
        <div
          className="flex items-center px-3 h-full border-r border-border/30"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            size="sm"
            checked={isCommandsEnabled}
            onCheckedChange={handleToggleEnabled}
            aria-label="Toggle commands enabled"
            style={{ "--primary": "#1ED760" } as React.CSSProperties}
          />
        </div>

        {/* Settings Modal Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="w-10 h-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-colors cursor-pointer border-r border-border/30"
            title="Settings & Preferences"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Minimize Button */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-11 h-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore Button */}
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-11 h-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-colors cursor-pointer"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="w-11 h-full inline-flex items-center justify-center text-muted-foreground hover:text-white hover:bg-[#e81123] active:bg-[#c40e1d] transition-colors cursor-pointer group"
          title="Close"
        >
          <X className="w-3.5 h-3.5 group-hover:stroke-[2.5]" />
        </button>
      </div>
    </header>
  );
};
