use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(default = "default_island_mode")]
    pub island_mode: String, // "island" or "notch"
    #[serde(default = "default_true")]
    pub allow_blur: bool,
    #[serde(default = "default_true")]
    pub allow_animation: bool,
    #[serde(default = "default_true")]
    pub anti_aliasing: bool,
    #[serde(default = "default_false")]
    pub run_on_startup: bool,
    #[serde(default)]
    pub theme_index: i32,
    #[serde(default)]
    pub screen_index: i32,
    #[serde(default = "default_small_left")]
    pub small_widgets_left: Vec<String>,
    #[serde(default = "default_small_middle")]
    pub small_widgets_middle: Vec<String>,
    #[serde(default = "default_small_right")]
    pub small_widgets_right: Vec<String>,
    #[serde(default = "default_big_widgets")]
    pub big_widgets: Vec<String>,
    #[serde(default = "default_enabled_widgets")]
    pub enabled_widgets: Vec<String>,
    #[serde(default = "default_true")]
    pub use_celsius: bool,
    #[serde(default = "default_false")]
    pub hide_location: bool,
    #[serde(default = "default_true")]
    pub volume_popup: bool,
    #[serde(default = "default_false")]
    pub brightness_popup: bool,
    #[serde(default = "default_false")]
    pub disable_wave_animation: bool,
    #[serde(default = "default_false")]
    pub auto_hide_on_fullscreen: bool,
    #[serde(default = "default_false")]
    pub game_mode_disable_animations: bool,
    #[serde(default = "default_false")]
    pub is_hidden: bool,
    #[serde(default = "default_toggle_island_hotkey")]
    pub toggle_island_hotkey: String,
    #[serde(default)]
    pub open_spotify_hotkey: String,
    #[serde(default)]
    pub open_pomodoro_hotkey: String,
    #[serde(default)]
    pub open_tray_hotkey: String,
    #[serde(default)]
    pub open_clipboard_hotkey: String,
    #[serde(default)]
    pub open_translate_hotkey: String,
    #[serde(default = "default_spotify_search_hotkey")]
    pub spotify_search_hotkey: String,
}

fn default_island_mode() -> String {
    "island".to_string()
}
fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_spotify_search_hotkey() -> String {
    "Alt+F".to_string()
}
fn default_toggle_island_hotkey() -> String {
    "Ctrl+Space".to_string()
}
fn default_small_left() -> Vec<String> {
    vec!["time".to_string()]
}
fn default_small_middle() -> Vec<String> {
    vec![]
}
fn default_small_right() -> Vec<String> {
    vec!["used_devices".to_string(), "battery".to_string()]
}
fn default_big_widgets() -> Vec<String> {
    vec![
        "media".to_string(),
        "weather".to_string(),
        "timer".to_string(),
        "shortcuts".to_string(),
    ]
}
fn default_enabled_widgets() -> Vec<String> {
    vec![
        "spotify".to_string(),
        "pomodoro".to_string(),
        "tray".to_string(),
        "clipboard".to_string(),
        "translate".to_string(),
    ]
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            island_mode: default_island_mode(),
            allow_blur: true,
            allow_animation: true,
            anti_aliasing: true,
            run_on_startup: false,
            theme_index: 0,
            screen_index: 0,
            small_widgets_left: default_small_left(),
            small_widgets_middle: default_small_middle(),
            small_widgets_right: default_small_right(),
            big_widgets: default_big_widgets(),
            enabled_widgets: default_enabled_widgets(),
            use_celsius: true,
            hide_location: false,
            volume_popup: true,
            brightness_popup: false,
            disable_wave_animation: false,
            auto_hide_on_fullscreen: false,
            game_mode_disable_animations: false,
            is_hidden: false,
            toggle_island_hotkey: default_toggle_island_hotkey(),
            open_spotify_hotkey: "".to_string(),
            open_pomodoro_hotkey: "".to_string(),
            open_tray_hotkey: "".to_string(),
            open_clipboard_hotkey: "".to_string(),
            open_translate_hotkey: "".to_string(),
            spotify_search_hotkey: default_spotify_search_hotkey(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomTheme {
    #[serde(rename = "IslandColor")]
    pub island_color: String,
    #[serde(rename = "TextMain")]
    pub text_main: String,
    #[serde(rename = "TextSecond")]
    pub text_second: String,
    #[serde(rename = "TextThird")]
    pub text_third: String,
    #[serde(rename = "Primary")]
    pub primary: String,
    #[serde(rename = "Secondary")]
    pub secondary: String,
    #[serde(rename = "Success")]
    pub success: String,
    #[serde(rename = "Error")]
    pub error: String,
    #[serde(rename = "IconColor")]
    pub icon_color: String,
    #[serde(rename = "WidgetBackground")]
    pub widget_background: String,
}

impl Default for CustomTheme {
    fn default() -> Self {
        Self {
            island_color: "#000000".to_string(),
            text_main: "#dd11dd".to_string(),
            text_second: "#aa11aa".to_string(),
            text_third: "#661166".to_string(),
            primary: "#dd11dd".to_string(),
            secondary: "#111111".to_string(),
            success: "#991199".to_string(),
            error: "#e74c3c".to_string(),
            icon_color: "#dd11dd".to_string(),
            widget_background: "rgba(255, 255, 255, 0.07)".to_string(),
        }
    }
}

fn get_config_dir() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DynamicWin");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

#[tauri::command]
pub fn load_settings() -> AppSettings {
    let file = get_config_dir().join("Settings.json");
    if file.exists() {
        if let Ok(content) = fs::read_to_string(file) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn focus_main_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                use windows_sys::Win32::System::Threading::AttachThreadInput;
                use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                    keybd_event, KEYEVENTF_KEYUP, VK_CONTROL, VK_MENU,
                };
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    BringWindowToTop, GetForegroundWindow,
                    GetWindowThreadProcessId, SetForegroundWindow,
                };

                // 1. Release Alt virtual state and tap Ctrl to break out of Windows system menu loop
                keybd_event(VK_MENU as u8, 0, KEYEVENTF_KEYUP, 0);
                keybd_event(VK_CONTROL as u8, 0, 0, 0);
                keybd_event(VK_CONTROL as u8, 0, KEYEVENTF_KEYUP, 0);

                // 2. Attach thread input to bypass Windows focus stealing protection
                let my_thread = GetWindowThreadProcessId(hwnd.0 as _, std::ptr::null_mut());
                let fg_hwnd = GetForegroundWindow();
                let fg_thread = GetWindowThreadProcessId(fg_hwnd, std::ptr::null_mut());

                if fg_thread != 0 && fg_thread != my_thread {
                    AttachThreadInput(fg_thread, my_thread, 1);
                    SetForegroundWindow(hwnd.0 as _);
                    BringWindowToTop(hwnd.0 as _);
                    AttachThreadInput(fg_thread, my_thread, 0);
                } else {
                    SetForegroundWindow(hwnd.0 as _);
                    BringWindowToTop(hwnd.0 as _);
                }
            }
        }
    }
    let _ = window.set_focus();
}

