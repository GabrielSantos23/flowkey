// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // On Linux, use x11 backend by default so KWin allows absolute top positioning & always-on-top
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11,wayland");
        }
    }

    dynamic_win_lib::run();
}
