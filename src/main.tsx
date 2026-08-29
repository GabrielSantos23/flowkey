import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { NowPlayingOverlayWindow } from "./components/NowPlayingOverlayWindow";
import { SearchOverlayWindow } from "./components/SearchOverlayWindow";
import { TrackToastWindow } from "./components/toasts/TrackToastWindow";
import { PlaylistPickerWindow } from "./components/PlaylistPickerWindow";
import { TooltipProvider } from "./components/ui/tooltip";
import "./App.css";

const searchParams = new URLSearchParams(window.location.search);
const windowParam = searchParams.get("window");
const isOverlayWindow = windowParam === "overlay" || window.location.hash.includes("overlay");
const isSearchWindow = windowParam === "search" || window.location.hash.includes("search");
const isToastWindow = windowParam === "toast" || window.location.hash.includes("toast");
const isPlaylistPickerWindow = windowParam === "playlist_picker" || window.location.hash.includes("playlist_picker");

// Prevent default browser/webview context menu on right click across all windows
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider>
      {isPlaylistPickerWindow ? (
        <PlaylistPickerWindow />
      ) : isToastWindow ? (
        <TrackToastWindow />
      ) : isSearchWindow ? (
        <SearchOverlayWindow />
      ) : isOverlayWindow ? (
        <NowPlayingOverlayWindow />
      ) : (
        <App />
      )}
    </TooltipProvider>
  </React.StrictMode>,
);
