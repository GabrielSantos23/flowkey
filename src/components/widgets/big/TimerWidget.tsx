import React, { useState, useEffect } from "react";
import { Play, Square, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { playTimerOverSound } from "../../../utils/sound";

interface TimerWidgetProps {
  onTimerEnd?: () => void;
  onTimeTick?: (remaining: number) => void;
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({ onTimerEnd, onTimeTick }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);

  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playTimerOverSound();
            if (onTimerEnd) onTimerEnd();
            return 0;
          }
          if (onTimeTick) onTimeTick(prev - 1);
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onTimerEnd, onTimeTick]);

  const handleStart = () => {
    if (!isRunning) {
      if (remainingSeconds <= 0) {
        const total = hours * 3600 + minutes * 60 + seconds;
        const initial = total > 0 ? total : 300;
        setRemainingSeconds(initial);
      }
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    const total = hours * 3600 + minutes * 60 + seconds;
    setRemainingSeconds(total > 0 ? total : 300);
    if (onTimeTick) onTimeTick(0);
  };

  const adjustUnit = (unit: "h" | "m" | "s", delta: number) => {
    if (isRunning) return;
    if (unit === "h") {
      setHours((prev) => Math.max(0, Math.min(23, prev + delta)));
    } else if (unit === "m") {
      setMinutes((prev) => Math.max(0, Math.min(59, prev + delta)));
    } else {
      setSeconds((prev) => Math.max(0, Math.min(59, prev + delta)));
    }
  };

  // Sync remaining seconds when adjustments happen outside running
  useEffect(() => {
    if (!isRunning) {
      const total = hours * 3600 + minutes * 60 + seconds;
      setRemainingSeconds(total);
    }
  }, [hours, minutes, seconds, isRunning]);

  const displayH = Math.floor(remainingSeconds / 3600);
  const displayM = Math.floor((remainingSeconds % 3600) / 60);
  const displayS = remainingSeconds % 60;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-island-widget backdrop-blur-md p-4 flex flex-col justify-between border border-white/5 shadow-inner transition-all hover:border-white/10 group min-w-[240px] flex-1 select-none">
      {/* Title */}
      <div className="flex items-center justify-between z-10">
        <span className="text-xs font-semibold text-island-textSecond uppercase tracking-wider">
          Timer
        </span>
        {isRunning && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Running
          </span>
        )}
      </div>

      {/* Digits and Steppers */}
      <div className="flex items-center justify-center gap-2 my-2 z-10">
        {/* Hours */}
        <div className="flex flex-col items-center">
          {!isRunning && (
            <button
              onClick={() => adjustUnit("h", 1)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-2xl font-bold text-island-textMain tracking-tight">
            {String(displayH).padStart(2, "0")}
          </span>
          {!isRunning && (
            <button
              onClick={() => adjustUnit("h", -1)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        <span className="font-mono text-xl font-bold text-island-textThird pb-0.5">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          {!isRunning && (
            <button
              onClick={() => adjustUnit("m", 1)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-2xl font-bold text-island-textMain tracking-tight">
            {String(displayM).padStart(2, "0")}
          </span>
          {!isRunning && (
            <button
              onClick={() => adjustUnit("m", -1)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        <span className="font-mono text-xl font-bold text-island-textThird pb-0.5">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          {!isRunning && (
            <button
              onClick={() => adjustUnit("s", 5)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-2xl font-bold text-island-textMain tracking-tight">
            {String(displayS).padStart(2, "0")}
          </span>
          {!isRunning && (
            <button
              onClick={() => adjustUnit("s", -5)}
              className="p-0.5 text-island-textSecond hover:text-island-textMain active:scale-90"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-3 z-10">
        <button
          onClick={isRunning ? handleStop : handleStart}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-island-primary text-island-secondary font-semibold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md"
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isRunning ? "Pause" : "Start"}</span>
        </button>

        <button
          onClick={handleReset}
          className="p-1.5 rounded-xl text-island-textSecond hover:text-island-textMain hover:bg-white/10 active:scale-90 transition-all"
          title="Reset Timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
