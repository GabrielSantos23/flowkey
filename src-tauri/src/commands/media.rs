use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaInfo {
    pub is_available: bool,
    pub is_playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub art_url: String,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub app_name: String,
}

#[cfg(target_os = "linux")]
fn get_active_mpris_service() -> Option<String> {
    if let Ok(out) = Command::new("busctl").args(["--user", "list"]).output() {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut services: Vec<String> = Vec::new();
        for line in text.lines() {
            if let Some(pos) = line.find("org.mpris.MediaPlayer2.") {
                let service = line[pos..].split_whitespace().next().unwrap_or("").to_string();
                if !service.is_empty() {
                    services.push(service);
                }
            }
        }

        // Prioritize Spotify if running
        if let Some(spot) = services.iter().find(|s| s.contains("spotify")) {
            return Some(spot.clone());
        }

        return services.into_iter().next();
    }
    None
}

#[cfg(target_os = "linux")]
fn extract_mpris_string(haystack: &str, key: &str) -> Option<String> {
    let quoted_key = format!("\"{}\"", key);
    if let Some(idx) = haystack.find(&quoted_key) {
        let after_key = &haystack[idx + quoted_key.len()..];
        if let Some(start) = after_key.find('"') {
            let value_slice = &after_key[start + 1..];
            if let Some(end) = value_slice.find('"') {
                let val = value_slice[..end].trim().to_string();
                if !val.is_empty() {
                    return Some(val);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn send_windows_media_key(vk: u8) {
    unsafe {
        windows_sys::Win32::UI::Input::KeyboardAndMouse::keybd_event(vk, 0, 0, 0);
        windows_sys::Win32::UI::Input::KeyboardAndMouse::keybd_event(
            vk,
            0,
            windows_sys::Win32::UI::Input::KeyboardAndMouse::KEYEVENTF_KEYUP,
            0,
        );
    }
}

#[tauri::command]
pub fn media_play_pause() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Some(svc) = get_active_mpris_service() {
            let _ = Command::new("busctl")
                .args(["--user", "call", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "PlayPause"])
                .status();
            return true;
        }

        if Command::new("playerctl").arg("play-pause").status().is_ok() {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB3); // VK_MEDIA_PLAY_PAUSE
        return true;
    }

    true
}

#[tauri::command]
pub fn media_next() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Some(svc) = get_active_mpris_service() {
            let _ = Command::new("busctl")
                .args(["--user", "call", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "Next"])
                .status();
            return true;
        }

        if Command::new("playerctl").arg("next").status().is_ok() {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB0); // VK_MEDIA_NEXT_TRACK
        return true;
    }

    true
}

#[tauri::command]
pub fn media_prev() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Some(svc) = get_active_mpris_service() {
            let _ = Command::new("busctl")
                .args(["--user", "call", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "Previous"])
                .status();
            return true;
        }

        if Command::new("playerctl").arg("previous").status().is_ok() {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB1); // VK_MEDIA_PREV_TRACK
        return true;
    }

    true
}

#[tauri::command]
pub fn media_seek(offset_secs: f64) -> bool {
    #[cfg(target_os = "linux")]
    {
        let offset_micros = (offset_secs * 1_000_000.0) as i64;
        if let Some(svc) = get_active_mpris_service() {
            let _ = Command::new("busctl")
                .args([
                    "--user",
                    "call",
                    &svc,
                    "/org/mpris/MediaPlayer2",
                    "org.mpris.MediaPlayer2.Player",
                    "Seek",
                    "x",
                    &offset_micros.to_string(),
                ])
                .status();
            return true;
        }
    }
    true
}

#[tauri::command]
pub fn get_media_info() -> MediaInfo {
    #[cfg(target_os = "linux")]
    {
        if let Some(svc) = get_active_mpris_service() {
            let status_out = Command::new("busctl")
                .args(["--user", "get-property", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "PlaybackStatus"])
                .output();

            let is_playing = if let Ok(out) = status_out {
                String::from_utf8_lossy(&out.stdout).contains("Playing")
            } else {
                false
            };

            let meta_out = Command::new("busctl")
                .args(["--user", "get-property", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "Metadata"])
                .output();

            let meta_str = meta_out.map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();

            let title = extract_mpris_string(&meta_str, "xesam:title").unwrap_or_default();
            let artist = extract_mpris_string(&meta_str, "xesam:artist")
                .or_else(|| extract_mpris_string(&meta_str, "xesam:albumArtist"))
                .unwrap_or_default();
            let album = extract_mpris_string(&meta_str, "xesam:album").unwrap_or_default();
            let mut art_url = extract_mpris_string(&meta_str, "mpris:artUrl").unwrap_or_default();

            // Length
            let duration_secs = if let Some(len_idx) = meta_str.find("\"mpris:length\"") {
                let slice = &meta_str[len_idx + "\"mpris:length\"".len()..];
                let num_str: String = slice.chars().skip_while(|c| !c.is_ascii_digit()).take_while(|c| c.is_ascii_digit()).collect();
                num_str.parse::<f64>().ok().map(|us| us / 1_000_000.0).unwrap_or(205.0)
            } else {
                205.0
            };

            // Position
            let pos_out = Command::new("busctl")
                .args(["--user", "get-property", &svc, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", "Position"])
                .output();

            let position_secs = if let Ok(out) = pos_out {
                let s = String::from_utf8_lossy(&out.stdout);
                let num_str: String = s.chars().skip_while(|c| !c.is_ascii_digit()).take_while(|c| c.is_ascii_digit()).collect();
                num_str.parse::<f64>().ok().map(|us| us / 1_000_000.0).unwrap_or(0.0)
            } else {
                0.0
            };

            if art_url.starts_with("file://") {
                art_url = art_url.replace("file://", "");
            }

            let app_name = if svc.contains("spotify") {
                "Spotify".to_string()
            } else if svc.contains("chromium") {
                "Chromium".to_string()
            } else if svc.contains("firefox") {
                "Firefox".to_string()
            } else {
                "Media Player".to_string()
            };

            if !title.is_empty() || !artist.is_empty() || is_playing {
                return MediaInfo {
                    is_available: true,
                    is_playing,
                    title: if title.is_empty() { "Unknown Track".into() } else { title },
                    artist: if artist.is_empty() { "Spotify".into() } else { artist },
                    album,
                    art_url,
                    position_secs,
                    duration_secs: if duration_secs > 0.0 { duration_secs } else { 205.0 },
                    app_name,
                };
            }
        }
    }

    MediaInfo {
        is_available: false,
        is_playing: false,
        title: "".to_string(),
        artist: "".to_string(),
        album: "".to_string(),
        art_url: "".to_string(),
        position_secs: 0.0,
        duration_secs: 200.0,
        app_name: "Spotify".to_string(),
    }
}
