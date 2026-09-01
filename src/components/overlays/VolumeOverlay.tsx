import React from "react";
import { Volume2, Volume1, BellOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SizeTransitionBlur } from "../common/SizeTransitionBlur";

interface VolumeOverlayProps {
  volume: number;
  isMuted: boolean;
}

export const VolumeOverlay: React.FC<VolumeOverlayProps> = ({ volume, isMuted }) => {
  const isSilent = isMuted || volume === 0;

  return (
    <div className="flex items-center h-8 select-none w-[260px] overflow-hidden relative">
      <SizeTransitionBlur triggerKey={isSilent} className="w-full">
        <AnimatePresence mode="popLayout" initial={false}>
          {isSilent ? (
            /* MUTE / SILENT MODE (Matches media_1788195366187.png) */
            <motion.div
              key="silent"
              initial={{ opacity: 0, scale: 0.9, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -3 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex items-center justify-between w-full px-2"
            >
              {/* Red Pill Badge with Mute Icon */}
              <motion.div
                layout
                className="bg-[#eb4d4b] px-2.5 py-0.5 rounded-full flex items-center justify-center shadow-sm"
              >
                <BellOff className="w-3.5 h-3.5 text-white" />
              </motion.div>

              {/* Red Silent Text */}
              <motion.span
                layout
                className="text-[#eb4d4b] font-bold text-xs pr-2 tracking-tight"
              >
                Silent
              </motion.span>
            </motion.div>
          ) : (
            /* VOLUME LEVEL SLIDER (Matches media_1788195354711.png) */
            <motion.div
              key="volume"
              initial={{ opacity: 0, scale: 0.9, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -3 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex items-center gap-3.5 w-full px-3.5"
            >
              {/* White Speaker Icon */}
              <div className="flex-shrink-0 text-white">
                {volume > 50 ? (
                  <Volume2 className="w-4 h-4 text-white fill-white stroke-none" />
                ) : (
                  <Volume1 className="w-4 h-4 text-white fill-white stroke-none" />
                )}
              </div>

              {/* Horizontal Smooth Progress Bar */}
              <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={false}
                  animate={{ width: `${Math.min(100, Math.max(0, volume))}%` }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SizeTransitionBlur>
    </div>
  );
};
