import React, { useState, useEffect, useRef } from "react";
import { SpotifyIcon } from "../assets/spotify-icon";
import { Kbd, KbdGroup } from "./ui/kbd";
import { HotkeyBinding, hotkeyService } from "../services/hotkeyService";

interface HotkeyRecorderPopoverProps {
  binding: HotkeyBinding | null;
  onClose: () => void;
  onSave: (actionId: string, combo: string) => void;
  className?: string;
}

export const HotkeyRecorderPopover: React.FC<HotkeyRecorderPopoverProps> = ({
  binding,
  onClose,
  onSave,
  className = "bottom-full right-4 mb-1.5",
}) => {
  const [currentCombo, setCurrentCombo] = useState<string | null>(null);
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!binding) return;
    setCurrentCombo(null);
    setActiveModifiers([]);

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.metaKey
      ) {
        onClose();
        return;
      }

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Super");
      setActiveModifiers(mods);

      const combo = hotkeyService.parseKeyboardEvent(e);
      if (combo) {
        setCurrentCombo(combo);
        setTimeout(() => {
          onSave(binding.id, combo);
          onClose();
        }, 180);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Super");
      setActiveModifiers(mods);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [binding, onClose, onSave]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (binding) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [binding, onClose]);

  if (!binding) return null;

  const displayBadges = currentCombo
    ? hotkeyService.formatShortcutBadges(currentCombo)
    : activeModifiers.length > 0
      ? activeModifiers
      : ["Ctrl", "Alt", "A"];

  const isLivePressing = Boolean(currentCombo || activeModifiers.length > 0);

  return (
    <div
      ref={containerRef}
      className={`absolute ${className} z-50 w-58.75 rounded-lg bg-secondary border-border border shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col p-2.5 space-y-2 select-none animate-in zoom-in-95 duration-150 font-sans`}
    >
      <div className="flex flex-col items-center justify-center py-1 space-y-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground/80 tracking-wide">
          {isLivePressing ? "Recording..." : "e.g."}
        </span>

        <div className="py-0.5">
          <KbdGroup className="gap-1">
            {displayBadges.map((badge, idx) => (
              <Kbd
                key={idx}
                className={`text-[10px] h-5 min-w-5 px-1.5 font-bold shadow-xs transition-all ${
                  isLivePressing
                    ? "bg-card border-primary  animate-pulse"
                    : "bg-card border-border text-foreground"
                }`}
              >
                {badge}
              </Kbd>
            ))}
          </KbdGroup>
        </div>

        <span className="text-[9px] font-medium text-muted-foreground/70">
          Single Step
        </span>
      </div>

      <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          <div className="flex items-center justify-center shrink-0">
            <SpotifyIcon
              className="w-3 h-3"
              color="#1ED760"
              lineColor="#00000"
            />
          </div>
          <span className="font-semibold text-foreground truncate text-[10px] max-w-25">
            {binding.name}
          </span>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground text-[9px] shrink-0 font-medium font-mono">
          <span>Close</span>
          <Kbd className="text-[8px] h-3.5 min-w-3.5 px-1 font-mono">Esc</Kbd>
          <span>or</span>
          <Kbd className="text-[8px] h-3.5 min-w-3.5 px-1 font-mono">↵</Kbd>
        </div>
      </div>
    </div>
  );
};
