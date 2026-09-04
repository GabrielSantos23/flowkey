import React, { createContext, useContext, useEffect, useState } from "react";
import { AppSettings } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "./ThemeContext";

const DEFAULT_SETTINGS: AppSettings = {
  island_mode: "island",
  allow_blur: true,
  allow_animation: true,
  anti_aliasing: true,
  run_on_startup: false,
  theme_index: 0,
  screen_index: 0,
  small_widgets_left: ["time"],
  small_widgets_middle: [],
  small_widgets_right: ["used_devices", "battery"],
  big_widgets: ["media", "weather", "timer", "shortcuts"],
  enabled_widgets: ["spotify", "pomodoro", "tray", "clipboard", "translate"],
  use_celsius: true,
  hide_location: false,
  volume_popup: true,
  brightness_popup: false,
  disable_wave_animation: false,
  auto_hide_on_fullscreen: false,
  game_mode_disable_animations: false,
  is_hidden: false,
  toggle_island_hotkey: "Ctrl+Space",
  open_spotify_hotkey: "",
  open_pomodoro_hotkey: "",
  open_tray_hotkey: "",
  open_clipboard_hotkey: "",
  open_translate_hotkey: "",
  spotify_search_hotkey: "Alt+F",
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  toggleWidgetSlot: (slot: "left" | "middle" | "right", widgetId: string) => void;
  toggleBigWidget: (widgetId: string) => void;
  toggleWidget: (widgetId: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  saveAllSettings: () => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { setThemeIndex } = useTheme();

  // Load settings on initial mount
  useEffect(() => {
    const normalizeSettings = (s: AppSettings): AppSettings => ({
      ...DEFAULT_SETTINGS,
      ...s,
      enabled_widgets:
        Array.isArray(s.enabled_widgets) && s.enabled_widgets.length > 0
          ? s.enabled_widgets
          : DEFAULT_SETTINGS.enabled_widgets,
    });

    try {
      invoke<AppSettings>("load_settings")
        .then((loaded) => {
          if (loaded) {
            const normalized = normalizeSettings(loaded);
            setSettings(normalized);
            if (typeof normalized.theme_index === "number") {
              setThemeIndex(normalized.theme_index);
            }
          }
        })
        .catch(() => {});
    } catch {}

    // Listen to real-time updates broadcast from other windows (e.g. Settings window -> Main window)
    let unlisten: (() => void) | undefined;
    try {
      listen<AppSettings>("settings-updated", (event) => {
        if (event.payload) {
          const normalized = normalizeSettings(event.payload);
          setSettings(normalized);
          if (typeof normalized.theme_index === "number") {
            setThemeIndex(normalized.theme_index);
          }
        }
      }).then((u) => {
        unlisten = u;
      });
    } catch {}

    return () => {
      if (unlisten) unlisten();
    };
  }, [setThemeIndex]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (typeof partial.theme_index === "number") {
        setThemeIndex(partial.theme_index);
      }
      try {
        invoke("save_settings", { settings: next }).catch(() => {});
      } catch {}
      return next;
    });
  };

  const saveAllSettings = async (): Promise<boolean> => {
    try {
      await invoke("save_settings", { settings });
      return true;
    } catch {
      return false;
    }
  };

  const toggleWidgetSlot = (slot: "left" | "middle" | "right", widgetId: string) => {
    setSettings((prev) => {
      const key =
        slot === "left"
          ? "small_widgets_left"
          : slot === "middle"
          ? "small_widgets_middle"
          : "small_widgets_right";

      const currentList = prev[key];
      const exists = currentList.includes(widgetId);

      const nextList = exists
        ? currentList.filter((id) => id !== widgetId)
        : [...currentList, widgetId];

      const next = { ...prev, [key]: nextList };
      try {
        invoke("save_settings", { settings: next }).catch(() => {});
      } catch {}
      return next;
    });
  };

  const toggleBigWidget = (widgetId: string) => {
    setSettings((prev) => {
      const exists = prev.big_widgets.includes(widgetId);
      const nextList = exists
        ? prev.big_widgets.filter((id) => id !== widgetId)
        : [...prev.big_widgets, widgetId];

      const next = { ...prev, big_widgets: nextList };
      try {
        invoke("save_settings", { settings: next }).catch(() => {});
      } catch {}
      return next;
    });
  };

  const toggleWidget = (widgetId: string) => {
    setSettings((prev) => {
      const current = prev.enabled_widgets ?? DEFAULT_SETTINGS.enabled_widgets ?? [];
      const exists = current.includes(widgetId);
      if (exists && current.length <= 1) {
        // Prevent disabling the last active widget
        return prev;
      }
      const nextList = exists
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId];

      const next = { ...prev, enabled_widgets: nextList };
      try {
        invoke("save_settings", { settings: next }).catch(() => {});
      } catch {}
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        toggleWidgetSlot,
        toggleBigWidget,
        toggleWidget,
        isSettingsOpen,
        setIsSettingsOpen,
        saveAllSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
