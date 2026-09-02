import React, { useEffect, useState } from "react";

export const TimeWidget: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setTimeStr(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground select-none font-mono">
      <span>{timeStr || "00:00"}</span>
    </div>
  );
};
