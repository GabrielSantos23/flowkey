import React from "react";
import { useSettings } from "../../context/SettingsContext";
import { Clock, Battery, Cpu, Radio, Timer, Music, CloudSun, LayoutGrid, Check } from "lucide-react";

export const WidgetSlotManager: React.FC = () => {
  const { settings, toggleWidgetSlot, toggleBigWidget } = useSettings();

  const availableSmallWidgets = [
    { id: "time", label: "Clock Time", icon: Clock },
    { id: "battery", label: "Battery Level", icon: Battery },
    { id: "system_usage", label: "System Usage (CPU/RAM)", icon: Cpu },
    { id: "used_devices", label: "Used Devices (Mic/Cam)", icon: Radio },
    { id: "active_timer", label: "Active Timer Clock", icon: Timer },
    { id: "visualizer", label: "Mini Equalizer", icon: Music },
  ];

  const availableBigWidgets = [
    { id: "media", label: "Media Player (Spotify)", icon: Music },
    { id: "weather", label: "Live Weather & Temp", icon: CloudSun },
    { id: "timer", label: "Digital Timer", icon: Timer },
    { id: "shortcuts", label: "Quick Launch Shortcuts", icon: LayoutGrid },
  ];

  return (
    <div className="space-y-4">
      {/* Small Widgets Slot Layout */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground">Small Widgets Bar (Collapsed Pill)</h4>
        <p className="text-[11px] text-muted-foreground">
          Configure which widgets appear on the Left, Middle, and Right sections of the collapsed island.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(["left", "middle", "right"] as const).map((slot) => {
            const key =
              slot === "left"
                ? "small_widgets_left"
                : slot === "middle"
                ? "small_widgets_middle"
                : "small_widgets_right";

            const activeList = settings[key];

            return (
              <div key={slot} className="p-2.5 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    {slot}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{activeList.length}</span>
                </div>

                <div className="space-y-1">
                  {availableSmallWidgets.map((w) => {
                    const isChecked = activeList.includes(w.id);
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.id}
                        onClick={() => toggleWidgetSlot(slot, w.id)}
                        className={`flex items-center justify-between w-full p-1.5 rounded-lg text-left text-xs transition-all ${
                          isChecked
                            ? "bg-primary/20 text-foreground border border-primary/30 font-medium"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate text-[11px]">{w.label}</span>
                        </div>
                        {isChecked && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Big Widgets Selector */}
      <div className="space-y-2 pt-2 border-t border-border">
        <h4 className="text-xs font-semibold text-foreground">Expanded Hub Widgets</h4>
        <div className="grid grid-cols-2 gap-2">
          {availableBigWidgets.map((bw) => {
            const isChecked = settings.big_widgets.includes(bw.id);
            const Icon = bw.icon;
            return (
              <button
                key={bw.id}
                onClick={() => toggleBigWidget(bw.id)}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                  isChecked
                    ? "bg-card border-primary/40 text-foreground shadow-sm"
                    : "bg-secondary/40 border-border text-muted-foreground opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-medium text-[11px]">{bw.label}</span>
                </div>
                {isChecked && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
