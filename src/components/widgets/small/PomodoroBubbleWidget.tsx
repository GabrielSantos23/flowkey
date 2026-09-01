import React from "react";
import { usePomodoro } from "../../../context/PomodoroContext";
import { Timer } from "lucide-react";
import { motion } from "framer-motion";

interface PomodoroBubbleWidgetProps {
  onClick?: () => void;
}

export const PomodoroBubbleWidget: React.FC<PomodoroBubbleWidgetProps> = ({ onClick }) => {
  const { isRunning, isPaused, progress } = usePomodoro();

  // Circular progress math (radius = 12, circum = 2 * PI * 12 = 75.398)
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="relative pointer-events-auto w-8 h-8 rounded-full bg-black border border-white/15 flex items-center justify-center shadow-island cursor-pointer flex-shrink-0"
      style={{
        boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
      title="Pomodoro Timer"
    >
      {/* Circular Progress Ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 32 32">
        {/* Background Track */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="2.5"
        />

        {/* Dynamic Progress Stroke (Filled when started, empties as time runs out) */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke={isPaused ? "#f59e0b" : "#ff9f0a"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>

      {/* Center Icon */}
      <div className="relative z-10 flex items-center justify-center">
        <Timer
          className={`w-3.5 h-3.5 ${
            isPaused ? "text-amber-400" : isRunning ? "text-[#ff9f0a]" : "text-white"
          }`}
        />
      </div>
    </motion.button>
  );
};
