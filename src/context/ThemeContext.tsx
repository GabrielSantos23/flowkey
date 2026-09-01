import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeHolder } from "../types";
import { DEFAULT_CUSTOM_THEME, PRESET_THEMES } from "../utils/themePresets";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface ThemeContextType {
  themeIndex: number;
  setThemeIndex: (idx: number) => void;
  activeTheme: ThemeHolder;
  customTheme: ThemeHolder;
  setCustomTheme: (theme: ThemeHolder) => void;
  presetNames: string[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const PRESET_LIST = ["Dark", "Light", "Candy", "Forest Dawn", "Sunset Glow"];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeIndex, setThemeIndexState] = useState<number>(0);
  const [customTheme, setCustomThemeState] = useState<ThemeHolder>(DEFAULT_CUSTOM_THEME);

  useEffect(() => {
    // Load custom theme from Tauri if available
    try {
      invoke<ThemeHolder>("load_custom_theme")
        .then((theme) => {
          if (theme && theme.IslandColor) {
            setCustomThemeState(theme);
          }
        })
        .catch(() => {});
    } catch {}

    // Listen to real-time theme updates across windows
    let unlisten: (() => void) | undefined;
    try {
      listen<ThemeHolder>("theme-updated", (event) => {
        if (event.payload) {
          setCustomThemeState(event.payload);
        }
      }).then((u) => {
        unlisten = u;
      });
    } catch {}

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const activeTheme: ThemeHolder =
    themeIndex === -1 || themeIndex === 5
      ? customTheme
      : PRESET_THEMES[PRESET_LIST[themeIndex] || "Dark"] || PRESET_THEMES.Dark;

  // Apply CSS variables on DOM whenever activeTheme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-island-bg", activeTheme.IslandColor);
    root.style.setProperty("--color-widget-bg", activeTheme.WidgetBackground);
    root.style.setProperty("--color-primary", activeTheme.Primary);
    root.style.setProperty("--color-secondary", activeTheme.Secondary);
    root.style.setProperty("--color-text-main", activeTheme.TextMain);
    root.style.setProperty("--color-text-second", activeTheme.TextSecond);
    root.style.setProperty("--color-text-third", activeTheme.TextThird);
    root.style.setProperty("--color-success", activeTheme.Success);
    root.style.setProperty("--color-error", activeTheme.Error);
    root.style.setProperty("--color-icon", activeTheme.IconColor);
  }, [activeTheme]);

  const setThemeIndex = (idx: number) => {
    setThemeIndexState(idx);
  };

  const setCustomTheme = (theme: ThemeHolder) => {
    setCustomThemeState(theme);
    try {
      invoke("save_custom_theme", { theme }).catch(() => {});
    } catch {}
  };

  return (
    <ThemeContext.Provider
      value={{
        themeIndex,
        setThemeIndex,
        activeTheme,
        customTheme,
        setCustomTheme,
        presetNames: PRESET_LIST,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
