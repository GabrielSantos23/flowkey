import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MainSettingsView } from "./components/MainSettingsView";
import { SettingsModal } from "./components/SettingsModal";
import { spotifyService, openExternalLink, openSpotifyLoginInBrowser } from "./services/spotifyApi";
import { hotkeyService, HotkeyHandlers } from "./services/hotkeyService";

let skipSequence = 0;

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    spotifyService.isAuthenticated()
  );
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Sync initial now playing track id for skip comparison
  useEffect(() => {
    if (isAuthenticated) {
      spotifyService.getNowPlaying().catch(() => {});
    }
  }, [isAuthenticated]);

  // Configure and register global OS shortcuts
  const refreshGlobalShortcuts = useCallback(() => {
    const handlers: HotkeyHandlers = {
      play_pause: async () => {
        try {
          await invoke("native_play_pause");
        } catch (e) {
          console.error("Hotkey Play/Pause error:", e);
        }
      },
      next_track: async () => {
        const seq = ++skipSequence;
        const previousTrackId = spotifyService.getLastTrackId();

        try {
          await invoke("native_next_track");
          await invoke("show_track_toast", {
            payload: {
              action: "next",
              title: "Advancing Track...",
              artist: "Spotify Playback",
              album_art: "",
            },
          });

          if (spotifyService.isAuthenticated()) {
            const newItem = await spotifyService.fetchNewTrackAfterSkip(previousTrackId);
            if (seq === skipSequence && newItem) {
              await invoke("show_track_toast", {
                payload: {
                  action: "next",
                  title: newItem.name,
                  artist: newItem.artists?.map((a: any) => a.name).join(", ") || "",
                  album_art: newItem.album?.images?.[0]?.url || "",
                },
              });
            }
          }
        } catch (e) {
          console.error("Hotkey Next Track error:", e);
        }
      },
      prev_track: async () => {
        const seq = ++skipSequence;
        const previousTrackId = spotifyService.getLastTrackId();

        try {
          await invoke("native_prev_track");
          await invoke("show_track_toast", {
            payload: {
              action: "prev",
              title: "Previous Track...",
              artist: "Spotify Playback",
              album_art: "",
            },
          });

          if (spotifyService.isAuthenticated()) {
            const newItem = await spotifyService.fetchNewTrackAfterSkip(previousTrackId);
            if (seq === skipSequence && newItem) {
              await invoke("show_track_toast", {
                payload: {
                  action: "prev",
                  title: newItem.name,
                  artist: newItem.artists?.map((a: any) => a.name).join(", ") || "",
                  album_art: newItem.album?.images?.[0]?.url || "",
                },
              });
            }
          }
        } catch (e) {
          console.error("Hotkey Prev Track error:", e);
        }
      },
      volume_up: async () => {
        try {
          const res = await spotifyService.getNowPlaying();
          const current = res.data.device?.volume_percent ?? 50;
          const nextVol = Math.min(100, current + 5);
          await spotifyService.setVolume(nextVol);
        } catch (e) {
          console.error("Hotkey Volume Up error:", e);
        }
      },
      volume_down: async () => {
        try {
          const res = await spotifyService.getNowPlaying();
          const current = res.data.device?.volume_percent ?? 50;
          const nextVol = Math.max(0, current - 5);
          await spotifyService.setVolume(nextVol);
        } catch (e) {
          console.error("Hotkey Volume Down error:", e);
        }
      },
      toggle_liked: async () => {
        try {
          const res = await spotifyService.getNowPlaying();
          const track = res.data.item;
          if (track?.id) {
            const isLiked = await spotifyService.checkIsTrackLiked(track.id);
            if (isLiked) {
              await spotifyService.removeTrackFromLiked(track.id);
              await invoke("show_track_toast", {
                payload: {
                  action: "dislike",
                  title: "Removed from Liked Songs",
                  artist: track.artists?.map((a: any) => a.name).join(", ") || "",
                  album_art: track.album?.images?.[0]?.url || "",
                },
              });
            } else {
              await spotifyService.saveTrackToLiked(track.id);
              await invoke("show_track_toast", {
                payload: {
                  action: "like",
                  title: "Saved to Liked Songs",
                  artist: track.artists?.map((a: any) => a.name).join(", ") || "",
                  album_art: track.album?.images?.[0]?.url || "",
                },
              });
            }
          }
        } catch (e) {
          console.error("Hotkey toggle liked error:", e);
        }
      },
      add_to_playlist: async () => {
        try {
          let isOverlayOpen = false;
          try {
            const searchWin = await WebviewWindow.getByLabel("search");
            const isSearchVis = await searchWin?.isVisible();
            const overlayWin = await WebviewWindow.getByLabel("overlay");
            const isOverlayVis = await overlayWin?.isVisible();
            isOverlayOpen = Boolean(isSearchVis || isOverlayVis);
          } catch {}

          if (isOverlayOpen) {
            if (typeof window !== "undefined" && "BroadcastChannel" in window) {
              const bc = new BroadcastChannel("flowkey_overlay_action_sync");
              bc.postMessage({ type: "OPEN_PLAYLIST_MENU" });
              bc.close();
            }
            return;
          }

          const res = await spotifyService.getNowPlaying();
          const item = res?.data?.item;
          if (!item || !item.uri) {
            await invoke("show_track_toast", {
              payload: {
                action: "next",
                title: "No music playing",
                artist: "Cannot add to playlist",
                album_art: "",
              },
            });
            return;
          }

          await invoke("show_playlist_picker");
        } catch (e) {
          console.error("Hotkey Add to Playlist error:", e);
        }
      },
      add_to_queue: async () => {
        try {
          let isOverlayOpen = false;
          try {
            const searchWin = await WebviewWindow.getByLabel("search");
            const isSearchVis = await searchWin?.isVisible();
            const overlayWin = await WebviewWindow.getByLabel("overlay");
            const isOverlayVis = await overlayWin?.isVisible();
            isOverlayOpen = Boolean(isSearchVis || isOverlayVis);
          } catch {}

          if (!isOverlayOpen) {
            return;
          }

          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const bc = new BroadcastChannel("flowkey_overlay_action_sync");
            bc.postMessage({ type: "TRIGGER_QUEUE" });
            bc.close();
          }
        } catch (e: any) {
          console.error("Hotkey Add to Queue error:", e);
        }
      },
      open_spotify: () => {
        openExternalLink("spotify:");
      },
      artist_radio: async () => {
        try {
          const res = await spotifyService.getNowPlaying();
          const artist = res.data.item?.artists?.[0];
          if (artist?.id && res.data.item?.id) {
            await spotifyService.playArtistRadio(artist.id, res.data.item.id);
          }
        } catch (e) {
          console.error("Hotkey Artist Radio error:", e);
        }
      },
      view_album: async () => {
        try {
          await invoke("show_now_playing_overlay");
        } catch (e) {
          console.error("Hotkey View Album error:", e);
        }
      },
      now_playing_overlay: async () => {
        try {
          await invoke("toggle_now_playing_overlay");
        } catch (e) {
          console.error("Hotkey Toggle Overlay error:", e);
        }
      },
      open_search: async () => {
        try {
          await invoke("toggle_search_overlay");
        } catch (e) {
          console.error("Hotkey Open Search error:", e);
        }
      },
    };

    hotkeyService.registerAllShortcuts(handlers);
  }, []);

  // Initial authentication check & OAuth broadcast listener
  useEffect(() => {
    spotifyService.handleUrlAuthRedirect();
    const authed = spotifyService.isAuthenticated();
    setIsAuthenticated(authed);

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("flowkey_spotify_auth");
      channel.onmessage = (event) => {
        if (event.data?.type === "TOKEN_RECEIVED" && event.data.token) {
          spotifyService.setAccessToken(event.data.token, 3600);
          setIsAuthenticated(true);
        }
      };
      return () => channel.close();
    }
  }, []);

  // Register shortcuts on mount / update
  useEffect(() => {
    refreshGlobalShortcuts();
  }, [refreshGlobalShortcuts]);

  const handleConnectSpotify = async () => {
    try {
      await openSpotifyLoginInBrowser();
    } catch (e) {
      console.error("Failed to start Spotify login:", e);
    }
  };

  const handleLogout = () => {
    spotifyService.logout();
    setIsAuthenticated(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f1115] text-[#f3f4f6] overflow-hidden select-none font-sans relative">
      <MainSettingsView
        isAuthenticated={isAuthenticated}
        onConnect={handleConnectSpotify}
        onLogout={handleLogout}
        onShortcutsUpdated={refreshGlobalShortcuts}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isAuthenticated={isAuthenticated}
        onConnect={handleConnectSpotify}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
