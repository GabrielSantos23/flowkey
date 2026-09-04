import React, { useState, useEffect } from "react";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { CustomThemeEditor } from "./CustomThemeEditor";
import { WidgetSlotManager } from "./WidgetSlotManager";
import { KeybindingsManager } from "./KeybindingsManager";
import { LocalSendWidget } from "../widgets/big/LocalSendWidget";
import { UpdateToast } from "./UpdateToast";
import { useAppUpdater } from "../../context/UpdateContext";
import { Switch } from "../ui/switch";
import {
  Sliders,
  Palette,
  Layout,
  Monitor,
  Music,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Keyboard,
  Sparkles,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { cn } from "../../lib/utils";

type SettingsTab =
  | "general"
  | "themes"
  | "keybindings"
  | "widgets"
  | "localsend"
  | "spotify"
  | "display";

const TAB_CONFIG: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "General", icon: Sliders },
  { id: "themes", label: "Appearance", icon: Palette },
  { id: "keybindings", label: "Keybindings", icon: Keyboard },
  { id: "widgets", label: "Widgets", icon: Layout },
  { id: "localsend", label: "LocalSend", icon: Send },
  { id: "spotify", label: "Spotify API", icon: Music },
  { id: "display", label: "Display", icon: Monitor },
];

export const SettingsWindow: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { themeIndex, presetNames, setThemeIndex } = useTheme();
  const {
    status: updateStatus,
    checkForUpdates,
  } = useAppUpdater();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as SettingsTab;
      if (
        tabParam &&
        ["general", "themes", "keybindings", "widgets", "localsend", "spotify", "display"].includes(tabParam)
      ) {
        return tabParam;
      }
    } catch {}
    return "general";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  // Spotify Auth state
  const [isSpotifyAuthed, setIsSpotifyAuthed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Hotkey recorder state
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  useEffect(() => {
    try {
      const win = getCurrentWebviewWindow();
      win.isMaximized().then(setIsMaximized).catch(() => {});
      const unlisten = win.onResized(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      });

      const unlistenTab = listen<string>("navigate-settings-tab", (event) => {
        if (
          event.payload &&
          ["general", "themes", "keybindings", "widgets", "localsend", "spotify", "display"].includes(event.payload)
        ) {
          setActiveTab(event.payload as SettingsTab);
        }
      });

      return () => {
        unlisten.then((u) => u());
        unlistenTab.then((u) => u());
      };
    } catch {}
  }, []);

  const handleMinimize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await getCurrentWebviewWindow().minimize();
    } catch {
      await invoke("window_minimize", { label: "settings" }).catch(() => {});
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await getCurrentWebviewWindow().toggleMaximize();
      const max = await getCurrentWebviewWindow().isMaximized();
      setIsMaximized(max);
    } catch {
      await invoke("window_toggle_maximize", { label: "settings" }).catch(() => {});
    }
  };

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await getCurrentWebviewWindow().hide();
    } catch {
      await invoke("window_close", { label: "settings" }).catch(() => {});
    }
  };

  const handleStartDragging = (e: React.MouseEvent) => {
    if (
      e.button === 0 &&
      !(e.target as HTMLElement).closest("button, input, a, [data-no-drag]")
    ) {
      try {
        getCurrentWebviewWindow().startDragging();
      } catch {}
    }
  };

  const handleRecordKey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
    parts.push(keyName);

    const combo = parts.join("+");
    updateSettings({ spotify_search_hotkey: combo });
    setIsRecordingHotkey(false);
  };

  const checkAuth = async () => {
    try {
      const authed = await invoke<boolean>("check_spotify_auth");
      setIsSpotifyAuthed(authed);
    } catch {}
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleSpotifyLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const success = await invoke<boolean>("spotify_login");
      if (success) {
        setIsSpotifyAuthed(true);
      }
    } catch (err: unknown) {
      setAuthError(String(err));
    } finally {
      setIsLoggingIn(false);
      checkAuth();
    }
  };

  const handleSpotifyLogout = async () => {
    try {
      await invoke("spotify_logout");
      setIsSpotifyAuthed(false);
    } catch {}
  };

  const filteredTabs = TAB_CONFIG.filter((t) =>
    t.label.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  const activeTabMeta =
    TAB_CONFIG.find((t) => t.id === activeTab) || TAB_CONFIG[0];

  return (
    <div className="w-screen h-screen bg-[#09090b] text-foreground flex select-none overflow-hidden font-sans border border-border/40">
      <UpdateToast />

      {/* LEFT SIDEBAR */}
      <div className="w-60 bg-[#0c0c0f] border-r border-border/30 flex flex-col justify-between shrink-0">
        <div className="flex flex-col">
          {/* Top Cosmic Header / Logo */}
          <div
            data-tauri-drag-region
            onMouseDown={handleStartDragging}
            className="h-14 px-4 flex items-center gap-2.5 relative overflow-hidden select-none border-b border-white/[0.04] cursor-default"
            style={{
              WebkitAppRegion: "drag",
              background:
                "radial-gradient(ellipse 90% 80% at 75% 10%, rgba(147, 51, 234, 0.22), transparent 75%), linear-gradient(180deg, #140e2b 0%, #0c0c0f 100%)",
            } as React.CSSProperties}
          >
            {/* Ambient stars/glow decoration */}
            <div className="absolute top-2 right-4 w-1 h-1 bg-purple-300/60 rounded-full blur-[0.5px] pointer-events-none" />
            <div className="absolute top-6 right-10 w-0.5 h-0.5 bg-blue-300/40 rounded-full pointer-events-none" />
            <div className="absolute bottom-2 right-6 w-1 h-1 bg-purple-200/50 rounded-full blur-[0.5px] pointer-events-none" />

            <div className="size-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm shadow-primary/20 shrink-0 pointer-events-none">
              <div className="w-4 h-2 rounded-full bg-primary" />
            </div>

            <div className="flex flex-col min-w-0 pointer-events-none">
              <span className="text-xs font-bold tracking-tight text-white leading-none">
                FlowKey
              </span>
              <span className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                v2.0.0
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-muted-foreground focus-within:border-primary/50 focus-within:bg-white/[0.06] focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-xs"
              />
              <kbd className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-muted-foreground/80 border border-white/[0.08]">
                /
              </kbd>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-2 space-y-0.5">
            {filteredTabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left group",
                    isActive
                      ? "bg-white/[0.09] text-white font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span>{label}</span>
                  {id === "spotify" && isSpotifyAuthed && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto shadow-sm shadow-emerald-500/50" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Back Button */}
        <div className="p-3 border-t border-white/[0.04] flex items-center justify-between">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all cursor-pointer"
            title="Return to Island"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
        </div>
      </div>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        {/* Customized Windows Native Window Header Bar */}
        <div
          data-tauri-drag-region
          onMouseDown={handleStartDragging}
          onDoubleClick={handleToggleMaximize}
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="h-10 flex items-center justify-between pl-6 select-none border-b border-white/[0.04] bg-[#09090b] cursor-default"
        >
          {/* Breadcrumbs on Left */}
          <div
            className="flex items-center gap-2 text-xs font-medium pointer-events-none"
          >
            <span className="text-muted-foreground/70">Settings</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-foreground font-semibold">
              {activeTabMeta.label}
            </span>
          </div>

          {/* Right Controls: Check for Updates + Windows Native Controls */}
          <div className="flex items-center h-full">
            {/* Check for Updates Button (Replaces "Restore defaults" from image) */}
            <button
              type="button"
              data-no-drag="true"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              onClick={() => checkForUpdates(true)}
              disabled={
                updateStatus === "checking" ||
                updateStatus === "downloading" ||
                updateStatus === "installing"
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.05] active:scale-95 transition-all mr-3 disabled:opacity-50 cursor-pointer"
              title="Check for FlowKey updates"
            >
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5",
                  updateStatus === "checking" && "animate-spin text-primary",
                )}
              />
              <span>
                {updateStatus === "checking" ? "Checking..." : "Check for updates"}
              </span>
            </button>

            {/* Native Windows Header Controls */}
            <div
              data-no-drag="true"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex items-center h-full"
            >
              {/* Minimize */}
              <button
                type="button"
                data-no-drag="true"
                onClick={handleMinimize}
                className="inline-flex items-center justify-center w-[46px] h-full text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14] transition-colors cursor-pointer"
                title="Minimize"
                aria-label="Minimize"
              >
                <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                  <rect width="10" height="1" />
                </svg>
              </button>

              {/* Maximize / Restore */}
              <button
                type="button"
                data-no-drag="true"
                onClick={handleToggleMaximize}
                className="inline-flex items-center justify-center w-[46px] h-full text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14] transition-colors cursor-pointer"
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                    <path d="M3 1.5H8.5V7" strokeWidth="1" strokeLinecap="square" />
                    <rect x="1.5" y="3" width="5.5" height="5.5" strokeWidth="1" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                    <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />
                  </svg>
                )}
              </button>

              {/* Close */}
              <button
                type="button"
                data-no-drag="true"
                onClick={handleClose}
                className="inline-flex items-center justify-center w-[46px] h-full text-neutral-400 hover:text-white hover:bg-[#c42b1c] active:bg-[#b52618] transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                  <path d="M1 1L9 9M9 1L1 9" strokeWidth="1" strokeLinecap="square" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tab View Container */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl transition-all">
            {/* Tab Header Title */}
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-6">
              {activeTabMeta.label}
            </h2>

            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="space-y-6">
                {/* Island Presentation Segmented Toggle */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-sm font-semibold text-foreground">
                      Island Presentation
                    </span>
                    <span className="text-xs text-muted-foreground leading-normal">
                      Choose between floating Dynamic Island capsule or MacBook
                      top notch curvature.
                    </span>
                  </div>
                  <div className="flex items-center p-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] shrink-0">
                    <button
                      onClick={() => updateSettings({ island_mode: "island" })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                        settings.island_mode === "island"
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Dynamic Island
                    </button>
                    <button
                      onClick={() => updateSettings({ island_mode: "notch" })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                        settings.island_mode === "notch"
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      MacBook Notch
                    </button>
                  </div>
                </div>

                {/* Switch Rows */}
                {[
                  {
                    key: "allow_animation",
                    label: "Spring physics animations",
                    desc: "Enable second-order fluid physics on expansion and hover interactions.",
                  },
                  {
                    key: "allow_blur",
                    label: "Backdrop blur (Glassmorphism)",
                    desc: "Apply hardware-accelerated frosted glass blur behind the island container.",
                  },
                  {
                    key: "anti_aliasing",
                    label: "Anti-aliasing refinement",
                    desc: "Render crisp rounded curves and high-DPI typography on display borders.",
                  },
                  {
                    key: "run_on_startup",
                    label: "Start with Windows",
                    desc: "Launch FlowKey automatically upon system user login.",
                  },
                  {
                    key: "volume_popup",
                    label: "Volume HUD popup",
                    desc: "Show interactive volume level slider when audio hardware keys are pressed.",
                  },
                  {
                    key: "disable_wave_animation",
                    label: "Disable music wave animation",
                    desc: "Prevent audio visualizer bars in the collapsed capsule from bouncing while music is playing.",
                  },
                  {
                    key: "auto_hide_on_fullscreen",
                    label: "Auto-hide in fullscreen",
                    desc: "Automatically hide the Dynamic Island whenever a fullscreen application or video is in the foreground.",
                  },
                  {
                    key: "game_mode_disable_animations",
                    label: "Game & fullscreen performance mode",
                    desc: "Disable all spring physics animations while playing games (including windowed mode) or when an app is in fullscreen.",
                  },
                ].map(({ key, label, desc }) => {
                  const checked = Boolean(
                    settings[key as keyof typeof settings],
                  );
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex flex-col gap-0.5 pr-6">
                        <span className="text-sm font-semibold text-foreground">
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground leading-normal">
                          {desc}
                        </span>
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(val) =>
                          updateSettings({ [key]: val })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* THEMES TAB */}
            {activeTab === "themes" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    Preset Themes
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select a color palette. Changes are broadcasted to the
                    island in real time.
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
                    {presetNames.map((name, idx) => (
                      <button
                        key={name}
                        onClick={() => {
                          setThemeIndex(idx);
                          updateSettings({ theme_index: idx });
                        }}
                        className={cn(
                          "p-3 rounded-xl border text-center transition-all cursor-pointer",
                          themeIndex === idx
                            ? "bg-primary text-primary-foreground font-bold shadow-md border-primary"
                            : "bg-card border-border/50 text-foreground hover:bg-white/[0.05]",
                        )}
                      >
                        <span className="text-xs">{name}</span>
                      </button>
                    ))}

                    <button
                      onClick={() => {
                        setThemeIndex(5);
                        updateSettings({ theme_index: 5 });
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5",
                        themeIndex === 5 || themeIndex === -1
                          ? "bg-primary text-primary-foreground font-bold shadow-md border-primary"
                          : "bg-card border-border/50 text-foreground hover:bg-white/[0.05]",
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-xs">Custom JSON</span>
                    </button>
                  </div>
                </div>

                {(themeIndex === 5 || themeIndex === -1) && (
                  <div className="pt-4 border-t border-border/30">
                    <CustomThemeEditor />
                  </div>
                )}
              </div>
            )}

            {/* KEYBINDINGS TAB */}
            {activeTab === "keybindings" && (
              <div>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure global shortcuts to toggle the Dynamic Island, open directly into any widget, or launch Spotify Quick Search.
                </p>
                <KeybindingsManager />
              </div>
            )}

            {/* WIDGETS TAB */}
            {activeTab === "widgets" && (
              <div>
                <p className="text-xs text-muted-foreground mb-4">
                  Enable or disable individual Dynamic Island widgets. Disabled widgets will be hidden from the header navigation bar, excluded from scroll-wheel cycling, and disabled in the island.
                </p>
                <WidgetSlotManager />
              </div>
            )}

            {/* LOCALSEND TAB */}
            {activeTab === "localsend" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Send files and clipboard text to nearby phones, tablets, and
                  computers on your Wi-Fi network.
                </p>
                <div className="p-1 rounded-2xl bg-card/60 border border-border/50">
                  <LocalSendWidget />
                </div>
              </div>
            )}

            {/* SPOTIFY API TAB */}
            {activeTab === "spotify" && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Connect your Spotify account to enable live playback queue
                    ("Playing Next") and remote shuffle control.
                  </p>
                </div>

                {/* Status Card */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border flex items-center justify-between",
                    isSpotifyAuthed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                      : "bg-destructive/10 border-destructive/30 text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isSpotifyAuthed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div>
                      <div className="text-xs font-bold">
                        {isSpotifyAuthed
                          ? "Spotify API Connected"
                          : "Not Connected"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {isSpotifyAuthed
                          ? "Ready to query live queue & remote controls"
                          : "Requires Spotify Client ID & Secret in .env"}
                      </div>
                    </div>
                  </div>

                  {isSpotifyAuthed ? (
                    <button
                      onClick={handleSpotifyLogout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent text-xs font-medium transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSpotifyLogin}
                      disabled={isLoggingIn}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isLoggingIn ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Music className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isLoggingIn ? "Waiting..." : "Login with Spotify"}
                      </span>
                    </button>
                  )}
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                    {authError}
                  </div>
                )}

                {/* Hotkey Configuration Section */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-primary" />
                      <span>Spotify Search Hotkey</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Press global hotkey on any screen to open search
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRecordingHotkey(true)}
                      onKeyDown={isRecordingHotkey ? handleRecordKey : undefined}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer",
                        isRecordingHotkey
                          ? "bg-primary text-primary-foreground border-primary animate-pulse ring-2 ring-ring/50"
                          : "bg-white/[0.05] text-foreground border-white/[0.08] hover:bg-white/[0.08]",
                      )}
                    >
                      {isRecordingHotkey
                        ? "Press keys..."
                        : settings.spotify_search_hotkey || "Alt+F"}
                    </button>

                    {settings.spotify_search_hotkey &&
                      settings.spotify_search_hotkey !== "Alt+F" && (
                        <button
                          onClick={() =>
                            updateSettings({ spotify_search_hotkey: "Alt+F" })
                          }
                          className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer"
                          title="Restore default (Alt+F)"
                        >
                          Reset
                        </button>
                      )}
                  </div>
                </div>

                {/* Step by step guide */}
                <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col gap-2.5">
                  <div className="text-xs font-bold text-foreground">
                    How to set up Spotify Developer App:
                  </div>
                  <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>
                      Open{" "}
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline inline-flex items-center gap-0.5"
                      >
                        Spotify Developer Dashboard{" "}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      Create a new app and set Redirect URI to:{" "}
                      <code className="px-1.5 py-0.5 rounded bg-muted text-primary">
                        http://127.0.0.1:8888/callback
                      </code>
                    </li>
                    <li>
                      Paste your <code className="text-foreground">SPOTIFY_CLIENT_ID</code> and{" "}
                      <code className="text-foreground">SPOTIFY_CLIENT_SECRET</code> in the project's{" "}
                      <code className="text-foreground">.env</code> file.
                    </li>
                    <li>
                      Click <strong>Login with Spotify</strong> above to authorize!
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* DISPLAY TAB */}
            {activeTab === "display" && (
              <div className="space-y-6">
                {/* Temperature Unit */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-sm font-semibold text-foreground">
                      Temperature Unit
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Select temperature unit format for weather widget
                    </span>
                  </div>
                  <div className="flex items-center p-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] shrink-0">
                    <button
                      onClick={() => updateSettings({ use_celsius: true })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                        settings.use_celsius
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Celsius (°C)
                    </button>
                    <button
                      onClick={() => updateSettings({ use_celsius: false })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                        !settings.use_celsius
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Fahrenheit (°F)
                    </button>
                  </div>
                </div>

                {/* Hide Weather Location Switch */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-sm font-semibold text-foreground">
                      Hide Weather Location
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Protect city name privacy on the expanded weather widget
                    </span>
                  </div>
                  <Switch
                    checked={Boolean(settings.hide_location)}
                    onCheckedChange={(val) =>
                      updateSettings({ hide_location: val })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
