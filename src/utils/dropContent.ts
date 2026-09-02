import { invoke } from "@tauri-apps/api/core";
import { LocalSendDevice, TrayInfo } from "../types";

export interface ExtractedDropContent {
  type: "files" | "in_memory_files" | "image_url" | "text" | "none";
  paths: string[];
  text?: string;
  imageUrl?: string;
  files?: File[];
}

export const isWebImageUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith("data:image/")) return true;
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) return false;

  // File extensions in path
  if (/\.(png|jpe?g|webp|gif|svg|bmp|avif|ico|tiff)(\?.*)?$/i.test(clean)) return true;

  // Query parameter formats (like Twitter / X format=jpg, Reddit, etc.)
  if (/[?&](?:format|ext|mime|type)=(?:png|jpe?g|webp|gif|svg|bmp|avif|jpg|jpeg|image)/i.test(clean)) return true;

  // Known photo hosts & CDNs
  if (
    clean.includes("pbs.twimg.com") ||
    clean.includes("twimg.com") ||
    clean.includes("twitter.com") ||
    clean.includes("x.com/media") ||
    clean.includes("cdn.discordapp.com") ||
    clean.includes("media.discordapp.net") ||
    clean.includes("images.unsplash.com") ||
    clean.includes("i.imgur.com") ||
    clean.includes("imgur.com") ||
    clean.includes("i.redd.it") ||
    clean.includes("preview.redd.it") ||
    clean.includes("external-preview.redd.it") ||
    clean.includes("encrypted-tbn") ||
    clean.includes("googleusercontent.com") ||
    clean.includes("yt3.ggpht.com") ||
    clean.includes("giphy.com/media") ||
    clean.includes("tenor.com/view") ||
    clean.includes("pinimg.com") ||
    clean.includes("fbcdn.net") ||
    clean.includes("wikimedia.org") ||
    clean.includes("flickr.com")
  ) {
    return true;
  }

  return false;
};

