"use client";

import { Toast } from "@base-ui/react/toast";
import {
  CheckCircleIcon,
  CircleAlertIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppToastType =
  | "error"
  | "info"
  | "loading"
  | "success"
  | "warning";

export interface AppToastData {
  /**
   * Optional custom icon.
   * If omitted, the default icon for the toast type is used.
   */
  icon?: ReactNode;
  /**
   * Optional custom card content (e.g. progress bar, bottom action button).
   */
  content?: ReactNode;
}

const toastManager = Toast.createToastManager<AppToastData>();

type ToastId = ReturnType<typeof toastManager.add>;

const TOAST_ICONS = {
  error: CircleAlertIcon,
  info: InfoIcon,
  loading: LoaderCircleIcon,
  success: CheckCircleIcon,
  warning: TriangleAlertIcon,
} as const;

/**
 * Adds a toast to the global toast manager.
 */
function showToast(options: {
  type?: AppToastType;
  title: string;
  description?: string;
  duration?: number;
  data?: AppToastData;
}) {
  return toastManager.add({
    type: options.type ?? "info",
    title: options.title,
    description: options.description,
    timeout: options.duration,
    data: options.data,
  });
}

/**
 * Convenience API.
 */
const toast = {
  success: (
    title: string,
    description?: string,
    options?: { duration?: number },
  ) =>
    showToast({
      type: "success",
      title,
      description,
      duration: options?.duration,
    }),

  error: (
    title: string,
    description?: string,
    options?: { duration?: number },
  ) =>
    showToast({
      type: "error",
      title,
      description,
      duration: options?.duration,
    }),

  info: (
    title: string,
    description?: string,
    options?: { duration?: number },
  ) =>
    showToast({
      type: "info",
      title,
      description,
      duration: options?.duration,
    }),

  warning: (
    title: string,
    description?: string,
    options?: { duration?: number },
  ) =>
    showToast({
      type: "warning",
      title,
      description,
      duration: options?.duration,
    }),

  loading: (
    title: string,
    description?: string,
    options?: { duration?: number },
  ) =>
    showToast({
      type: "loading",
      title,
      description,
      duration: options?.duration,
    }),

  close: (id: ToastId) => {
    toastManager.close(id);
  },

  show: (options: {
    id?: string;
    type?: AppToastType;
    title: string | ReactNode;
    description?: string | ReactNode;
    duration?: number;
    data?: AppToastData;
    actionProps?: React.ComponentPropsWithoutRef<"button">;
  }) => {
    return toastManager.add({
      id: options.id,
      type: options.type ?? "info",
      title: options.title,
      description: options.description,
      timeout: options.duration,
      data: options.data,
      actionProps: options.actionProps,
    });
  },

  update: (
    id: string,
    options: {
      type?: AppToastType;
      title?: string | ReactNode;
      description?: string | ReactNode;
      duration?: number;
      data?: AppToastData;
      actionProps?: React.ComponentPropsWithoutRef<"button">;
    },
  ) => {
    toastManager.update(id, {
      type: options.type,
      title: options.title,
      description: options.description,
      timeout: options.duration,
      data: options.data,
      actionProps: options.actionProps,
    });
  },
};

type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
}

function ToastProvider({
  children,
  position = "top-right",
  ...props
}: ToastProviderProps) {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      {children}
      <Toasts position={position} />
    </Toast.Provider>
  );
}

