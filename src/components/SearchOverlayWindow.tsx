import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { SearchOverlayView } from "./SearchOverlayView";
import { ArtistAlbumsOverlayView } from "./ArtistAlbumsOverlayView";
import { ArtistTopTracksOverlayView } from "./ArtistTopTracksOverlayView";
import { AlbumTracksOverlayView } from "./AlbumTracksOverlayView";
import { SpotifyArtist } from "../types/spotify";

type SearchViewType = "search" | "artist_albums" | "artist_top_tracks" | "album_tracks";

export const SearchOverlayWindow: React.FC = () => {
  const [viewHistory, setViewHistory] = useState<SearchViewType[]>(["search"]);
  const [activeArtist, setActiveArtist] = useState<SpotifyArtist | null>(null);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);

  const currentView = viewHistory[viewHistory.length - 1] || "search";

  const pushView = useCallback((view: SearchViewType) => {
    setViewHistory((prev) => [...prev, view]);
  }, []);

  const popView = useCallback(() => {
    setViewHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : ["search"]));
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await invoke("hide_search_overlay");
    } catch {
      window.close();
    }
  }, []);

  useEffect(() => {
    let unlistenTrigger: (() => void) | undefined;
    let unlistenBlur: (() => void) | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();

      appWindow
        .listen("search_overlay_trigger", () => {
          setViewHistory(["search"]);
          setActiveArtist(null);
          setActiveAlbumId(null);
        })
        .then((fn) => {
          unlistenTrigger = fn;
        });

      appWindow
        .listen("tauri://blur", () => {
          handleClose();
        })
        .then((fn) => {
          unlistenBlur = fn;
        });
    } catch {}

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keyup", handleKeyUpGlobal);

    return () => {
      unlistenTrigger?.();
      unlistenBlur?.();
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keyup", handleKeyUpGlobal);
    };
  }, [handleClose]);

  return (
    <div
      data-tauri-drag-region
      className="w-screen h-screen bg-background/95 backdrop-blur-2xl text-foreground flex flex-col justify-between px-5 py-3.5 select-none font-sans border border-border rounded-xl shadow-2xl overflow-hidden relative"
    >
      {currentView === "artist_albums" && activeArtist ? (
        <ArtistAlbumsOverlayView
          artist={activeArtist}
          onBack={popView}
          onSelectAlbum={(albumId) => {
            setActiveAlbumId(albumId);
            pushView("album_tracks");
          }}
        />
      ) : currentView === "artist_top_tracks" && activeArtist ? (
        <ArtistTopTracksOverlayView
          artist={activeArtist}
          onBack={popView}
        />
      ) : currentView === "album_tracks" && activeAlbumId ? (
        <AlbumTracksOverlayView
          albumId={activeAlbumId}
          onBack={popView}
        />
      ) : (
        <SearchOverlayView
          onBack={handleClose}
          onSelectAlbum={(albumId) => {
            setActiveAlbumId(albumId);
            pushView("album_tracks");
          }}
          onSelectArtistAlbums={(artist) => {
            setActiveArtist(artist);
            pushView("artist_albums");
          }}
          onSelectArtistTopTracks={(artist) => {
            setActiveArtist(artist);
            pushView("artist_top_tracks");
          }}
        />
      )}
    </div>
  );
};
export default SearchOverlayWindow;
