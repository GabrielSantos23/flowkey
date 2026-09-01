import React from "react";
import { Download, Check, X, Smartphone, Monitor, Tablet, Globe, File, MessageSquare, Clipboard } from "lucide-react";
import { motion } from "framer-motion";
import { LocalSendIncomingTransfer } from "../../types";

interface IncomingTransferOverlayProps {
  transfer: LocalSendIncomingTransfer;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingTransferOverlay: React.FC<IncomingTransferOverlayProps> = ({
  transfer,
  onAccept,
  onReject,
}) => {
  const isText =
    transfer.files.length === 1 &&
    (transfer.files[0].fileType.startsWith("text/plain") ||
      transfer.files[0].fileName.endsWith(".txt") ||
      transfer.files[0].fileName === "Text.txt" ||
      transfer.files[0].fileName === "text.txt");

  const textPreview = isText && transfer.files[0].preview ? transfer.files[0].preview : null;

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const fileSummary = isText
    ? textPreview || "Text Message"
    : transfer.files.length === 1
    ? transfer.files[0].fileName
    : `${transfer.files.length} files (${formatBytes(transfer.totalSize)})`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="flex items-center justify-between gap-3 px-3.5 py-2 w-full select-none text-white"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="relative flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center bg-zinc-900 border border-white/20 ${
              isText
                ? " "
                : " text-emerald-400"
            }`}
          >
            {getDeviceIcon(transfer.sender.deviceType)}
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black ${
              isText ? "bg-amber-400" : "bg-emerald-500"
            }`}
          >
            {isText ? (
              <MessageSquare className="w-2 h-2 stroke-[3]" />
            ) : (
              <Download className="w-2 h-2 stroke-[3]" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate max-w-[130px]">
              {transfer.sender.alias}
            </span>

          </div>
          <div className="flex items-center gap-1 text-[10px] text-neutral-300 truncate font-mono">
            {isText ? (
              <MessageSquare className="w-2.5 h-2.5 flex-shrink-0 text-amber-400" />
            ) : (
              <File className="w-2.5 h-2.5 flex-shrink-0 text-neutral-500" />
            )}
            <span className="truncate italic">"{fileSummary}"</span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onReject}
          className="p-1.5 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 active:scale-90 transition-all"
          title="Decline"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onAccept}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-black text-xs font-bold active:scale-95 shadow-md transition-all ${
            isText
              ? "bg-amber-400 hover:bg-amber-300 shadow-amber-500/20"
              : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
          }`}
          title={isText ? "Receive & Copy Text" : "Accept & Save"}
        >
          {isText ? (
            <>
              <Clipboard className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Copy</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Accept</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
