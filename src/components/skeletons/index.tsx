import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export interface SpotifyQueueSkeletonProps {
  count?: number;
}

export const SpotifyQueueSkeleton: React.FC<SpotifyQueueSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="flex flex-col gap-1.5 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-1 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Album Cover Skeleton */}
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />

            {/* Track Title and Artist Skeleton */}
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>

          {/* Action Button Skeleton */}
          <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 ml-2" />
        </div>
      ))}
    </div>
  );
};

export const MediaWidgetSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-3 p-3 w-full">
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
    </div>
  );
};

export const ClipboardItemSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="flex flex-col gap-2 w-full p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-card border border-border">
          <Skeleton className="w-6 h-6 rounded-lg flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const FileTrayShelfSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="flex items-center gap-3 px-6 py-2 w-full h-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center flex-shrink-0 gap-1.5">
          <Skeleton className="w-14 h-14 rounded-[16px]" />
          <Skeleton className="h-2.5 w-12 rounded" />
        </div>
      ))}
    </div>
  );
};

export { Skeleton };
export { ClipboardSkeleton } from "./ClipboardSkeleton";

