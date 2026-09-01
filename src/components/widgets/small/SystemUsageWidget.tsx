import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardwareStats } from "../../../types";
import { Cpu, HardDrive } from "lucide-react";

export const SystemUsageWidget: React.FC = () => {
  const [stats, setStats] = useState<HardwareStats>({
    cpu_usage: 5.2,
    ram_used_gb: 4.8,
    ram_total_gb: 16.0,
    ram_usage_percent: 30.0,
    usage_string: "CPU: 5.2%  RAM: 4.8GB / 16GB",
  });

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await invoke<HardwareStats>("get_hardware_usage");
        if (data) setStats(data);
      } catch {}
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2.5 px-2 py-0.5 text-[11px] font-mono text-island-textSecond select-none">
      <div className="flex items-center gap-1">
        <Cpu className="w-3.5 h-3.5 text-island-primary opacity-80" />
        <span>{stats.cpu_usage.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <HardDrive className="w-3.5 h-3.5 text-island-primary opacity-80" />
        <span>{stats.ram_used_gb.toFixed(1)}GB</span>
      </div>
    </div>
  );
};
