import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MediaStats, ViewMode } from "@/types";
import { SpotifyExpandedPlayer } from "../widgets/big/SpotifyExpandedPlayer";
import { PomodoroExpandedWidget } from "../widgets/big/PomodoroExpandedWidget";
import TrayExpandedWidget from "../widgets/big/TrayExpandedWidget";
import { ClipboardHistory } from "../widgets/big/ClipboardHistory";
import { TranslateExpandedWidget } from "../widgets/big/TranslateExpandedWidget";
import { IslandHeader } from "./IslandHeader";

interface ExpandedContentProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  media: MediaStats;
  fetchMedia: () => void;
  isQueueOpen?: boolean;
  setIsQueueOpen: (v: boolean) => void;
  isLockedOpen?: boolean;
  setIsLockedOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen?: (v: boolean) => void;
  setIsOpen: (v: boolean) => void;
}

export const ExpandedContent: React.FC<ExpandedContentProps> = ({
  viewMode, setViewMode, media, fetchMedia, setIsQueueOpen,
  setIsOpen
}) => {
  return (
    <div className="w-full flex flex-col items-center">
      <IslandHeader currentView={viewMode} onViewChange={setViewMode} />
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
    </div>
  );
};
