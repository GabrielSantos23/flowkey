import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Star,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Globe,
  Image as ImageIcon,
  Mail,
  File,
  Folder,
  Send,
  Command,
  Layers,
  Sparkles,
} from "lucide-react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardItem } from "../../../types/clipboard";
import { ClipboardSkeleton } from "@/components/skeletons";

export const ClipboardHistory: React.FC = () => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Real-time clipboard capture listener
  useEffect(() => {
    let unlistenHistory: UnlistenFn | undefined;
    let unlistenItem: UnlistenFn | undefined;
    let isMounted = true;

    // 1. Initial history fetch from backend
    invoke<ClipboardItem[]>("load_clipboard_history")
      .then((history) => {
        if (isMounted) {
          if (history && history.length > 0) {
            setItems(history);
            setSelectedId((current) => current || history[0].id);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    // 2. Listen for live full history updates emitted from Rust backend
    listen<ClipboardItem[]>("clipboard-history-updated", (event) => {
      if (isMounted && event.payload && event.payload.length > 0) {
        setItems(event.payload);
        setSelectedId(event.payload[0].id);
      }
    }).then((u) => {
      if (isMounted) unlistenHistory = u;
      else u();
    });

    // 3. Listen for individual captured items
    listen<ClipboardItem>("clipboard-item-captured", (event) => {
      if (isMounted && event.payload) {
        const newItem = event.payload;
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.content === newItem.content);
          if (idx !== -1) {
            const updated = { ...prev[idx], ...newItem, timestamp: newItem.timestamp };
            return [updated, ...prev.filter((_, i) => i !== idx)];
          }
          return [newItem, ...prev];
        });
        setSelectedId(newItem.id);
      }
    }).then((u) => {
      if (isMounted) unlistenItem = u;
      else u();
    });

    // 4. Refresh on window focus
    const handleFocus = () => {
      invoke<ClipboardItem[]>("load_clipboard_history")
        .then((history) => {
          if (isMounted && history && history.length > 0) {
            setItems(history);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      if (unlistenHistory) unlistenHistory();
      if (unlistenItem) unlistenItem();
    };
  }, []);

  // Filter and sort items: Pinned first, then sorted by timestamp desc
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.metadata?.appName &&
            item.metadata.appName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.timestamp - a.timestamp;
      });
  }, [items, searchQuery]);

  // Keep selectedId valid
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!filteredItems.some((i) => i.id === selectedId)) {
        setSelectedId(filteredItems[0].id);
      }
    }
  }, [filteredItems, selectedId]);

  // Scroll active item into view during keyboard navigation
  useEffect(() => {
    if (selectedId) {
      const el = itemRefs.current.get(selectedId);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedId]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedId) || filteredItems[0] || null;
  }, [items, selectedId, filteredItems]);

  // Toggle pin directly in backend
  const handleTogglePin = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const updated = await invoke<ClipboardItem[]>("toggle_pin_clipboard_item", { id });
      if (updated) setItems(updated);
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isPinned: !i.isPinned } : i))
      );
    }
  };

  // Delete item directly in backend
  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const updated = await invoke<ClipboardItem[]>("delete_clipboard_item", { id });
      if (updated) {
        setItems(updated);
        if (selectedId === id && updated.length > 0) {
          setSelectedId(updated[0].id);
        }
      }
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Copy item content to system clipboard
  const handleCopyContent = async (
    item: ClipboardItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    try {
      if (item.type === "image") {
        await invoke("set_clipboard_image", { dataBase64: item.content });
      } else {
        await invoke("set_clipboard_text", { text: item.content });
        await navigator.clipboard.writeText(item.content).catch(() => {});
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error("Failed to copy item to system clipboard", err);
      try {
        await navigator.clipboard.writeText(item.content);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1800);
      } catch {}
    }
  };

  // Format date time
  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Global Keyboard navigation for the ClipboardHistory widget
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;
      const currentIndex = filteredItems.findIndex((i) => i.id === selectedId);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % filteredItems.length;
        setSelectedId(filteredItems[nextIndex].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          (currentIndex - 1 + filteredItems.length) % filteredItems.length;
        setSelectedId(filteredItems[prevIndex].id);
      } else if (e.key === "Enter") {
        if (selectedItem) {
          e.preventDefault();
          handleCopyContent(selectedItem);
        }
      } else if (e.key === "Escape") {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [filteredItems, selectedId, selectedItem, searchQuery]);

  // Leading icon: Only personalized for images, links, email, color, and folders. For the rest, show default <File /> icon!
  const getItemLeadingIcon = (item: ClipboardItem) => {
    switch (item.type) {
      case "color":
        return (
          <div
            className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20 shadow-sm"
            style={{ backgroundColor: item.content }}
          />
        );
      case "image":
        return (
          <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-neutral-800 border border-white/10 flex items-center justify-center">
            {item.previewUrl || item.content.startsWith("data:") ? (
              <img
                src={item.previewUrl || item.content}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-3 h-3 text-purple-400" />
            )}
          </div>
        );
      case "link":
        return <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
      case "email":
        return <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
      case "folder":
        return <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      default:
        return <File className="w-4 h-4 text-neutral-400 flex-shrink-0" />;
    }
  };

  const getAppBadge = (appName?: string) => {
    const name = appName?.toLowerCase() || "";
    if (name.includes("safari")) {
      return <Globe className="w-3 h-3 text-cyan-400" />;
    } else if (name.includes("chrome")) {
      return <Globe className="w-3 h-3 text-amber-400" />;
    } else if (name.includes("firefox")) {
      return <Globe className="w-3 h-3 text-orange-400" />;
    } else if (name.includes("figma")) {
      return <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />;
    } else if (name.includes("code") || name.includes("vscode")) {
      return <File className="w-3 h-3 text-blue-400" />;
    } else if (name.includes("mail") || name.includes("thunderbird")) {
      return <Mail className="w-3 h-3 text-emerald-400" />;
    } else if (name.includes("finder") || name.includes("file") || name.includes("nautilus")) {
      return <Folder className="w-3 h-3 text-blue-400" />;
    } else if (name.includes("openai") || name.includes("chatgpt")) {
      return <Sparkles className="w-3 h-3 text-emerald-400" />;
    }
    return <Layers className="w-3 h-3 text-neutral-400" />;
  };

  if (isLoading) {
    return <ClipboardSkeleton />;
  }

  return (
    <div className="w-[580px] h-[370px] flex flex-col bg-card/95 backdrop-blur-3xl text-card-foreground select-none overflow-hidden rounded-[26px] shadow-2xl border border-border">
      {/* 2-COLUMN MAIN BODY */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT COLUMN: Search & Item List */}
        <div className="w-[260px] flex flex-col border-r border-border bg-muted/20">
          {/* Search Header */}
          <div className="p-2 border-b border-border">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="w-full bg-background hover:bg-muted focus:bg-background border border-input focus:border-primary rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              ) : (
                <div className="absolute right-2 pointer-events-none flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                  <Command className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          </div>

          {/* List of Clipboard Items */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar"
          >
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                <Search className="w-6 h-6 mb-1 opacity-40" />
                <span className="text-xs">
                  {searchQuery
                    ? "No matches found"
                    : "Copy text, images, or files to build history"}
                </span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
                    }}
                    onClick={() => setSelectedId(item.id)}
                    className={`group relative flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/20 text-foreground shadow-sm border border-primary/30 font-medium"
                        : "hover:bg-muted text-muted-foreground border border-transparent"
                    }`}
                  >
                    {/* Leading Icon & Snippet */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                      {getItemLeadingIcon(item)}
                      <span className="text-xs truncate">{item.title}</span>
                    </div>

                    {/* Pin Action */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(item.id, e)}
                      className={`p-1 rounded-md transition-all ${
                        item.isPinned
                          ? "text-primary opacity-100"
                          : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                      }`}
                      title={item.isPinned ? "Unpin item" : "Pin item"}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          item.isPinned ? "fill-primary" : ""
                        }`}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Left Footer Shortcuts */}
          <div className="px-2.5 py-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">
                ↓↑
              </span>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">
                ↵
              </span>
              <span>Copy</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Rich Contextual Inspector & Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-card/40">
          {selectedItem ? (
            <>
              {/* Header Action Bar */}
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyContent(selectedItem)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                      copiedId === selectedItem.id
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {copiedId === selectedItem.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {selectedItem.type === "link" && (
                    <a
                      href={selectedItem.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-foreground hover:text-foreground bg-secondary hover:bg-accent border border-border transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open in Browser</span>
                    </a>
                  )}

                  {selectedItem.type === "email" && (
                    <a
                      href={`mailto:${selectedItem.content}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-foreground hover:text-foreground bg-secondary hover:bg-accent border border-border transition-all"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send Email</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePin(selectedItem.id)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      selectedItem.isPinned
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                    }`}
                    title={selectedItem.isPinned ? "Unpin item" : "Pin item"}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        selectedItem.isPinned
                          ? "fill-primary text-primary"
                          : ""
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Content Area - Contextual UI Per Type */}
              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col justify-center">
                {/* 1. LINK PREVIEW CARD (Rich OpenGraph Banner & Excerpt) */}
                {selectedItem.type === "link" && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg flex flex-col">
                    {selectedItem.previewUrl && (
                      <div className="w-full h-28 overflow-hidden relative group bg-muted">
                        <img
                          src={selectedItem.previewUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                        <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{selectedItem.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                        {selectedItem.description || selectedItem.content}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. IMAGE PREVIEW */}
                {selectedItem.type === "image" && (
                  <div className="flex flex-col items-center justify-center h-full bg-muted/40 rounded-xl border border-border p-2 overflow-hidden">
                    <div className="max-h-32 max-w-full rounded-lg overflow-hidden border border-border shadow-md">
                      <img
                        src={selectedItem.previewUrl || selectedItem.content}
                        alt="Clipboard image"
                        className="max-h-32 w-auto object-contain"
                      />
                    </div>
                    {selectedItem.metadata?.dimensions && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        <span>{selectedItem.metadata.dimensions}</span>
                        {selectedItem.metadata.fileSize && (
                          <span>• {selectedItem.metadata.fileSize}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. COLOR PALETTE SWATCH */}
                {selectedItem.type === "color" && (
                  <div className="flex flex-col items-center justify-center gap-2 p-2">
                    <div
                      className="w-16 h-16 rounded-2xl border border-border shadow-2xl transition-transform hover:scale-105"
                      style={{ backgroundColor: selectedItem.content }}
                    />
                    <div className="text-sm font-mono font-bold text-foreground tracking-wide">
                      {selectedItem.content}
                    </div>
                    {selectedItem.metadata?.colorFormats && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted border border-border">
                          {selectedItem.metadata.colorFormats.rgb}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-muted border border-border">
                          {selectedItem.metadata.colorFormats.hsl}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. EMAIL ADDRESS CARD */}
                {selectedItem.type === "email" && (
                  <div className="flex flex-col items-center justify-center p-3 text-center bg-card rounded-xl border border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 text-primary flex items-center justify-center mb-2 text-sm font-bold shadow-md">
                      {selectedItem.content.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-xs font-semibold text-foreground mb-0.5 font-mono truncate max-w-full">
                      {selectedItem.content}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Email Address
                    </div>
                  </div>
                )}

                {/* 5. FOLDER CARD */}
                {selectedItem.type === "folder" && (
                  <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/40 text-accent-foreground flex items-center justify-center flex-shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {selectedItem.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        {selectedItem.metadata?.fileSize || selectedItem.content}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. DEFAULT FILE / TEXT / CODE CARD */}
                {selectedItem.type !== "link" &&
                  selectedItem.type !== "image" &&
                  selectedItem.type !== "color" &&
                  selectedItem.type !== "email" &&
                  selectedItem.type !== "folder" && (
                    <div className="p-3 bg-muted/40 rounded-xl border border-border font-mono text-xs text-foreground max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                      {selectedItem.content}
                    </div>
                  )}
              </div>

              {/* Bottom Metadata Section (Matches reference layout) */}
              <div className="px-3 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Application</span>
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    {getAppBadge(selectedItem.metadata?.appName)}
                    <span>{selectedItem.metadata?.appName || "DynamicWin"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Type</span>
                  <span className="capitalize text-foreground font-medium">
                    {selectedItem.type}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {selectedItem.type === "link" ? "URL" : "Content"}
                  </span>
                  <span className="text-foreground font-mono truncate max-w-[180px]">
                    {selectedItem.content}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Copy time</span>
                  <span className="text-foreground">
                    {formatDateTime(selectedItem.timestamp)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
              <Layers className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-xs">
                {items.length === 0
                  ? "Clipboard history is empty"
                  : "Select an item to view preview"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
