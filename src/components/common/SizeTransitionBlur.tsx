import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface SizeTransitionBlurProps {
  children: React.ReactNode;
  triggerKey?: string | number | boolean;
  className?: string;
  maxBlur?: number;
  duration?: number;
  layout?: boolean;
}

export const SizeTransitionBlur: React.FC<SizeTransitionBlurProps> = ({
  children,
  triggerKey,
  className = "w-full",
  maxBlur = 8,
  duration = 0.22,
  layout = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Skip resize animation when collapsed or collapsing into the small island bar
        if (width < 160 || height < 60) {
          lastSizeRef.current = { w: width, h: height };
          setIsResizing(false);
          return;
        }

        const diffW = Math.abs(width - lastSizeRef.current.w);
        const diffH = Math.abs(height - lastSizeRef.current.h);

        if ((diffW > 12 || diffH > 12) && lastSizeRef.current.w > 0) {
          setIsResizing(true);
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
          resizeTimeoutRef.current = setTimeout(() => {
            setIsResizing(false);
          }, Math.round(duration * 1000) + 40);
        }

        lastSizeRef.current = { w: width, h: height };
      }
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [duration]);

  useEffect(() => {
    if (triggerKey !== undefined) {
      setIsResizing(true);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        setIsResizing(false);
      }, Math.round(duration * 1000) + 40);
    }
  }, [triggerKey, duration]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <motion.div
        layout={layout}
        transition={{
          duration: duration,
          ease: [0.25, 1, 0.5, 1],
        }}
        animate={{
          filter: isResizing ? `blur(${Math.min(maxBlur, 4)}px)` : "blur(0px)",
          opacity: isResizing ? 0.92 : 1,
          scale: isResizing ? 0.99 : 1,
        }}
        style={{
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
        className="w-full h-full flex items-center justify-center transform-gpu will-change-[transform,opacity]"
      >
        {children}
      </motion.div>
    </div>
  );
};
