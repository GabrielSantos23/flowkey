import React, { useState, useEffect } from "react";

export const MinimalClockCapsule: React.FC = () => {
  const [time, setTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds();
  const showColon = seconds % 2 === 0;
  return (
    <div
      className="flex items-center justify-center w-full h-full select-none"
    >
      <div className="flex items-center justify-center font-mono text-[13px] font-semibold tracking-wider text-white/90 leading-none">
        <span className="tabular-nums">{hours}</span>
        <span
          className={`transition-opacity duration-300 w-[6px] text-center text-white/60 leading-none ${
            showColon ? "opacity-100" : "opacity-30"
          }`}
        >
          :
        </span>
        <span className="tabular-nums">{minutes}</span>
      </div>
    </div>
  );
};
