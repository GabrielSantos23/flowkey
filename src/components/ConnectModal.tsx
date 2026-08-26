import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Loader2,
  AlertCircle,
  Radio,
} from "lucide-react";
import {
  spotifyService,
  openSpotifyLoginInBrowser,
  getSpotifyAuthorizeUrl,
  SPOTIFY_SCOPES,
  authBroadcastChannel,
  getStoredRedirectUri,
  setStoredRedirectUri,
} from "../services/spotifyApi";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthUpdated: () => void;
}

const REDIRECT_OPTIONS = [
  "http://127.0.0.1:8888/callback",
  "http://127.0.0.1:8000/callback",
];

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onAuthUpdated,
}) => {
  const [tokenInput, setTokenInput] = useState(spotifyService.getAccessToken() || "");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [browserOpened, setBrowserOpened] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string>(getStoredRedirectUri());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isAuthenticated = spotifyService.isAuthenticated();

  useEffect(() => {
    setSelectedUri(getStoredRedirectUri());
  }, [isOpen]);

  // Listen for broadcast token when browser finishes login
  useEffect(() => {
    const channel = authBroadcastChannel;
    if (!channel) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "TOKEN_RECEIVED" && event.data.token) {
        setTokenInput(event.data.token);
        setSavedSuccess(true);
        setBrowserOpened(false);
        onAuthUpdated();
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 1200);
      }
    };

    channel.addEventListener("message", handleMessage);
    return () => channel.removeEventListener("message", handleMessage);
  }, [onAuthUpdated, onClose]);

  if (!isOpen) return null;

  const handleUriChange = (uri: string) => {
    setSelectedUri(uri);
    setStoredRedirectUri(uri);
  };

  const handleOpenBrowserLogin = async () => {
    setBrowserOpened(true);
    setErrorMessage(null);
    try {
      await openSpotifyLoginInBrowser(selectedUri);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to start OAuth login");
      setBrowserOpened(false);
    }
  };

  const handleCopyAuthUrl = () => {
    const url = getSpotifyAuthorizeUrl(selectedUri);
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      spotifyService.setAccessToken(tokenInput.trim(), 3600);
      setSavedSuccess(true);
      onAuthUpdated();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    }
  };

  const handleLogout = () => {
    spotifyService.logout();
    setTokenInput("");
    setBrowserOpened(false);
    onAuthUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-2xl bg-[#11141c] border border-[#262c3b] shadow-2xl p-6 relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#181c26] hover:bg-[#202535] text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Connect Spotify Web API
            </h3>
            <p className="text-xs text-zinc-400">
              Live authorization via Spotify loopback listener
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Error Message banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-xs font-mono text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Authentication Error:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Redirect URI Port Selector */}
          <div className="p-3 rounded-xl bg-[#161a24] border border-[#242a3a] space-y-2">
            <span className="text-zinc-400 block text-[11px]">Choose matching Redirect URI from your Spotify App:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REDIRECT_OPTIONS.map((uri) => (
                <button
                  key={uri}
                  onClick={() => handleUriChange(uri)}
                  className={`p-2 rounded-lg text-left border transition-all cursor-pointer font-mono text-[11px] flex items-center gap-2 ${
                    selectedUri === uri
                      ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300 shadow-sm"
                      : "bg-[#181c26] hover:bg-[#1f2533] border-[#2b3345] text-zinc-400"
                  }`}
                >
                  <Radio className={`w-3.5 h-3.5 shrink-0 ${selectedUri === uri ? "text-emerald-400" : "text-zinc-600"}`} />
                  <span className="truncate">{uri}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action: 1-Click Login in Browser */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#16221c] to-[#121922] border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Log In via External Browser</span>
              </span>
              {isAuthenticated ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-mono text-[10px] font-bold">
                  CONNECTED
                </span>
              ) : browserOpened ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950 border border-sky-500 text-sky-300 font-mono text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Waiting for Login...</span>
                </span>
              ) : null}
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Opens Spotify in your default browser and runs the background loopback listener to capture your token automatically.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleOpenBrowserLogin}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>
                  {isAuthenticated
                    ? "Re-Authorize with Spotify"
                    : browserOpened
                    ? "Open Browser Again"
                    : "Log In with Spotify"}
                </span>
              </button>

              <button
                onClick={handleCopyAuthUrl}
                className="px-3 py-2.5 rounded-lg bg-[#181c28] hover:bg-[#222838] border border-[#2b3345] text-zinc-300 font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy Spotify Authorization URL to clipboard"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
              </button>

              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="px-3 py-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Disconnect Spotify Account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          </div>

          {/* Direct Access Token / Manual Paste Option */}
          <div className="p-3.5 rounded-xl bg-[#161a24] border border-[#242a3a] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-200 font-semibold text-xs">
                Or Paste Bearer Access Token Directly
              </span>
              <a
                href="https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 font-mono"
              >
                <span>Get Token on Spotify Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste Bearer Token (e.g. BQC...)"
                className="flex-1 bg-[#0f1219] border border-[#262c3b] rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={handleSaveToken}
                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors cursor-pointer text-xs shrink-0"
              >
                {savedSuccess ? "Saved!" : "Apply"}
              </button>
            </div>
          </div>

          {/* Authorized Scopes */}
          <div className="p-2.5 rounded-lg bg-[#0e1117] border border-[#1e2330] text-[10px] text-zinc-400 font-mono space-y-1">
            <span className="text-zinc-500 font-bold block">AUTHORIZED SCOPES:</span>
            <div className="flex flex-wrap gap-1">
              {SPOTIFY_SCOPES.map((s) => (
                <span key={s} className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
