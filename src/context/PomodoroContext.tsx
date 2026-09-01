import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export type PomodoroMode = "focus" | "break";

interface PomodoroContextType {
  mode: PomodoroMode;
  setMode: (mode: PomodoroMode) => void;
  focusMinutes: number;
  breakMinutes: number;
  setMinutes: (minutes: number) => void;
  timeRemaining: number;
  totalDuration: number;
  isRunning: boolean;
  isPaused: boolean;
  soundAlert: boolean;
  toggleSound: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  progress: number; // 1 (full at start) down to 0 (empty at finish)
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

// Web Audio API chime synthesis on timer completion
const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.85);
    });
  } catch {}
};

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<PomodoroMode>("focus");
  const [focusMinutes, setFocusMinutes] = useState<number>(25);
  const [breakMinutes, setBreakMinutes] = useState<number>(5);

  const [timeRemaining, setTimeRemaining] = useState<number>(25 * 60);
  const [totalDuration, setTotalDuration] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundAlert, setSoundAlert] = useState<boolean>(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setMode = (newMode: PomodoroMode) => {
    setModeState(newMode);
    const mins = newMode === "focus" ? focusMinutes : breakMinutes;
    const dur = mins * 60;
    setTotalDuration(dur);
    setTimeRemaining(dur);
    setIsRunning(false);
    setIsPaused(false);
  };

  const setMinutes = (mins: number) => {
    if (mode === "focus") {
      setFocusMinutes(mins);
    } else {
      setBreakMinutes(mins);
    }
    const dur = mins * 60;
    setTotalDuration(dur);
    setTimeRemaining(dur);
    setIsRunning(false);
    setIsPaused(false);
  };

  const startTimer = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseTimer = () => {
    setIsRunning(false);
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    const mins = mode === "focus" ? focusMinutes : breakMinutes;
    const dur = mins * 60;
    setTotalDuration(dur);
    setTimeRemaining(dur);
  };

  const toggleSound = () => {
    setSoundAlert((prev) => !prev);
  };

  // Timer Tick Interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setIsPaused(false);
            if (soundAlert) {
              playChime();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, soundAlert]);

  // Progress percentage: 1.0 at start down to 0.0 at completion
  const progress = totalDuration > 0 ? timeRemaining / totalDuration : 0;

  return (
    <PomodoroContext.Provider
      value={{
        mode,
        setMode,
        focusMinutes,
        breakMinutes,
        setMinutes,
        timeRemaining,
        totalDuration,
        isRunning,
        isPaused,
        soundAlert,
        toggleSound,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        progress,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = () => {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  return ctx;
};
