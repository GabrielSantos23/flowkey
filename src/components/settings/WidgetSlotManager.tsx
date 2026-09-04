import React from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  Music,
  Timer,
  Inbox,
  ClipboardList,
  Languages,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/utils";

interface IslandWidgetDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
  colorClass: {
    bg: string;
    text: string;
    border: string;
  };
}

export const DYNAMIC_ISLAND_WIDGETS: IslandWidgetDef[] = [
  {
    id: "spotify",
    title: "Media Player",
    subtitle: "Spotify & System Music",
    description:
      "Full media player with album art, track progress, interactive lyrics, visualizer capsule, and Spotify queue integration.",
    icon: Music,
    tags: ["Audio Visualizer", "Lyrics", "Queue", "Header Tab"],
    colorClass: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
    },
  },
  {
    id: "pomodoro",
    title: "Focus & Pomodoro",
    subtitle: "Productivity Timer",
    description:
      "Focus sessions with custom work and short/long break intervals, circular countdown animation, audio chimes, and dual capsule bubble.",
    icon: Timer,
    tags: ["Work & Breaks", "Dual Bubble", "Sound Alerts", "Header Tab"],
    colorClass: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
    },
  },
  {
    id: "tray",
    title: "File Tray",
    subtitle: "Temporary Drop Shelf",
    description:
      "Quick shelf to drop and hold files, downloads, and attachments with drag-and-drop sharing across desktop applications.",
    icon: Inbox,
    tags: ["Drag & Drop Shelf", "File Downloads", "Header Icon"],
    colorClass: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/20",
    },
  },
  {
    id: "clipboard",
    title: "Clipboard History",
    subtitle: "Copied Snippets & Links",
    description:
      "Real-time clipboard manager that stores copied texts, code snippets, and URLs for quick search, preview, and one-click copying.",
    icon: ClipboardList,
    tags: ["History Storage", "Live Search", "One-Click Copy", "Header Icon"],
    colorClass: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/20",
    },
  },
  {
    id: "translate",
    title: "Tradutor",
    subtitle: "Instant Language Translator",
    description:
      "Real-time multi-language translator supporting Portuguese, English, Spanish, French, and German with copy actions and live usage status.",
    icon: Languages,
    tags: ["DeepL & Google", "5 Languages", "Usage Tracker", "Header Icon"],
    colorClass: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/20",
    },
  },
];

export const WidgetSlotManager: React.FC = () => {
  const { settings, toggleWidget, updateSettings } = useSettings();

  const enabledWidgets =
    settings.enabled_widgets && settings.enabled_widgets.length > 0
      ? settings.enabled_widgets
      : ["spotify", "pomodoro", "tray", "clipboard", "translate"];

  const handleEnableAll = () => {
    updateSettings({
      enabled_widgets: DYNAMIC_ISLAND_WIDGETS.map((w) => w.id),
    });
  };

  const allEnabled = enabledWidgets.length === DYNAMIC_ISLAND_WIDGETS.length;

  return (
    <div className="space-y-4">
      {/* Top Summary Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-500/50" />
          <span className="text-xs font-semibold text-foreground">
            {enabledWidgets.length} of {DYNAMIC_ISLAND_WIDGETS.length} Dynamic Island widgets active
          </span>
        </div>

        {!allEnabled && (
          <button
            type="button"
            onClick={handleEnableAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary hover:text-primary-foreground hover:bg-primary/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enable all</span>
          </button>
        )}
      </div>

      {/* Widget List */}
      <div className="space-y-2">
        {DYNAMIC_ISLAND_WIDGETS.map((widget) => {
          const isEnabled = enabledWidgets.includes(widget.id);
          const isOnlyOneActive = isEnabled && enabledWidgets.length <= 1;
          const Icon = widget.icon;

          return (
            <div
              key={widget.id}
              onClick={() => {
                if (!isOnlyOneActive) {
                  toggleWidget(widget.id);
                }
              }}
              className={cn(
                "flex items-start justify-between p-3.5 rounded-xl border transition-all cursor-pointer group",
                isEnabled
                  ? "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.14]"
                  : "bg-white/[0.01] border-white/[0.03] opacity-60 hover:opacity-80",
              )}
            >
              {/* Left: Icon & Info */}
              <div className="flex items-start gap-3.5 min-w-0 pr-4">
                <div
                  className={cn(
                    "size-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                    widget.colorClass.bg,
                    widget.colorClass.border,
                    widget.colorClass.text,
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground tracking-tight">
                      {widget.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 font-mono">
                      · {widget.subtitle}
                    </span>
                    {isEnabled && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400/90 ml-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-2">
                    {widget.description}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {widget.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-muted-foreground border border-white/[0.04]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Switch */}
              <div
                className="pt-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
                title={
                  isOnlyOneActive
                    ? "At least one widget must remain active in the Dynamic Island"
                    : isEnabled
                    ? `Disable ${widget.title}`
                    : `Enable ${widget.title}`
                }
              >
                <Switch
                  checked={isEnabled}
                  disabled={isOnlyOneActive}
                  onCheckedChange={() => toggleWidget(widget.id)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Helper Note */}
      <div className="pt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
        <p>
          Changes update in real time. Disabled widgets are hidden from the island header, excluded from scroll-wheel rotation, and will not take over the collapsed pill.
        </p>
      </div>
    </div>
  );
};
