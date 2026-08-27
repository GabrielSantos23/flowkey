use base64::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{command, AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, KEYEVENTF_KEYUP, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct SpotifyTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: Option<String>,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
}

#[command]
fn native_play_pause() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(VK_MEDIA_PLAY_PAUSE as u8, 0, 0, 0);
        keybd_event(VK_MEDIA_PLAY_PAUSE as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok("VK_MEDIA_PLAY_PAUSE (0xB3) sent".into())
}

#[command]
fn native_next_track() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(VK_MEDIA_NEXT_TRACK as u8, 0, 0, 0);
        keybd_event(VK_MEDIA_NEXT_TRACK as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok("VK_MEDIA_NEXT_TRACK (0xB0) sent".into())
}

#[command]
fn native_prev_track() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(VK_MEDIA_PREV_TRACK as u8, 0, 0, 0);
        keybd_event(VK_MEDIA_PREV_TRACK as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok("VK_MEDIA_PREV_TRACK (0xB1) sent".into())
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct NativeMediaMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_art: String,
}

#[cfg(target_os = "windows")]
fn get_windows_media_properties() -> Result<NativeMediaMetadata, String> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let session = manager
        .GetCurrentSession()
        .map_err(|e| e.to_string())?;

    let properties = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let title = properties.Title().map(|h| h.to_string()).unwrap_or_default();
    let artist = properties.Artist().map(|h| h.to_string()).unwrap_or_default();
    let album = properties.AlbumTitle().map(|h| h.to_string()).unwrap_or_default();

    let mut album_art = String::new();
    if let Ok(thumb_ref) = properties.Thumbnail() {
        if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
            if let Ok(stream) = stream_op.get() {
                if let Ok(size) = stream.Size() {
                    if size > 0 && size < 4 * 1024 * 1024 {
                        use windows::Storage::Streams::{DataReader, InputStreamOptions};
                        if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                            let _ = reader.SetInputStreamOptions(InputStreamOptions::None);
                            if let Ok(load_op) = reader.LoadAsync(size as u32) {
                                if load_op.get().is_ok() {
                                    let mut bytes = vec![0u8; size as usize];
                                    if reader.ReadBytes(&mut bytes).is_ok() {
                                        album_art = format!(
                                            "data:image/png;base64,{}",
                                            BASE64_STANDARD.encode(&bytes)
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(NativeMediaMetadata {
        title,
        artist,
        album,
        album_art,
    })
}

#[cfg(target_os = "windows")]
fn get_spotify_window_title_info() -> Result<NativeMediaMetadata, String> {
    use windows_sys::Win32::Foundation::{HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowTextW, IsWindowVisible};

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), 512);
        if len > 0 {
            let text = String::from_utf16_lossy(&buffer[..len as usize]);
            if text.contains(" - ")
                && !text.contains("Chrome")
                && !text.contains("Visual Studio")
                && !text.contains("FlowKey")
            {
                let match_ptr = lparam as *mut Option<String>;
                if (*match_ptr).is_none() {
                    *match_ptr = Some(text);
                }
            }
        }
        1
    }

    let mut result_title: Option<String> = None;
    unsafe {
        EnumWindows(Some(enum_proc), &mut result_title as *mut _ as LPARAM);
    }

    if let Some(full) = result_title {
        if let Some((artist, title)) = full.split_once(" - ") {
            return Ok(NativeMediaMetadata {
                title: title.trim().to_string(),
                artist: artist.trim().to_string(),
                album: String::new(),
                album_art: String::new(),
            });
        }
    }

    Err("No Spotify window title found".into())
}

#[command]
async fn get_native_media_info() -> Result<NativeMediaMetadata, String> {
    #[cfg(target_os = "windows")]
    {
        
        if let Ok(meta) = get_windows_media_properties() {
            if !meta.title.is_empty() {
                return Ok(meta);
            }
        }

        if let Ok(meta) = get_spotify_window_title_info() {
            if !meta.title.is_empty() {
                return Ok(meta);
            }
        }
    }

    Ok(NativeMediaMetadata::default())
}

#[command]
async fn spotify_exchange_code(
    client_id: String,
    client_secret: String,
    code: String,
    redirect_uri: String,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let auth = BASE64_STANDARD.encode(format!("{}:{}", client_id, client_secret));

    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("code", &code);
    params.insert("redirect_uri", &redirect_uri);

    let res = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify Token Error: {}", err_text));
    }

    let token_data: SpotifyTokenResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(token_data)
}

#[command]
async fn spotify_refresh_token(
    client_id: String,
    client_secret: String,
    refresh_token: String,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let auth = BASE64_STANDARD.encode(format!("{}:{}", client_id, client_secret));

    let mut params = HashMap::new();
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", &refresh_token);

    let res = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify Refresh Error: {}", err_text));
    }

    let token_data: SpotifyTokenResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(token_data)
}

#[command]
async fn spotify_get_client_credentials(
    client_id: String,
    client_secret: String,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let auth = BASE64_STANDARD.encode(format!("{}:{}", client_id, client_secret));

    let mut params = HashMap::new();
    params.insert("grant_type", "client_credentials");

    let res = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify Client Credentials Error: {}", err_text));
    }

    let token_data: SpotifyTokenResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(token_data)
}

#[command]
async fn start_spotify_oauth_listener(
    client_id: String,
    client_secret: String,
    port: u16,
) -> Result<SpotifyTokenResponse, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind loopback server on {}: {}", addr, e))?;

    let (mut stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(180),
        listener.accept(),
    )
    .await
    .map_err(|_| "Spotify login timed out after 3 minutes. Please try again.".to_string())?
    .map_err(|e| format!("Accept error: {}", e))?;

    let mut buffer = [0u8; 4096];
    let n = stream
        .read(&mut buffer)
        .await
        .map_err(|e| format!("Socket read error: {}", e))?;
    let request_str = String::from_utf8_lossy(&buffer[..n]);

    let mut auth_code = None;
    let mut error_msg = None;
    if let Some(first_line) = request_str.lines().next() {
        if let Some(query_start) = first_line.find('?') {
            if let Some(query_end) = first_line[query_start..].find(' ') {
                let query = &first_line[query_start + 1..query_start + query_end];
                for param in query.split('&') {
                    let mut parts = param.split('=');
                    if let (Some(key), Some(val)) = (parts.next(), parts.next()) {
                        if key == "code" {
                            auth_code = Some(val.to_string());
                        } else if key == "error" {
                            error_msg = Some(val.to_string());
                        }
                    }
                }
            }
        }
    }

    let code = match auth_code {
        Some(c) => c,
        None => {
            let err_type = error_msg.unwrap_or_else(|| "No code received".to_string());
            let error_html = format!(
                r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Spotify Auth Error</title>
    <style>
        body {{ background: #0a0c10; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
        .card {{ background: #181216; border: 1px solid #4a1d24; border-radius: 16px; padding: 2rem; text-align: center; max-width: 480px; }}
        .badge {{ width: 48px; height: 48px; border-radius: 50%; background: rgba(244, 63, 94, 0.15); border: 1px solid #f43f5e; color: #f43f5e; font-size: 24px; margin: 0 auto 1rem auto; line-height: 48px; }}
        h1 {{ font-size: 1.25rem; margin-bottom: 0.5rem; color: #f43f5e; }}
        p {{ font-size: 0.85rem; color: #9ca3af; line-height: 1.5; margin-bottom: 0.75rem; }}
        code {{ background: #26161b; padding: 2px 6px; border-radius: 4px; color: #fda4af; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">&#10007;</div>
        <h1>Spotify Authorization Returned: <code>{}</code></h1>
        <p>Spotify sent a server error. This usually occurs if your Spotify account is not added under <strong>Users and Access</strong> in your Spotify Developer Dashboard for apps in Development mode.</p>
        <p>You can return to FlowKey to check settings or paste a direct access token.</p>
    </div>
</body>
</html>"#,
                err_type
            );
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                error_html.len(),
                error_html
            );
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.flush().await;
            return Err(format!("Spotify returned error: {}", err_type));
        }
    };

    let html_body = r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FlowKey Spotify Connected</title>
    <style>
        body { background: #0a0c10; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #12151e; border: 1px solid #232838; border-radius: 16px; padding: 2.5rem; text-align: center; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .badge { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; background: rgba(30, 215, 96, 0.15); border: 1px solid #1ed760; color: #1ed760; font-size: 26px; margin: 0 auto 1rem auto; line-height: 52px; }
        h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #ffffff; }
        p { font-size: 0.875rem; color: #9ca3af; margin: 0; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">&#10003;</div>
        <h1>Spotify Connected to FlowKey</h1>
        <p>Authorization was successful! You can safely close this browser window and return to FlowKey.</p>
    </div>
</body>
</html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_body.len(),
        html_body
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    spotify_exchange_code(client_id, client_secret, code, redirect_uri).await
}

#[command]
fn open_in_spotify(target: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("cmd")
            .args(["/C", "start", "", &target])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open {}: {}", target, e))?;
        Ok(format!("Opened {}", target))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!("Opened {}", target))
    }
}

#[command]
async fn toggle_now_playing_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            if let Some(search) = app.get_webview_window("search") {
                let _ = search.hide();
            }
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("overlay_trigger", ());
        }
        Ok(())
    } else {
        Err("Overlay window not found".into())
    }
}

#[command]
async fn show_now_playing_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Some(search) = app.get_webview_window("search") {
            let _ = search.hide();
        }
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("overlay_trigger", ());
        Ok(())
    } else {
        Err("Overlay window not found".into())
    }
}

#[command]
async fn toggle_search_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("search") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.hide();
            }
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("search_overlay_trigger", ());
        }
        Ok(())
    } else {
        Err("Search window not found".into())
    }
}

#[command]
async fn show_search_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("search") {
        if let Some(overlay) = app.get_webview_window("overlay") {
            let _ = overlay.hide();
        }
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("search_overlay_trigger", ());
        Ok(())
    } else {
        Err("Search window not found".into())
    }
}

#[command]
async fn hide_search_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("search") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Search window not found".into())
    }
}

