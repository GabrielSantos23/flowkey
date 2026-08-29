import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Laptop,
} from "lucide-react";
import { SpotifyIcon } from "../assets/spotify-icon";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  getStoredOverlayStyle,
  setStoredOverlayStyle,
  OverlayStyle,
} from "../services/overlaySettings";
import { autostartService } from "../services/autostartService";
import { updaterService, UpdateInfo } from "../services/updaterService";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onConnect: () => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  onConnect,
  onLogout,
}) => {
  
  const [isAutostartEnabled, setIsAutostartEnabled] = useState<boolean>(false);
  const [isTogglingAutostart, setIsTogglingAutostart] =
    useState<boolean>(false);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] =
    useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(
    null,
  );
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(
    null,
  );
  const [overlayStyle, setOverlayStyle] = useState<OverlayStyle>(() =>
    getStoredOverlayStyle()
  );

  useEffect(() => {
    const handleStyleChange = (e: any) => {
      const newStyle = e?.detail?.style || getStoredOverlayStyle();
      setOverlayStyle(newStyle);
    };

    window.addEventListener("flowkey_overlay_style_changed", handleStyleChange);
    return () => {
      window.removeEventListener(
        "flowkey_overlay_style_changed",
        handleStyleChange
      );
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    autostartService.isEnabled().then((enabled) => {
      if (isMounted) setIsAutostartEnabled(enabled);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleToggleAutostart = async (checked: boolean) => {
    setIsTogglingAutostart(true);
    try {
      const nextState = await autostartService.setEnabled(checked);
      setIsAutostartEnabled(nextState);
    } catch (err: any) {
      console.error("Failed to change autostart:", err);
    } finally {
      setIsTogglingAutostart(false);
    }
  };

  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateErrorMessage(null);
    setUpdateStatusMessage(null);

    try {
      const result = await updaterService.checkForUpdates();
      setUpdateInfo(result);
      if (result.available) {
        setUpdateStatusMessage(`Version ${result.version} is available!`);
      } else {
        setUpdateStatusMessage("FlowKey is up to date.");
      }
    } catch (err: any) {
      console.error("Update check failed:", err);
      setUpdateErrorMessage(err?.message || "Failed to check for updates");
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const handleInstallUpdate = async () => {
    if (!updateInfo?.available) return;

    setIsDownloadingUpdate(true);
    setUpdateErrorMessage(null);
    try {
      await updaterService.downloadAndInstall((downloaded, total) => {
        if (total && total > 0) {
          setDownloadProgress(
            Math.min(100, Math.round((downloaded / total) * 100)),
          );
        }
      });
      setUpdateStatusMessage("Update installed! Please restart FlowKey.");
    } catch (err: any) {
      console.error("Failed to download update:", err);
      setUpdateErrorMessage(err?.message || "Failed to download update");
    } finally {
      setIsDownloadingUpdate(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-xl max-w-[calc(100%-2rem)] p-0 overflow-hidden bg-background border-[#242a3a] gap-0 text-xs select-none max-h-[85vh] flex flex-col shadow-2xl rounded-2xl"
        showCloseButton={true}
      >
        
        <DialogHeader className="px-6 py-4 border-b border-border/40 bg-card/40 flex-row items-center gap-3 space-y-0 text-left">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <DialogTitle className="text-sm font-bold text-foreground">
              Preferences & Settings
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Manage accounts, autostart, and software updates
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <SpotifyIcon
                className="w-3.5 h-3.5"
                color="#1ED760"
                lineColor="#00000"
              />
              <span>Spotify Connection</span>
            </h3>

            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-card border border-border/70 flex items-center justify-center">
                      <SpotifyIcon
                        className="w-5 h-5"
                        color="#1ED760"
                        lineColor="#00000"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          Spotify Web API
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isAuthenticated
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 py-0 px-1.5 text-[10px]"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 py-0 px-1.5 text-[10px]"
                          }
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1 ${
                              isAuthenticated
                                ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                                : "bg-amber-400"
                            }`}
                          />
                          {isAuthenticated ? "Connected" : "Not Connected"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isAuthenticated
                          ? "Authorized for playback control, search, playlists, and overlays."
                          : "Connect your Spotify account to enable library search and rich overlays."}
                      </p>
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLogout}
                      className="text-xs h-7 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={onConnect}
                      className="bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-xs h-7 shadow-sm cursor-pointer"
                    >
                      Connect Account
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-primary" />
              <span>System & Startup</span>
            </h3>

            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      Start with System
                    </span>
                    {isAutostartEnabled && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 bg-emerald-500/15 text-emerald-400"
                      >
                        Enabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Automatically launch FlowKey in the background when your
                    computer boots up.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isTogglingAutostart && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    checked={isAutostartEnabled}
                    disabled={isTogglingAutostart}
                    onCheckedChange={handleToggleAutostart}
                    aria-label="Toggle Start with System"
                    style={{ "--primary": "#1ED760" } as React.CSSProperties}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <span>Now Playing Overlay Style</span>
            </h3>

            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      Overlay Window Interface
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5 bg-emerald-500/15 text-emerald-400"
                    >
                      {overlayStyle === "island" ? "Top Notch" : "Center Modal"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Select your preferred interface for the Now Playing floating popup.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={overlayStyle}
                    onValueChange={(val) => {
                      if (val) {
                        const styleVal = val as OverlayStyle;
                        setOverlayStyle(styleVal);
                        setStoredOverlayStyle(styleVal);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[195px] h-7 text-xs bg-secondary/50 border-border/60">
                      <SelectValue placeholder="Select Overlay Style" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border/60 text-xs">
                      <SelectItem value="island">
                        <span className="flex items-center gap-2">
                          <span>🏝️</span>
                          <span>Dynamic Island (Top Edge)</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="classic">
                        <span className="flex items-center gap-2">
                          <span>🪟</span>
                          <span>Floating Window (Center)</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Software Updates</span>
            </h3>

            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">
                        FlowKey Desktop
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        v1.0.0
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Check for new features, bug fixes, and performance
                      improvements.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate || isDownloadingUpdate}
                    className="h-7 text-xs gap-1.5 cursor-pointer"
                  >
                    {isCheckingUpdate ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Check for Updates</span>
                      </>
                    )}
                  </Button>
                </div>

                {updateStatusMessage &&
                  !updateInfo?.available &&
                  !updateErrorMessage && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{updateStatusMessage}</span>
                    </div>
                  )}

                {updateErrorMessage && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{updateErrorMessage}</span>
                  </div>
                )}

                {updateInfo?.available && (
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-primary font-medium text-[10px] tracking-wide"
                        >
                          NEW RELEASE
                        </Badge>
                        <span className="font-semibold text-foreground text-xs">
                          Version {updateInfo.version}
                        </span>
                      </div>
                    </div>

                    {updateInfo.body && (
                      <p className="text-[11px] text-muted-foreground whitespace-pre-line bg-black/30 p-2 rounded-md font-mono max-h-24 overflow-y-auto">
                        {updateInfo.body}
                      </p>
                    )}

                    {isDownloadingUpdate ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Downloading & Installing...</span>
                          <span className="font-mono">{downloadProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleInstallUpdate}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-7 shadow-sm gap-1.5 cursor-pointer mt-1"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Download & Install v{updateInfo.version}</span>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border/40 bg-card/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>FlowKey • Spotify Companion for Windows</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClose}
            className="h-6 text-xs cursor-pointer"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
