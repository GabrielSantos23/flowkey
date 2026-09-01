import React from "react";
import { Sun } from "lucide-react";
import { motion } from "framer-motion";

interface BrightnessOverlayProps {
  brightness: number;
}

export const BrightnessOverlay: React.FC<BrightnessOverlayProps> = ({ brightness }) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: -10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: -10 }}
      className="flex items-center gap-3 px-4 py-2.5 w-full select-none"
    >
      <div className="p-1.5 rounded-full bg-white/10 flex-shrink-0">
        <Sun className="w-4 h-4 text-amber-400" />
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-island-textMain">Brightness</span>
          <span className="font-mono text-[11px] text-island-textSecond font-semibold">
            {brightness}%
          </span>
        </div>

        <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-amber-400"
            initial={false}
            animate={{ width: `${brightness}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        </div>
      </div>
    </motion.div>
  );
};
