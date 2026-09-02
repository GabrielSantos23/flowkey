import React from "react";
import { BellRing, X } from "lucide-react";
import { motion } from "framer-motion";

interface TimerOverOverlayProps {
  onDismiss: () => void;
}

export const TimerOverOverlay: React.FC<TimerOverOverlayProps> = ({ onDismiss }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: [1, 1.05, 1], opacity: 1 }}
      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
      className="relative flex items-center justify-between gap-4 px-6 py-3 w-full select-none"
    >
      {/* Pulsing Alert Waves */}
      <div className="absolute inset-0 rounded-full border-2 border-destructive/40 animate-ping pointer-events-none" />

      <div className="flex items-center gap-3 z-10">
        <div className="p-2 rounded-full bg-destructive/20 text-destructive">
          <BellRing className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground tracking-tight">Timer Completed!</h4>
          <p className="text-[11px] text-muted-foreground">Your countdown has elapsed</p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 transition-all z-10"
        title="Dismiss Alert"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
