import React from "react";
import { Download, Upload, CheckCircle2, AlertCircle, X, Clipboard, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { LocalSendTransferProgress } from "../../types";

interface TransferProgressOverlayProps {
  transfer: LocalSendTransferProgress;
  onCancel: (transferId: string) => void;
}

export const TransferProgressOverlay: React.FC<TransferProgressOverlayProps> = ({
  transfer,
  onCancel,
}) => {
  const isSending = transfer.status === "sending";
  const isCompleted = transfer.status === "completed";
  const isFailed = transfer.status === "failed";
  const isText = Boolean(transfer.textContent) || transfer.fileName === "Text.txt";

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const percent = Math.min(100, Math.max(0, Math.round(transfer.progress * 100)));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="flex flex-col gap-1.5 px-3.5 py-2 w-full select-none text-foreground"
    >
      {/* Top row: Icon + Filename + Speed / State */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status Indicator Icon */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              isCompleted
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : isFailed
                ? "bg-destructive/20 text-destructive border border-destructive/40"
                : "bg-primary/20 text-primary border border-primary/40"
            }`}
          >
            {isCompleted ? (
              isText ? (
                <Clipboard className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )
            ) : isFailed ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : isText ? (
              <MessageSquare className="w-3 h-3 text-primary animate-pulse" />
            ) : isSending ? (
              <Upload className="w-3 h-3 animate-pulse stroke-[2.5]" />
            ) : (
              <Download className="w-3 h-3 animate-pulse stroke-[2.5]" />
            )}
          </div>

          {/* Filename & Transfer Type Tag */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                {isText ? "Text Message" : transfer.fileName}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold border ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-primary/20 text-primary border-primary/30"
                }`}
              >
                {isText
                  ? isCompleted
                    ? "Copied to Clipboard"
                    : "Receiving Text"
                  : isSending
                  ? "Sending"
                  : "Receiving"}
              </span>
            </div>
          </div>
        </div>

        {/* Speed / Percentage / Cancel Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isCompleted && !isFailed && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {formatBytes(transfer.speed)}/s
            </span>
          )}
          <span
            className={`text-xs font-mono font-bold ${
              isCompleted
                ? "text-emerald-400"
                : isFailed
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {isCompleted ? (isText ? "Copied" : "Done") : isFailed ? "Failed" : `${percent}%`}
          </span>

          {!isCompleted && !isFailed && (
            <button
              onClick={() => onCancel(transfer.transferId)}
              className="p-1 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive text-muted-foreground active:scale-90 transition-all ml-0.5"
              title="Cancel Transfer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Animated Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden relative">
        <motion.div
          className={`h-full rounded-full ${
            isFailed
              ? "bg-destructive"
              : isCompleted
              ? "bg-emerald-500"
              : "bg-primary"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.15, ease: "linear" }}
        />
      </div>

      {/* Text preview / Bytes breakdown */}
      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground px-0.5">
        {transfer.textContent ? (
          <span className="text-foreground truncate max-w-[280px] italic">
            "{transfer.textContent}"
          </span>
        ) : (
          <span>
            {formatBytes(transfer.transferredBytes)} of {formatBytes(transfer.totalBytes)}
          </span>
        )}
        {transfer.error && (
          <span className="text-destructive truncate max-w-[160px]">{transfer.error}</span>
        )}
      </div>
    </motion.div>
  );
};
