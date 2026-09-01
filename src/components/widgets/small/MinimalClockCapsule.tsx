import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export const MinimalClockCapsule: React.FC = () => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds();

  // Subtle breathing animation on colon
  const showColon = seconds % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-center justify-center w-[128px] h-8 px-3 cursor-pointer select-none group"
      title="Dynamic Island"
    >
      <div className="flex items-center justify-center gap-2">
        {/* Subtle glowing dot indicator */}
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
        </span>

        {/* Minimalist Centered Clock with pulsing colon */}
        <div className="flex items-center font-mono text-[13px] font-semibold tracking-wider text-white/90 group-hover:text-white transition-colors">
          <span>{hours}</span>
          <span
            className={`transition-opacity duration-300 mx-[1px] text-white/60 ${
              showColon ? "opacity-100" : "opacity-20"
            }`}
          >
            :
          </span>
          <span>{minutes}</span>
        </div>
      </div>
    </motion.div>
  );
};
