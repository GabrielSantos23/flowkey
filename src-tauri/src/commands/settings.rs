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
    #[serde(default = "default_true")]
    pub use_celsius: bool,
    #[serde(default = "default_false")]
    pub hide_location: bool,
    #[serde(default = "default_true")]
    pub volume_popup: bool,
    #[serde(default = "default_true")]
    pub brightness_popup: bool,
    #[serde(default = "default_false")]
    pub is_hidden: bool,
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
            use_celsius: true,
            hide_location: false,
            volume_popup: true,
            brightness_popup: true,
            is_hidden: false,
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

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<bool, String> {
    let file = get_config_dir().join("Settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-updated", &settings);
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
