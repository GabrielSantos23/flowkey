export interface AppSettings {
  island_mode: "island" | "notch";
  allow_blur: boolean;
  allow_animation: boolean;
  anti_aliasing: boolean;
  run_on_startup: boolean;
  theme_index: number;
  screen_index: number;
  small_widgets_left: string[];
  small_widgets_middle: string[];
  small_widgets_right: string[];
  big_widgets: string[];
  use_celsius: boolean;
  hide_location: boolean;
  volume_popup: boolean;
  brightness_popup: boolean;
  is_hidden: boolean;
}

export interface ThemeHolder {
  IslandColor: string;
  TextMain: string;
  TextSecond: string;
  TextThird: string;
  Primary: string;
  Secondary: string;
  Success: string;
  Error: string;
  IconColor: string;
  WidgetBackground: string;
}

export interface HardwareStats {
  cpu_usage: number;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_usage_percent: number;
  usage_string: string;
}

export interface BatteryStats {
  has_battery: boolean;
  percentage: number;
  is_charging: boolean;
  status: string;
}

export interface MediaStats {
  is_available: boolean;
  is_playing: boolean;
  title: string;
  artist: string;
  album: string;
  art_url: string;
  position_secs: number;
  duration_secs: number;
  app_name: string;
}

export interface SpotifyQueueTrack {
  id: string;
  title: string;
  artist: string;
  album_art: string;
  duration_ms: number;
  uri: string;
}

export interface WeatherData {
  city: string;
  region: string;
  weather_text: string;
  weather_code: number;
  temperature_celsius: string;
  temperature_fahrenheit: string;
  temp_c: number;
  temp_f: number;
  icon: string;
}

export interface TrayItem {
  id: string;
  name: string;
  path: string;
  size_bytes: number;
  extension: string;
  is_dir: boolean;
  thumbnail?: string;
  timestamp?: number;
}

export interface TrayInfo {
  items: TrayItem[];
  totalSizeBytes: number;
  maxCapacityBytes: number;
}

export interface ShortcutItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export interface LocalSendDevice {
  alias: string;
  version?: string;
  deviceModel?: string;
  deviceType?: "mobile" | "desktop" | "web" | "headless" | "server" | string;
  fingerprint: string;
  port: number;
  protocol: "http" | "https" | string;
  download?: boolean;
  announce?: boolean;
  ip: string;
  lastSeen?: number;
}

export interface LocalSendTransferProgress {
  transferId: string;
  deviceId: string;
  fileName: string;
  transferredBytes: number;
  totalBytes: number;
  progress: number;
  speed: number;
  status: "sending" | "receiving" | "completed" | "failed" | "cancelled" | string;
  error?: string;
  textContent?: string;
}

export interface LocalSendIncomingFile {
  id: string;
  fileName: string;
  size: number;
  fileType: string;
  preview?: string;
}

export interface LocalSendIncomingTransfer {
  sessionId: string;
  sender: LocalSendDevice;
  files: LocalSendIncomingFile[];
  totalSize: number;
}

export * from "./clipboard";

export interface TranslationItem {
  detected_source_language?: string;
  text: string;
}

export interface DeepLTranslateResponse {
  translations: TranslationItem[];
}

export interface TranslationUsage {
  character_count: number;
  character_limit: number;
  remaining_characters: number;
  percent_used: number;
  is_limit_reached: boolean;
  is_online: boolean;
  api_tier: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  native_name: string;
}

export type OverlayType =
  | "none"
  | "volume"
  | "brightness"
  | "timer-over"
  | "drop-file"
  | "drop-localsend"
  | "tray-saving"
  | "tray-confirmed";
export type ViewMode = "spotify" | "pomodoro" | "tray" | "clipboard" | "translate";
