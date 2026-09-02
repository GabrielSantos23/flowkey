import React from "react";
import { motion } from "framer-motion";

interface SmallVisualizerWidgetProps {
  isPlaying?: boolean;
}

export const SmallVisualizerWidget: React.FC<SmallVisualizerWidgetProps> = ({ isPlaying = false }) => {
  const bars = [0.4, 0.9, 0.6, 1.0, 0.5];

  return (
    <div className="flex items-end justify-center gap-0.5 h-3.5 px-1 py-0.5">
      {bars.map((heightMultiplier, i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full bg-primary"
          animate={
            isPlaying
              ? {
                  height: [
                    `${Math.max(2, 12 * heightMultiplier * 0.3)}px`,
                    `${Math.max(4, 12 * heightMultiplier)}px`,
                    `${Math.max(2, 12 * heightMultiplier * 0.5)}px`,
                  ],
                }
              : { height: "2px" }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.6 + (i % 3) * 0.15,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
};
