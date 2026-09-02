import { Inbox, Check, Copy } from "lucide-react";

export const TraySavingToast = () => (
  <div className="flex items-center justify-between gap-3 px-4 py-2 w-[340px] select-none text-foreground">
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="w-7 h-7 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center flex-shrink-0 animate-pulse">
        <Inbox className="w-4 h-4 stroke-[2.5]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-foreground truncate">Saving to File Tray...</div>
        <div className="text-[10px] text-muted-foreground">Downloading & caching file</div>
      </div>
    </div>
    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden relative flex-shrink-0">
      <div className="h-full bg-primary rounded-full animate-pulse w-full" />
    </div>
  </div>
);

export const TrayConfirmedToast = ({ type }: { type: "in" | "out" | undefined }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2 w-[320px] select-none text-foreground">
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      >
        {type === "in" ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-foreground truncate">
          {type === "in" ? "Saved to File Tray" : "Copied to Clipboard"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {type === "in" ? "Ready in File Tray" : "Ready to paste (Ctrl+V)"}
        </div>
      </div>
    </div>
    <span
      className="text-[9px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    >
      {type === "in" ? "Saved" : "Copied"}
    </span>
  </div>
);
