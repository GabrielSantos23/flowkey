import React, { useState } from "react";
import {
  Send,
  Search,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  FileUp,
  Download,
  FolderOpen,
  Plus,
  Radio,
  Clipboard,
  Type,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalSend } from "../../../hooks/useLocalSend";
import { LocalSendDevice } from "../../../types";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SizeTransitionBlur } from "../../common/SizeTransitionBlur";

export const LocalSendWidget: React.FC = () => {
  const {
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
  } = useLocalSend();

  const [showManualConnect, setShowManualConnect] = useState(false);
  const [manualIp, setManualIp] = useState("");
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const [manualError, setManualError] = useState("");

  const [showTextModal, setShowTextModal] = useState<LocalSendDevice | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const [isSendingText, setIsSendingText] = useState(false);

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

  const handlePickAndSend = async (target: LocalSendDevice) => {
    try {
      const selected = await openFileDialog({
        multiple: true,
        title: `Select files to send to ${target.alias}`,
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          await sendFiles(target, paths);
        }
      }
    } catch (e) {
      console.error("Failed to select or send files", e);
    }
  };

  const handleSendClipboard = async (target: LocalSendDevice) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        await sendText(target, text.trim());
      } else {
        setShowTextModal(target);
      }
    } catch {
      setShowTextModal(target);
    }
  };

  const handleSendTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTextModal || !textMessage.trim()) return;
    setIsSendingText(true);
    try {
      await sendText(showTextModal, textMessage.trim());
      setTextMessage("");
      setShowTextModal(null);
    } catch (err) {
      console.error("Failed to send text:", err);
    } finally {
      setIsSendingText(false);
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const activeTransferList = Object.values(activeTransfers);

  return (
    <SizeTransitionBlur className="w-full">
      <div className="w-full flex flex-col gap-3 p-3 bg-transparent text-foreground select-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">LocalSend</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                  v2.1
                </span>
              </div>
              {myDevice && (
                <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {myDevice.alias} <span className="text-muted-foreground/70 font-mono">({myDevice.ip})</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowManualConnect((prev) => !prev)}
              className="p-1 rounded-full bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95"
              title="Connect via IP"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                if (isSearching) {
                  stopDiscovery();
                } else {
                  startDiscovery(8);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 shadow-sm ${
                isSearching
                  ? "bg-primary/30 text-primary border border-primary/50"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>Searching...</span>
                </>
              ) : devices.length > 0 ? (
                <>
                  <Search className="w-3 h-3" />
                  <span>Search Again</span>
                </>
              ) : (
                <>
                  <Search className="w-3 h-3" />
                  <span>Find Devices</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Manual IP Connect Drawer */}
        <AnimatePresence>
          {showManualConnect && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleManualConnect}
              className="overflow-hidden p-2.5 rounded-xl bg-card border border-border flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-primary" /> Connect by IP
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualConnect(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

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

              {manualError && (
                <div className="text-[10px] text-destructive font-medium">{manualError}</div>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        {/* Incoming Transfer Prompt Banner */}
        <AnimatePresence>
          {incomingTransfer && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="p-3 rounded-2xl bg-card border border-primary/30 flex flex-col gap-2 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">Incoming Transfer</div>
                    <div className="text-[10px] text-primary">
                      From: <span className="font-semibold">{incomingTransfer.sender.alias}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-muted-foreground">
                  {formatBytes(incomingTransfer.totalSize)}
                </div>
              </div>

              <div className="text-[11px] text-foreground truncate bg-muted/40 px-2 py-1 rounded-lg">
                {incomingTransfer.files.map((f) => f.fileName).join(", ")}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => acceptTransfer(incomingTransfer.sessionId)}
                  className="flex-1 py-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  Accept & Save
                </button>
                <button
                  onClick={() => rejectTransfer(incomingTransfer.sessionId)}
                  className="px-3 py-1 rounded-xl bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 text-destructive text-xs font-bold transition-all active:scale-95"
                >
                  Decline
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Transfers Progress Section */}
        {activeTransferList.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              Active Transfers
            </span>
            {activeTransferList.map((t) => (
              <div
                key={t.transferId}
                className="p-2.5 rounded-xl bg-card border border-border flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[200px]">
                    {t.fileName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatBytes(t.speed)}/s
                    </span>
                    {t.status === "sending" || t.status === "receiving" ? (
                      <button
                        onClick={() => cancelTransfer(t.transferId)}
                        className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : t.status === "completed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      t.status === "completed"
                        ? "bg-emerald-500"
                        : t.status === "failed"
                        ? "bg-destructive"
                        : "bg-primary"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(t.progress * 100)}%` }}
                    transition={{ duration: 0.15 }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>
                    {formatBytes(t.transferredBytes)} / {formatBytes(t.totalBytes)}
                  </span>
                  <span>{Math.round(t.progress * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nearby Devices Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Nearby Devices ({devices.length})
            </span>
            {isSearching && (
              <span className="text-[10px] text-primary animate-pulse">
                Listening on 224.0.0.167:53317
              </span>
            )}
          </div>

          {devices.length === 0 ? (
            /* Empty State */
            <div className="py-6 px-4 rounded-2xl bg-card border border-border flex flex-col items-center justify-center text-center gap-2.5">
              {isSearching ? (
                <>
                  <div className="relative flex items-center justify-center w-10 h-10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-25"></span>
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                      <Send className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Scanning local network...
                  </div>
                  <div className="text-[10px] text-muted-foreground max-w-[220px]">
                    Make sure LocalSend is open on other devices connected to the same Wi-Fi.
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    No devices found
                  </div>
                  <button
                    onClick={() => startDiscovery(8)}
                    className="px-4 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all active:scale-95 shadow-sm"
                  >
                    Find Devices
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Discovered Devices Grid */
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-0.5">
              {devices.map((device) => (
                <div
                  key={device.fingerprint}
                  className="group flex items-center justify-between p-2 rounded-xl bg-card hover:bg-muted border border-border transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                        {device.alias}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        {device.ip}:{device.port}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSendClipboard(device)}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground text-xs transition-all active:scale-95"
                      title={`Send Clipboard to ${device.alias}`}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setShowTextModal(device)}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground text-xs transition-all active:scale-95"
                      title={`Send Text to ${device.alias}`}
                    >
                      <Type className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handlePickAndSend(device)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-bold transition-all active:scale-95"
                      title={`Send files to ${device.alias}`}
                    >
                      <FileUp className="w-3 h-3" />
                      <span>Files</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Send Text / Message Modal */}
        <AnimatePresence>
          {showTextModal && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSendTextSubmit}
              className="overflow-hidden p-2.5 rounded-xl bg-card border border-border flex flex-col gap-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" /> Send Text to {showTextModal.alias}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTextModal(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <textarea
                rows={2}
                placeholder="Type or paste message / text to send..."
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                className="w-full bg-background border border-input rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none font-sans"
                autoFocus
              />

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      if (clip) setTextMessage(clip);
                    } catch {}
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste Clipboard</span>
                </button>

                <button
                  type="submit"
                  disabled={isSendingText || !textMessage.trim()}
                  className="flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-lg transition-all active:scale-95"
                >
                  {isSendingText ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  <span>Send Text</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Quick Open Downloads Folder */}
        <div className="flex items-center justify-between pt-1 border-t border-border px-1">
          <button
            onClick={async () => {
              try {
                await invoke("show_in_folder", { path: "" });
              } catch {}
            }}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="w-3 h-3" />
            <span>Open Received Files (Downloads)</span>
          </button>
        </div>
      </div>
    </SizeTransitionBlur>
  );
};
