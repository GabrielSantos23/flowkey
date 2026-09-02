import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TrayItem, TrayInfo } from "../../../types";
import {
  Folder,
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Code,
  Archive,
  File,
  Check,
  Trash2,
  Copy,
} from "lucide-react";
import {
  extractDropContent,
  saveExtractedContentToTray,
} from "../../../utils/dropContent";
import { FileTrayShelfSkeleton } from "@/components/skeletons";

interface TrayExpandedWidgetProps {
  onMinimize?: () => void;
  onViewChange?: (view: "spotify" | "pomodoro" | "tray" | "clipboard") => void;
}

export const TrayExpandedWidget: React.FC<TrayExpandedWidgetProps> = () => {
  const [files, setFiles] = useState<TrayItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Fetch all saved files and storage info
  const fetchFiles = async () => {
    try {
      const info = await invoke<TrayInfo>("get_tray_files");
      if (info) {
        setFiles(info.items || []);
      }
    } catch (e) {
      console.error("[TrayExpandedWidget] fetchFiles error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      setIsSaving(true);
      const updated = await invoke<TrayInfo>("paste_clipboard_to_tray");
      if (updated) {
        setFiles(updated.items || []);
      }
      window.dispatchEvent(
        new CustomEvent("dynamicwin-tray-action", {
          detail: { text: "Pasted to Tray", type: "in", minimize: false },
        })
      );
    } catch (err) {
      console.warn("[TrayExpandedWidget] Paste error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Format bytes to human readable format (KB, MB, GB)
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Copy one or multiple files to system clipboard
  const handleCopyItems = async (itemsToCopy: TrayItem[]) => {
    if (itemsToCopy.length === 0) return;

    try {
      const paths = itemsToCopy.map((f) => f.path);
      await invoke("copy_tray_files_to_clipboard", { pathsOrNames: paths });

      if (itemsToCopy.length === 1) {
        setCopiedId(itemsToCopy[0].id);
        setTimeout(() => setCopiedId(null), 1500);
      } else {
        const idSet = new Set(itemsToCopy.map((f) => f.id));
        setCopiedIds(idSet);
        setTimeout(() => setCopiedIds(new Set()), 1500);
      }

      window.dispatchEvent(
        new CustomEvent("dynamicwin-tray-action", {
          detail: {
            text:
              itemsToCopy.length > 1
                ? `Copied ${itemsToCopy.length} Files`
                : "Copied to Clipboard",
            type: "out",
            minimize: false,
          },
        })
      );
    } catch (err) {
      console.error("[TrayExpandedWidget] copy error:", err);
    }
  };

  // Single click: Select or deselect item
  const toggleSelect = (item: TrayItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hasMovedRef.current) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  // Double click: Copy individual file immediately
  const handleDoubleClick = async (item: TrayItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await handleCopyItems([item]);
  };

  // Select all or deselect all items
  const handleSelectAllToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIds.size === files.length && files.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  // Keyboard shortcut support (Ctrl+A to select all, Ctrl+C to copy selected)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAllToggle();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          const items = files.filter((f) => selectedIds.has(f.id));
          handleCopyItems(items);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files, selectedIds]);

  // Delete selected items
  const handleDeleteSelected = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length === 0) return;

    const idsToDelete =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : files.map((f) => f.id);

    const itemsToDelete = files.filter((f) => idsToDelete.includes(f.id));

    for (const item of itemsToDelete) {
      try {
        await invoke("remove_tray_file", { pathOrName: item.path });
      } catch {}
    }

    setFiles((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
    setSelectedIds(new Set());
    fetchFiles();
  };

  // Remove individual item via '✕' badge
  const handleRemoveSingle = async (item: TrayItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("remove_tray_file", { pathOrName: item.path });
      setFiles((prev) => prev.filter((f) => !item.id.includes(f.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      fetchFiles();
    } catch {}
  };



  // Drop files or web images into the tray
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const content = extractDropContent(e);
    if (content.type !== "none") {
      setIsSaving(true);
      setSaveProgress(20);
      const t1 = setTimeout(() => setSaveProgress(60), 120);
      const t2 = setTimeout(() => setSaveProgress(90), 240);

      try {
        const updated = await saveExtractedContentToTray(content);
        clearTimeout(t1);
        clearTimeout(t2);
        setSaveProgress(100);

        if (updated) {
          setFiles(updated.items || []);
        } else {
          await fetchFiles();
        }

        window.dispatchEvent(
          new CustomEvent("dynamicwin-tray-action", {
            detail: { text: "Saved to File Tray", type: "in", minimize: true },
          })
        );
      } catch (err) {
        clearTimeout(t1);
        clearTimeout(t2);
        console.error("[TrayExpandedWidget] Drop save failed:", err);
      } finally {
        setTimeout(() => {
          setIsSaving(false);
          setSaveProgress(0);
        }, 400);
      }
    }
  };

  // Pointer drag for horizontal scrolling
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-tray-item]") || target.closest("button")) {
      return;
    }
    if (!scrollRef.current) return;
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current || !scrollRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 4) {
      hasMovedRef.current = true;
      scrollRef.current.scrollLeft = scrollLeftRef.current - dx;
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    // If holding Shift or swiping horizontally on trackpad, scroll the file shelf horizontally
    if (e.shiftKey || (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 0)) {
      e.stopPropagation();
      scrollRef.current.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY;
    }
    // Normal vertical mouse wheel (deltaY) will NOT call stopPropagation,
    // allowing it to bubble up to DynamicIsland to switch widgets smoothly!
  };

  // Render squircle file icon based on file type
  const renderItemVisual = (item: TrayItem) => {
    if (item.is_dir) {
      return (
        <div className="w-full h-full bg-amber-500/20 flex items-center justify-center">
          <Folder className="w-6 h-6 text-amber-400" />
        </div>
      );
    }

    const e = item.extension.toLowerCase();

    if (["png", "jpg", "jpeg", "svg", "webp", "gif", "bmp", "ico", "avif"].includes(e)) {
      if (item.thumbnail) {
        return (
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        );
      }
      return (
        <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-purple-400" />
        </div>
      );
    }

    if (["mp3", "wav", "flac", "m4a", "ogg", "aac"].includes(e)) {
      return (
        <div className="w-full h-full bg-emerald-500/20 flex items-center justify-center">
          <Music className="w-6 h-6 text-emerald-400" />
        </div>
      );
    }

    if (["mp4", "mkv", "mov", "webm", "avi"].includes(e)) {
      return (
        <div className="w-full h-full bg-rose-500/20 flex items-center justify-center">
          <Video className="w-6 h-6 text-rose-400" />
        </div>
      );
    }

    if (["zip", "tar", "gz", "rar", "7z", "bz2", "xz"].includes(e)) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-400 flex items-center justify-center">
          <Archive className="w-6 h-6 text-neutral-900" />
        </div>
      );
    }

    if (["ts", "tsx", "js", "jsx", "rs", "py", "json", "html", "css", "c", "cpp", "go"].includes(e)) {
      return (
        <div className="w-full h-full bg-cyan-500/20 flex items-center justify-center">
          <Code className="w-6 h-6 text-cyan-400" />
        </div>
      );
    }

    if (["txt", "md", "pdf", "docx", "doc", "odt", "rtf"].includes(e)) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-white to-neutral-300 flex items-center justify-center">
          <FileText className="w-6 h-6 text-neutral-900" />
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
        <File className="w-6 h-6 text-neutral-300" />
      </div>
    );
  };

  const isAllSelected = files.length > 0 && selectedIds.size === files.length;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className="relative w-full flex flex-col gap-2 select-none"
    >


      {/* 2. HORIZONTAL FILE SHELF */}
      <div className="relative w-full h-[96px] flex items-center select-none overflow-hidden rounded-[20px] bg-card border border-border">
        {/* Left Side Blur & Fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 z-20 pointer-events-none bg-gradient-to-r from-background via-background/70 to-transparent backdrop-blur-[2px]" />

        {/* Right Side Blur & Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 z-20 pointer-events-none bg-gradient-to-l from-background via-background/70 to-transparent backdrop-blur-[2px]" />

        {/* Drag-Over / Saving Overlay */}
        {(isDragOver || isSaving) && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md rounded-[20px] border-2 border-dashed border-primary/80 p-3 transition-all">
            <div className="flex items-center gap-2 mb-1.5">
              <UploadCloud className="w-4 h-4 text-primary animate-bounce" />
              <span className="text-xs font-semibold text-foreground">
                {isSaving ? "Saving to Tray..." : "Drop to save in Tray"}
              </span>
            </div>

            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300 bg-primary"
                style={{ width: isSaving ? `${saveProgress}%` : "100%" }}
              />
            </div>
          </div>
        )}

        {/* Horizontal Scroll Shelf */}
        <div
          ref={scrollRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full overflow-x-auto flex items-center gap-3 px-6 py-2 no-scrollbar cursor-grab active:cursor-grabbing touch-none z-10"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {isLoading ? (
            <FileTrayShelfSkeleton count={5} />
          ) : files.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center gap-2 text-muted-foreground text-xs">
              <UploadCloud className="w-4 h-4 text-muted-foreground animate-bounce" />
              <span>Drag & drop files or web images here</span>
            </div>
          ) : (
            files.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  data-tray-item="true"
                  onClick={(e) => toggleSelect(item, e)}
                  onDoubleClick={(e) => handleDoubleClick(item, e)}
                  className="group relative flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
                  title={`${item.name} (${formatBytes(item.size_bytes)} • Click to select • Double-click to copy)`}
                >
                  {/* Squircle Card */}
                  <div
                    className={`w-14 h-14 rounded-[16px] overflow-hidden bg-muted/40 border transition-all duration-150 relative shadow-md ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30 scale-105 shadow-xl"
                        : "border-border hover:border-border group-hover:scale-105"
                    }`}
                  >
                    {renderItemVisual(item)}

                    {/* Copied feedback overlay */}
                    {(copiedId === item.id || copiedIds.has(item.id)) && (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center z-20 text-emerald-400">
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </div>
                    )}

                    {/* Top-Right '✕' delete badge */}
                    <button
                      onClick={(e) => handleRemoveSingle(item, e)}
                      className="w-4 h-4 rounded-full bg-card hover:bg-destructive border border-border text-foreground hover:text-destructive-foreground flex items-center justify-center absolute top-1 right-1 shadow-md transition-all opacity-0 group-hover:opacity-100 z-30"
                      title="Remove from Tray"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Item Name Label */}
                  <span className="text-[10px] text-foreground font-medium text-center truncate w-14 mt-1 leading-tight tracking-tight">
                    {item.name}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Bottom-Right Action Buttons */}
        {files.length > 0 && (
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 z-30 pointer-events-auto">
            {/* Copy Selected Button - Only appears when 2 or more items are selected */}
            {selectedIds.size >= 2 && (
              <button
                onClick={() => {
                  const items = files.filter((f) => selectedIds.has(f.id));
                  handleCopyItems(items);
                }}
                className="h-6 px-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] flex items-center gap-1.5 transition-all shadow-lg active:scale-95 animate-fade-in"
                title={`Copy ${selectedIds.size} selected files (Ctrl+C)`}
              >
                <Copy className="w-3 h-3 stroke-[2.5]" />
                <span>Copy ({selectedIds.size})</span>
              </button>
            )}

            {/* Select All Tick Button */}
            <button
              onClick={handleSelectAllToggle}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 border ${
                isAllSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-primary/20"
                  : selectedIds.size > 0
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted"
              }`}
              title={isAllSelected ? "Deselect All" : "Select All"}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Delete Trash Button */}
            <button
              onClick={handleDeleteSelected}
              className="w-6 h-6 rounded-full bg-card hover:bg-destructive text-muted-foreground hover:text-destructive-foreground border border-border flex items-center justify-center transition-all shadow-lg active:scale-90"
              title={
                selectedIds.size > 0
                  ? `Delete Selected (${selectedIds.size})`
                  : "Delete All Files"
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default TrayExpandedWidget;
