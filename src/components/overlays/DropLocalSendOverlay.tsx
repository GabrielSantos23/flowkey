import React, { useState } from "react";
import {
  Send,
  Search,
  Loader2,
  Smartphone,
  Tablet,
  Globe,
  Monitor,
  X,
  FileUp,
  Radio,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalSend } from "../../hooks/useLocalSend";
import { LocalSendDevice } from "../../types";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  extractDropContent,
  sendExtractedContentToDevice,
} from "../../utils/dropContent";

interface DropLocalSendOverlayProps {
  onClose: () => void;
  draggedFiles?: string[];
  draggedFilesRef?: React.RefObject<string[]>;
  hoveredFingerprint?: string | null;
}

export const DropLocalSendOverlay: React.FC<DropLocalSendOverlayProps> = ({
  onClose,
  draggedFiles = [],
  draggedFilesRef,
  hoveredFingerprint,
}) => {
  const {
    devices,
    isSearching,
    startDiscovery,
    stopDiscovery,
    sendFiles,
    sendText,
    probeIp,
  } = useLocalSend();

  const [showManualConnect, setShowManualConnect] = useState(false);
  const [manualIp, setManualIp] = useState("");
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [dragOverDevice, setDragOverDevice] = useState<string | null>(null);

  const effectiveHoveredFp = hoveredFingerprint || dragOverDevice;

  const getDeviceIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case "tablet":
        return <Tablet className="w-4 h-4 text-cyan-400" />;
      case "web":
        return <Globe className="w-4 h-4 text-amber-400" />;
      case "desktop":
      default:
        return <Monitor className="w-4 h-4 text-blue-400" />;
    }
  };

  const handleSendToDevice = async (
    target: LocalSendDevice,
    pathsToSend?: string[],
    isExplicitClick = false
  ) => {
    try {
      let paths = pathsToSend && pathsToSend.length > 0 ? pathsToSend : [];

      if (paths.length === 0 && draggedFilesRef?.current && draggedFilesRef.current.length > 0) {
        paths = draggedFilesRef.current;
      }

      if (paths.length === 0 && draggedFiles && draggedFiles.length > 0) {
        paths = draggedFiles;
      }

      // ONLY open file explorer if user explicitly clicked the button with a mouse click AND no files/text available
      if (paths.length === 0 && isExplicitClick) {
        const selected = await openFileDialog({
          multiple: true,
          title: `Select files to send to ${target.alias}`,
        });

        if (selected) {
          paths = Array.isArray(selected) ? selected : [selected];
        }
      }

      if (paths.length > 0) {
        await sendFiles(target, paths);
        onClose();
      }
    } catch (e) {
      console.error("Failed to send files", e);
    }
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    setIsConnectingManual(true);
    setManualError("");
    try {
      await probeIp(manualIp.trim());
      setManualIp("");
      setShowManualConnect(false);
    } catch (err: any) {
      setManualError(typeof err === "string" ? err : "Could not connect to device");
    } finally {
      setIsConnectingManual(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="flex flex-col gap-2.5 p-3 w-[360px] select-none text-foreground"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <Send className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Send via LocalSend</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-semibold border border-primary/30">
                AirDrop Mode
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">Select target device to send</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowManualConnect((prev) => !prev)}
            className="p-1.5 rounded-full bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95"
            title="Connect via IP"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (isSearching) stopDiscovery();
              else startDiscovery(8);
            }}
            className="p-1.5 rounded-full bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95"
            title="Search Devices"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-all active:scale-95"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Manual IP Drawer */}
      <AnimatePresence>
        {showManualConnect && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleManualConnect}
            className="overflow-hidden p-2 rounded-xl bg-card border border-border flex flex-col gap-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 192.168.15.50"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                className="flex-1 bg-background border border-input rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                autoFocus
              />
              <button
                type="submit"
                disabled={isConnectingManual || !manualIp.trim()}
                className="px-3 py-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-lg transition-all active:scale-95"
              >
                {isConnectingManual ? <Loader2 className="w-3 h-3 animate-spin" /> : "Connect"}
              </button>
            </div>
            {manualError && <div className="text-[10px] text-destructive">{manualError}</div>}
          </motion.form>
        )}
      </AnimatePresence>

      {/* Device List */}
      <div className="flex flex-col gap-1.5 max-h-[170px] overflow-y-auto custom-scrollbar pr-0.5">
        {devices.length === 0 ? (
          <div className="py-4 px-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center gap-2">
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs font-semibold text-foreground">Scanning local devices...</span>
                <span className="text-[10px] text-muted-foreground">Open LocalSend on your phone or PC</span>
              </>
            ) : (
              <>
                <Radio className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-foreground font-semibold">No devices found</span>
                <button
                  onClick={() => startDiscovery(8)}
                  className="px-3 py-1 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  Scan Network
                </button>
              </>
            )}
          </div>
        ) : (
          devices.map((device) => {
            const isHoveredTarget = effectiveHoveredFp === device.fingerprint;
            return (
              <div
                key={device.fingerprint}
                data-device-fingerprint={device.fingerprint}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverDevice(device.fingerprint);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverDevice === device.fingerprint) {
                    setDragOverDevice(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverDevice(null);

                  const content = extractDropContent(
                    e,
                    draggedFiles,
                    draggedFilesRef?.current || undefined
                  );
                  await sendExtractedContentToDevice(
                    device,
                    content,
                    sendFiles,
                    sendText,
                    onClose
                  );
                }}
                onClick={async () => {
                  const content = extractDropContent(
                    { dataTransfer: null } as any,
                    draggedFiles,
                    draggedFilesRef?.current || undefined
                  );
                  if (
                    content.type !== "none" &&
                    (content.paths.length > 0 ||
                      content.text ||
                      content.imageUrl ||
                      content.files?.length)
                  ) {
                    await sendExtractedContentToDevice(
                      device,
                      content,
                      sendFiles,
                      sendText,
                      onClose
                    );
                  } else {
                    handleSendToDevice(device, undefined, true);
                  }
                }}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  isHoveredTarget
                    ? "bg-primary/30 border-primary text-foreground scale-[1.02] shadow-lg shadow-primary/20"
                    : "bg-card hover:bg-muted border-border"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isHoveredTarget
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted border border-border"
                    }`}
                  >
                    {getDeviceIcon(device.deviceType)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                      {device.alias}
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono truncate">
                      {isHoveredTarget ? "Drop to send file / text" : device.ip}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const content = extractDropContent(
                      { dataTransfer: null } as any,
                      draggedFiles,
                      draggedFilesRef?.current || undefined
                    );
                    if (
                      content.type !== "none" &&
                      (content.paths.length > 0 ||
                        content.text ||
                        content.imageUrl ||
                        content.files?.length)
                    ) {
                      await sendExtractedContentToDevice(
                        device,
                        content,
                        sendFiles,
                        sendText,
                        onClose
                      );
                    } else {
                      handleSendToDevice(device, undefined, true);
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isHoveredTarget
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary"
                  }`}
                >
                  <FileUp className="w-3 h-3 pointer-events-none" />
                  <span className="pointer-events-none">{isHoveredTarget ? "Drop" : "Send"}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
