import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ClipboardSkeleton: React.FC = () => {
  return (
    <div className="w-[580px] h-[370px] flex flex-col bg-card/95 backdrop-blur-3xl text-card-foreground select-none overflow-hidden rounded-[26px] shadow-2xl border border-border animate-in fade-in duration-150">
      {/* 2-COLUMN BODY */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT COLUMN: Search & Item List Skeleton */}
        <div className="w-[260px] flex flex-col border-r border-border bg-muted/20">
          {/* Search Header Skeleton */}
          <div className="p-2 border-b border-border">
            <Skeleton className="h-7 w-full rounded-xl" />
          </div>

          {/* List of Clipboard Items Skeleton */}
          <div className="flex-1 overflow-hidden p-1.5 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-2 rounded-xl bg-muted/40"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <Skeleton className="w-4 h-4 rounded-md flex-shrink-0" />
                  <Skeleton
                    className="h-3 rounded"
                    style={{ width: `${60 + (i % 3) * 15}%` }}
                  />
                </div>
                <Skeleton className="w-3.5 h-3.5 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Left Footer Skeleton */}
          <div className="px-2.5 py-1.5 border-t border-border flex items-center justify-between bg-muted/40">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
        </div>

        {/* RIGHT COLUMN: Inspector Preview Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 bg-card/40 p-3.5 justify-between">
          {/* Top Actions & Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          {/* Center Content Lines */}
          <div className="flex-1 py-4 flex flex-col gap-2.5">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-5/6 rounded" />
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3.5 w-4/5 rounded" />
          </div>

          {/* Bottom Metadata Bar */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipboardSkeleton;