pub fn bind_all_shortcuts(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    use tauri::Manager;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let _ = app.global_shortcut().unregister_all();

    let shortcuts_to_bind: Vec<(String, String, Option<String>)> = vec![
        (settings.toggle_island_hotkey.clone(), "toggle-island".to_string(), None),
        (settings.open_spotify_hotkey.clone(), "open-widget".to_string(), Some("spotify".to_string())),
        (settings.open_pomodoro_hotkey.clone(), "open-widget".to_string(), Some("pomodoro".to_string())),
        (settings.open_tray_hotkey.clone(), "open-widget".to_string(), Some("tray".to_string())),
        (settings.open_clipboard_hotkey.clone(), "open-widget".to_string(), Some("clipboard".to_string())),
        (settings.open_translate_hotkey.clone(), "open-widget".to_string(), Some("translate".to_string())),
        (settings.spotify_search_hotkey.clone(), "toggle-spotify-search".to_string(), None),
    ];

    for (raw_key, event_name, payload) in shortcuts_to_bind {
        let clean = raw_key.replace(" ", "");
        if clean.is_empty() {
            continue;
        }

        let ev_name = event_name.clone();
        let pyld = payload.clone();

        let _ = app.global_shortcut().on_shortcut(clean.as_str(), move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if ev_name == "toggle-island" {
                    let _ = crate::commands::system::toggle_island(app.clone());
                } else if let Some(window) = app.get_webview_window("main") {
                    focus_main_window(&window);
                    if let Some(ref p) = pyld {
                        let _ = app.emit(&ev_name, p);
                    } else {
                        let _ = app.emit(&ev_name, ());
                    }
                }
            }
        });
    }

    Ok(())
}

pub fn bind_spotify_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let mut s = load_settings();
    s.spotify_search_hotkey = hotkey.to_string();
    bind_all_shortcuts(app, &s)
}

#[tauri::command]
pub fn register_all_shortcuts(app: AppHandle, settings: AppSettings) -> Result<bool, String> {
    bind_all_shortcuts(&app, &settings)?;
    Ok(true)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<bool, String> {
    let file = get_config_dir().join("Settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-updated", &settings);

    // Update all global shortcuts
    let _ = bind_all_shortcuts(&app, &settings);

    // Sync Windows autostart
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if settings.run_on_startup {
            if let Ok(exe) = std::env::current_exe() {
                let exe_str = format!("\"{}\"", exe.to_string_lossy());
                let _ = std::process::Command::new("reg")
                    .args(&[
                        "add",
                        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "FlowKey",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &exe_str,
                        "/f",
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "FlowKey",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }

    Ok(true)
}

#[tauri::command]
pub fn register_spotify_search_hotkey(app: AppHandle, hotkey: String) -> Result<bool, String> {
    bind_spotify_hotkey(&app, &hotkey)?;
    Ok(true)
}

#[tauri::command]
pub fn load_custom_theme() -> CustomTheme {
    let file = get_config_dir().join("Theme.json");
    if file.exists() {
        if let Ok(content) = fs::read_to_string(file) {
            if let Ok(theme) = serde_json::from_str::<CustomTheme>(&content) {
                return theme;
            }
        }
    }
    CustomTheme::default()
}

#[tauri::command]
pub fn save_custom_theme(app: AppHandle, theme: CustomTheme) -> Result<bool, String> {
    let file = get_config_dir().join("Theme.json");
    let content = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    let _ = app.emit("theme-updated", &theme);
    Ok(true)
}
