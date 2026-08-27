import {
  register,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";

export type HotkeyCategory = "playback" | "audio" | "library" | "navigation";

export interface HotkeyDefinition {
  id: string;
  name: string;
  description: string;
  category: HotkeyCategory;
  defaultShortcut: string;
}

export interface HotkeyBinding extends HotkeyDefinition {
  currentShortcut: string;
  enabled: boolean;
  alias?: string;
}

export function toTauriShortcut(combo: string): string {
  if (!combo) return "";
  const parts = combo.split("+").map((p) => p.trim());
  const normalized = parts.map((part) => {
    if (part === "Up" || part === "ArrowUp") return "ArrowUp";
    if (part === "Down" || part === "ArrowDown") return "ArrowDown";
    if (part === "Left" || part === "ArrowLeft") return "ArrowLeft";
    if (part === "Right" || part === "ArrowRight") return "ArrowRight";
    if (part === "Space") return "Space";
    if (part.toLowerCase() === "ctrl" || part.toLowerCase() === "control") return "CommandOrControl";
    if (part.toLowerCase() === "alt") return "Alt";
    if (part.toLowerCase() === "shift") return "Shift";
    if (part.toLowerCase() === "super" || part.toLowerCase() === "meta") return "Super";
    return part;
  });
  return normalized.join("+");
}

export function parseShortcutToKeyArray(shortcut: string): string[] {
  if (!shortcut || !shortcut.trim()) return [];
  return shortcut.split("+").map((part) => {
    const p = part.trim();
    if (p === "ArrowUp" || p === "Up") return "↑";
    if (p === "ArrowDown" || p === "Down") return "↓";
    if (p === "ArrowLeft" || p === "Left") return "←";
    if (p === "ArrowRight" || p === "Right") return "→";
    if (p === "Enter" || p === "Return") return "↵";
    if (p.toLowerCase() === "ctrl" || p.toLowerCase() === "control") return "Ctrl";
    if (p.toLowerCase() === "alt") return "Alt";
    if (p.toLowerCase() === "shift") return "Shift";
    if (p.toLowerCase() === "meta" || p.toLowerCase() === "cmd") return "Win";
    return p;
  });
}

export const HOTKEY_DEFINITIONS: HotkeyDefinition[] = [
  {
    id: "play_pause",
    name: "Play / Pause",
    description: "Toggle Spotify playback state",
    category: "playback",
    defaultShortcut: "Alt+P",
  },
  {
    id: "next_track",
    name: "Next Track",
    description: "Skip to the next song in playback queue",
    category: "playback",
    defaultShortcut: "Alt+ArrowRight",
  },
  {
    id: "prev_track",
    name: "Previous Track",
    description: "Return to the previous song",
    category: "playback",
    defaultShortcut: "Alt+ArrowLeft",
  },
  {
    id: "volume_up",
    name: "Volume Up (+5%)",
    description: "Increase Spotify playback volume",
    category: "audio",
    defaultShortcut: "Alt+ArrowUp",
  },
  {
    id: "volume_down",
    name: "Volume Down (-5%)",
    description: "Decrease Spotify playback volume",
    category: "audio",
    defaultShortcut: "Alt+ArrowDown",
  },
  {
    id: "toggle_liked",
    name: "Like / Unlike Song",
    description: "Save or remove currently playing track from Liked Songs",
    category: "library",
    defaultShortcut: "Alt+L",
  },
  {
    id: "add_to_playlist",
    name: "Add to Playlist",
    description: "Jump to playlist manager to save current track",
    category: "library",
    defaultShortcut: "Alt+A",
  },
  {
    id: "add_to_queue",
    name: "Add to Queue",
    description: "Add currently playing track to Spotify queue",
    category: "playback",
    defaultShortcut: "Alt+Q",
  },
  {
    id: "open_spotify",
    name: "Open Spotify Client",
    description: "Launch or bring Spotify desktop application to focus",
    category: "navigation",
    defaultShortcut: "Alt+S",
  },
  {
    id: "artist_radio",
    name: "Open Artist Radio",
    description: "Tune into radio station for the currently playing artist",
    category: "navigation",
    defaultShortcut: "Alt+R",
  },
  {
    id: "view_album",
    name: "View Album Details",
    description: "Open the complete album tracklist modal",
    category: "navigation",
    defaultShortcut: "Alt+O",
  },
  {
    id: "now_playing_overlay",
    name: "Show Now Playing Window",
    description: "Display floating song info popup window",
    category: "playback",
    defaultShortcut: "Alt+W",
  },
  {
    id: "open_search",
    name: "Focus Catalog Search",
    description: "Quickly navigate to live catalog search",
    category: "navigation",
    defaultShortcut: "Alt+F",
  },
];

const STORAGE_KEY = "flowkey_hotkeys_config";
const MASTER_DISABLED_KEY = "flowkey_commands_disabled";

export type HotkeyHandlers = Record<string, () => void | Promise<void>>;

class HotkeyService {
  private registeredShortcuts: Set<string> = new Set();
  private windowKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  public isMasterDisabled(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MASTER_DISABLED_KEY) === "true";
    } catch {
      return false;
    }
  }

  public setMasterDisabled(disabled: boolean): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(MASTER_DISABLED_KEY, String(disabled));
      this.broadcastChange();
    } catch (e) {
      console.warn("Failed to set master disabled state:", e);
    }
  }

  public getBindings(): HotkeyBinding[] {
    const saved = this.loadSavedConfig();
    return HOTKEY_DEFINITIONS.map((def) => {
      const custom = saved[def.id];
      return {
        ...def,
        currentShortcut: custom?.shortcut ?? def.defaultShortcut,
        enabled: custom?.enabled ?? true,
        alias: custom?.alias ?? "",
      };
    });
  }

  public saveBinding(
    actionId: string,
    shortcut: string,
    enabled = true,
    alias = ""
  ): HotkeyBinding[] {
    const saved = this.loadSavedConfig();
    saved[actionId] = { shortcut: shortcut.trim(), enabled, alias: alias.trim() };
    this.saveConfig(saved);
    return this.getBindings();
  }

  public toggleBinding(actionId: string, enabled: boolean): HotkeyBinding[] {
    const saved = this.loadSavedConfig();
    const existing = saved[actionId];
    const def = HOTKEY_DEFINITIONS.find((d) => d.id === actionId);
    saved[actionId] = {
      shortcut: existing?.shortcut ?? def?.defaultShortcut ?? "",
      enabled,
      alias: existing?.alias ?? "",
    };
    this.saveConfig(saved);
    return this.getBindings();
  }

  public saveAlias(actionId: string, alias: string): HotkeyBinding[] {
    const saved = this.loadSavedConfig();
    const existing = saved[actionId];
    const def = HOTKEY_DEFINITIONS.find((d) => d.id === actionId);
    saved[actionId] = {
      shortcut: existing?.shortcut ?? def?.defaultShortcut ?? "",
      enabled: existing?.enabled ?? true,
      alias: alias.trim(),
    };
    this.saveConfig(saved);
    return this.getBindings();
  }

  public resetToDefaults(): HotkeyBinding[] {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      this.broadcastChange();
    }
    return this.getBindings();
  }

  private loadSavedConfig(): Record<string, { shortcut: string; enabled: boolean; alias?: string }> {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private broadcastChange() {
    if (typeof window === "undefined") return;
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("flowkey_hotkeys_sync");
        bc.postMessage({ type: "HOTKEYS_UPDATED", disabled: this.isMasterDisabled() });
        bc.close();
      }
      window.dispatchEvent(new CustomEvent("flowkey_hotkeys_changed"));
      window.dispatchEvent(new CustomEvent("flowkey_disabled_changed", { detail: { disabled: this.isMasterDisabled() } }));
    } catch (e) {
      console.warn("Broadcast error:", e);
    }
  }

  private saveConfig(config: Record<string, { shortcut: string; enabled: boolean; alias?: string }>) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      this.broadcastChange();
    } catch (e) {
      console.warn("Failed to persist hotkey config:", e);
    }
  }

  public async registerAllShortcuts(handlers: HotkeyHandlers): Promise<void> {
    
    this.setupWindowKeyListener(handlers);

    try {
      await unregisterAll();
    } catch (e) {
      console.warn("unregisterAll fallback:", e);
    }
    this.registeredShortcuts.clear();

    if (this.isMasterDisabled()) {
      return;
    }

    const bindings = this.getBindings();
    for (const binding of bindings) {
      if (!binding.enabled || !binding.currentShortcut.trim()) continue;

      const rawShortcut = binding.currentShortcut.trim();
      const tauriShortcut = toTauriShortcut(rawShortcut);
      const handler = handlers[binding.id];
      if (!handler) continue;

      try {
        await register(tauriShortcut, (event) => {
          if (!event || !event.state || event.state === "Pressed" || (event as any).state === "pressed") {
            try {
              if (this.isMasterDisabled()) return;
              handler();
            } catch (err) {
              console.error(`Error executing global hotkey ${rawShortcut} (${binding.id}):`, err);
            }
          }
        });
        this.registeredShortcuts.add(tauriShortcut);
      } catch (err) {
        console.warn(`Could not register OS global shortcut "${tauriShortcut}" for ${binding.id}:`, err);
      }
    }
  }

  private setupWindowKeyListener(handlers: HotkeyHandlers) {
    if (typeof window === "undefined") return;
    if (this.windowKeyHandler) {
      window.removeEventListener("keydown", this.windowKeyHandler);
    }

    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (this.isMasterDisabled()) return;

      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const combo = this.parseKeyboardEvent(e);
      if (!combo) return;

      const bindings = this.getBindings();
      const match = bindings.find((b) => {
        if (!b.enabled) return false;
        const bNorm = toTauriShortcut(b.currentShortcut).toLowerCase();
        const cNorm = toTauriShortcut(combo).toLowerCase();
        return bNorm === cNorm;
      });

      if (match && handlers[match.id]) {
        e.preventDefault();
        e.stopPropagation();
        try {
          handlers[match.id]();
        } catch (err) {
          console.error(`Error executing in-app shortcut ${combo}:`, err);
        }
      }
    };

    window.addEventListener("keydown", this.windowKeyHandler);
  }

  public formatShortcutBadges(shortcut: string): string[] {
    if (!shortcut) return [];
    return shortcut.split("+").map((k) => {
      const trimmed = k.trim();
      if (trimmed === "ArrowUp") return "Up";
      if (trimmed === "ArrowDown") return "Down";
      if (trimmed === "ArrowLeft") return "Left";
      if (trimmed === "ArrowRight") return "Right";
      if (trimmed === "CommandOrControl") return "Ctrl";
      return trimmed;
    });
  }

  public parseKeyboardEvent(e: React.KeyboardEvent | KeyboardEvent): string | null {
    
    if (["Control", "Alt", "Shift", "Meta", "CapsLock", "Tab"].includes(e.key)) {
      return null;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    let key = e.key;
    if (key === " ") key = "Space";
    else if (key === "ArrowUp") key = "ArrowUp";
    else if (key === "ArrowDown") key = "ArrowDown";
    else if (key === "ArrowLeft") key = "ArrowLeft";
    else if (key === "ArrowRight") key = "ArrowRight";
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return parts.join("+");
  }
}

export const hotkeyService = new HotkeyService();
