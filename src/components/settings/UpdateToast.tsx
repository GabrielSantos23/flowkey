import React, { useEffect, useRef } from "react";
import { useAppUpdater } from "../../context/UpdateContext";
import { toast } from "../ui/toast";
import { Download, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export const UPDATE_TOAST_ID = "app-updater-toast";

export const UpdateToast: React.FC = () => {
  const {
    status,
    currentVersion,
    availableVersion,
    downloadProgress,
    error,
    downloadUpdate,
    installUpdate,
    retry,
  } = useAppUpdater();

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Close toast UI when leaving Settings without affecting the background update manager
      toast.close(UPDATE_TOAST_ID);
    };
  }, []);

  useEffect(() => {
    // Only render/update toast if active update status
    if (
      status !== "checking" &&
      status !== "up-to-date" &&
      status !== "available" &&
      status !== "downloading" &&
      status !== "downloaded" &&
      status !== "installing" &&
      status !== "error"
    ) {
      toast.close(UPDATE_TOAST_ID);
      return;
    }

    if (status === "checking") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "loading",
        title: "Checking for Updates",
        duration: 0,
        data: {
          icon: <RefreshCw className="size-4 text-primary animate-spin" />,
          content: (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connecting to update servers...
            </p>
          ),
        },
      });
    } else if (status === "up-to-date") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "success",
        title: "Up to Date",
        duration: 3500,
        data: {
          icon: <CheckCircle2 className="size-4 text-emerald-400" />,
          content: (
            <p className="text-xs text-muted-foreground leading-relaxed">
              FlowKey is already on the latest version (v{currentVersion}).
            </p>
          ),
        },
      });
    } else if (status === "available") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "info",
        title: "Update Available",
        duration: 0, // Keep visible until user acts or dismisses
        data: {
          icon: <Download className="size-4 text-primary" />,
          content: (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Version {availableVersion || "new"} is available.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadUpdate();
                }}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Download Update</span>
              </button>
            </div>
          ),
        },
      });
    } else if (status === "downloading") {
      const hasProgress = typeof downloadProgress === "number";
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "info",
        title: "Downloading Update",
        duration: 0,
        data: {
          icon: <Download className="size-4 text-primary animate-pulse" />,
          content: (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Version {availableVersion}</span>
                <span className="font-mono font-medium text-foreground">
                  {hasProgress ? `${downloadProgress}%` : "Downloading..."}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden border border-border/40">
                {hasProgress ? (
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${downloadProgress}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 bg-primary animate-[pulse_1.2s_infinite] rounded-full" />
                )}
              </div>
            </div>
          ),
        },
      });
    } else if (status === "downloaded") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "success",
        title: "Update Ready",
        duration: 0,
        data: {
          icon: <CheckCircle2 className="size-4 text-emerald-400" />,
          content: (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Version {availableVersion} has been downloaded successfully.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  installUpdate();
                }}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Restart & Install</span>
              </button>
            </div>
          ),
        },
      });
    } else if (status === "installing") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "loading",
        title: "Installing Update",
        duration: 0,
        data: {
          icon: <RefreshCw className="size-4 text-primary animate-spin" />,
          content: (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Restarting FlowKey...</p>
            </div>
          ),
        },
      });
    } else if (status === "error") {
      toast.show({
        id: UPDATE_TOAST_ID,
        type: "error",
        title: "Update Failed",
        duration: 0,
        data: {
          icon: <AlertCircle className="size-4 text-destructive" />,
          content: (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {error || `Unable to download version ${availableVersion || ""}.`}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  retry();
                }}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ),
        },
      });
    }
  }, [
    status,
    availableVersion,
    downloadProgress,
    error,
    downloadUpdate,
    installUpdate,
    retry,
  ]);

  return null;
};
