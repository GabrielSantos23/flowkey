import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Search,
  Sparkles,
  Command as CommandIcon,
} from "lucide-react";
import { SpotifyIcon } from "../assets/spotify-icon";
import { Kbd, KbdGroup } from "./ui/kbd";
import {
  hotkeyService,
  HotkeyBinding,
} from "../services/hotkeyService";
import { OverlayToast } from "./toasts/OverlayToast";
import { HotkeyRecorderPopover } from "./HotkeyRecorderPopover";
import { MainWindowHeader } from "./MainWindowHeader";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "./ui/table";

interface MainSettingsViewProps {
  isAuthenticated: boolean;
  onConnect: () => void;
  onLogout: () => void;
  onShortcutsUpdated: () => void;
  onOpenSettings: () => void;
}

export const MainSettingsView: React.FC<MainSettingsViewProps> = ({
  isAuthenticated,
  onConnect,
  onLogout,
  onShortcutsUpdated,
  onOpenSettings,
}) => {
  const [bindings, setBindings] = useState<HotkeyBinding[]>(() =>
    hotkeyService.getBindings()
  );
  const [isMasterDisabled, setIsMasterDisabled] = useState<boolean>(() =>
    hotkeyService.isMasterDisabled()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingBinding, setRecordingBinding] = useState<HotkeyBinding | null>(null);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [aliasInputValue, setAliasInputValue] = useState("");
  const [showMoreDescription, setShowMoreDescription] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleHotkeysChanged = () => {
      setIsMasterDisabled(hotkeyService.isMasterDisabled());
      setBindings(hotkeyService.getBindings());
    };

    window.addEventListener("flowkey_disabled_changed", handleHotkeysChanged);
    window.addEventListener("flowkey_hotkeys_changed", handleHotkeysChanged);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("flowkey_hotkeys_sync");
      bc.onmessage = () => {
        handleHotkeysChanged();
      };
    }

    return () => {
      window.removeEventListener(
        "flowkey_disabled_changed",
        handleHotkeysChanged
      );
      window.removeEventListener(
        "flowkey_hotkeys_changed",
        handleHotkeysChanged
      );
      bc?.close();
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleToggleEnable = (actionId: string, currentVal: boolean) => {
    const updated = hotkeyService.toggleBinding(actionId, !currentVal);
    setBindings(updated);
    onShortcutsUpdated();
    showToast(!currentVal ? "Shortcut enabled" : "Shortcut disabled");
  };

  const handleSaveHotkey = (actionId: string, combo: string) => {
    const updated = hotkeyService.saveBinding(actionId, combo, true);
    setBindings(updated);
    onShortcutsUpdated();
    showToast(`Saved shortcut: ${combo}`);
  };

  const handleStartEditingAlias = (actionId: string, currentAlias = "") => {
    setEditingAliasId(actionId);
    setAliasInputValue(currentAlias);
  };

  const handleSaveAlias = (actionId: string) => {
    const updated = hotkeyService.saveAlias(actionId, aliasInputValue);
    setBindings(updated);
    setEditingAliasId(null);
    onShortcutsUpdated();
  };

  const handleResetDefaults = () => {
    const updated = hotkeyService.resetToDefaults();
    setBindings(updated);
    onShortcutsUpdated();
    showToast("Reset all shortcuts to defaults");
  };

  const filteredBindings = useMemo(() => {
    if (!searchQuery.trim()) return bindings;
    const q = searchQuery.toLowerCase();
    return bindings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        (b.alias && b.alias.toLowerCase().includes(q)) ||
        b.currentShortcut.toLowerCase().includes(q)
    );
  }, [bindings, searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground font-sans select-none overflow-hidden relative">
      <OverlayToast message={toastMessage} />

      <MainWindowHeader onOpenSettings={onOpenSettings} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
          
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/0 blur-sm group-hover:blur-md transition-all duration-300" />
              <div className="relative w-14 h-14 rounded-2xl bg-card border border-emerald-500/30 flex items-center justify-center shadow-lg">
                <SpotifyIcon className="w-8 h-8" color="#1ED760" lineColor="#00000" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                Spotify Player
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spotify's most essential controls and overlays at your fingertips. Control playback and browse your library with seamless global shortcuts.
              </p>
            </div>

            {/* Collapsible Info */}
            <Collapsible
              open={showMoreDescription}
              onOpenChange={setShowMoreDescription}
              className="w-full max-w-md"
            >
              <CollapsibleTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-1 px-2.5 rounded-md hover:bg-muted/40 cursor-pointer">
                <span>{showMoreDescription ? "Show Less" : "Features & Details"}</span>
                {showMoreDescription ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2.5">
                <Card size="sm" className="text-left bg-muted/20 border-border/50">
                  <CardContent className="text-[11px] text-muted-foreground space-y-2 py-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>System-wide global hotkeys with 0ms Win32 media hooks.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CommandIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>
                        Floating Now Playing Overlay (Default: <Kbd>Alt</Kbd> + <Kbd>W</Kbd>).
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-3.5 h-3.5 flex items-center justify-center text-xs text-emerald-400 shrink-0 font-bold">•</span>
                      <span>Instant playlist selector and artist radio inside overlay.</span>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Quick Settings & Status */}
          <div>
            {/* Account Status Card */}
            <Card
              size="sm"
              className="bg-card/70 border-border/60 hover:border-emerald-500/40 transition-colors cursor-pointer group"
              onClick={onOpenSettings}
            >
              <CardContent className="flex items-center justify-between h-full py-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        isAuthenticated
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1.5"
                      }
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isAuthenticated
                            ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                            : "bg-amber-400"
                        }`}
                      />
                      {isAuthenticated ? "Connected" : "Offline"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                      (Configure)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isAuthenticated ? "Spotify Web API connected" : "Connect your Spotify account"}
                  </p>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isAuthenticated ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenSettings}
                        className="text-xs h-7"
                      >
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLogout}
                        className="text-xs h-7 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        Logout
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={onConnect}
                      className="bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-xs h-7 shadow-sm cursor-pointer"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commands Section */}
          <div className={`space-y-3 pt-1 transition-all ${isMasterDisabled ? "opacity-60" : ""}`}>
            {/* Section Header & Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Commands & Shortcuts
                </h2>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                  {filteredBindings.length}
                </Badge>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isMasterDisabled}
                  placeholder="Search commands or keys..."
                  className="pl-8 h-8 w-56 text-xs bg-card/60"
                />
              </div>
            </div>

            {/* Commands Table */}
            <Card size="sm" className="overflow-visible p-0 border-border/60 bg-card/80">
              <Table containerClassName="overflow-visible">
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[11px] text-muted-foreground font-semibold h-8 pl-4">Command</TableHead>
                    <TableHead className="text-[11px] text-muted-foreground font-semibold h-8 text-right w-28">Alias</TableHead>
                    <TableHead className="text-[11px] text-muted-foreground font-semibold h-8 text-right w-36">Shortcut</TableHead>
                    <TableHead className="text-[11px] text-muted-foreground font-semibold h-8 text-center w-16 pr-4">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBindings.length > 0 ? (
                    filteredBindings.map((binding, index) => {
                      const isEditingAlias = editingAliasId === binding.id;
                      const isRecordingThis = recordingBinding?.id === binding.id;
                      const isNearTop = index <= 1;
                      const badges = hotkeyService.formatShortcutBadges(binding.currentShortcut);
                      const isActive = !isMasterDisabled && binding.enabled;

                      return (
                        <TableRow
                          key={binding.id}
                          className={`relative border-border/30 transition-colors ${
                            isRecordingThis ? "z-40" : ""
                          } ${!isActive ? "opacity-45" : "hover:bg-muted/30"}`}
                        >
                          {/* Command Name & Description */}
                          <TableCell className="pl-4 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isActive
                                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                                    : "bg-muted-foreground/30"
                                }`}
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate block">
                                  {binding.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {binding.description}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Alias */}
                          <TableCell className="text-right py-2.5">
                            {isEditingAlias ? (
                              <Input
                                value={aliasInputValue}
                                autoFocus
                                disabled={isMasterDisabled}
                                onChange={(e) => setAliasInputValue(e.target.value)}
                                onBlur={() => handleSaveAlias(binding.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveAlias(binding.id);
                                  if (e.key === "Escape") setEditingAliasId(null);
                                }}
                                placeholder="Alias..."
                                className="h-6 w-24 text-[11px] font-mono ml-auto py-0 px-1.5"
                              />
                            ) : binding.alias ? (
                              <Button
                                variant="link"
                                size="xs"
                                disabled={isMasterDisabled}
                                onClick={() =>
                                  handleStartEditingAlias(binding.id, binding.alias)
                                }
                                className="text-[11px] font-mono h-auto p-0 text-primary hover:text-primary/80"
                              >
                                {binding.alias}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={isMasterDisabled}
                                onClick={() => handleStartEditingAlias(binding.id, "")}
                                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground h-auto p-0"
                              >
                                Add Alias
                              </Button>
                            )}
                          </TableCell>

                          {/* Shortcut */}
                          <TableCell className="text-right py-2.5">
                            <div className="flex justify-end">
                              {binding.currentShortcut ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    onClick={() => !isMasterDisabled && setRecordingBinding(binding)}
                                    className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <KbdGroup>
                                      {badges.map((b, i) => (
                                        <Kbd key={i} className="text-[10px] h-5 px-1.5 font-mono shadow-xs">
                                          {b}
                                        </Kbd>
                                      ))}
                                    </KbdGroup>
                                  </TooltipTrigger>
                                  <TooltipContent>Click to rebind shortcut</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  disabled={isMasterDisabled}
                                  onClick={() => setRecordingBinding(binding)}
                                  className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground h-auto p-0"
                                >
                                  Record Hotkey
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Enable / Disable Checkbox */}
                          <TableCell className="text-center pr-4 py-2.5">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={isMasterDisabled ? false : binding.enabled}
                                disabled={isMasterDisabled}
                                onCheckedChange={() =>
                                  handleToggleEnable(binding.id, binding.enabled)
                                }
                              />
                            </div>
                          </TableCell>

                          {/* Floating Hotkey Recorder Popover */}
                          {isRecordingThis && !isMasterDisabled && (
                            <HotkeyRecorderPopover
                              binding={binding}
                              onClose={() => setRecordingBinding(null)}
                              onSave={handleSaveHotkey}
                              className={
                                isNearTop
                                  ? "top-[calc(100%+8px)] right-4 shadow-2xl"
                                  : "bottom-[calc(100%+8px)] right-4 shadow-2xl"
                              }
                            />
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground font-mono">
                        No matching commands found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span className="text-[11px]">
                Tip: Click any shortcut badge to record a new key combination.
              </span>

              <Tooltip>
                <TooltipTrigger
                  onClick={() => !isMasterDisabled && handleResetDefaults()}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/40 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Defaults</span>
                </TooltipTrigger>
                <TooltipContent>Restore all shortcuts to factory defaults</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
