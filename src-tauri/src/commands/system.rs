use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

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
pub fn window_minimize(app: AppHandle, label: String) -> bool {
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.minimize();
        return true;
    }
    false
}

#[tauri::command]
pub fn window_toggle_maximize(app: AppHandle, label: String) -> bool {
    if let Some(window) = app.get_webview_window(&label) {
        if let Ok(maximized) = window.is_maximized() {
            if maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn window_close(app: AppHandle, label: String) -> bool {
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.hide();
        return true;
    }
    false
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
        .title("FlowKey Settings")
        .inner_size(1020.0, 660.0)
        .min_inner_size(820.0, 520.0)
        .center()
        .decorations(false)
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
pub fn open_keybindings_window(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = app.emit("navigate-settings-tab", "keybindings");
        return true;
    } else {
        if let Ok(window) = tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html?window=settings&tab=keybindings".into()),
        )
        .title("FlowKey Keybindings")
        .inner_size(1020.0, 660.0)
        .min_inner_size(820.0, 520.0)
        .center()
        .decorations(false)
        .resizable(true)
        .build() {
            let _ = window.show();
            let _ = window.set_focus();
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
        let _ = window.set_resizable(false);

        let logical_w = 660.0;
        let logical_h = 520.0;

        if let Ok(Some(monitor)) = window.current_monitor() {
            let monitor_size = monitor.size();
            let scale = monitor.scale_factor();
            let win_w = (logical_w * scale) as u32;
            let win_h = (logical_h * scale) as u32;

            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: win_w,
                height: win_h,
            }));
            let pos_x = ((monitor_size.width as i32) - (win_w as i32)) / 2;
            let pos_y = 0;
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));

            #[cfg(target_os = "linux")]
            {
                if let Ok(gtk_win) = window.gtk_window() {
                    gtk_win.set_keep_above(true);
                    gtk_win.stick();
                    gtk_win.set_type_hint(gdk::WindowTypeHint::Dock);
                    gtk_win.move_(pos_x, pos_y);
                }
            }
        }

        return true;
    }
    false
}

#[tauri::command]
pub fn resize_island_window(app: AppHandle, width: u32, height: u32) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_resizable(false);
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

#[cfg(target_os = "windows")]
use std::sync::Mutex;

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug)]
pub struct InputMask {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(target_os = "windows")]
static CURRENT_INPUT_MASK: Mutex<Option<InputMask>> = Mutex::new(Some(InputMask {
    x: (660 - 260) / 2,
    y: 0,
    width: 260,
    height: 48,
}));

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
        let _ = app;
        if let Ok(mut mask) = CURRENT_INPUT_MASK.lock() {
            *mask = Some(InputMask { x, y, width, height });
        }
        return true;
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
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
        let _ = app;
        if let Ok(mut mask) = CURRENT_INPUT_MASK.lock() {
            *mask = None;
        }
        return true;
    }

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
    false
}

pub fn start_mouse_pass_through_watcher(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            let mut was_ignoring = false;

            loop {
                std::thread::sleep(std::time::Duration::from_millis(10)); // 100Hz smooth tracking

                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(is_visible) = window.is_visible() {
                        if !is_visible {
                            continue;
                        }
                    }

                    let mut pt = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
                    unsafe {
                        windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut pt);
                    }

                    if let Ok(pos) = window.outer_position() {
                        if let Ok(scale) = window.scale_factor() {
                            let client_css_x = (pt.x - pos.x) as f64 / scale;
                            let client_css_y = (pt.y - pos.y) as f64 / scale;

                            let should_ignore = if let Ok(guard) = CURRENT_INPUT_MASK.lock() {
                                if let Some(mask) = *guard {
                                    let pad_x = 6.0;
                                    let pad_y = 6.0;
                                    let is_inside = client_css_x >= (mask.x as f64 - pad_x)
                                        && client_css_x <= ((mask.x + mask.width) as f64 + pad_x)
                                        && client_css_y >= (mask.y as f64 - pad_y)
                                        && client_css_y <= ((mask.y + mask.height) as f64 + pad_y);
                                    !is_inside
                                } else {
                                    false
                                }
                            } else {
                                false
                            };

                            if should_ignore != was_ignoring {
                                was_ignoring = should_ignore;
                                let _ = window.set_ignore_cursor_events(should_ignore);
                            }
                        }
                    }
                }
            }
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
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
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{
            eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

            let enumerator: Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

            if let Ok(enumerator) = enumerator {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                    if let Ok(endpoint_vol) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                        let vol_scalar = endpoint_vol.GetMasterVolumeLevelScalar().unwrap_or(0.65);
                        let is_muted = endpoint_vol.GetMute().map(|b| b.as_bool()).unwrap_or(false);

                        return SystemAudioInfo {
                            volume_percent: (vol_scalar * 100.0).round() as u32,
                            is_muted,
                        };
                    }
                }
            }
        }

        SystemAudioInfo {
            volume_percent: 65,
            is_muted: false,
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

            std::thread::sleep(std::time::Duration::from_millis(100));
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
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{
            eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

            let enumerator: Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

            if let Ok(enumerator) = enumerator {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                    if let Ok(endpoint_vol) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                        let scalar = (percent.min(100) as f32) / 100.0;
                        let _ = endpoint_vol.SetMasterVolumeLevelScalar(scalar, std::ptr::null());
                        if percent > 0 {
                            let _ = endpoint_vol.SetMute(false, std::ptr::null());
                        }
                        return true;
                    }
                }
            }
        }
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
pub fn toggle_island(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(is_visible) = window.is_visible() {
            if is_visible {
                let _ = window.hide();
                return false;
            } else {
                let _ = window.show();
                let _ = window.unminimize();
                crate::commands::settings::focus_main_window(&window);
                return true;
            }
        }
    }
    true
}

