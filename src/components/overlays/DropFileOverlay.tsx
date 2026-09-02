import React, { useState, useRef, useEffect } from "react";
import { Inbox, Send, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DropFileOverlayProps {
  onSelectLocalSend: () => void;
  onSelectTray?: () => void;
  externalHoveredZone?: "tray" | "localsend" | null;
}

export const DropFileOverlay: React.FC<DropFileOverlayProps> = ({
  onSelectLocalSend,
  onSelectTray,
  externalHoveredZone,
}) => {
  const [hoveredCard, setHoveredCard] = useState<"tray" | "localsend" | null>(null);
  const [selectedCard, setSelectedCard] = useState<"tray" | "localsend" | null>(null);
  const [hoverProgress, setHoverProgress] = useState(0);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDwellCardRef = useRef<"tray" | "localsend" | null>(null);

  const clearTimers = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    currentDwellCardRef.current = null;
    setHoverProgress(0);
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const startDwell = (card: "tray" | "localsend") => {
    if (selectedCard || currentDwellCardRef.current === card) return;

    clearTimers();
    currentDwellCardRef.current = card;
    setHoveredCard(card);

    const startTime = Date.now();
    const DURATION = 1400; // 1.4 seconds dwell delay

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setHoverProgress(pct);
    }, 25);

    hoverTimerRef.current = setTimeout(() => {
      clearTimers();
      setSelectedCard(card);

      // Brief confirmation pause before navigation
      setTimeout(() => {
        if (card === "localsend") {
          onSelectLocalSend();
        } else if (card === "tray" && onSelectTray) {
          onSelectTray();
        }
      }, 350);
    }, DURATION);
  };

  const endDwell = () => {
    if (!selectedCard) {
      setHoveredCard(null);
      clearTimers();
    }
  };

  // Sync with external hover updates (e.g. from Tauri native drag-over events)
  useEffect(() => {
    if (externalHoveredZone) {
      startDwell(externalHoveredZone);
    } else if (currentDwellCardRef.current && !selectedCard) {
      endDwell();
    }
  }, [externalHoveredZone, selectedCard]);

  const handleExplicitClick = (card: "tray" | "localsend") => {
    clearTimers();
    setSelectedCard(card);
    if (card === "localsend") {
      onSelectLocalSend();
    } else if (card === "tray" && onSelectTray) {
      onSelectTray();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="flex items-center justify-center gap-2.5 px-3 py-2 select-none"
    >
      {/* 1. Tray Action Tile */}
      <motion.div
        data-drop-zone="tray"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onMouseEnter={() => startDwell("tray")}
        onMouseLeave={endDwell}
        onClick={() => handleExplicitClick("tray")}
        onDragEnter={(e) => {
          e.preventDefault();
          startDwell("tray");
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (currentDwellCardRef.current !== "tray") startDwell("tray");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            endDwell();
          }
        }}
        className={`relative flex flex-col items-center justify-center gap-1.5 w-24 h-16 rounded-2xl cursor-pointer transition-all border overflow-hidden ${
          selectedCard === "tray"
            ? "bg-purple-600/40 border-purple-400 text-white shadow-xl shadow-purple-500/30 backdrop-blur-md"
            : hoveredCard === "tray"
            ? "bg-white/20 border-white/40 text-white shadow-lg backdrop-blur-sm"
            : "bg-white/10 border-white/10 text-neutral-300 hover:text-white"
        }`}
      >
        {/* Checkmark overlay when selected via 1-2s hover */}
        <AnimatePresence>
          {selectedCard === "tray" ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 bg-purple-600/60 backdrop-blur-md flex flex-col items-center justify-center z-20 pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full bg-white text-purple-600 flex items-center justify-center shadow-lg">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-[10px] font-bold text-white mt-1">Selected</span>
            </motion.div>
          ) : (
            <>
              {/* Hover Progress Fill */}
              {hoveredCard === "tray" && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-purple-400 transition-all duration-75 z-10 pointer-events-none"
                  style={{ width: `${hoverProgress}%` }}
                />
              )}
              <div className="w-6 h-6 rounded-xl bg-white/10 flex items-center justify-center pointer-events-none">
                <Inbox className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide pointer-events-none">Tray</span>
            </>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 2. LocalSend Action Tile */}
      <motion.div
        data-drop-zone="localsend"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onMouseEnter={() => startDwell("localsend")}
        onMouseLeave={endDwell}
        onClick={() => handleExplicitClick("localsend")}
        onDragEnter={(e) => {
          e.preventDefault();
          startDwell("localsend");
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (currentDwellCardRef.current !== "localsend") startDwell("localsend");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            endDwell();
          }
        }}
        className={`relative flex flex-col items-center justify-center gap-1.5 w-24 h-16 rounded-2xl cursor-pointer transition-all border overflow-hidden ${
          selectedCard === "localsend"
            ? "bg-emerald-500/40 border-emerald-400 text-white shadow-xl shadow-emerald-500/30 backdrop-blur-md"
            : hoveredCard === "localsend"
            ? "bg-emerald-500/30 border-emerald-400/60 text-emerald-300 shadow-lg shadow-emerald-500/20 backdrop-blur-sm"
            : "bg-white/10 border-white/10 text-neutral-300 hover:text-white"
        }`}
      >
        {/* Checkmark overlay when selected via 1-2s hover */}
        <AnimatePresence>
          {selectedCard === "localsend" ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 bg-emerald-600/60 backdrop-blur-md flex flex-col items-center justify-center z-20 pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-[10px] font-bold text-white mt-1">Selected</span>
            </motion.div>
          ) : (
            <>
              {/* Hover Progress Fill */}
              {hoveredCard === "localsend" && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-emerald-400 transition-all duration-75 z-10 pointer-events-none"
                  style={{ width: `${hoverProgress}%` }}
                />
              )}
              <div className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center pointer-events-none">
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide pointer-events-none">LocalSend</span>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
