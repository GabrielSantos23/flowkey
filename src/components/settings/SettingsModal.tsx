import React, { useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { CustomThemeEditor } from "./CustomThemeEditor";
import { WidgetSlotManager } from "./WidgetSlotManager";
import { LocalSendWidget } from "../widgets/big/LocalSendWidget";
import { X, Sliders, Palette, Layout, Monitor, Sparkles, Send, Moon, Sun } from "lucide-react";

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, settings, updateSettings } = useSettings();
  const { themeIndex, presetNames } = useTheme();

  const [activeTab, setActiveTab] = useState<"general" | "localsend" | "themes" | "widgets" | "display">("general");

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={() => setIsSettingsOpen(false)}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] rounded-3xl bg-neutral-900/95 border border-white/15 p-6 shadow-2xl flex flex-col gap-4 overflow-hidden text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-island-primary/20 text-island-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-none">DynamicWin Settings</h2>
              <p className="text-xs text-neutral-400 mt-1">Configure island appearance and behavior</p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
          {[
            { id: "general", label: "General", icon: Sparkles },
            { id: "localsend", label: "LocalSend", icon: Send },
            { id: "themes", label: "Themes", icon: Palette },
            { id: "widgets", label: "Widgets", icon: Layout },
            { id: "display", label: "Display", icon: Monitor },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                activeTab === id
                  ? "bg-white/15 text-white shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Island Mode Style */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300">Island Style</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateSettings({ island_mode: "island" })}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all ${
                      settings.island_mode === "island"
                        ? "bg-island-primary/20 border-island-primary text-white shadow-md"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="w-20 h-5 rounded-full bg-black/60 border border-white/20 shadow-inner" />
                    <span className="text-xs font-semibold">Floating Island</span>
                    <span className="text-[10px] text-neutral-400">Pill floating below screen top</span>
                  </button>

                  <button
                    onClick={() => updateSettings({ island_mode: "notch" })}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all ${
                      settings.island_mode === "notch"
                        ? "bg-island-primary/20 border-island-primary text-white shadow-md"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="w-20 h-5 rounded-b-xl bg-black/60 border-b border-x border-white/20 shadow-inner" />
                    <span className="text-xs font-semibold">MacBook Notch</span>
                    <span className="text-[10px] text-neutral-400">Attached to screen top with curves</span>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {[
                  {
                    key: "allow_animation",
                    label: "Spring Physics Animations",
                    desc: "Smooth second-order dynamics expansion",
                  },
                  {
                    key: "allow_blur",
                    label: "Backdrop Blur & Glassmorphism",
                    desc: "Frosted translucent background glow",
                  },
                  {
                    key: "anti_aliasing",
                    label: "Anti-Aliasing",
                    desc: "Crisp rounded corners and typography",
                  },
                  {
                    key: "run_on_startup",
                    label: "Start with System",
                    desc: "Launch automatically on login",
                  },
                  {
                    key: "volume_popup",
                    label: "Volume Change HUD Popup",
                    desc: "Show island overlay on volume adjustments",
                  },
                  {
                    key: "brightness_popup",
                    label: "Brightness Change HUD Popup",
                    desc: "Show island overlay on brightness adjustments",
                  },
                ].map(({ key, label, desc }) => {
                  const val = settings[key as keyof typeof settings] as boolean;
                  return (
                    <div
                      key={key}
                      onClick={() => updateSettings({ [key]: !val })}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[11px] text-neutral-400">{desc}</p>
                      </div>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                          val ? "bg-island-primary justify-end" : "bg-white/20 justify-start"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "localsend" && (
            <div className="space-y-3">
              <div className="p-1 rounded-2xl bg-neutral-900/60 border border-white/10">
                <LocalSendWidget />
              </div>
            </div>
          )}

          {activeTab === "themes" && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-neutral-300">Preset Themes</label>
              <div className="grid grid-cols-3 gap-2">
                {presetNames.map((name, idx) => (
                  <button
                    key={name}
                    onClick={() => updateSettings({ theme_index: idx })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      themeIndex === idx
                        ? "bg-island-primary/20 border-island-primary text-white font-semibold"
                        : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                    }`}
                  >
                    {name === "Dark" ? (
                      <Moon className="w-4 h-4 text-slate-300" />
                    ) : name === "Light" ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Palette className="w-4 h-4 text-island-primary" />
                    )}
                    <span>{name}</span>
                  </button>
                ))}

                <button
                  onClick={() => updateSettings({ theme_index: -1 })}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    themeIndex === -1
                      ? "bg-island-primary/20 border-island-primary text-white font-semibold"
                      : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Custom JSON</span>
                </button>
              </div>

              {themeIndex === -1 && <CustomThemeEditor />}
            </div>
          )}

          {activeTab === "widgets" && <WidgetSlotManager />}

          {activeTab === "display" && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-neutral-300">Display & Positioning</label>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-xs text-neutral-300">Screen Output</p>
                <p className="text-[11px] text-neutral-400">
                  DynamicWin is attached to your Primary Monitor with automatic DPI scaling and centered layout.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-neutral-500">
          <span>DynamicWin v2.0 (Tauri + React)</span>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-1.5 rounded-xl font-semibold bg-island-primary text-island-secondary hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
