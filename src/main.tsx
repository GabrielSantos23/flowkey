import React from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "./components/ui/tooltip";
import "./App.css";

const App = React.lazy(() => import("./App").then((m) => ({ default: m.App })));
const NowPlayingOverlayWindow = React.lazy(() =>
  import("./components/NowPlayingOverlayWindow").then((m) => ({
    default: m.NowPlayingOverlayWindow,
  })),
);
const SearchOverlayWindow = React.lazy(() =>
  import("./components/SearchOverlayWindow").then((m) => ({
    default: m.SearchOverlayWindow,
  })),
);
const TrackToastWindow = React.lazy(() =>
  import("./components/toasts/TrackToastWindow").then((m) => ({
    default: m.TrackToastWindow,
  })),
);
const PlaylistPickerWindow = React.lazy(() =>
  import("./components/PlaylistPickerWindow").then((m) => ({
    default: m.PlaylistPickerWindow,
  })),
);

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
      <React.Suspense fallback={null}>
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
      </React.Suspense>
    </TooltipProvider>
  </React.StrictMode>,
);
