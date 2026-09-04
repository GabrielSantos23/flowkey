import React, { useState, useEffect, useRef, useMemo } from "react";
import { Music2, AlertCircle } from "lucide-react";

interface LyricLine {
  timeSecs: number;
  text: string;
}

interface SpotifyLyricsProps {
  trackTitle: string;
  artistName: string;
  albumName?: string;
  durationSecs?: number;
  currentPosSecs: number;
  isPlaying?: boolean;
  onSeek?: (secs: number) => void;
}

interface LrcLibResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}



interface ParsedTrackMeta {
  baseTitle: string;
  primaryArtist: string;
  feats: string[];
}

function normalizeStr(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\$/g, "s")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArtists(str: string): string[] {
  if (!str) return [];
  return str
    .split(/[,&+]|\s+(?:and|with|feat\.?|ft\.?|featuring|и|e)\s+/i)
    .map((s) => normalizeStr(s))
    .filter((s) => s.length > 0);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTrackMeta(rawTitle: string, rawArtist: string): ParsedTrackMeta {
  let title = rawTitle || "";
  let artist = rawArtist || "";
  const feats: string[] = [];

  // Strip artist prefix if present in title, e.g. 'Artist - Title'
  if (artist) {
    const prefixRegex = new RegExp("^" + escapeRegex(artist.trim()) + "\\s*-\\s*", "i");
    title = title.replace(prefixRegex, "");
  }

  // 1. Extract feats from title: (feat. Artist), [ft. Artist], (with Artist), - feat. Artist
  const titleFeatRegex = /\s*[\(\[](?:feat\.?|ft\.?|featuring|with)\s+([^()\[\]]+)[\)\]]/i;
  const dashFeatRegex = /\s*-\s*(?:feat\.?|ft\.?|featuring|with)\s+(.+)$/i;

  let featMatch = title.match(titleFeatRegex);
  if (featMatch) {
    feats.push(...splitArtists(featMatch[1]));
    title = title.replace(titleFeatRegex, "").trim();
  } else {
    featMatch = title.match(dashFeatRegex);
    if (featMatch) {
      feats.push(...splitArtists(featMatch[1]));
      title = title.replace(dashFeatRegex, "").trim();
    }
  }

  // Remove harmless suffixes like Remastered, Bonus Track, Official Video/Audio
  title = title
    .replace(/\s*-\s*(remaster(ed)?(\s*\d+)?|bonus track|deluxe).*$/i, "")
    .replace(/\s*[\(\[](remaster(ed)?(\s*\d+)?|bonus track|deluxe|official\s*(video|audio)|lyric\s*video)[\)\]]/gi, "")
    .trim();

  // 2. Extract feats and primary singer from artist string
  let primaryArtist = "";
  const artistFeatRegex = /\s*(?:feat\.?|ft\.?|featuring|with)\s+(.+)$/i;
  const artistFeatMatch = artist.match(artistFeatRegex);

  if (artistFeatMatch) {
    const mainPart = artist.substring(0, artistFeatMatch.index);
    primaryArtist = normalizeStr(mainPart);
    feats.push(...splitArtists(artistFeatMatch[1]));
  } else {
    const artistsList = splitArtists(artist);
    if (artistsList.length > 0) {
      primaryArtist = artistsList[0];
      if (artistsList.length > 1) {
        feats.push(...artistsList.slice(1));
      }
    } else {
      primaryArtist = normalizeStr(artist);
    }
  }

  const uniqueFeats = Array.from(new Set(feats.map((f) => normalizeStr(f)).filter(Boolean))).sort();

  return {
    baseTitle: normalizeStr(title),
    primaryArtist,
    feats: uniqueFeats,
  };
}

function verifyMatch(
  item: LrcLibResponse,
  targetTitle: string,
  targetArtist: string,
  targetDuration?: number
): boolean {
  if (!item || !item.trackName || !item.artistName) return false;
  if (!targetDuration || targetDuration <= 0 || !item.duration || item.duration <= 0) return false;

  // 1. Mesmo tamanho de duracao (tolerancia padrao de +-2 segundos)
  const diff = Math.abs(item.duration - targetDuration);
  if (diff > 2) return false;

  const targetMeta = parseTrackMeta(targetTitle, targetArtist);
  const itemMeta = parseTrackMeta(item.trackName, item.artistName);

  // 2. Nome da musica for igual
  if (!targetMeta.baseTitle || !itemMeta.baseTitle || targetMeta.baseTitle !== itemMeta.baseTitle) {
    return false;
  }

  // 3. Do mesmo cantor
  if (!targetMeta.primaryArtist || !itemMeta.primaryArtist || targetMeta.primaryArtist !== itemMeta.primaryArtist) {
    return false;
  }

  // 4. Com os mesmos feats
  if (targetMeta.feats.length !== itemMeta.feats.length) {
    return false;
  }
  for (let i = 0; i < targetMeta.feats.length; i++) {
    if (targetMeta.feats[i] !== itemMeta.feats[i]) {
      return false;
    }
  }

  return true;
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (matches.length === 0) continue;

    const text = trimmed.replace(timeRegex, "").trim();
    if (!text && text !== "") continue;

    for (const match of matches) {
      const mins = parseInt(match[1], 10);
      const secs = parseFloat(match[2]);
      const timeSecs = mins * 60 + secs;
      result.push({ timeSecs, text });
    }
  }

  return result.sort((a, b) => a.timeSecs - b.timeSecs);
}