#[tauri::command]
pub fn toggle_island_hidden(app: AppHandle) -> bool {
    toggle_island(app)
}

fn is_standard_desktop_app(proc_path: &str) -> bool {
    let lower = proc_path.to_lowercase();
    let name = lower.rsplit('\\').next().unwrap_or(&lower);

    const EXCLUDED_EXES: &[&str] = &[
        // Browsers
        "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
        "operagx.exe", "arc.exe", "vivaldi.exe", "waterfox.exe", "tor.exe",
        // Developer & Terminals
        "code.exe", "devenv.exe", "idea64.exe", "clion64.exe", "pycharm64.exe",
        "webstorm64.exe", "windowsterminal.exe", "cmd.exe", "powershell.exe", "pwsh.exe",
        // Windows Shell & System
        "explorer.exe", "taskmgr.exe", "shellexperiencehost.exe", "searchhost.exe",
        "startmenuexperiencehost.exe", "applicationframehost.exe", "systemsettings.exe",
        "mmc.exe", "regedit.exe", "notepad.exe",
        // Chat & Productivity
        "discord.exe", "slack.exe", "spotify.exe", "notion.exe", "teams.exe",
        "word.exe", "excel.exe", "powerpnt.exe", "outlook.exe",
        // Self
        "flowkey.exe", "dynamic-win.exe",
    ];

    EXCLUDED_EXES.iter().any(|&ex| name == ex)
}

