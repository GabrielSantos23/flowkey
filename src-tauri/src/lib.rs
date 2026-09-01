mod commands;
pub mod localsend;

use commands::battery::*;
use commands::hardware::*;
use commands::localsend_api::*;
use commands::media::*;
use commands::settings::*;
use commands::shortcuts::*;
use commands::spotify_api::*;
use commands::system::*;
use commands::tray_files::*;
use commands::weather::*;
use commands::clipboard::*;
use localsend::LocalSendState;

#[cfg(target_os = "linux")]
use gtk::prelude::*;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install rustls ring crypto provider globally. Required because both axum-server (aws-lc-rs)
    // and reqwest (ring) pull in rustls with different providers. We must install one explicitly.
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_drag::init())
        .manage(HardwareState::new())
        .manage(SpotifyState::new())
        .setup(|app| {
            app.manage(LocalSendState::new(&app.handle()));
            start_clipboard_listener(app.handle().clone());

            // Position and configure overlay window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
                let _ = window.set_skip_taskbar(true);
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(false);

                let mut pos_x = 0;
                let pos_y = 0;

                if let Ok(Some(monitor)) = window.current_monitor() {
                    let monitor_size = monitor.size();
                    let scale = monitor.scale_factor();
                    let win_w = (600.0 * scale) as u32;
                    let win_h = (420.0 * scale) as u32;
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

                        let pill_w = 220;
                        let pill_h = 36;
                        let mask_x = (600 - pill_w) / 2;
                        let rect = cairo::RectangleInt::new(mask_x, 0, pill_w, pill_h);
                        let region = cairo::Region::create_rectangle(&rect);
                        gtk_win.input_shape_combine_region(Some(&region));
                    }
                }

                #[cfg(target_os = "windows")]
                {
                    if let Ok(hwnd) = window.hwnd() {
                        unsafe {
                            let pill_w = 220;
                            let pill_h = 36;
                            let mask_x = (600 - pill_w) / 2;
                            let rgn = windows_sys::Win32::Graphics::Gdi::CreateRectRgn(
                                mask_x,
                                0,
                                mask_x + pill_w,
                                pill_h,
                            );
                            windows_sys::Win32::UI::WindowsAndMessaging::SetWindowRgn(hwnd.0 as _, rgn, 1);
                        }
                    }
                }
            }

            // Setup Tray Menu
            let toggle_i = MenuItem::with_id(app, "toggle", "Toggle Island", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Exit DynamicWin", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_i, &settings_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("DynamicWin Overlay")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(visible) = window.is_visible() {
                                if visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                    "settings" => {
                        let _ = open_settings_window(app.clone());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            start_audio_volume_watcher(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(drag_event) = event {
                match drag_event {
                    tauri::DragDropEvent::Enter { paths, position } => {
                        let path_strs: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
                        println!("[Tauri DragDrop] Enter with {} paths: {:?}", path_strs.len(), path_strs);
                        let _ = window.emit("tauri://drag-enter", serde_json::json!({
                            "paths": path_strs,
                            "position": { "x": position.x, "y": position.y }
                        }));
                    }
                    tauri::DragDropEvent::Over { position } => {
                        let _ = window.emit("tauri://drag-over", serde_json::json!({
                            "position": { "x": position.x, "y": position.y }
                        }));
                    }
                    tauri::DragDropEvent::Drop { paths, position } => {
                        let path_strs: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
                        println!("[Tauri DragDrop] Drop with {} paths: {:?}", path_strs.len(), path_strs);
                        let _ = window.emit("tauri://drag-drop", serde_json::json!({
                            "paths": path_strs,
                            "position": { "x": position.x, "y": position.y }
                        }));
                    }
                    tauri::DragDropEvent::Leave => {
                        let _ = window.emit("tauri://drag-leave", ());
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_usage,
            get_battery_status,
            media_play_pause,
            media_next,
            media_prev,
            media_seek,
            get_media_info,
            get_spotify_queue,
            set_spotify_shuffle,
            spotify_login,
            spotify_logout,
            check_spotify_auth,
            open_settings_window,
            get_weather_data,
            get_tray_files,
            add_tray_files,
            save_temp_dropped_file,
            download_url_to_temp,
            save_bytes_to_tray,
            remove_tray_file,
            clear_tray_files,
            open_tray_file,
            show_in_folder,
            copy_tray_file_to_clipboard,
            paste_clipboard_to_tray,
            launch_shortcut,
            load_settings,
            save_settings,
            load_custom_theme,
            save_custom_theme,
            get_system_volume,
            set_system_volume,
            get_system_brightness,
            set_system_brightness,
            get_monitors,
            toggle_island_hidden,
            position_window_at_top,
            resize_island_window,
            update_input_mask,
            clear_input_mask,
            localsend_start_discovery,
            localsend_stop_discovery,
            localsend_get_devices,
            localsend_get_my_device,
            localsend_is_discovering,
            localsend_send_files,
            localsend_send_text,
            localsend_cancel_transfer,
            localsend_accept_transfer,
            localsend_reject_transfer,
            localsend_probe_ip,
            load_clipboard_history,
            save_clipboard_history,
            toggle_pin_clipboard_item,
            delete_clipboard_item,
            clear_clipboard_history,
            get_current_clipboard_item,
            fetch_url_preview,
            set_clipboard_text,
            set_clipboard_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DynamicWin application");
}
