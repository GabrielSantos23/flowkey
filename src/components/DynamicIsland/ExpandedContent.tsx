import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as SettingsIcon, Inbox, Music, Timer as PomodoroIcon, ClipboardList, Languages } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { MediaStats, ViewMode } from "@/types";
import { SpotifyExpandedPlayer } from "../widgets/big/SpotifyExpandedPlayer";
import { PomodoroExpandedWidget } from "../widgets/big/PomodoroExpandedWidget";
import TrayExpandedWidget from "../widgets/big/TrayExpandedWidget";
import { ClipboardHistory } from "../widgets/big/ClipboardHistory";
import { TranslateExpandedWidget } from "../widgets/big/TranslateExpandedWidget";

interface ExpandedContentProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  media: MediaStats;
  fetchMedia: () => void;
  isQueueOpen?: boolean;
  setIsQueueOpen: (v: boolean) => void;
  isLockedOpen: boolean;
  setIsLockedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: (v: boolean) => void;
  setIsOpen: (v: boolean) => void;
}

export const ExpandedContent: React.FC<ExpandedContentProps> = ({
  viewMode, setViewMode, media, fetchMedia, setIsQueueOpen,
  isLockedOpen, setIsLockedOpen, setIsSettingsOpen, setIsOpen
}) => {
  const showHeader = viewMode !== "spotify" && viewMode !== "pomodoro" && viewMode !== "tray";

  return (
    <>
      {showHeader && (
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/5">
            {media.is_available && (
              <button onClick={() => setViewMode("spotify")} className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white">
                <Music className="w-3 h-3" /><span>Player</span>
              </button>
            )}
            <button onClick={() => setViewMode("pomodoro")} className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white">
              <PomodoroIcon className="w-3 h-3 text-[#ff9f0a]" /><span>Pomodoro</span>
            </button>
            <button onClick={() => setViewMode("tray")} className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all text-neutral-400 hover:text-white">
              <Inbox className="w-3 h-3" /><span>Tray</span>
            </button>
            <button
              onClick={() => setViewMode("clipboard")}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "clipboard" ? "bg-white text-black shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <ClipboardList className="w-3 h-3" /><span>Clipboard</span>
            </button>
            <button
              onClick={() => setViewMode("translate")}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "translate" ? "bg-white text-black shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Languages className="w-3 h-3" /><span>Translate</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setIsLockedOpen((prev) => !prev)} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${isLockedOpen ? "bg-white/20 text-white border border-white/30" : "text-neutral-500 hover:text-neutral-300"}`} title="Keep island expanded">
              {isLockedOpen ? "Pinned" : "Pin"}
            </button>
            <button onClick={() => { try { invoke("open_settings_window"); } catch { setIsSettingsOpen(true); } }} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all" title="Settings">
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full">
        <AnimatePresence mode="wait">
          {viewMode === "spotify" && (
            <motion.div
              key="spotify"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ transformOrigin: "top center" }}
              className="w-full origin-top"
            >
              <SpotifyExpandedPlayer media={media} onRefreshMedia={fetchMedia} onQueueToggle={setIsQueueOpen} />
            </motion.div>
          )}
          {viewMode === "pomodoro" && (
            <motion.div
              key="pomodoro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ transformOrigin: "top center" }}
              className="w-full origin-top"
            >
              <PomodoroExpandedWidget />
            </motion.div>
          )}
          {viewMode === "tray" && (
            <motion.div
              key="tray"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ transformOrigin: "top center" }}
              className="w-full origin-top"
            >
              <TrayExpandedWidget onMinimize={() => setIsOpen(false)} onViewChange={setViewMode} />
            </motion.div>
          )}
          {viewMode === "clipboard" && (
            <motion.div
              key="clipboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ transformOrigin: "top center" }}
              className="w-full origin-top"
            >
              <ClipboardHistory />
            </motion.div>
          )}
          {viewMode === "translate" && (
            <motion.div
              key="translate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ transformOrigin: "top center" }}
              className="w-full origin-top"
            >
              <TranslateExpandedWidget onMinimize={() => setIsOpen(false)} onViewChange={setViewMode} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
