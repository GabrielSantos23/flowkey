import React, {
  useRef,
  useCallback,
} from "react";
import { usePomodoro } from "../../../context/PomodoroContext";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { SizeTransitionBlur } from "../../common/SizeTransitionBlur";
import BlurText from "@/components/common/BlurText";
const MIN_MINUTES = 1;
const MAX_MINUTES = 120;
const PX_PER_MINUTE = 10;
const VISIBLE_RANGE = 40;

const AnimatedTime: React.FC<{
  timeRemaining: number;
  accent: string;
}> = ({ timeRemaining, accent }) => {
  const formatTimeParts = (secs: number) => {
    if (!Number.isFinite(secs)) {
      return ["0", "0", ":", "0", "0"];
    }

    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);

    const minutesString = String(minutes).padStart(2, "0");
    const secondsString = String(seconds).padStart(2, "0");

    return [
      ...minutesString.split(""),
      ":",
      ...secondsString.split(""),
    ];
  };

  const parts = formatTimeParts(timeRemaining);

  return (
    <div
      className="
        text-2xl
        font-mono
        font-black
        tracking-tight
        leading-none
        tabular-nums
        flex
        items-center
      "
      style={{ color: accent }}
    >
      {parts.map((char, index) => {
        if (char === ":") {
          return (
            <span key={`colon-${index}`}>
              :
            </span>
          );
        }

        return (
          <BlurText
            key={`${index}-${char}`}
            text={char}
            animateBy="letters"
            delay={0}
            stepDuration={0.12}
            animationFrom={{
              filter: "blur(4px)",
              opacity: 0,
              y: -6,
            }}
            animationTo={[
              {
                filter: "blur(1.5px)",
                opacity: 0.7,
                y: -1,
              },
              {
                filter: "blur(0px)",
                opacity: 1,
                y: 0,
              },
            ]}
            className="inline-block"
          />
        );
      })}
    </div>
  );
};

