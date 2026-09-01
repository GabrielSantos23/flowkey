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
  maxBlur = 4,
  duration = 0.18,
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
        const diffW = Math.abs(width - lastSizeRef.current.w);
        const diffH = Math.abs(height - lastSizeRef.current.h);

        // Only trigger blur on significant structural size jumps (> 15px), not tiny micro-animations
        if ((diffW > 15 || diffH > 15) && lastSizeRef.current.w > 0) {
          setIsResizing(true);
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
          resizeTimeoutRef.current = setTimeout(() => {
            setIsResizing(false);
          }, Math.round(duration * 1000) + 50);
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
      }, Math.round(duration * 1000) + 50);
    }
  }, [triggerKey, duration]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <motion.div
        layout={layout}
        transition={{
          type: "spring",
          stiffness: 450,
          damping: 32,
          mass: 0.65,
        }}
        animate={{
          filter: isResizing ? `blur(${maxBlur}px)` : "blur(0px)",
          opacity: isResizing ? 0.9 : 1,
          scale: isResizing ? 0.99 : 1,
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
