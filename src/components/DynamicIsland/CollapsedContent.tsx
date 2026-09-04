import React from "react";
import { Music, Timer as PomodoroIcon, Inbox, ClipboardList, Languages } from "lucide-react";
import { MediaStats, ViewMode } from "@/types";
import { MinimalClockCapsule } from "../widgets/small/MinimalClockCapsule";
import { SizeTransitionBlur } from "@/components/common/SizeTransitionBlur";
import { useSettings } from "@/context/SettingsContext";

interface CollapsedContentProps {
  isDualActive: boolean;
  media: MediaStats;
  isPomodoroActive: boolean;
  pomodoroMode: string;
  pomodoroTimeRemaining: number;
  viewMode?: ViewMode;
  showIdleClock?: boolean;
  isWheelPreviewing?: boolean;
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
  isWheelPreviewing = false,
}) => {
  const { settings } = useSettings();
  const enabledWidgets =
    settings.enabled_widgets && settings.enabled_widgets.length > 0
      ? settings.enabled_widgets
      : ["spotify", "pomodoro", "tray", "clipboard", "translate"];

  const isSpotifyEnabled = enabledWidgets.includes("spotify");
  const isPomodoroEnabled = enabledWidgets.includes("pomodoro");
  const isTrayEnabled = enabledWidgets.includes("tray");
  const isClipboardEnabled = enabledWidgets.includes("clipboard");
  const isTranslateEnabled = enabledWidgets.includes("translate");

  const renderSpotifyCapsule = () => (
    <div className="flex items-center justify-between w-full">
      <div className="w-5 h-5 rounded-md bg-card border border-border overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
        {media.art_url ? (
          <img src={media.art_url} alt={media.title} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
        ) : (
          <Music className="w-3 h-3 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-[2.5px] h-3.5 px-0.5">
        <span
          className={`w-[2.5px] bg-white rounded-full transition-all ${
            media.is_playing && !settings.disable_wave_animation
              ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5"
              : media.is_playing
              ? "h-2 opacity-80"
              : "h-1 opacity-40"
          }`}
        />
        <span
          className={`w-[2.5px] bg-white rounded-full transition-all ${
            media.is_playing && !settings.disable_wave_animation
              ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-3.5"
              : media.is_playing
              ? "h-3 opacity-80"
              : "h-1.5 opacity-40"
          }`}
        />
        <span
          className={`w-[2.5px] bg-white rounded-full transition-all ${
            media.is_playing && !settings.disable_wave_animation
              ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-2"
              : media.is_playing
              ? "h-2 opacity-80"
              : "h-1 opacity-40"
          }`}
        />
      </div>
    </div>
  );

  const renderPomodoroCapsule = () => (
    <div className="flex items-center justify-between w-full gap-2">
      <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
        <PomodoroIcon className="w-3 h-3 text-accent-foreground" />
      </div>
      <span className="text-[11px] font-semibold text-foreground capitalize truncate">{pomodoroMode}</span>
      <span className="text-xs font-mono font-bold text-accent-foreground shrink-0">{formatTime(pomodoroTimeRemaining)}</span>
    </div>
  );

  const renderInner = () => {
    if (isDualActive && isSpotifyEnabled && isPomodoroEnabled) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="w-5 h-5 rounded-md bg-card border border-border overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
            {media.art_url ? (
              <img src={media.art_url} alt={media.title} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
            ) : (
              <Music className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-[2.5px] h-3.5 px-0.5">
            <span
              className={`w-[2.5px] bg-white rounded-full transition-all ${
                media.is_playing && !settings.disable_wave_animation
                  ? "animate-[bounce_0.75s_infinite_ease-in-out] h-2.5"
                  : media.is_playing
                  ? "h-2 opacity-80"
                  : "h-1 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-white rounded-full transition-all ${
                media.is_playing && !settings.disable_wave_animation
                  ? "animate-[bounce_0.6s_infinite_ease-in-out_0.15s] h-3.5"
                  : media.is_playing
                  ? "h-3 opacity-80"
                  : "h-1.5 opacity-40"
              }`}
            />
            <span
              className={`w-[2.5px] bg-white rounded-full transition-all ${
                media.is_playing && !settings.disable_wave_animation
                  ? "animate-[bounce_0.85s_infinite_ease-in-out_0.3s] h-2"
                  : media.is_playing
                  ? "h-2 opacity-80"
                  : "h-1 opacity-40"
              }`}
            />
          </div>
        </div>
      );
    }

    if (!isWheelPreviewing) {
      if (media.is_playing && isSpotifyEnabled) {
        return renderSpotifyCapsule();
      }
      if (isPomodoroActive && isPomodoroEnabled) {
        return renderPomodoroCapsule();
      }
      return <MinimalClockCapsule />;
    }

    if (viewMode === "tray" && isTrayEnabled) {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-foreground px-1">
          <Inbox className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold tracking-tight">File Tray</span>
        </div>
      );
    }

    if (viewMode === "clipboard" && isClipboardEnabled) {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-foreground px-1">
          <ClipboardList className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold tracking-tight">Clipboard</span>
        </div>
      );
    }

    if (viewMode === "translate" && isTranslateEnabled) {
      return (
        <div className="flex items-center justify-center gap-1.5 w-full text-foreground px-1">
          <Languages className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold tracking-tight">Translate</span>
        </div>
      );
    }

    if ((viewMode === "pomodoro" || isPomodoroActive) && isPomodoroEnabled) {
      return renderPomodoroCapsule();
    }

    if ((viewMode === "spotify" || media.is_playing) && isSpotifyEnabled) {
      return renderSpotifyCapsule();
    }

    return <MinimalClockCapsule />;
  };

  return (
    <SizeTransitionBlur
      triggerKey={`${viewMode}-${showIdleClock}-${isDualActive}-${media.is_playing}-${isPomodoroActive}-${isWheelPreviewing}-${enabledWidgets.join(",")}`}
      maxBlur={7}
      duration={0.2}
      className="w-full h-full flex items-center justify-center"
    >
      {renderInner()}
    </SizeTransitionBlur>
  );
};
