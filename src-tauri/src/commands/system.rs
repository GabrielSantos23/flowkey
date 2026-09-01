use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "linux")]
use gtk::prelude::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemAudioInfo {
    pub volume_percent: u32,
    pub is_muted: bool,
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        #[cfg(target_os = "linux")]
        {
            if let Ok(gtk_win) = window.gtk_window() {
                gtk_win.show_all();
                gtk_win.present();
            }
        }
        return true;
    } else {
        if let Ok(window) = tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html?window=settings".into()),
        )
        .title("DynamicWin Settings")
        .inner_size(680.0, 580.0)
        .min_inner_size(540.0, 460.0)
        .center()
        .decorations(true)
        .resizable(true)
        .build() {
            let _ = window.show();
            let _ = window.set_focus();

            #[cfg(target_os = "linux")]
            {
                if let Ok(gtk_win) = window.gtk_window() {
                    gtk_win.show_all();
                    gtk_win.present();
                }
            }
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn position_window_at_top(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(true);
        let _ = window.set_skip_taskbar(true);
        let _ = window.set_decorations(false);
        let _ = window.set_shadow(false);

        let logical_w = 600.0;
        let logical_h = 420.0;

        let mut pos_x = 0;
        let pos_y = 0;

        if let Ok(Some(monitor)) = window.current_monitor() {
            let monitor_size = monitor.size();
            let scale = monitor.scale_factor();
            let win_w = (logical_w * scale) as u32;
            let win_h = (logical_h * scale) as u32;

            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: win_w,
                height: win_h,
            }));
            pos_x = ((monitor_size.width as i32) - (win_w as i32)) / 2;
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(gtk_win) = window.gtk_window() {
                gtk_win.set_keep_above(true);
                gtk_win.stick();
                gtk_win.set_type_hint(gdk::WindowTypeHint::Dock);
                gtk_win.move_(pos_x, pos_y);
            }
        }

        return true;
    }
    false
}

#[tauri::command]
pub fn resize_island_window(app: AppHandle, width: u32, height: u32) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale = monitor.scale_factor();
            let win_w = (width as f64 * scale) as u32;
            let win_h = (height as f64 * scale) as u32;
            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: win_w,
                height: win_h,
            }));
            let pos_x = ((monitor.size().width as i32) - (win_w as i32)) / 2;
            let pos_y = 0;
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));

            #[cfg(target_os = "linux")]
            {
                if let Ok(gtk_win) = window.gtk_window() {
                    gtk_win.move_(pos_x, pos_y);
                }
            }
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn update_input_mask(app: AppHandle, x: i32, y: i32, width: i32, height: i32) -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(gtk_win) = window.gtk_window() {
                let rect = cairo::RectangleInt::new(x, y, width, height);
                let region = cairo::Region::create_rectangle(&rect);
                gtk_win.input_shape_combine_region(Some(&region));
                return true;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    let rgn = windows_sys::Win32::Graphics::Gdi::CreateRectRgn(
                        x,
                        y,
                        x + width,
                        y + height,
                    );
                    windows_sys::Win32::UI::WindowsAndMessaging::SetWindowRgn(hwnd.0 as _, rgn, 1);
                }
                return true;
            }
        }
    }

    false
}

#[tauri::command]
pub fn clear_input_mask(app: AppHandle) -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(gtk_win) = window.gtk_window() {
                gtk_win.input_shape_combine_region(None);
                return true;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::SetWindowRgn(hwnd.0 as _, 0, 1);
                }
                return true;
            }
        }
    }

    false
}

