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

  // Save confirmation state
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    <div className="w-screen h-screen bg-neutral-950 text-neutral-100 flex flex-col select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 text-white shadow-sm">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">DynamicWin Settings</h1>
            <p className="text-[11px] text-neutral-400">Customize island appearance, behavior, and integrations</p>
          </div>
        </div>

        {/* Top Confirm / Save Button */}
        <button
          onClick={handleConfirmChanges}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
            isSaved
              ? "bg-emerald-500 text-black shadow-emerald-500/20"
              : "bg-white text-black hover:bg-neutral-200"
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
        <div className="w-48 bg-neutral-900/40 border-r border-white/10 p-3 flex flex-col gap-1">
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
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {id === "spotify" && isSpotifyAuthed && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-auto" />
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
                <h3 className="text-sm font-bold text-white mb-2">Island Presentation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateSettings({ island_mode: "island" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      settings.island_mode === "island"
                        ? "bg-white/15 border-white text-white shadow-md"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="font-semibold text-xs text-white">Dynamic Island</span>
                    <span className="text-[11px] text-neutral-400">Floating capsule pill with second-order physics</span>
                  </button>

                  <button
                    onClick={() => updateSettings({ island_mode: "notch" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      settings.island_mode === "notch"
                        ? "bg-white/15 border-white text-white shadow-md"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="font-semibold text-xs text-white">MacBook Notch</span>
                    <span className="text-[11px] text-neutral-400">Top-anchored notch with smooth Bézier curvature</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
                <h3 className="text-sm font-bold text-white">Toggles & Effects</h3>
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
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{label}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key as keyof typeof settings])}
                      onChange={(e) => updateSettings({ [key]: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
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
                <h3 className="text-sm font-bold text-white mb-1">LocalSend File & Clipboard Sharing</h3>
                <p className="text-xs text-neutral-400">
                  Send files and clipboard text to nearby phones, tablets, and computers on your Wi-Fi network.
                </p>
              </div>

              <div className="p-1 rounded-2xl bg-neutral-900/60 border border-white/10">
                <LocalSendWidget />
              </div>
            </div>
          )}

          {/* SPOTIFY API TAB */}
          {activeTab === "spotify" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Spotify Developer API Integration</h3>
                <p className="text-xs text-neutral-400">
                  Connect your Spotify account to enable live playback queue ("Playing Next") and remote shuffle control.
                </p>
              </div>

              {/* Status Box */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isSpotifyAuthed
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/30 border-amber-500/30 text-amber-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSpotifyAuthed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {isSpotifyAuthed ? "Spotify API Connected" : "Not Connected"}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {isSpotifyAuthed
                        ? "Ready to query live queue & remote controls"
                        : "Requires Spotify Client ID & Secret in .env"}
                    </div>
                  </div>
                </div>

                {isSpotifyAuthed ? (
                  <button
                    onClick={handleSpotifyLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-medium transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSpotifyLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1DB954] text-black hover:brightness-110 active:scale-95 text-xs font-bold transition-all shadow-md disabled:opacity-50"
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
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                  {authError}
                </div>
              )}

              {/* Step by step guide */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
                <div className="text-xs font-bold text-white">How to set up Spotify Developer App:</div>
                <ol className="text-xs text-neutral-300 list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>
                    Open{" "}
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline inline-flex items-center gap-0.5"
                    >
                      Spotify Developer Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Create a new app and set Redirect URI to: <code className="px-1.5 py-0.5 rounded bg-black/50 text-emerald-300">http://127.0.0.1:8888/callback</code></li>
                  <li>Paste your <code className="text-neutral-200">SPOTIFY_CLIENT_ID</code> and <code className="text-neutral-200">SPOTIFY_CLIENT_SECRET</code> in the project's <code className="text-neutral-200">.env</code> file.</li>
                  <li>Click <strong>Login with Spotify</strong> above to authorize!</li>
                </ol>
              </div>
            </div>
          )}

          {/* THEMES TAB */}
          {activeTab === "themes" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Preset Themes</h3>
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
                          ? "bg-white text-black font-bold shadow-md"
                          : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {themeIndex === 5 && (
                <div className="pt-3 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white mb-3">Custom Theme Palette</h3>
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
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-white">Temperature Unit</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Toggle between Celsius and Fahrenheit</div>
                </div>
                <button
                  onClick={() => updateSettings({ use_celsius: !settings.use_celsius })}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
                >
                  {settings.use_celsius ? "Celsius (°C)" : "Fahrenheit (°F)"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-white">Hide Weather Location</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Protect city name privacy on widget</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.hide_location}
                  onChange={(e) => updateSettings({ hide_location: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Confirmation Bar */}
      <div className="px-6 py-3 border-t border-white/10 bg-neutral-900/60 flex items-center justify-between">
        <div className="text-xs text-neutral-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Changes are broadcasted in real-time to the Dynamic Island overlay.</span>
        </div>

        <button
          onClick={handleConfirmChanges}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
            isSaved
              ? "bg-emerald-500 text-black"
              : "bg-white text-black hover:bg-neutral-200"
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
