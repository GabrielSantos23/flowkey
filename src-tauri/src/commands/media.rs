use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
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
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB3); // VK_MEDIA_PLAY_PAUSE
        true
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
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
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB0); // VK_MEDIA_NEXT_TRACK
        true
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
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
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        send_windows_media_key(0xB1); // VK_MEDIA_PREV_TRACK
        true
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
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
    #[cfg(not(target_os = "linux"))]
    {
        let _ = offset_secs;
    }
    true
}

fn default_media_info() -> MediaInfo {
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

#[cfg(target_os = "linux")]
fn get_linux_media_info() -> MediaInfo {
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

    default_media_info()
}

#[cfg(target_os = "windows")]
fn get_spotify_window_media_info() -> Option<MediaInfo> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW,
    };

    struct WindowSearchData {
        found_title: String,
    }

    unsafe extern "system" fn enum_window_callback(
        hwnd: windows_sys::Win32::Foundation::HWND,
        lparam: windows_sys::Win32::Foundation::LPARAM,
    ) -> windows_sys::Win32::Foundation::BOOL {
        let data = &mut *(lparam as *mut WindowSearchData);

        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
        if len > 0 {
            let title = String::from_utf16_lossy(&title_buf[..len as usize]);
            let title_trim = title.trim();
            if !title_trim.is_empty()
                && title_trim != "Spotify"
                && title_trim != "Spotify Premium"
                && title_trim != "Spotify Free"
                && title_trim != "Spotify Music"
                && title_trim != "GDI+ Window (Spotify.exe)"
                && title_trim != "Default IME"
                && title_trim != "MSCTFIME UI"
                && title_trim.contains(" - ")
            {
                data.found_title = title_trim.to_string();
                return 0; // Stop enumeration
            }
        }
        1 // Continue enumeration
    }

    let mut search_data = WindowSearchData {
        found_title: String::new(),
    };
    unsafe {
        EnumWindows(Some(enum_window_callback), &mut search_data as *mut _ as _);
    }

    if !search_data.found_title.is_empty() {
        let parts: Vec<&str> = search_data.found_title.splitn(2, " - ").collect();
        if parts.len() == 2 {
            let artist = parts[0].trim().to_string();
            let title = parts[1].trim().to_string();
            return Some(MediaInfo {
                is_available: true,
                is_playing: true,
                title,
                artist,
                album: "".to_string(),
                art_url: "".to_string(),
                position_secs: 0.0,
                duration_secs: 200.0,
                app_name: "Spotify".to_string(),
            });
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn get_windows_media_info() -> MediaInfo {
    // Run all WinRT/COM calls on a dedicated OS thread to avoid COM apartment
    // conflicts with Tauri's tokio thread pool and WebView2's STA thread.
    // IAsyncOperation::get() blocks and needs proper COM initialization.
    let handle = std::thread::spawn(|| {
        unsafe {
            windows_sys::Win32::System::Com::CoInitializeEx(
                std::ptr::null_mut(),
                windows_sys::Win32::System::Com::COINIT_MULTITHREADED as _,
            );
        }
        let result = std::panic::catch_unwind(|| {
            get_windows_media_info_internal()
        });
        match result {
            Ok(info) => info,
            Err(_) => default_media_info(),
        }
    });

    match handle.join() {
        Ok(info) => info,
        Err(_) => {
            // Thread panicked or crashed — fall back to window title detection
            get_spotify_window_media_info().unwrap_or_else(default_media_info)
        }
    }
}

#[cfg(target_os = "windows")]
fn get_windows_media_info_internal() -> MediaInfo {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
    use windows::Storage::Streams::DataReader;
    use base64::{engine::general_purpose, Engine as _};

    let mut candidate_sessions = Vec::new();

    if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
        if let Ok(manager) = manager_op.get() {
            if let Ok(sessions) = manager.GetSessions() {
                for session in sessions {
                    candidate_sessions.push(session);
                }
            }
            if candidate_sessions.is_empty() {
                if let Ok(current) = manager.GetCurrentSession() {
                    candidate_sessions.push(current);
                }
            }
        }
    }

    for session in candidate_sessions {
        let app_id = session.SourceAppUserModelId().unwrap_or_default().to_string();
        let app_id_lower = app_id.to_lowercase();
        let app_name = if app_id_lower.contains("spotify") {
            "Spotify".to_string()
        } else if app_id_lower.contains("chrome") {
            "Chromium".to_string()
        } else if app_id_lower.contains("firefox") {
            "Firefox".to_string()
        } else if app_id_lower.contains("edge") {
            "Edge".to_string()
        } else if !app_id.is_empty() {
            app_id
        } else {
            "Media Player".to_string()
        };

        let is_playing = if let Ok(info) = session.GetPlaybackInfo() {
            if let Ok(status) = info.PlaybackStatus() {
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
            } else {
                false
            }
        } else {
            false
        };

        let mut title = String::new();
        let mut artist = String::new();
        let mut album = String::new();
        let mut art_url = String::new();

        if let Ok(props_op) = session.TryGetMediaPropertiesAsync() {
            if let Ok(props) = props_op.get() {
                title = props.Title().unwrap_or_default().to_string();
                artist = props.Artist().unwrap_or_default().to_string();
                album = props.AlbumTitle().unwrap_or_default().to_string();

                // Cached thumbnail check
                static LAST_MEDIA_KEY: std::sync::Mutex<(String, String)> = std::sync::Mutex::new((String::new(), String::new()));
                let current_key = format!("{}::{}", title, artist);

                let cached_art = {
                    let guard = LAST_MEDIA_KEY.lock().unwrap();
                    if guard.0 == current_key && !guard.1.is_empty() {
                        Some(guard.1.clone())
                    } else {
                        None
                    }
                };

                if let Some(cached) = cached_art {
                    art_url = cached;
                } else if let Ok(thumb_ref) = props.Thumbnail() {
                    if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
                        if let Ok(stream) = stream_op.get() {
                            if let Ok(size) = stream.Size() {
                                if size > 0 && size < 3_000_000 {
                                    if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                        if let Ok(load_op) = reader.LoadAsync(size as u32) {
                                            if load_op.get().is_ok() {
                                                let mut buffer = vec![0u8; size as usize];
                                                if reader.ReadBytes(&mut buffer).is_ok() {
                                                    let content_type = stream.ContentType().unwrap_or_default().to_string();
                                                    let mime = if content_type.is_empty() {
                                                        "image/jpeg"
                                                    } else {
                                                        &content_type
                                                    };
                                                    let b64 = general_purpose::STANDARD.encode(&buffer);
                                                    art_url = format!("data:{};base64,{}", mime, b64);
                                                    if let Ok(mut guard) = LAST_MEDIA_KEY.lock() {
                                                        *guard = (current_key, art_url.clone());
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let mut position_secs = 0.0;
        let mut duration_secs = 200.0;

        if let Ok(timeline) = session.GetTimelineProperties() {
            if let Ok(pos) = timeline.Position() {
                position_secs = (pos.Duration as f64) / 10_000_000.0;
            }
            if let Ok(end) = timeline.EndTime() {
                let dur = (end.Duration as f64) / 10_000_000.0;
                if dur > 0.0 {
                    duration_secs = dur;
                }
            }
        }

        if !title.is_empty() || is_playing {
            return MediaInfo {
                is_available: true,
                is_playing,
                title: if title.is_empty() { "Unknown Track".into() } else { title },
                artist: if artist.is_empty() { "Spotify".into() } else { artist },
                album,
                art_url,
                position_secs,
                duration_secs: if duration_secs > 0.0 { duration_secs } else { 200.0 },
                app_name,
            };
        }
    }

    // Secondary fallback: inspect Spotify window title
    if let Some(info) = get_spotify_window_media_info() {
        return info;
    }

    default_media_info()
}

#[tauri::command]
pub fn get_media_info() -> MediaInfo {
    #[cfg(target_os = "linux")]
    {
        get_linux_media_info()
    }

    #[cfg(target_os = "windows")]
    {
        get_windows_media_info()
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    default_media_info()
}