#[tauri::command]
pub fn get_system_volume() -> SystemAudioInfo {
    #[cfg(target_os = "linux")]
    {
        let mut vol = 65;
        let mut is_muted = false;

        if let Ok(out) = Command::new("pactl").args(["get-sink-volume", "@DEFAULT_SINK@"]).output() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(percent_pos) = s.find('%') {
                let start = s[..percent_pos].rfind(|c: char| !c.is_ascii_digit()).map(|p| p + 1).unwrap_or(0);
                if let Ok(v) = s[start..percent_pos].trim().parse::<u32>() {
                    vol = v.min(100);
                }
            }
        }

        if let Ok(out) = Command::new("pactl").args(["get-sink-mute", "@DEFAULT_SINK@"]).output() {
            let s = String::from_utf8_lossy(&out.stdout).to_lowercase();
            is_muted = s.contains("yes");
        }

        SystemAudioInfo {
            volume_percent: vol,
            is_muted,
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut vol = 65;
        let mut is_muted = false;

        if let Ok(out) = Command::new("powershell")
            .args(["-NoProfile", "-Command", "[Math]::Round((Get-AudioDevice -List | Where-Object Default).Volume)"])
            .output()
        {
            if let Ok(v) = String::from_utf8_lossy(&out.stdout).trim().parse::<u32>() {
                vol = v.min(100);
            }
        }

        SystemAudioInfo {
            volume_percent: vol,
            is_muted,
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        SystemAudioInfo {
            volume_percent: 65,
            is_muted: false,
        }
    }
}

pub fn start_audio_volume_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_vol = 0;
        let mut last_muted = false;
        let mut initialized = false;

        loop {
            let info = get_system_volume();
            if !initialized {
                last_vol = info.volume_percent;
                last_muted = info.is_muted;
                initialized = true;
            } else if info.volume_percent != last_vol || info.is_muted != last_muted {
                last_vol = info.volume_percent;
                last_muted = info.is_muted;
                use tauri::Emitter;
                let _ = app.emit("volume-changed", &info);
            }

            std::thread::sleep(std::time::Duration::from_millis(150));
        }
    });
}

#[tauri::command]
pub fn set_system_volume(percent: u32) -> bool {
    #[cfg(target_os = "linux")]
    {
        let vol_str = format!("{}%", percent.min(100));
        let _ = Command::new("pactl")
            .args(["set-sink-volume", "@DEFAULT_SINK@", &vol_str])
            .status();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Set-AudioDevice -Volume {}", percent.min(100))])
            .status();
    }

    true
}

#[tauri::command]
pub fn get_system_brightness() -> u32 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(out) = Command::new("brightnessctl").arg("g").output() {
            if let Ok(curr) = String::from_utf8_lossy(&out.stdout).trim().parse::<f32>() {
                if let Ok(max_out) = Command::new("brightnessctl").arg("m").output() {
                    if let Ok(max) = String::from_utf8_lossy(&max_out.stdout).trim().parse::<f32>() {
                        if max > 0.0 {
                            return ((curr / max) * 100.0).round() as u32;
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness).CurrentBrightness"])
            .output()
        {
            if let Ok(v) = String::from_utf8_lossy(&out.stdout).trim().parse::<u32>() {
                return v.min(100);
            }
        }
    }

    80
}

#[tauri::command]
pub fn set_system_brightness(percent: u32) -> bool {
    #[cfg(target_os = "linux")]
    {
        let pct_str = format!("{}%", percent.min(100));
        let _ = Command::new("brightnessctl").args(["s", &pct_str]).status();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {})", percent.min(100))])
            .status();
    }

    true
}

#[tauri::command]
pub fn get_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let mut list = Vec::new();
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(monitors) = window.available_monitors() {
            let primary = window.primary_monitor().ok().flatten();
            for m in monitors {
                let name = m.name().map(|n| n.to_string()).unwrap_or_else(|| "Display".to_string());
                let size = m.size();
                let scale = m.scale_factor();
                let is_primary = primary.as_ref().and_then(|p| p.name()).map(|pn| pn == &name).unwrap_or(false);

                list.push(MonitorInfo {
                    name,
                    width: size.width,
                    height: size.height,
                    scale_factor: scale,
                    is_primary,
                });
            }
        }
    }
    list
}

#[tauri::command]
pub fn toggle_island_hidden(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(is_visible) = window.is_visible() {
            if is_visible {
                let _ = window.hide();
                return false;
            } else {
                let _ = window.show();
                let _ = window.set_focus();
                return true;
            }
        }
    }
    true
}
