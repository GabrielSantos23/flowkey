import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  LocalSendDevice,
  LocalSendTransferProgress,
  LocalSendIncomingTransfer,
} from "../types";

interface LocalSendContextType {
  devices: LocalSendDevice[];
  isSearching: boolean;
  myDevice: LocalSendDevice | null;
  activeTransfers: Record<string, LocalSendTransferProgress>;
  incomingTransfer: LocalSendIncomingTransfer | null;
  startDiscovery: (durationSecs?: number) => Promise<void>;
  stopDiscovery: () => Promise<void>;
  sendFiles: (target: LocalSendDevice, filePaths: string[]) => Promise<string>;
  sendText: (target: LocalSendDevice, text: string) => Promise<string>;
  cancelTransfer: (transferId: string) => Promise<void>;
  acceptTransfer: (sessionId: string) => Promise<void>;
  rejectTransfer: (sessionId: string) => Promise<void>;
  probeIp: (ip: string) => Promise<LocalSendDevice>;
}

const LocalSendContext = createContext<LocalSendContextType | undefined>(undefined);

export const LocalSendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<LocalSendDevice[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [myDevice, setMyDevice] = useState<LocalSendDevice | null>(null);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, LocalSendTransferProgress>>({});
  const [incomingTransfer, setIncomingTransfer] = useState<LocalSendIncomingTransfer | null>(null);

  // Fetch initial info
  useEffect(() => {
    invoke<LocalSendDevice>("localsend_get_my_device")
      .then(setMyDevice)
      .catch(() => {});

    invoke<LocalSendDevice[]>("localsend_get_devices")
      .then(setDevices)
      .catch(() => {});

    invoke<boolean>("localsend_is_discovering")
      .then(setIsSearching)
      .catch(() => {});
  }, []);

  // Listen to Tauri events globally
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Device found
    listen<LocalSendDevice>("localsend://device-found", (event) => {
      setDevices((prev) => {
        const filtered = prev.filter((d) => d.fingerprint !== event.payload.fingerprint);
        return [...filtered, event.payload];
      });
    }).then((u) => unlisteners.push(u));

    // Device updated
    listen<LocalSendDevice>("localsend://device-updated", (event) => {
      setDevices((prev) => {
        const filtered = prev.filter((d) => d.fingerprint !== event.payload.fingerprint);
        return [...filtered, event.payload];
      });
    }).then((u) => unlisteners.push(u));

    // Discovery finished
    listen("localsend://discovery-finished", () => {
      setIsSearching(false);
    }).then((u) => unlisteners.push(u));

    // Transfer Progress
    listen<LocalSendTransferProgress>("localsend://transfer-progress", (event) => {
      setActiveTransfers((prev) => ({
        ...prev,
        [event.payload.transferId]: event.payload,
      }));
    }).then((u) => unlisteners.push(u));

    // Transfer Completed
    listen<LocalSendTransferProgress>("localsend://transfer-completed", (event) => {
      setActiveTransfers((prev) => ({
        ...prev,
        [event.payload.transferId]: event.payload,
      }));

      // If this was a text transfer with text content, automatically copy to system clipboard
      if (event.payload.textContent) {
        try {
          navigator.clipboard.writeText(event.payload.textContent).catch(() => {});
        } catch {}
      }

      // Clear completed transfer after 4 seconds
      setTimeout(() => {
        setActiveTransfers((prev) => {
          const next = { ...prev };
          delete next[event.payload.transferId];
          return next;
        });
      }, 4000);
    }).then((u) => unlisteners.push(u));

    // Transfer Failed
    listen<{ transferId: string; error?: string }>("localsend://transfer-failed", (event) => {
      setActiveTransfers((prev) => {
        if (!prev[event.payload.transferId]) return prev;
        return {
          ...prev,
          [event.payload.transferId]: {
            ...prev[event.payload.transferId],
            status: "failed",
            error: event.payload.error || "Transfer failed",
          },
        };
      });
    }).then((u) => unlisteners.push(u));

    // Transfer Cancelled
    listen<{ transferId: string }>("localsend://transfer-cancelled", (event) => {
      setActiveTransfers((prev) => {
        const next = { ...prev };
        delete next[event.payload.transferId];
        return next;
      });
    }).then((u) => unlisteners.push(u));

    // Incoming Transfer Request from other device
    listen<LocalSendIncomingTransfer>("localsend://incoming-transfer", (event) => {
      setIncomingTransfer(event.payload);
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);

  const startDiscovery = useCallback(async (durationSecs = 8) => {
    setIsSearching(true);
    try {
      await invoke("localsend_start_discovery", { durationSecs });
    } catch {
      setIsSearching(false);
    }
  }, []);

  const stopDiscovery = useCallback(async () => {
    setIsSearching(false);
    try {
      await invoke("localsend_stop_discovery");
    } catch {}
  }, []);

  const sendFiles = useCallback(
    async (target: LocalSendDevice, filePaths: string[]) => {
      return await invoke<string>("localsend_send_files", {
        target,
        filePaths,
      });
    },
    []
  );

  const sendText = useCallback(
    async (target: LocalSendDevice, text: string) => {
      return await invoke<string>("localsend_send_text", {
        target,
        text,
      });
    },
    []
  );

  const cancelTransfer = useCallback(async (transferId: string) => {
    try {
      await invoke("localsend_cancel_transfer", { transferId });
    } catch {}
  }, []);

  const acceptTransfer = useCallback(async (sessionId: string) => {
    console.log("[LocalSendContext] Accepting transfer for sessionId:", sessionId);
    setIncomingTransfer(null);
    try {
      await invoke("localsend_accept_transfer", { sessionId, session_id: sessionId });
    } catch (e) {
      console.error("[LocalSendContext] Failed to invoke localsend_accept_transfer:", e);
    }
  }, []);

  const rejectTransfer = useCallback(async (sessionId: string) => {
    console.log("[LocalSendContext] Rejecting transfer for sessionId:", sessionId);
    setIncomingTransfer(null);
    try {
      await invoke("localsend_reject_transfer", { sessionId, session_id: sessionId });
    } catch (e) {
      console.error("[LocalSendContext] Failed to invoke localsend_reject_transfer:", e);
    }
  }, []);

  const probeIp = useCallback(async (ip: string) => {
    return await invoke<LocalSendDevice>("localsend_probe_ip", { ip });
  }, []);

  return (
    <LocalSendContext.Provider
      value={{
        devices,
        isSearching,
        myDevice,
        activeTransfers,
        incomingTransfer,
        startDiscovery,
        stopDiscovery,
        sendFiles,
        sendText,
        cancelTransfer,
        acceptTransfer,
        rejectTransfer,
        probeIp,
      }}
    >
      {children}
    </LocalSendContext.Provider>
  );
};

export const useLocalSend = () => {
  const context = useContext(LocalSendContext);
  if (!context) {
    throw new Error("useLocalSend must be used within a LocalSendProvider");
  }
  return context;
};
