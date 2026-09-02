import React from "react";
import { Timer } from "lucide-react";

interface ActiveTimerWidgetProps {
  remainingSeconds?: number;
}

export const ActiveTimerWidget: React.FC<ActiveTimerWidgetProps> = ({ remainingSeconds = 0 }) => {
  if (remainingSeconds <= 0) return null;

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formatted =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-primary font-mono font-semibold bg-primary/10 rounded-full border border-primary/20 animate-pulse">
      <Timer className="w-3.5 h-3.5" />
      <span>{formatted}</span>
    </div>
  );
};
