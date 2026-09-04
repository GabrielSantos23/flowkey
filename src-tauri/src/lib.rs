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
use commands::translate::*;
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

    // Optimize WebView2 resource usage on Windows (disable telemetry, translate, reduce background timer throttling overhead)
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-features=msWebOOUI,msPdfOOUI,TranslateUI --disable-background-timer-throttling --disable-renderer-backgrounding",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(HardwareState::new())
        .manage(SpotifyState::new())
        .setup(|app| {
            app.manage(LocalSendState::new(&app.handle()));
            start_clipboard_listener(app.handle().clone());

            let settings = load_settings();
            let _ = commands::settings::bind_all_shortcuts(&app.handle(), &settings);

            // Position and configure overlay window
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

                            let pill_w = 260;
                            let pill_h = 44;
                            let mask_x = (660 - pill_w) / 2;
                            let rect = cairo::RectangleInt::new(mask_x, 0, pill_w, pill_h);
                            let region = cairo::Region::create_rectangle(&rect);
                            gtk_win.input_shape_combine_region(Some(&region));
                        }
                    }

                    #[cfg(target_os = "windows")]
                    {
                        let _ = pos_x;
                        if let Ok(hwnd) = window.hwnd() {
                            unsafe {
                                windows_sys::Win32::UI::WindowsAndMessaging::SetClassLongPtrW(
                                    hwnd.0 as _,
                                    windows_sys::Win32::UI::WindowsAndMessaging::GCLP_HBRBACKGROUND,
                                    0,
                                );
                            }
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
                        let _ = toggle_island(app.clone());
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
            start_mouse_pass_through_watcher(app.handle().clone());
            start_fullscreen_and_game_watcher(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "settings" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
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
            open_spotify,
            get_spotify_queue,
            spotify_next,
            spotify_previous,
            get_spotify_shuffle_state,
            set_spotify_shuffle,
            spotify_login,
            spotify_logout,
            check_spotify_auth,
            get_spotify_access_token,
            spotify_play,
            open_settings_window,
            open_keybindings_window,
            window_minimize,
            window_toggle_maximize,
            window_close,
            get_weather_data,
            get_tray_files,
            add_tray_files,
            save_temp_dropped_file,
            download_url_to_temp,
            save_bytes_to_tray,
            save_base64_to_tray,
            remove_tray_file,
            clear_tray_files,
            open_tray_file,
            show_in_folder,
            copy_tray_file_to_clipboard,
            copy_tray_files_to_clipboard,
            paste_clipboard_to_tray,
            launch_shortcut,
            load_settings,
            save_settings,
            register_spotify_search_hotkey,
            register_all_shortcuts,
            load_custom_theme,
            save_custom_theme,
            get_system_volume,
            set_system_volume,
            get_system_brightness,
            set_system_brightness,
            get_monitors,
            toggle_island,
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
            translate_text,
            get_translation_usage,
            get_supported_languages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DynamicWin application");
}
