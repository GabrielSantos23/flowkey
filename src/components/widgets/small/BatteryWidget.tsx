import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BatteryStats } from "../../../types";
import { Battery, BatteryCharging, BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";

export const BatteryWidget: React.FC = () => {
  const [battery, setBattery] = useState<BatteryStats>({
    has_battery: true,
    percentage: 100,
    is_charging: false,
    status: "AC Connected",
  });

  useEffect(() => {
    const fetchBattery = async () => {
      try {
        const data = await invoke<BatteryStats>("get_battery_status");
        if (data) setBattery(data);
      } catch {
        // Web navigator fallback
        if ("getBattery" in navigator) {
          try {
            const navBattery: {
              level: number;
              charging: boolean;
            } = await (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> }).getBattery();
            setBattery({
              has_battery: true,
              percentage: Math.round(navBattery.level * 100),
              is_charging: navBattery.charging,
              status: navBattery.charging ? "Charging" : "Discharging",
            });
          } catch {}
        }
      }
    };

    fetchBattery();
    const interval = setInterval(fetchBattery, 5000);
    return () => clearInterval(interval);
  }, []);

  const getBatteryIcon = () => {
    if (battery.is_charging) {
      return <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />;
    }
    if (battery.percentage <= 20) {
      return <BatteryLow className="w-4 h-4 text-rose-500" />;
    }
    if (battery.percentage <= 60) {
      return <BatteryMedium className="w-4 h-4 text-amber-400" />;
    }
    if (battery.percentage < 95) {
      return <Battery className="w-4 h-4 text-island-textSecond" />;
    }
    return <BatteryFull className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs text-island-textSecond select-none">
      {getBatteryIcon()}
      <span className="font-mono text-[11px] font-medium">{battery.percentage}%</span>
    </div>
  );
};
