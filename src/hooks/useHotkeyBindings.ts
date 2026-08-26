import { useState, useEffect, useCallback } from "react";
import { hotkeyService, HotkeyBinding, parseShortcutToKeyArray } from "../services/hotkeyService";

export interface ShortcutInfo {
  keys: string[];
  enabled: boolean;
  rawShortcut: string;
}

export function useHotkeyBindings() {
  const [bindings, setBindings] = useState<Record<string, HotkeyBinding>>(() => {
    const list = hotkeyService.getBindings();
    const map: Record<string, HotkeyBinding> = {};
    list.forEach((b) => {
      map[b.id] = b;
    });
    return map;
  });

  const refreshBindings = useCallback(() => {
    const list = hotkeyService.getBindings();
    const map: Record<string, HotkeyBinding> = {};
    list.forEach((b) => {
      map[b.id] = b;
    });
    setBindings(map);
  }, []);

  useEffect(() => {
    refreshBindings();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_hotkeys_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "HOTKEYS_UPDATED") {
          refreshBindings();
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "flowkey_hotkeys_config") {
        refreshBindings();
      }
    };

    const handleCustom = () => {
      refreshBindings();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("flowkey_hotkeys_changed", handleCustom);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("flowkey_hotkeys_changed", handleCustom);
    };
  }, [refreshBindings]);

  const getShortcut = useCallback(
    (id: string, defaultFallbackKeys: string[] = []): ShortcutInfo => {
      const b = bindings[id];
      if (!b) {
        return {
          keys: defaultFallbackKeys,
          enabled: true,
          rawShortcut: defaultFallbackKeys.join("+"),
        };
      }

      const activeShortcut = b.currentShortcut?.trim() || b.defaultShortcut;
      const parsedKeys = parseShortcutToKeyArray(activeShortcut);

      return {
        keys: parsedKeys.length > 0 ? parsedKeys : defaultFallbackKeys,
        enabled: b.enabled,
        rawShortcut: activeShortcut,
      };
    },
    [bindings]
  );

  return { bindings, getShortcut, refreshBindings };
}
