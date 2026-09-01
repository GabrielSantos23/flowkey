import React, { useEffect, useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import { PomodoroProvider } from "./context/PomodoroContext";
import { LocalSendProvider } from "./context/LocalSendContext";
import { DynamicIsland } from "./components/DynamicIsland";
import { SettingsWindow } from "./components/settings/SettingsWindow";
import { invoke } from "@tauri-apps/api/core";
import { moveWindow, Position } from "@tauri-apps/plugin-positioner";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export const App: React.FC = () => {
  const [isSettingsWindow, setIsSettingsWindow] = useState(false);

  useEffect(() => {
    try {
      const current = getCurrentWebviewWindow();
      const params = new URLSearchParams(window.location.search);
      const isSettings = current.label === "settings" || params.get("window") === "settings";
      setIsSettingsWindow(isSettings);

      if (!isSettings) {
        moveWindow(Position.TopCenter).catch(() => {});
        invoke("position_window_at_top").catch(() => {});
      }
    } catch {
      const params = new URLSearchParams(window.location.search);
      if (params.get("window") === "settings") {
        setIsSettingsWindow(true);
      }
    }
  }, []);

  return (
    <ThemeProvider>
      <SettingsProvider>
        <PomodoroProvider>
          <LocalSendProvider>
            {isSettingsWindow ? (
              <SettingsWindow />
            ) : (
              <main className="w-full h-full relative overflow-hidden bg-transparent flex flex-col items-center justify-start">
                <DynamicIsland />
              </main>
            )}
          </LocalSendProvider>
        </PomodoroProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
};

export default App;
