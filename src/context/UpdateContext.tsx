import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Update } from "@tauri-apps/plugin-updater";
import { emit, listen } from "@tauri-apps/api/event";
import { UpdaterService } from "../services/updaterService";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "up-to-date"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

export interface UpdateContextType extends UpdateState {
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  retry: () => Promise<void>;
  dismiss: () => void;
  simulateUpdate: (mockVersion?: string) => void;
}

const INITIAL_STATE: UpdateState = {
  status: "idle",
  currentVersion: "2.0.0",
};

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

const STATE_SYNC_EVENT = "updater://state-sync";

export const AppUpdaterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<UpdateState>(INITIAL_STATE);
  const updateResourceRef = useRef<Update | null>(null);
  const isSimulationRef = useRef<boolean>(false);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synchronize state across windows
  const broadcastState = useCallback((nextState: UpdateState) => {
    setState(nextState);
    try {
      emit(STATE_SYNC_EVENT, nextState).catch(() => {});
    } catch {}
  }, []);

  // Listen for sync events from peer windows
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      listen<UpdateState>(STATE_SYNC_EVENT, (event) => {
        if (event.payload) {
          setState(event.payload);
        }
      }).then((u) => {
        unlisten = u;
      });
    } catch {}

    return () => {
      if (unlisten) unlisten();
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const checkForUpdates = useCallback(
    async (manual = false) => {
      try {
        broadcastState({
          ...state,
          status: "checking",
          error: undefined,
        });

        const update = await UpdaterService.check();

        if (update && update.available) {
          updateResourceRef.current = update;
          isSimulationRef.current = false;
          broadcastState({
            status: "available",
            currentVersion: update.currentVersion || state.currentVersion,
            availableVersion: update.version,
            releaseNotes: update.body,
            error: undefined,
          });
        } else {
          updateResourceRef.current = null;
          broadcastState({
            ...state,
            status: manual ? "up-to-date" : "idle",
            error: undefined,
          });
        }
      } catch (err: unknown) {
        console.warn("[AppUpdater] Update check failed:", err);
        // Only surface error toast if manually checked or if previous status was not idle
        if (manual) {
          const msg = err instanceof Error ? err.message : String(err);
          broadcastState({
            ...state,
            status: "error",
            error: msg,
          });
        } else {
          broadcastState({
            ...state,
            status: "idle",
          });
        }
      }
    },
    [broadcastState, state],
  );

  const downloadUpdate = useCallback(async () => {
    // If running in development simulation mode
    if (isSimulationRef.current) {
      broadcastState({
        ...state,
        status: "downloading",
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: 25 * 1024 * 1024, // 25 MB
        error: undefined,
      });

      let progress = 0;
      const total = 25 * 1024 * 1024;
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);

      simIntervalRef.current = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        if (progress >= 100) {
          if (simIntervalRef.current) clearInterval(simIntervalRef.current);
          broadcastState({
            ...state,
            status: "downloaded",
            downloadProgress: 100,
            downloadedBytes: total,
            totalBytes: total,
          });
        } else {
          const currentBytes = Math.floor((progress / 100) * total);
          broadcastState({
            ...state,
            status: "downloading",
            downloadProgress: progress,
            downloadedBytes: currentBytes,
            totalBytes: total,
          });
        }
      }, 350);

      return;
    }

    const update = updateResourceRef.current;
    if (!update) {
      broadcastState({
        ...state,
        status: "error",
        error: "No pending update resource found. Please check for updates again.",
      });
      return;
    }

    try {
      broadcastState({
        ...state,
        status: "downloading",
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: undefined,
        error: undefined,
      });

      await UpdaterService.download(
        update,
        (downloadedBytes: number, totalBytes?: number) => {
          const progress =
            totalBytes && totalBytes > 0
              ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              : undefined;

          broadcastState({
            ...state,
            status: "downloading",
            downloadProgress: progress,
            downloadedBytes,
            totalBytes,
          });
        },
      );

      // Download successfully finished
      broadcastState({
        ...state,
        status: "downloaded",
        downloadProgress: 100,
        error: undefined,
      });
    } catch (err: unknown) {
      console.error("[AppUpdater] Download error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      broadcastState({
        ...state,
        status: "error",
        error: msg,
      });
    }
  }, [broadcastState, state]);

  const installUpdate = useCallback(async () => {
    if (isSimulationRef.current) {
      broadcastState({
        ...state,
        status: "installing",
        error: undefined,
      });
      setTimeout(() => {
        console.log("[AppUpdater Simulator] Simulated app restart!");
        broadcastState({
          ...state,
          status: "idle",
        });
      }, 2500);
      return;
    }

    const update = updateResourceRef.current;
    if (!update) {
      broadcastState({
        ...state,
        status: "error",
        error: "Update package not found. Please download again.",
      });
      return;
    }

    try {
      broadcastState({
        ...state,
        status: "installing",
        error: undefined,
      });

      await UpdaterService.install(update);
    } catch (err: unknown) {
      console.error("[AppUpdater] Installation error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      broadcastState({
        ...state,
        status: "error",
        error: msg,
      });
    }
  }, [broadcastState, state]);

  const retry = useCallback(async () => {
    if (updateResourceRef.current || isSimulationRef.current) {
      await downloadUpdate();
    } else {
      await checkForUpdates(true);
    }
  }, [downloadUpdate, checkForUpdates]);

  const dismiss = useCallback(() => {
    broadcastState({
      ...state,
      status: "idle",
      error: undefined,
    });
  }, [broadcastState, state]);

  const simulateUpdate = useCallback(
    (mockVersion = "2.1.0") => {
      isSimulationRef.current = true;
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      broadcastState({
        status: "available",
        currentVersion: state.currentVersion,
        availableVersion: mockVersion,
        releaseNotes: "Performance improvements and new widget additions.",
        error: undefined,
      });
    },
    [broadcastState, state.currentVersion],
  );

  // Asynchronous non-blocking update check on application startup
  useEffect(() => {
    // Only check if not already checking/available
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Expose simulation hook in dev mode on window for convenience
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__simulateAppUpdate =
        simulateUpdate;
    }
  }, [simulateUpdate]);

  return (
    <UpdateContext.Provider
      value={{
        ...state,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        retry,
        dismiss,
        simulateUpdate,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

export const useAppUpdater = (): UpdateContextType => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error("useAppUpdater must be used within an AppUpdaterProvider");
  }
  return context;
};