function Toasts({ position }: { position: ToastPosition }) {
  const { toasts } = Toast.useToastManager<AppToastData>();

  const isTop = position.startsWith("top");

  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          "fixed z-[100] mx-auto flex",
          "w-[calc(100%-var(--toast-inset)*2)]",
          "max-w-90",
          "[--toast-inset:1rem]",

          "sm:[--toast-inset:2rem]",

          // Position
          "data-[position*=top]:top-[var(--toast-inset)]",
          "data-[position*=bottom]:bottom-[var(--toast-inset)]",

          "data-[position*=left]:left-[var(--toast-inset)]",
          "data-[position*=right]:right-[var(--toast-inset)]",

          "data-[position*=center]:left-1/2",
          "data-[position*=center]:-translate-x-1/2",
        )}
        data-position={position}
      >
        {toasts.map((toast, index) => {
          const Icon =
            toast.type && toast.type in TOAST_ICONS
              ? TOAST_ICONS[toast.type as AppToastType]
              : InfoIcon;

          const customIcon = toast.data?.icon;

          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              data-position={position}
              style={
                {
                  "--toast-index": index,
                } as CSSProperties
              }
              swipeDirection={
                position.includes("center")
                  ? [isTop ? "up" : "down"]
                  : position.includes("left")
                    ? ["left", isTop ? "up" : "down"]
                    : ["right", isTop ? "up" : "down"]
              }
              className={cn(
                // Base
                "dropdown-glass",
                "relative",
                "w-full",
                "overflow-visible",
                "rounded-lg",
                "text-popover-foreground",
                "shadow-xl",
                "shadow-black/25",

                // Animation
                "transition-[transform,opacity]",
                "duration-500",
                "[transition-timing-function:cubic-bezier(.22,1,.36,1)]",

                // Stack
                "mb-3",
                "data-[index]:",

                // Starting animation
                "data-starting-style:opacity-0",

                "data-[position*=top]:data-starting-style:-translate-y-full",
                "data-[position*=bottom]:data-starting-style:translate-y-full",

                "data-[position*=right]:data-starting-style:translate-x-full",

                // Ending animation
                "data-ending-style:opacity-0",

                "data-[position*=top]:data-ending-style:-translate-y-full",
                "data-[position*=bottom]:data-ending-style:translate-y-full",

                "data-[position*=right]:data-ending-style:translate-x-full",

                // Swipe
                "data-[swipe-direction=left]:translate-x-[calc(var(--toast-swipe-movement-x)-100%-1rem)]",
                "data-[swipe-direction=right]:translate-x-[calc(var(--toast-swipe-movement-x)+100%+1rem)]",
                "data-[swipe-direction=up]:-translate-y-[calc(var(--toast-swipe-movement-y)+100%+1rem)]",
                "data-[swipe-direction=down]:translate-y-[calc(var(--toast-swipe-movement-y)+100%+1rem)]",
              )}
            >
              {/* Corner dismiss button */}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => toastManager.close(toast.id)}
                className={cn(
                  "absolute",
                  "-right-1.5",
                  "-top-1.5",
                  "z-20",

                  "inline-flex",
                  "size-6",
                  "shrink-0",
                  "cursor-pointer",
                  "items-center",
                  "justify-center",

                  "rounded-full",

                  "border",
                  "border-border/60",

                  "bg-popover/92",
                  "text-muted-foreground",

                  "shadow-sm",
                  "backdrop-blur-sm",

                  "outline-none",

                  "transition-[color,background-color,box-shadow]",

                  "hover:bg-popover",
                  "hover:text-foreground",

                  "focus-visible:ring-2",
                  "focus-visible:ring-ring",
                  "focus-visible:ring-offset-1",
                  "focus-visible:ring-offset-background",
                )}
              >
                <XIcon
                  className="size-3"
                  strokeWidth={2.25}
                />
              </button>

              <Toast.Content
                className={cn(
                  "pointer-events-auto",
                  "flex",
                  "min-h-0",
                  "overflow-visible",
                  "text-sm",
                  "transition-opacity",
                  "duration-250",
                  toast.data?.content
                    ? "flex-col p-3.5 pr-8 gap-2.5 items-stretch"
                    : "items-center justify-between gap-1.5 py-3 pl-3.5 pr-10",
                )}
              >
                {toast.data?.content ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex",
                          "size-4",
                          "shrink-0",
                          "items-center",
                          "justify-center",
                          "[&>svg]:size-4",
                          "[&>svg]:shrink-0",
                        )}
                      >
                        {customIcon ?? (
                          <Icon
                            className={cn(
                              "pointer-events-none",
                              toast.type === "error" && "text-destructive",
                              toast.type === "info" && "text-info",
                              toast.type === "success" && "text-success",
                              toast.type === "warning" && "text-warning",
                              toast.type === "loading" && "animate-spin opacity-80",
                            )}
                          />
                        )}
                      </div>
                      <Toast.Title className="min-w-0 truncate font-semibold text-xs text-foreground leading-tight" />
                    </div>
                    {toast.data.content}
                  </>
                ) : (
                  <>
                    {/* Left content */}
                    <div className="flex min-w-0 flex-1 gap-2">
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex",
                          "h-lh",
                          "w-4",
                          "shrink-0",
                          "items-center",
                          "justify-center",
                          "[&>svg]:size-4",
                          "[&>svg]:shrink-0",
                        )}
                      >
                        {customIcon ?? (
                          <Icon
                            className={cn(
                              "pointer-events-none",
                              toast.type === "error" && "text-destructive",
                              toast.type === "info" && "text-info",
                              toast.type === "success" && "text-success",
                              toast.type === "warning" && "text-warning",
                              toast.type === "loading" && "animate-spin opacity-80",
                            )}
                          />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Toast.Title className="min-w-0 wrap-break-word font-medium" />

                        {toast.description && (
                          <Toast.Description
                            className={cn(
                              "min-w-0",
                              "wrap-break-word",
                              "text-muted-foreground",
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Optional action */}
                    {toast.actionProps && (
                      <Toast.Action
                        className={cn(
                          "shrink-0",
                          "rounded-md",
                          "bg-primary",
                          "px-2.5",
                          "py-1.5",
                          "text-xs",
                          "font-medium",
                          "text-primary-foreground",
                          "transition-colors",
                          "hover:bg-primary/90",
                        )}
                      >
                        {toast.actionProps.children}
                      </Toast.Action>
                    )}
                  </>
                )}
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export {
  ToastProvider,
  toast,
  toastManager,
};

export type {
  ToastPosition,
  ToastId,
};
