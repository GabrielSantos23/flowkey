import React, { useState } from "react";
import { Mic, Video } from "lucide-react";

export const UsedDevicesWidget: React.FC = () => {
  // Mic & Camera indicator state
  const [isMicActive] = useState(false);
  const [isCamActive] = useState(false);

  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5 select-none">
      {/* Cam active glowing dot */}
      {isCamActive && (
        <div className="relative flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>
      )}

      {/* Mic active glowing dot */}
      {isMicActive && (
        <div className="relative flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </div>
      )}

      {!isCamActive && !isMicActive && (
        <div className="flex items-center gap-1 opacity-40 hover:opacity-90 transition-opacity">
          <Video className="w-3 h-3 text-island-textThird" />
          <Mic className="w-3 h-3 text-island-textThird" />
        </div>
      )}
    </div>
  );
};
