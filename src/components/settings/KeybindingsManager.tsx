import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  Search,
  RotateCcw,
  AlertTriangle,
  X,
  Music,
  Timer,
  Inbox,
  ClipboardList,
  Languages,
  Maximize2,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface KeybindingDef {
  id: string;
  key: keyof import("../../types").AppSettings;
  title: string;
  category: "Dynamic Island" | "Spotify";
  when: string;
  description: string;
  defaultKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const KEYBINDINGS_CONFIG: KeybindingDef[] = [
  {
    id: "toggle_island",
    key: "toggle_island_hotkey",
    title: "Dynamic Island: Toggle",
    category: "Dynamic Island",
    when: "Always",
    description: "Expand or collapse the Dynamic Island from anywhere in Windows.",
    defaultKey: "Ctrl+Space",
    icon: Maximize2,
  },
  {
    id: "open_spotify",
    key: "open_spotify_hotkey",
    title: "Dynamic Island: Open Media Player",
    category: "Dynamic Island",
    when: "Always",
    description: "Open the Dynamic Island directly into the Media Player & lyrics.",
    defaultKey: "",
    icon: Music,
  },
  {
    id: "open_pomodoro",
    key: "open_pomodoro_hotkey",
    title: "Dynamic Island: Open Focus & Pomodoro",
    category: "Dynamic Island",
    when: "Always",
    description: "Open the Dynamic Island directly into Focus & Pomodoro timer.",
    defaultKey: "",
    icon: Timer,
  },
  {
    id: "open_tray",
    key: "open_tray_hotkey",
    title: "Dynamic Island: Open File Tray",
    category: "Dynamic Island",
    when: "Always",
    description: "Open the Dynamic Island directly into the temporary File Tray shelf.",
    defaultKey: "",
    icon: Inbox,
  },
  {
    id: "open_clipboard",
    key: "open_clipboard_hotkey",
    title: "Dynamic Island: Open Clipboard History",
    category: "Dynamic Island",
    when: "Always",
    description: "Open the Dynamic Island directly into the Clipboard History list.",
    defaultKey: "",
    icon: ClipboardList,
  },
  {
    id: "open_translate",
    key: "open_translate_hotkey",
    title: "Dynamic Island: Open Tradutor",
    category: "Dynamic Island",
    when: "Always",
    description: "Open the Dynamic Island directly into the Tradutor language translator.",
    defaultKey: "",
    icon: Languages,
  },
  {
    id: "spotify_search",
    key: "spotify_search_hotkey",
    title: "Spotify: Quick Search",
    category: "Spotify",
    when: "Always",
    description: "Open the floating quick search bar to find and play tracks instantly.",
    defaultKey: "Alt+F",
    icon: Search,
  },
];

const renderKeyPills = (hotkey: string) => {
  if (!hotkey) {
    return (
      <span className="text-xs text-muted-foreground/40 italic font-mono">
        Not bound
      </span>
    );
  }

  const parts = hotkey.split("+").map((p) => p.trim());

  return (
    <div className="flex items-center gap-1 font-mono">
      {parts.map((part, index) => {
        let display = part;
        if (part === "Super") display = "Win";
        if (part === "ArrowUp") display = "↑";
        if (part === "ArrowDown") display = "↓";
        if (part === "ArrowLeft") display = "←";
        if (part === "ArrowRight") display = "→";

        return (
          <kbd
            key={index}
            className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-white/[0.08] border border-white/[0.12] text-foreground shadow-sm select-none"
          >
            {display}
          </kbd>
        );
      })}
    </div>
  );
};

export const KeybindingsManager: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map of normalized shortcuts to detect conflicts
  const conflictsMap = useMemo(() => {
    const map = new Map<string, string[]>();

    KEYBINDINGS_CONFIG.forEach((cfg) => {
      const val = (settings[cfg.key] as string)?.trim().toLowerCase().replace(/\s+/g, "");
      if (val) {
        const existing = map.get(val) || [];
        existing.push(cfg.id);
        map.set(val, existing);
      }
    });

    return map;
  }, [settings]);

  const filteredBindings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return KEYBINDINGS_CONFIG;

    return KEYBINDINGS_CONFIG.filter((cfg) => {
      const titleMatch = cfg.title.toLowerCase().includes(q);
      const descMatch = cfg.description.toLowerCase().includes(q);
      const currentVal = ((settings[cfg.key] as string) || "").toLowerCase();
      const valMatch = currentVal.includes(q);
      return titleMatch || descMatch || valMatch;
    });
  }, [searchQuery, settings]);

  const handleResetDefaults = () => {
    const patch: Record<string, string> = {};
    KEYBINDINGS_CONFIG.forEach((cfg) => {
      patch[cfg.key] = cfg.defaultKey;
    });
    updateSettings(patch);
  };

  const handleClear = (key: keyof import("../../types").AppSettings, e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateSettings({ [key]: "" });
    if (recordingId) setRecordingId(null);
  };

  // Keyboard listener when recording
  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingId(null);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        const targetCfg = KEYBINDINGS_CONFIG.find((c) => c.id === recordingId);
        if (targetCfg) {
          updateSettings({ [targetCfg.key]: "" });
        }
        setRecordingId(null);
        return;
      }

      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Super");

      let keyName = e.key.toUpperCase();
      if (keyName === " ") keyName = "Space";
      if (e.code.startsWith("Digit")) keyName = e.code.replace("Digit", "");
      if (e.code.startsWith("Key")) keyName = e.code.replace("Key", "");

      parts.push(keyName);

      const combo = parts.join("+");
      const targetCfg = KEYBINDINGS_CONFIG.find((c) => c.id === recordingId);
      if (targetCfg) {
        updateSettings({ [targetCfg.key]: combo });
      }

      setRecordingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [recordingId, updateSettings]);

  // Click outside to cancel recording
  useEffect(() => {
    if (!recordingId) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setRecordingId(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [recordingId]);

  return (
    <div className="space-y-4 select-none" ref={containerRef}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.04]">
        {/* Search Bar */}
        <div className="flex-1 max-w-sm flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-muted-foreground focus-within:border-primary/50 focus-within:bg-white/[0.06] focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keybindings..."
            className="w-full bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Info and Actions */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground/70">
            {filteredBindings.length} {filteredBindings.length === 1 ? "binding" : "bindings"}
          </span>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all cursor-pointer"
            title="Reset all keybindings to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset defaults</span>
          </button>
        </div>
      </div>

      {/* Keybindings List */}
      <div className="space-y-1">
        {filteredBindings.map((cfg) => {
          const rawVal = (settings[cfg.key] as string) || "";
          const isRecording = recordingId === cfg.id;
          const normalizedVal = rawVal.trim().toLowerCase().replace(/\s+/g, "");
          const hasConflict =
            Boolean(normalizedVal) &&
            (conflictsMap.get(normalizedVal)?.length || 0) > 1;

          const Icon = cfg.icon;

          return (
            <div
              key={cfg.id}
              onClick={() => {
                setRecordingId(cfg.id);
              }}
              className={cn(
                "flex items-center justify-between py-2.5 px-3 rounded-xl border transition-all cursor-pointer group",
                isRecording
                  ? "bg-primary/[0.08] border-primary/40 ring-1 ring-primary/30"
                  : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]",
              )}
            >
              {/* Left Column: Command & Scope */}
              <div className="flex items-start gap-3 min-w-0 pr-4">
                <div className="size-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground tracking-tight">
                      {cfg.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-mono">
                    <span>When</span>
                    <span className="text-muted-foreground/90 font-sans font-medium hover:text-foreground">
                      {cfg.when}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-muted-foreground/60 font-sans truncate">
                      {cfg.description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Conflict Warning + Key Pills / Recording */}
              <div className="flex items-center gap-2 shrink-0">
                {hasConflict && !isRecording && (
                  <div
                    className="flex items-center text-amber-400 gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium"
                    title="Duplicate keybinding conflict with another shortcut"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Conflict</span>
                  </div>
                )}

                {isRecording ? (
                  <div className="flex items-center gap-1.5 animate-pulse">
                    <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-primary/20 border border-primary/50 text-primary shadow-sm">
                      Press keys...
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      Esc to cancel
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="group-hover:opacity-100 transition-opacity">
                      {renderKeyPills(rawVal)}
                    </div>

                    {rawVal && (
                      <button
                        type="button"
                        onClick={(e) => handleClear(cfg.key, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="Clear shortcut"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredBindings.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No keybindings found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="pt-4 border-t border-white/[0.04] text-[11px] text-muted-foreground/60 leading-relaxed">
        <p>
          Click on any row to record a new key combination. Shortcuts are registered globally across Windows and work from any app. Press <kbd className="font-mono bg-white/[0.06] px-1 py-0.5 rounded border border-white/[0.08]">Backspace</kbd> to clear or <kbd className="font-mono bg-white/[0.06] px-1 py-0.5 rounded border border-white/[0.08]">Esc</kbd> to exit.
        </p>
      </div>
    </div>
  );
};