pub fn start_fullscreen_and_game_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut was_auto_hidden = false;
        let mut last_game_mode = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(350));

            let settings = crate::commands::settings::load_settings();
            if !settings.auto_hide_on_fullscreen && !settings.game_mode_disable_animations {
                if was_auto_hidden {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                    }
                    was_auto_hidden = false;
                }
                if last_game_mode {
                    last_game_mode = false;
                    use tauri::Emitter;
                    let _ = app.emit("game-mode-animation-state", false);
                }
                continue;
            }

            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, GetClassNameW,
                    GetWindowLongW, GWL_STYLE, WS_CAPTION,
                };
                use windows_sys::Win32::Graphics::Gdi::{
                    MonitorFromWindow, GetMonitorInfoW, MONITORINFO, MONITOR_DEFAULTTONEAREST,
                };
                use windows_sys::Win32::System::Threading::{
                    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
                };
                use windows_sys::Win32::Foundation::{RECT, CloseHandle};

                let fg = unsafe { GetForegroundWindow() };
                if fg.is_null() {
                    continue;
                }

                let mut fg_pid = 0;
                unsafe {
                    GetWindowThreadProcessId(fg, &mut fg_pid);
                }
                let my_pid = std::process::id();
                if fg_pid == my_pid {
                    continue;
                }

                let mut class_buf = [0u16; 256];
                let class_len = unsafe { GetClassNameW(fg, class_buf.as_mut_ptr(), 256) };
                let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
                if class_name == "Progman" || class_name == "WorkerW" || class_name == "Shell_TrayWnd" {
                    if was_auto_hidden {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                        }
                        was_auto_hidden = false;
                    }
                    if last_game_mode {
                        last_game_mode = false;
                        use tauri::Emitter;
                        let _ = app.emit("game-mode-animation-state", false);
                    }
                    continue;
                }

                let mut is_game = false;
                let mut proc_path = String::new();

                let hprocess = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, fg_pid) };
                if !hprocess.is_null() {
                    let mut path_buf = [0u16; 1024];
                    let mut size = 1024u32;
                    if unsafe { QueryFullProcessImageNameW(hprocess, 0, path_buf.as_mut_ptr(), &mut size) } != 0 {
                        proc_path = String::from_utf16_lossy(&path_buf[..size as usize]).to_lowercase();
                        if proc_path.contains("\\steamapps\\common\\")
                            || proc_path.contains("\\epic games\\")
                            || proc_path.contains("\\riot games\\")
                            || proc_path.contains("\\ubisoft\\")
                            || proc_path.contains("\\gog galaxy\\games\\")
                            || proc_path.contains("\\gog games\\")
                            || proc_path.contains("\\xboxgames\\")
                            || proc_path.contains("\\battlenet\\")
                            || proc_path.contains("\\ea games\\")
                            || proc_path.contains("\\origin games\\")
                            || proc_path.contains("\\roblox\\")
                            || proc_path.ends_with("valorant.exe")
                            || proc_path.ends_with("league of legends.exe")
                            || proc_path.ends_with("cs2.exe")
                            || proc_path.ends_with("dota2.exe")
                            || proc_path.ends_with("gta5.exe")
                            || proc_path.ends_with("minecraft.exe")
                            || proc_path.ends_with("javaw.exe")
                            || proc_path.ends_with("fortniteclient-win64-shipping.exe")
                            || proc_path.ends_with("overwatch.exe")
                            || proc_path.ends_with("rocketleague.exe")
                        {
                            is_game = true;
                        }
                    }
                    unsafe { CloseHandle(hprocess); }
                }

                // If foreground is a standard desktop browser or productivity app, never hide or disable animations
                if is_standard_desktop_app(&proc_path) {
                    if was_auto_hidden {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                        }
                        was_auto_hidden = false;
                    }
                    if last_game_mode {
                        last_game_mode = false;
                        use tauri::Emitter;
                        let _ = app.emit("game-mode-animation-state", false);
                    }
                    continue;
                }

                let mut is_fullscreen = false;
                let mut w_rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                if unsafe { GetWindowRect(fg, &mut w_rect) } != 0 {
                    let hmonitor = unsafe { MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST) };
                    if !hmonitor.is_null() {
                        let mut mi = MONITORINFO {
                            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                            rcMonitor: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                            rcWork: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                            dwFlags: 0,
                        };
                        if unsafe { GetMonitorInfoW(hmonitor, &mut mi) } != 0 {
                            let mon = mi.rcMonitor;
                            if w_rect.left <= mon.left && w_rect.top <= mon.top &&
                               w_rect.right >= mon.right && w_rect.bottom >= mon.bottom {
                                let style = unsafe { GetWindowLongW(fg, GWL_STYLE) as u32 };
                                let has_caption = (style & WS_CAPTION) == WS_CAPTION;
                                if !has_caption || is_game {
                                    is_fullscreen = true;
                                }
                            }
                        }
                    }
                }

                if settings.auto_hide_on_fullscreen {
                    let should_hide = is_game || is_fullscreen;
                    if should_hide {
                        if !was_auto_hidden {
                            if let Some(w) = app.get_webview_window("main") {
                                if let Ok(vis) = w.is_visible() {
                                    if vis {
                                        let _ = w.hide();
                                        was_auto_hidden = true;
                                    }
                                }
                            }
                        }
                    } else if was_auto_hidden {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                        }
                        was_auto_hidden = false;
                    }
                } else if was_auto_hidden {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                    }
                    was_auto_hidden = false;
                }

                if settings.game_mode_disable_animations {
                    let should_disable = is_game || is_fullscreen;
                    if should_disable != last_game_mode {
                        last_game_mode = should_disable;
                        use tauri::Emitter;
                        let _ = app.emit("game-mode-animation-state", should_disable);
                    }
                } else if last_game_mode {
                    last_game_mode = false;
                    use tauri::Emitter;
                    let _ = app.emit("game-mode-animation-state", false);
                }
            }
        }
    });
}


