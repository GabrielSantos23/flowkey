import React from "react";
import { motion } from "framer-motion";
import { ClipboardList, Inbox, Languages } from "lucide-react";
import { ViewMode } from "@/types";
import { useSettings } from "@/context/SettingsContext";

interface IslandHeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export const IslandHeader: React.FC<IslandHeaderProps> = ({
  currentView,
  onViewChange,
  className = "",
}) => {
  const { settings } = useSettings();
  const enabledWidgets =
    settings.enabled_widgets && settings.enabled_widgets.length > 0
      ? settings.enabled_widgets
      : ["spotify", "pomodoro", "tray", "clipboard", "translate"];

  const isClipboardEnabled = enabledWidgets.includes("clipboard");
  const isSpotifyEnabled = enabledWidgets.includes("spotify");
  const isPomodoroEnabled = enabledWidgets.includes("pomodoro");
  const isTrayEnabled = enabledWidgets.includes("tray");
  const isTranslateEnabled = enabledWidgets.includes("translate");

  const handleToggleAuxView = (view: ViewMode) => {
    if (currentView === view) {
      const fallback =
        (enabledWidgets.find((w) => w !== view) as ViewMode) || "spotify";
      onViewChange(fallback);
    } else {
      onViewChange(view);
    }
  };

  const isPlayerActive = currentView === "spotify";
  const isFocusActive = currentView === "pomodoro";

  return (
    <div
      className={`w-full flex items-center justify-between px-3.5 pt-2.5 pb-1 select-none z-20 ${className}`}
    >
      {/* LEFT: Clipboard Shortcut */}
      <div className="flex-1 flex items-center justify-start min-w-[28px]">
        {isClipboardEnabled && (
          <button
            type="button"
            onClick={() => handleToggleAuxView("clipboard")}
            className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
              currentView === "clipboard"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
                : "bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white"
            }`}
            title="Clipboard History"
          >
            <ClipboardList className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        )}
      </div>

      {/* CENTER: Segmented Tab (Player vs Focus) */}
      <div className="flex items-center justify-center flex-shrink-0">
        {(isSpotifyEnabled || isPomodoroEnabled) && (
          <div className="flex items-center p-0.5 rounded-full bg-black/40 border border-white/5 backdrop-blur-md shadow-inner">
            {/* Player Tab */}
            {isSpotifyEnabled && (
              <button
                type="button"
                onClick={() => onViewChange("spotify")}
                className={`relative px-3.5 py-1 text-xs font-semibold rounded-full transition-colors duration-200 cursor-pointer ${
                  isPlayerActive ? "text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                {isPlayerActive && (
                  <motion.div
                    layoutId="island-header-active-pill"
                    className="absolute inset-0 bg-neutral-700/80 rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Player</span>
              </button>
            )}

            {/* Focus (Pomodoro) Tab */}
            {isPomodoroEnabled && (
              <button
                type="button"
                onClick={() => onViewChange("pomodoro")}
                className={`relative px-3.5 py-1 text-xs font-semibold rounded-full transition-colors duration-200 cursor-pointer ${
                  isFocusActive ? "text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                {isFocusActive && (
                  <motion.div
                    layoutId="island-header-active-pill"
                    className="absolute inset-0 bg-neutral-700/80 rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Focus</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Tray & Tradutor Shortcuts */}
      <div className="flex-1 flex items-center justify-end gap-1.5 min-w-[28px]">
        {/* Tray Button */}
        {isTrayEnabled && (
          <button
            type="button"
            onClick={() => handleToggleAuxView("tray")}
            className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
              currentView === "tray"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
                : "bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white"
            }`}
            title="File Tray"
          >
            <Inbox className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        )}

        {/* Tradutor Button */}
        {isTranslateEnabled && (
          <button
            type="button"
            onClick={() => handleToggleAuxView("translate")}
            className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
              currentView === "translate"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
                : "bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white"
            }`}
            title="Tradutor"
          >
            <Languages className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        )}
      </div>
    </div>
  );
};
