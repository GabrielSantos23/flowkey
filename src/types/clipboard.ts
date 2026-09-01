export type ClipboardItemType =
  | "text"
  | "image"
  | "link"
  | "color"
  | "email"
  | "file"
  | "folder"
  | "code";

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  title: string;
  content: string;
  previewUrl?: string;
  description?: string;
  metadata?: {
    appName?: string;
    appIcon?: string;
    fileSize?: string;
    dimensions?: string;
    colorFormats?: {
      hex: string;
      rgb: string;
      hsl: string;
    };
    lineCount?: number;
    wordCount?: number;
    charCount?: number;
    language?: string;
  };
  isPinned: boolean;
  timestamp: number;
}
