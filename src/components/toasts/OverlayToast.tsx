import React from "react";
import { Check, AlertCircle, Info, Heart, HeartOff } from "lucide-react";
import { cn } from "../../lib/utils";

export interface OverlayToastProps {
  message: string | null;
  type?: "success" | "error" | "info" | "like" | "dislike";
  className?: string;
}

export const OverlayToast: React.FC<OverlayToastProps> = ({
  message,
  type = "success",
  className,
}) => {
  if (!message) return null;

  return (
    <div
      className={cn(
        "absolute top-12 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl text-xs font-mono flex items-center gap-1.5 animate-fade-in select-none pointer-events-none",
        type === "success" &&
          "bg-popover/95 border-emerald-500/50 text-emerald-400 shadow-emerald-950/30",
        type === "error" &&
          "bg-popover/95 border-destructive/60 text-destructive-foreground shadow-destructive/20",
        type === "info" &&
          "bg-popover/95 border-border text-foreground shadow-black/40",
        type === "like" &&
          "bg-popover/95 border-rose-500/50 text-rose-400 shadow-rose-950/30",
        type === "dislike" &&
          "bg-popover/95 border-zinc-500/50 text-zinc-400 shadow-black/40",
        className
      )}
    >
      {type === "success" && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
      {type === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
      {type === "info" && <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      {type === "like" && <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />}
      {type === "dislike" && <HeartOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className="truncate max-w-[280px]">{message}</span>
    </div>
  );
};
