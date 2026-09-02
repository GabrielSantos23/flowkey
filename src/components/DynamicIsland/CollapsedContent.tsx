import React from "react";
import { Music, Timer as PomodoroIcon, Inbox, ClipboardList, Languages } from "lucide-react";
import { MediaStats, ViewMode } from "@/types";
import { MinimalClockCapsule } from "../widgets/small/MinimalClockCapsule";
import { SizeTransitionBlur } from "@/components/common/SizeTransitionBlur";

interface CollapsedContentProps {
  isDualActive: boolean;
  media: MediaStats;
  isPomodoroActive: boolean;
  pomodoroMode: string;
  pomodoroTimeRemaining: number;
  viewMode?: ViewMode;
  showIdleClock?: boolean;
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const CollapsedContent: React.FC<CollapsedContentProps> = ({
  isDualActive,
  media,
  isPomodoroActive,
  pomodoroMode,
  pomodoroTimeRemaining,
  viewMode = "spotify",
  showIdleClock = false,
}) => {
  const renderInner = () => {
    if (isDualActive) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="w-5 h-5 rounded-md bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
            {media.art_url ? (
              <img src={media.art_url} alt={media.title} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
            ) : (
              <Music className="w-3 h-3 text-white/50" />
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-[2.5px] h-3.5 px-0.5">
            <span
              className={`w-[2.5px] bg-gradient-to-t from-purple-500 to-orange-400 rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5" : "h-1 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-gradient-to-t from-purple-500 to-orange-400 rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-3.5" : "h-1.5 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-gradient-to-t from-purple-500 to-orange-400 rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-2" : "h-1 opacity-40"
              }`}
            />
          </div>
        </div>
      );
    }

    if (showIdleClock && !media.is_playing && !isPomodoroActive) {
      return <MinimalClockCapsule />;
    }

    if (viewMode === "tray") {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-neutral-300 px-1">
          <Inbox className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold tracking-tight">File Tray</span>
        </div>
      );
    }

    if (viewMode === "clipboard") {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-neutral-300 px-1">
          <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold tracking-tight">Clipboard</span>
        </div>
      );
    }

    if (viewMode === "translate") {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-neutral-300 px-1">
          <Languages className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold tracking-tight">Translate</span>
        </div>
      );
    }

    if (viewMode === "pomodoro" || isPomodoroActive) {
      return (
        <div className="flex items-center justify-between w-full gap-2">
          <div className="w-5 h-5 rounded-full bg-[#ff9f0a]/20 border border-[#ff9f0a]/40 flex items-center justify-center flex-shrink-0">
            <PomodoroIcon className="w-3 h-3 text-[#ff9f0a]" />
          </div>
          <span className="text-[11px] font-semibold text-neutral-300 capitalize truncate">{pomodoroMode}</span>
          <span className="text-xs font-mono font-bold text-[#ff9f0a] flex-shrink-0">{formatTime(pomodoroTimeRemaining)}</span>
        </div>
      );
    }

    if (media.is_playing || viewMode === "spotify") {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="w-5 h-5 rounded-md bg-neutral-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
            {media.art_url ? (
              <img src={media.art_url} alt={media.title} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
            ) : (
              <Music className="w-3 h-3 text-white/50" />
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-[2.5px] h-3.5 px-0.5">
            <span
              className={`w-[2.5px] bg-[#d8c3a5] rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5" : "h-1 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-[#d8c3a5] rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-3.5" : "h-1.5 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-[#d8c3a5] rounded-full transition-all ${
                media.is_playing ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-2" : "h-1 opacity-40"
              }`}
            />
          </div>
        </div>
      );
    }

    return <MinimalClockCapsule />;
  };

  return (
    <SizeTransitionBlur
      triggerKey={`${viewMode}-${showIdleClock}-${isDualActive}-${media.is_playing}-${isPomodoroActive}`}
      maxBlur={7}
      duration={0.2}
      className="w-full h-full flex items-center justify-center"
    >
      {renderInner()}
    </SizeTransitionBlur>
  );
};