export const PomodoroExpandedWidget: React.FC = () => {
  const {
    mode,
    setMode,
    focusMinutes,
    breakMinutes,
    setMinutes,
    timeRemaining,
    isRunning,
    isPaused,
    soundAlert,
    toggleSound,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = usePomodoro();

  const currentMinutes = mode === "focus" ? focusMinutes : breakMinutes;

  const rulerRef = useRef<HTMLDivElement>(null);

  const dragState = useRef<{
    startX: number;
    startMinutes: number;
  } | null>(null);

  const accent = mode === "focus" ? "#ff9f0a" : "#3fa9f5";

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const clamp = (value: number) =>
    Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, value));

  // --------------------------------------------------
  // Drag / Pointer
  // --------------------------------------------------

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isRunning) return;

      dragState.current = {
        startX: e.clientX,
        startMinutes: currentMinutes,
      };

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isRunning, currentMinutes]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current || isRunning) return;

      const deltaX =
        e.clientX - dragState.current.startX;

      const deltaMinutes =
        deltaX / PX_PER_MINUTE;

      const nextMinutes = clamp(
        Math.round(
          dragState.current.startMinutes -
            deltaMinutes
        )
      );

      setMinutes(nextMinutes);
    },
    [isRunning, setMinutes]
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  // --------------------------------------------------
  // Mouse wheel / Trackpad
  // --------------------------------------------------

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (isRunning) return;

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY;

      if (delta === 0) return;

      e.preventDefault();

      setMinutes(clamp(Math.round(currentMinutes + delta / 30)));
    },
    [isRunning, setMinutes, currentMinutes]
  );

  // --------------------------------------------------
  // Generate ticks
  // --------------------------------------------------

  const ticks = [];

  for (
    let i = -VISIBLE_RANGE;
    i <= VISIBLE_RANGE;
    i++
  ) {
    const value = currentMinutes + i;

    if (
      value < MIN_MINUTES ||
      value > MAX_MINUTES
    ) {
      continue;
    }

    ticks.push({
      value,
      offset: i,
    });
  }



  return (
    <SizeTransitionBlur triggerKey={mode} className="w-full">
      <div
        className="
          w-full
          flex
          flex-col
          justify-between
          p-4
          bg-transparent
          text-white
          select-none
          gap-3
        "
        style={
          {
            "--accent": accent,
          } as React.CSSProperties
        }
      >
      {/* -------------------------------------------- */}
      {/* Focus / Break */}
      {/* -------------------------------------------- */}

      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-black/60 border border-white/10">
          <button
            onClick={() => setMode("focus")}
            disabled={isRunning}
            className={`
              px-4
              py-1
              rounded-full
              text-xs
              font-bold
              transition-all
              ${
                mode === "focus"
                  ? "bg-[#ff9f0a]/25 text-[#ff9f0a] border border-[#ff9f0a]/40 shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }
              ${
                isRunning
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }
            `}
          >
            Focus
          </button>

          <button
            onClick={() => setMode("break")}
            disabled={isRunning}
            className={`
              px-4
              py-1
              rounded-full
              text-xs
              font-bold
              transition-all
              ${
                mode === "break"
                  ? "bg-[#3fa9f5]/25 text-[#3fa9f5] border border-[#3fa9f5]/40 shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }
              ${
                isRunning
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }
            `}
          >
            Break
          </button>
        </div>
      </div>



      <div className="flex flex-col items-center justify-center my-1 relative">
        <div
          ref={rulerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={`
            relative
            w-full
            h-20
            overflow-hidden
            touch-none
            ${
              isRunning
                ? "cursor-default"
                : "cursor-grab active:cursor-grabbing"
            }
          `}
          >
            <div
              className="
                absolute
                left-0
                top-0
                bottom-0
                w-12
                z-20
                pointer-events-none
                bg-gradient-to-r
                from-[#000000]
                via-[#000000]/70
                to-transparent
              "
            />

            {/* Right fade */}
            <div
              className="
                absolute
                right-0
                top-0
                bottom-0
                w-12
                z-20
                pointer-events-none
                bg-gradient-to-l
                from-[#000000]
                via-[#000000]/70
                to-transparent
              "
            />
          {/* Center active tick */}
          <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none">
            <div
              className="w-[2px] h-4 rounded-full bg-white"
              style={{
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
          </div>

          {/* Ticks */}
          <div className="absolute inset-x-0 top-8 h-8">
            {ticks.map((tick) => {
              const isMajor =
                tick.value % 5 === 0;

              const isActive =
                tick.offset === 0;

              return (
                <div
                  key={tick.value}
                  className="
                    absolute
                    flex
                    flex-col
                    items-center
                    -translate-x-1/2
                    pointer-events-none
                  "
                  style={{
                    left: `calc(50% + ${
                      tick.offset *
                      PX_PER_MINUTE
                    }px)`,
                  }}
                >
                  {/* Number only every 5 minutes */}
                  {isMajor && (
                    <span
                      className={`
                        text-[11px]
                        mb-1
                        tabular-nums
                        font-mono
                        transition-all
                        ${
                          isActive
                            ? "text-white font-bold scale-110"
                            : "text-white/25"
                        }
                      `}
                    >
                      {tick.value}
                    </span>
                  )}

                  {/* Tick */}
                  <div
                    className={`
                      rounded-full
                      transition-all
                      ${
                        isActive
                          ? "w-[2px] h-3 bg-white"
                          : isMajor
                          ? "w-px h-3 bg-white/30"
                          : "w-px h-1.5 bg-white/15"
                      }
                    `}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom pointer */}
          <div className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none">
            <div
              className="w-0 h-0"
              style={{
                borderLeft:
                  "5px solid transparent",
                borderRight:
                  "5px solid transparent",
                borderBottom: `7px solid ${accent}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* -------------------------------------------- */}
      {/* Bottom Controls */}
      {/* -------------------------------------------- */}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Start */}
          {!isRunning && !isPaused && (
            <button
              onClick={startTimer}
              className="
                px-4
                py-1.5
                rounded-full
                text-xs
                font-bold
                transition-all
                shadow-sm
                active:scale-95
              "
              style={{
                backgroundColor: `${accent}33`,
                border: `1px solid ${accent}66`,
                color: accent,
              }}
            >
              Start Timer
            </button>
          )}

          {/* Pause */}
          {isRunning && (
            <button
              onClick={pauseTimer}
              className="
                px-4
                py-1.5
                rounded-full
                bg-amber-500/20
                border
                border-amber-500/40
                text-amber-300
                hover:bg-amber-500/30
                active:scale-95
                text-xs
                font-bold
                transition-all
              "
            >
              Pause
            </button>
          )}

          {/* Resume */}
          {isPaused && (
            <button
              onClick={resumeTimer}
              className="
                px-4
                py-1.5
                rounded-full
                text-xs
                font-bold
                transition-all
                active:scale-95
              "
              style={{
                backgroundColor: `${accent}33`,
                border: `1px solid ${accent}66`,
                color: accent,
              }}
            >
              Resume
            </button>
          )}

          {/* Sound */}
          <button
            onClick={toggleSound}
            className={`
              w-8
              h-8
              rounded-full
              flex
              items-center
              justify-center
              transition-all
              active:scale-95
              ${
                soundAlert
                  ? "bg-white/15 text-white hover:bg-white/20"
                  : "bg-white/5 text-neutral-500 hover:text-white"
              }
            `}
            title={
              soundAlert
                ? "Chime Enabled"
                : "Muted"
            }
          >
            {soundAlert ? (
              <Volume2 className="w-3.5 h-3.5 text-white" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>

          {/* Reset */}
          {(isRunning ||
            isPaused ||
            timeRemaining <
              currentMinutes * 60) && (
            <button
              onClick={resetTimer}
              className="
                w-8
                h-8
                rounded-full
                bg-white/10
                hover:bg-white/20
                text-neutral-300
                hover:text-white
                flex
                items-center
                justify-center
                transition-all
                active:scale-95
              "
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <AnimatedTime
          timeRemaining={timeRemaining}
          accent={accent}
        />
      </div>
    </div>
  </SizeTransitionBlur>
  );
};
