import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShortcutItem } from "../../../types";
import { Plus, ExternalLink, Globe, Terminal, Folder } from "lucide-react";

export const ShortcutsWidget: React.FC = () => {
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([
    { id: "s1", name: "Browser", path: "https://google.com" },
    { id: "s2", name: "Terminal", path: "terminal" },
    { id: "s3", name: "Files", path: "files" },
    { id: "s4", name: "", path: "" },
  ]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("dw_shortcuts");
    if (saved) {
      try {
        setShortcuts(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveShortcuts = (items: ShortcutItem[]) => {
    setShortcuts(items);
    localStorage.setItem("dw_shortcuts", JSON.stringify(items));
  };

  const handleLaunch = async (shortcut: ShortcutItem, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shortcut.path) {
      openEdit(index);
      return;
    }

    try {
      if (shortcut.path === "terminal") {
        await invoke("launch_shortcut", { path: "bash" });
      } else if (shortcut.path === "files") {
        await invoke("show_in_folder", { pathOrName: "." });
      } else {
        await invoke("launch_shortcut", { path: shortcut.path });
      }
    } catch {
      // Browser fallback
      if (shortcut.path.startsWith("http")) {
        window.open(shortcut.path, "_blank");
      }
    }
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setEditName(shortcuts[index]?.name || "");
    setEditPath(shortcuts[index]?.path || "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null) return;

    const next = [...shortcuts];
    next[editingIndex] = {
      ...next[editingIndex],
      name: editName.trim() || (editPath ? "Shortcut" : ""),
      path: editPath.trim(),
    };
    saveShortcuts(next);
    setEditingIndex(null);
  };

  const getIcon = (item: ShortcutItem) => {
    if (item.path.startsWith("http")) return <Globe className="w-4 h-4 text-sky-400" />;
    if (item.path.includes("terminal") || item.path.includes("sh")) return <Terminal className="w-4 h-4 text-emerald-400" />;
    return <Folder className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card backdrop-blur-md p-4 flex flex-col justify-between border border-border shadow-inner transition-all hover:border-border group min-w-[240px] flex-1 select-none">
      <div className="flex items-center justify-between z-10 mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Launch
        </span>
        <span className="text-[10px] text-muted-foreground">4 slots</span>
      </div>

      {/* Grid of 4 shortcut buttons */}
      <div className="grid grid-cols-2 gap-2 z-10">
        {shortcuts.map((sc, idx) => (
          <div
            key={sc.id}
            onClick={(e) => handleLaunch(sc, idx, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              openEdit(idx);
            }}
            className={`group/btn relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
              sc.path
                ? "bg-card border-border hover:bg-accent/40 hover:border-border active:scale-95"
                : "border-dashed border-border hover:border-primary/40 bg-transparent hover:bg-muted"
            }`}
          >
            {sc.path ? (
              <>
                <div className="p-1 rounded-lg bg-muted border border-border flex-shrink-0">
                  {getIcon(sc)}
                </div>
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {sc.name || "Shortcut"}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover/btn:opacity-100 transition-opacity" />
              </>
            ) : (
              <div className="flex items-center justify-center gap-1.5 w-full py-1 text-muted-foreground group-hover/btn:text-foreground">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-xs">Add</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Configure Modal */}
      {editingIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setEditingIndex(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-popover border border-border p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">Configure Slot {editingIndex + 1}</h3>
            <form onSubmit={handleSaveEdit} className="space-y-2">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Browser, VS Code"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Path or URL</label>
                <input
                  type="text"
                  value={editPath}
                  onChange={(e) => setEditPath(e.target.value)}
                  placeholder="https://... or /usr/bin/... or C:\..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = [...shortcuts];
                    next[editingIndex] = { id: `s${editingIndex + 1}`, name: "", path: "" };
                    saveShortcuts(next);
                    setEditingIndex(null);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