#[command]
async fn hide_now_playing_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Overlay window not found".into())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrackToastPayload {
    pub action: String, 
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_art: Option<String>,
}

#[command]
async fn show_track_toast(app: AppHandle, payload: TrackToastPayload) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("toast") {
        
        let _ = window.set_ignore_cursor_events(true);

        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let toast_width = (360.0 * scale_factor) as i32;
            let toast_height = (96.0 * scale_factor) as i32;
            let margin_x = (24.0 * scale_factor) as i32;
            let margin_y = (48.0 * scale_factor) as i32; 

            let x = screen_size.width as i32 - toast_width - margin_x;
            let y = screen_size.height as i32 - toast_height - margin_y;

            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        let _ = window.emit("track_toast_event", &payload);
        let _ = app.emit("track_toast_event", &payload);
        let _ = window.show();
        Ok(())
    } else {
        Err("Toast window not found".into())
    }
}

#[command]
async fn hide_track_toast(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("toast") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Toast window not found".into())
    }
}

#[command]
async fn show_playlist_picker(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("playlist_picker") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let picker_width = (320.0 * scale_factor) as i32;
            let picker_height = (380.0 * scale_factor) as i32;
            let margin_x = (24.0 * scale_factor) as i32;
            let margin_y = (48.0 * scale_factor) as i32;

            let x = screen_size.width as i32 - picker_width - margin_x;
            let y = screen_size.height as i32 - picker_height - margin_y;

            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        let _ = window.emit("playlist_picker_trigger", ());
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Playlist picker window not found".into())
    }
}

#[command]
async fn hide_playlist_picker(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("playlist_picker") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Playlist picker window not found".into())
    }
}

#[command]
async fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
    Ok(())
}

#[command]
async fn toggle_maximize_main_window(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_max = window.is_maximized().unwrap_or(false);
        if is_max {
            let _ = window.unmaximize();
            Ok(false)
        } else {
            let _ = window.maximize();
            Ok(true)
        }
    } else {
        Err("Main window not found".into())
    }
}

#[command]
async fn close_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Open FlowKey", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit FlowKey", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("FlowKey")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_play_pause,
            native_next_track,
            native_prev_track,
            spotify_exchange_code,
            spotify_refresh_token,
            spotify_get_client_credentials,
            start_spotify_oauth_listener,
            open_in_spotify,
            toggle_now_playing_overlay,
            show_now_playing_overlay,
            hide_now_playing_overlay,
            toggle_search_overlay,
            show_search_overlay,
            hide_search_overlay,
            show_track_toast,
            hide_track_toast,
            show_playlist_picker,
            hide_playlist_picker,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            get_native_media_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