export const SpotifyLyrics: React.FC<SpotifyLyricsProps> = ({
  trackTitle,
  artistName,
  albumName,
  durationSecs,
  currentPosSecs,
  onSeek,
}) => {
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedKeyRef = useRef<string>("");

  const trackKey = useMemo(() => {
    return `${trackTitle}::${artistName}::${Math.round(durationSecs || 0)}`;
  }, [trackTitle, artistName, durationSecs]);

  const fetchLyrics = async (force = false) => {
    if (!trackTitle || !artistName) {
      setErrorMessage("No track info");
      return;
    }

    if (!durationSecs || durationSecs <= 0) {
      setErrorMessage("No lyrics found");
      return;
    }

    if (!force && lastFetchedKeyRef.current === trackKey) {
      return;
    }

    lastFetchedKeyRef.current = trackKey;
    setIsLoading(true);
    setErrorMessage(null);
    setSyncedLines([]);
    setPlainLyrics(null);
    setIsInstrumental(false);

    const targetMeta = parseTrackMeta(trackTitle, artistName);
    const headers = {
      "Lrclib-Client": "DynamicWin/2.0 (https://github.com/GabrielSantos23/flowkey)",
    };

    try {
      // 1. Tentar GET direto no /api/get
      const params = new URLSearchParams();
      params.set("track_name", targetMeta.baseTitle);
      params.set("artist_name", targetMeta.primaryArtist);
      if (albumName) params.set("album_name", albumName);
      params.set("duration", Math.round(durationSecs).toString());

      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, { headers });
      if (res.ok) {
        const data: LrcLibResponse = await res.json();
        if (verifyMatch(data, trackTitle, artistName, durationSecs)) {
          applyLyricsData(data);
          setIsLoading(false);
          return;
        }
      }

      // 2. Se /api/get não retornar ou não passar na verificação, buscar candidatos via /api/search
      const searchUrls: string[] = [];

      if (targetMeta.feats.length > 0) {
        searchUrls.push(
          `https://lrclib.net/api/search?q=${encodeURIComponent(
            `${targetMeta.baseTitle} ${targetMeta.primaryArtist} ${targetMeta.feats.join(" ")}`
          )}`
        );
        searchUrls.push(
          `https://lrclib.net/api/search?track_name=${encodeURIComponent(
            targetMeta.baseTitle
          )}&artist_name=${encodeURIComponent(targetMeta.primaryArtist)}`
        );
      } else {
        searchUrls.push(
          `https://lrclib.net/api/search?track_name=${encodeURIComponent(
            targetMeta.baseTitle
          )}&artist_name=${encodeURIComponent(targetMeta.primaryArtist)}`
        );
        searchUrls.push(
          `https://lrclib.net/api/search?q=${encodeURIComponent(
            `${targetMeta.primaryArtist} ${targetMeta.baseTitle}`
          )}`
        );
      }

      const allCandidates: LrcLibResponse[] = [];
      const seenIds = new Set<number>();

      for (const url of searchUrls) {
        try {
          const searchRes = await fetch(url, { headers });
          if (searchRes.ok) {
            const data = await searchRes.json();
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item && item.id && !seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  allCandidates.push(item);
                }
              }
            }
          }
        } catch {}
      }

      // Filtrar estritamente apenas candidatos que satisfazem todos os requisitos
      const verifiedCandidates = allCandidates.filter((item) =>
        verifyMatch(item, trackTitle, artistName, durationSecs)
      );

      if (verifiedCandidates.length > 0) {
        // Ordenar: preferir letras sincronizadas (synced), seguido pela menor diferença de duração
        verifiedCandidates.sort((a, b) => {
          const aSynced = a.syncedLyrics && a.syncedLyrics.trim().length > 0 ? 1 : 0;
          const bSynced = b.syncedLyrics && b.syncedLyrics.trim().length > 0 ? 1 : 0;
          if (bSynced !== aSynced) return bSynced - aSynced;
          return Math.abs(a.duration - durationSecs) - Math.abs(b.duration - durationSecs);
        });

        applyLyricsData(verifiedCandidates[0]);
        setIsLoading(false);
        return;
      }

      // Se qualquer um dos requisitos não bateu, mostrar que não achou a letra
      setErrorMessage("No lyrics found");
    } catch {
      setErrorMessage("Failed to load lyrics");
    } finally {
      setIsLoading(false);
    }
  };

  const applyLyricsData = (data: LrcLibResponse) => {
    if (data.instrumental) {
      setIsInstrumental(true);
      return;
    }

    if (data.syncedLyrics) {
      const parsed = parseLrc(data.syncedLyrics);
      if (parsed.length > 0) {
        setSyncedLines(parsed);
        return;
      }
    }

    if (data.plainLyrics) {
      setPlainLyrics(data.plainLyrics);
    } else {
      setErrorMessage("No lyrics found");
    }
  };

  useEffect(() => {
    fetchLyrics();
  }, [trackKey]);

  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    let found = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].timeSecs <= currentPosSecs + 0.25) {
        found = i;
      } else {
        break;
      }
    }
    return found;
  }, [syncedLines, currentPosSecs]);

  useEffect(() => {
    if (userHasScrolled || !activeLineRef.current || !containerRef.current) return;

    activeLineRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeLineIndex, userHasScrolled]);

  const handleContainerWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    setUserHasScrolled(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserHasScrolled(false);
    }, 4000);
  };

  const handleLineClick = (timeSecs: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSeek) onSeek(timeSecs);
  };

  return (
    <div
      data-lyrics-container="true"
      data-scrollable="true"
      className="w-68.75 pl-4 border-l border-border flex flex-col justify-between h-35.5 select-none overflow-hidden"
    >
      <div
        ref={containerRef}
        onWheel={handleContainerWheel}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1.5 relative flex flex-col gap-2 mask-linear-fade"
        style={{ scrollBehavior: "smooth" }}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 py-2">
            <div className="h-3 bg-muted rounded-full w-3/4 animate-pulse" />
            <div className="h-3.5 bg-muted/80 rounded-full w-4/5 animate-pulse" />
            <div className="h-3 bg-muted rounded-full w-2/3 animate-pulse" />
            <div className="h-3 bg-muted rounded-full w-3/5 animate-pulse" />
          </div>
        ) : isInstrumental ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-1.5 py-4">
            <Music2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Instrumental Track</span>
            <span className="text-[10px] text-muted-foreground">No vocals in this song</span>
          </div>
        ) : errorMessage ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-1.5 py-4">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive">{errorMessage}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchLyrics(true);
              }}
              className="text-[10px] text-white hover:underline font-semibold mt-0.5"
            >
              Try Again
            </button>
          </div>
        ) : syncedLines.length > 0 ? (
          <div className="flex flex-col gap-1.5 py-4">
            {syncedLines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={(e) => handleLineClick(line.timeSecs, e)}
                  className={`text-left transition-all duration-200 cursor-pointer rounded-lg px-1 py-0.5 wrap-break-word ${
                    isActive
                      ? "text-foreground font-bold text-[13px] scale-[1.01] origin-left"
                      : isPast
                      ? "text-muted-foreground hover:text-foreground text-[11.5px] font-medium"
                      : "text-muted-foreground/60 hover:text-foreground text-[11.5px] font-medium"
                  }`}
                >
                  {line.text || "♪"}
                </div>
              );
            })}
          </div>
        ) : plainLyrics ? (
          <div className="text-[11.5px] text-foreground font-medium leading-relaxed whitespace-pre-line py-1 wrap-break-word">
            {plainLyrics}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No lyrics available
          </div>
        )}
      </div>
    </div>
  );
};
