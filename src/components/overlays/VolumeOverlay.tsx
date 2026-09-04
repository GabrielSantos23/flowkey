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
    <div className="flex items-center justify-between h-8 select-none w-70 px-3.5 relative">
      <div className="flex items-center gap-1.5 shrink-0">
        {isSilent ? (
          <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
        ) : volume > 50 ? (
          <Volume2 className="w-3.5 h-3.5 text-foreground fill-foreground stroke-none" />
        ) : (
          <Volume1 className="w-3.5 h-3.5 text-foreground fill-foreground stroke-none" />
        )}
        <span className="text-xs font-bold text-foreground tracking-tight">
          {isSilent ? "Muted" : "Volume"}
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-21 h-1.75 bg-muted rounded-full overflow-hidden p-[0.5px]">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            initial={false}
            animate={{ width: isSilent ? "0%" : `${Math.min(100, Math.max(0, volume))}%` }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
          />
        </div>

        <div className="min-w-6 flex items-center justify-end font-mono tabular-nums">
          {digits.map((digit, idx) => (
            <div key={idx} className="w-[7.5px] flex items-center justify-center">
              <BlurText
                key={`digit-${idx}-${digit}`}
                text={digit}
                className="text-xs font-bold text-foreground tracking-tight justify-center"
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
