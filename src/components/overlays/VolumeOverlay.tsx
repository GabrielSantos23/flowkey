import React from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import BlurText from "../common/BlurText";

interface VolumeOverlayProps {
  volume: number;
  isMuted: boolean;
}

export const VolumeOverlay: React.FC<VolumeOverlayProps> = ({ volume, isMuted }) => {
  const isSilent = isMuted || volume === 0;
  const digits = (isSilent ? "0" : String(volume)).split("");

  return (
    <div className="flex items-center justify-between h-8 select-none w-[280px] px-3.5 relative">
      {/* Left: Speaker Icon + "Volume" text */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isSilent ? (
          <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
        ) : volume > 50 ? (
          <Volume2 className="w-3.5 h-3.5 text-white fill-white stroke-none" />
        ) : (
          <Volume1 className="w-3.5 h-3.5 text-white fill-white stroke-none" />
        )}
        <span className="text-xs font-bold text-white tracking-tight">
          {isSilent ? "Muted" : "Volume"}
        </span>
      </div>

      {/* Right: Green Progress Pill Bar + Volume Number with per-digit BlurText */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Deep Green Track Pill Container */}
        <div className="w-[84px] h-[7px] bg-[#092b10] rounded-full overflow-hidden p-[0.5px]">
          <motion.div
            className="h-full bg-[#00E640] rounded-full"
            initial={false}
            animate={{ width: isSilent ? "0%" : `${Math.min(100, Math.max(0, volume))}%` }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
          />
        </div>

        {/* Dynamic Number: ONLY the digits that changed will blur & animate */}
        <div className="min-w-[24px] flex items-center justify-end font-mono tabular-nums">
          {digits.map((digit, idx) => (
            <div key={idx} className="w-[7.5px] flex items-center justify-center">
              <BlurText
                key={`digit-${idx}-${digit}`}
                text={digit}
                className="text-xs font-bold text-white tracking-tight justify-center"
                delay={0}
                stepDuration={0.12}
                direction="top"
                animateBy="letters"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VolumeOverlay;

