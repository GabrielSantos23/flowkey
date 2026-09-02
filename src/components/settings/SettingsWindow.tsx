import React, { useState, useEffect } from "react";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { CustomThemeEditor } from "./CustomThemeEditor";
import { WidgetSlotManager } from "./WidgetSlotManager";
import { LocalSendWidget } from "../widgets/big/LocalSendWidget";
import {
  Sliders,
  Palette,
  Layout,
  Monitor,
  Sparkles,
  Music,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LogOut,
  RefreshCw,
  Save,
  Check,
  Keyboard,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export const SettingsWindow: React.FC = () => {
  const { settings, updateSettings, saveAllSettings } = useSettings();
  const { themeIndex, presetNames, setThemeIndex, customTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<"general" | "localsend" | "themes" | "widgets" | "spotify" | "display">("general");

  // Spotify Auth state
  const [isSpotifyAuthed, setIsSpotifyAuthed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Hotkey recorder state
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  // Save confirmation state
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleRecordKey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier keys alone
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
    } catch (err: any) {
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

  const handleConfirmChanges = async () => {
    setIsSaving(true);
    try {
      await saveAllSettings();
      await invoke("save_custom_theme", { theme: customTheme });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {}
    setIsSaving(false);
  };

  return (
    <div className="w-screen h-screen bg-background text-foreground flex flex-col select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/15 text-primary shadow-sm">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">DynamicWin Settings</h1>
            <p className="text-[11px] text-muted-foreground">Customize island appearance, behavior, and integrations</p>
          </div>
        </div>

        {/* Top Confirm / Save Button */}
        <button
          onClick={handleConfirmChanges}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
            isSaved
              ? "bg-emerald-500 text-white shadow-emerald-500/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Applied in Real-Time!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Confirm & Apply Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-48 bg-sidebar border-r border-sidebar-border p-3 flex flex-col gap-1">
          {[
            { id: "general", label: "General", icon: Sparkles },
            { id: "localsend", label: "LocalSend", icon: Send },
            { id: "spotify", label: "Spotify API", icon: Music },
            { id: "themes", label: "Themes", icon: Palette },
            { id: "widgets", label: "Widgets", icon: Layout },
            { id: "display", label: "Display", icon: Monitor },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {id === "spotify" && isSpotifyAuthed && (
                <span className="w-2 h-2 rounded-full bg-primary ml-auto" />
              )}
            </button>
          ))}
        </div>

        {/* Tab View Container */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2">Island Presentation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateSettings({ island_mode: "island" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      settings.island_mode === "island"
                        ? "bg-primary/15 border-primary text-foreground shadow-md"
                        : "bg-card border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground">Dynamic Island</span>
                    <span className="text-[11px] text-muted-foreground">Floating capsule pill with second-order physics</span>
                  </button>

                  <button
                    onClick={() => updateSettings({ island_mode: "notch" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      settings.island_mode === "notch"
                        ? "bg-primary/15 border-primary text-foreground shadow-md"
                        : "bg-card border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground">MacBook Notch</span>
                    <span className="text-[11px] text-muted-foreground">Top-anchored notch with smooth Bézier curvature</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-3 border-t border-border">
                <h3 className="text-sm font-bold text-foreground">Toggles & Effects</h3>
                {[
                  {
                    key: "allow_animation",
                    label: "Smooth Spring Animations",
                    desc: "Enable second-order fluid physics on hover and expansion",
                  },
                  {
                    key: "allow_blur",
                    label: "Backdrop Blur (Glassmorphism)",
                    desc: "Apply hardware-accelerated blur behind island container",
                  },
                  {
                    key: "volume_popup",
                    label: "Volume Change HUD",
                    desc: "Show interactive volume level slider when audio keys are pressed",
                  },
                  {
                    key: "brightness_popup",
                    label: "Brightness HUD",
                    desc: "Show display brightness level overlay when adjusted",
                  },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border cursor-pointer hover:bg-accent/40 transition-all"
                  >
                    <div>
                      <div className="text-xs font-semibold text-foreground">{label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key as keyof typeof settings])}
                      onChange={(e) => updateSettings({ [key]: e.target.checked })}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* LOCALSEND TAB */}
          {activeTab === "localsend" && (
            <div className="flex flex-col gap-4 max-w-xl">
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">LocalSend File & Clipboard Sharing</h3>
                <p className="text-xs text-muted-foreground">
                  Send files and clipboard text to nearby phones, tablets, and computers on your Wi-Fi network.
                </p>
              </div>

              <div className="p-1 rounded-2xl bg-card/60 border border-border">
                <LocalSendWidget />
              </div>
            </div>
          )}

          {/* SPOTIFY API TAB */}
          {activeTab === "spotify" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">Spotify Developer API Integration</h3>
                <p className="text-xs text-muted-foreground">
                  Connect your Spotify account to enable live playback queue ("Playing Next") and remote shuffle control.
                </p>
              </div>

              {/* Status Box */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isSpotifyAuthed
                    ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                    : "bg-destructive/10 border-destructive/30 text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSpotifyAuthed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {isSpotifyAuthed ? "Spotify API Connected" : "Not Connected"}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent text-xs font-medium transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSpotifyLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 text-xs font-bold transition-all shadow-md disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Music className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoggingIn ? "Waiting..." : "Login with Spotify"}</span>
                  </button>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                  {authError}
                </div>
              )}

              {/* Hotkey Configuration Section */}
              <div className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-primary" />
                      <span>Atalho da Busca Spotify</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Pressione o atalho global em qualquer tela para abrir a busca
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRecordingHotkey(true)}
                      onKeyDown={isRecordingHotkey ? handleRecordKey : undefined}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                        isRecordingHotkey
                          ? "bg-primary text-primary-foreground border-primary animate-pulse ring-2 ring-ring/50"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {isRecordingHotkey
                        ? "Pressione as teclas..."
                        : settings.spotify_search_hotkey || "Alt+F"}
                    </button>

                    {settings.spotify_search_hotkey && settings.spotify_search_hotkey !== "Alt+F" && (
                      <button
                        onClick={() => updateSettings({ spotify_search_hotkey: "Alt+F" })}
                        className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded-lg bg-secondary hover:bg-accent transition-all"
                        title="Restaurar padrão (Alt+F)"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Step by step guide */}
              <div className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2.5">
                <div className="text-xs font-bold text-foreground">How to set up Spotify Developer App:</div>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>
                    Open{" "}
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline inline-flex items-center gap-0.5"
                    >
                      Spotify Developer Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Create a new app and set Redirect URI to: <code className="px-1.5 py-0.5 rounded bg-muted text-primary">http://127.0.0.1:8888/callback</code></li>
                  <li>Paste your <code className="text-foreground">SPOTIFY_CLIENT_ID</code> and <code className="text-foreground">SPOTIFY_CLIENT_SECRET</code> in the project's <code className="text-foreground">.env</code> file.</li>
                  <li>Click <strong>Login with Spotify</strong> above to authorize!</li>
                </ol>
              </div>
            </div>
          )}

          {/* THEMES TAB */}
          {activeTab === "themes" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2">Preset Themes</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {presetNames.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => {
                        setThemeIndex(idx);
                        updateSettings({ theme_index: idx });
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        themeIndex === idx
                          ? "bg-primary text-primary-foreground font-bold shadow-md border-primary"
                          : "bg-card border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="text-xs">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {themeIndex === 5 && (
                <div className="pt-3 border-t border-border">
                  <h3 className="text-sm font-bold text-foreground mb-3">Custom Theme Palette</h3>
                  <CustomThemeEditor />
                </div>
              )}
            </div>
          )}

          {/* WIDGETS TAB */}
          {activeTab === "widgets" && (
            <div className="max-w-lg">
              <WidgetSlotManager />
            </div>
          )}

          {/* DISPLAY TAB */}
          {activeTab === "display" && (
            <div className="flex flex-col gap-4 max-w-lg">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border">
                <div>
                  <div className="text-xs font-semibold text-foreground">Temperature Unit</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Toggle between Celsius and Fahrenheit</div>
                </div>
                <button
                  onClick={() => updateSettings({ use_celsius: !settings.use_celsius })}
                  className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-accent text-xs font-bold text-secondary-foreground transition-all"
                >
                  {settings.use_celsius ? "Celsius (°C)" : "Fahrenheit (°F)"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border">
                <div>
                  <div className="text-xs font-semibold text-foreground">Hide Weather Location</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Protect city name privacy on widget</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.hide_location}
                  onChange={(e) => updateSettings({ hide_location: e.target.checked })}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Confirmation Bar */}
      <div className="px-6 py-3 border-t border-border bg-card/60 backdrop-blur-md flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Changes are broadcasted in real-time to the Dynamic Island overlay.</span>
        </div>

        <button
          onClick={handleConfirmChanges}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
            isSaved
              ? "bg-emerald-500 text-white shadow-emerald-500/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Applied in Real-Time!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Confirm & Apply Changes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