export const extractDropContent = (
  e: React.DragEvent | DragEvent,
  propFiles?: string[],
  refFiles?: string[]
): ExtractedDropContent => {
  // 1. Check native prop or ref files first
  if (refFiles && refFiles.length > 0) {
    return { type: "files", paths: refFiles };
  }
  if (propFiles && propFiles.length > 0) {
    return { type: "files", paths: propFiles };
  }

  const dt = e.dataTransfer;
  if (!dt) return { type: "none", paths: [] };

  const nativePaths: string[] = [];
  const inMemoryFiles: File[] = [];

  // 2. Check for items (Chromium/WebKit in-memory files & images)
  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          const p = (file as any).path;
          if (p && typeof p === "string" && !p.startsWith("blob:") && !p.startsWith("http")) {
            if (!nativePaths.includes(p)) nativePaths.push(p);
          } else {
            inMemoryFiles.push(file);
          }
        }
      }
    }
  }

  // 3. Check for File objects in dataTransfer
  if (dt.files && dt.files.length > 0) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      const p = (f as any).path;
      if (p && typeof p === "string" && !p.startsWith("blob:") && !p.startsWith("http")) {
        if (!nativePaths.includes(p)) nativePaths.push(p);
      } else if (!inMemoryFiles.some((im) => im.name === f.name && im.size === f.size)) {
        inMemoryFiles.push(f);
      }
    }
  }

  if (nativePaths.length > 0) {
    return { type: "files", paths: nativePaths };
  }
  if (inMemoryFiles.length > 0) {
    return { type: "in_memory_files", paths: [], files: inMemoryFiles };
  }

  // 4. Check for native file paths or web URLs from uri-list
  try {
    const uriList = dt.getData("text/uri-list") || "";
    if (uriList) {
      const lines = uriList.split(/[\r\n]+/).map((l) => l.trim());
      for (const line of lines) {
        if (line.startsWith("file://")) {
          let p = decodeURIComponent(line.replace(/^file:\/\//, ""));
          if (p.startsWith("/") && /^[A-Za-z]:/.test(p.slice(1))) {
            p = p.slice(1);
          }
          if (p && !nativePaths.includes(p)) nativePaths.push(p);
        } else if (
          line.startsWith("http://") ||
          line.startsWith("https://") ||
          line.startsWith("data:image/")
        ) {
          return { type: "image_url", paths: [], imageUrl: line };
        }
      }
    }
  } catch {}

  if (nativePaths.length > 0) {
    return { type: "files", paths: nativePaths };
  }

  // 5. Check for HTML <img> or background images (Photos dragged from Chrome/Discord/Firefox/Twitter/Reddit)
  let rawHtml = "";
  try {
    rawHtml = dt.getData("text/html") || "";
    if (rawHtml) {
      const doc = new DOMParser().parseFromString(rawHtml, "text/html");

      // Check all <img> tags
      const img = doc.querySelector("img");
      if (img) {
        const src =
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("data-full") ||
          "";
        if (
          src.startsWith("http://") ||
          src.startsWith("https://") ||
          src.startsWith("data:image/")
        ) {
          return { type: "image_url", paths: [], imageUrl: src };
        }
      }

      // Check all <source> tags (in <picture> elements)
      const source = doc.querySelector("source");
      if (source) {
        const srcset = source.getAttribute("srcset") || "";
        const first = srcset.split(",")[0].trim().split(" ")[0];
        if (
          first.startsWith("http://") ||
          first.startsWith("https://") ||
          first.startsWith("data:image/")
        ) {
          return { type: "image_url", paths: [], imageUrl: first };
        }
      }

      // Check <a> links wrapping images
      const a = doc.querySelector("a");
      if (a && a.href && (a.href.startsWith("http://") || a.href.startsWith("https://"))) {
        if (isWebImageUrl(a.href)) {
          return { type: "image_url", paths: [], imageUrl: a.href };
        }
      }
    }
  } catch {}

  // 6. Check Firefox moz-url or URL
  try {
    const mozUrl = dt.getData("text/x-moz-url") || dt.getData("URL") || "";
    if (mozUrl) {
      const firstLine = mozUrl.split(/[\r\n]+/)[0].trim();
      if (
        firstLine.startsWith("http://") ||
        firstLine.startsWith("https://") ||
        firstLine.startsWith("data:image/")
      ) {
        return { type: "image_url", paths: [], imageUrl: firstLine };
      }
    }
  } catch {}

  // 7. Check for plain text or text/plain
  try {
    let plainText =
      dt.getData("text/plain") ||
      dt.getData("text") ||
      dt.getData("Text") ||
      "";

    if (!plainText.trim() && rawHtml.trim()) {
      try {
        const doc = new DOMParser().parseFromString(rawHtml, "text/html");
        plainText = doc.body.textContent || "";
      } catch {}
    }

    const targetText = plainText.trim();

    if (
      targetText.startsWith("http://") ||
      targetText.startsWith("https://") ||
      targetText.startsWith("data:image/")
    ) {
      return { type: "image_url", paths: [], imageUrl: targetText };
    }

    if (targetText.length > 0) {
      return { type: "text", paths: [], text: targetText };
    }
  } catch {}

  return { type: "none", paths: [] };
};

export const sendExtractedContentToDevice = async (
  target: LocalSendDevice,
  content: ExtractedDropContent,
  sendFiles: (target: LocalSendDevice, paths: string[]) => Promise<string>,
  sendText: (target: LocalSendDevice, text: string) => Promise<string>,
  onClose: () => void
): Promise<boolean> => {
  try {
    // A. Native File paths
    if (content.paths && content.paths.length > 0) {
      await sendFiles(target, content.paths);
      onClose();
      return true;
    }

    // B. In-memory File objects (blobs, images from other apps)
    if (content.files && content.files.length > 0) {
      const tempPaths: string[] = [];
      for (const file of content.files) {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const tempPath = await invoke<string>("save_temp_dropped_file", {
          fileName: file.name || `image_${Date.now()}.png`,
          bytes,
        });
        if (tempPath) tempPaths.push(tempPath);
      }
      if (tempPaths.length > 0) {
        await sendFiles(target, tempPaths);
        onClose();
        return true;
      }
    }

    // C. Web Photo / Image URL or Data URL
    if (content.imageUrl) {
      if (content.imageUrl.startsWith("data:")) {
        const res = await fetch(content.imageUrl);
        const buffer = await res.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const tempPath = await invoke<string>("save_temp_dropped_file", {
          fileName: `web_photo_${Date.now()}.png`,
          bytes,
        });
        if (tempPath) {
          await sendFiles(target, [tempPath]);
          onClose();
          return true;
        }
      } else {
        try {
          const tempPath = await invoke<string>("download_url_to_temp", {
            url: content.imageUrl,
          });
          if (tempPath) {
            await sendFiles(target, [tempPath]);
            onClose();
            return true;
          }
        } catch {
          // If download fails (e.g. CORS/offline), send as URL link
          await sendText(target, content.imageUrl);
          onClose();
          return true;
        }
      }
    }

    // D. Plain Text or Link
    if (content.text) {
      try {
        await sendText(target, content.text);
        onClose();
        return true;
      } catch (err) {
        console.error("Failed to send text to device:", err);
      }
    }
  } catch (err) {
    console.error("Failed to send extracted content to device:", err);
  }
  return false;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const saveExtractedContentToTray = async (
  content: ExtractedDropContent
): Promise<TrayInfo | null> => {
  try {
    if (content.paths && content.paths.length > 0) {
      return await invoke<TrayInfo>("add_tray_files", { paths: content.paths });
    }

    if (content.files && content.files.length > 0) {
      let result: TrayInfo | null = null;
      for (const file of content.files) {
        const base64Data = await blobToBase64(file);
        result = await invoke<TrayInfo>("save_base64_to_tray", {
          fileName: file.name || `photo_${Date.now()}.png`,
          base64Data,
        });
      }
      return result;
    }

    if (content.imageUrl) {
      if (content.imageUrl.startsWith("data:")) {
        return await invoke<TrayInfo>("save_base64_to_tray", {
          fileName: `photo_${Date.now()}.png`,
          base64Data: content.imageUrl,
        });
      } else {
        try {
          const tempPath = await invoke<string>("download_url_to_temp", {
            url: content.imageUrl,
          });
          if (tempPath) {
            return await invoke<TrayInfo>("add_tray_files", { paths: [tempPath] });
          }
        } catch (downloadErr) {
          console.warn("[saveExtractedContentToTray] Backend download fallback to browser fetch:", downloadErr);
          try {
            const res = await fetch(content.imageUrl, { mode: "cors" });
            const blob = await res.blob();
            const base64Data = await blobToBase64(blob);
            return await invoke<TrayInfo>("save_base64_to_tray", {
              fileName: `web_photo_${Date.now()}.png`,
              base64Data,
            });
          } catch (fetchErr) {
            console.error("[saveExtractedContentToTray] Browser fetch failed:", fetchErr);
          }
        }
      }
    }

    if (content.text) {
      if (
        content.text.startsWith("http://") ||
        content.text.startsWith("https://") ||
        content.text.startsWith("data:image/")
      ) {
        if (isWebImageUrl(content.text) || content.text.startsWith("data:image/")) {
          try {
            const tempPath = await invoke<string>("download_url_to_temp", {
              url: content.text,
            });
            if (tempPath) {
              return await invoke<TrayInfo>("add_tray_files", { paths: [tempPath] });
            }
          } catch {}
        }
      }

      const encoder = new TextEncoder();
      const bytes = Array.from(encoder.encode(content.text));
      return await invoke<TrayInfo>("save_bytes_to_tray", {
        fileName: `Note_${Date.now().toString().slice(-4)}.txt`,
        bytes,
      });
    }
  } catch (e) {
    console.error("[saveExtractedContentToTray] Failed:", e);
    throw e;
  }
  return null;
};
