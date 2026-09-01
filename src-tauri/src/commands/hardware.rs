use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

pub struct HardwareState {
    pub sys: Mutex<System>,
}

impl HardwareState {
    pub fn new() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        Self {
            sys: Mutex::new(sys),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub cpu_usage: f32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_usage_percent: f32,
    pub usage_string: String,
}

#[tauri::command]
pub fn get_hardware_usage(state: tauri::State<HardwareState>) -> HardwareInfo {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let total_mem = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let used_mem = sys.used_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let ram_percent = if total_mem > 0.0 {
        ((used_mem / total_mem) * 100.0) as f32
    } else {
        0.0
    };

    let cpu_rounded = (cpu_usage * 10.0).round() / 10.0;
    let ram_used_rounded = (used_mem * 10.0).round() / 10.0;
    let ram_total_rounded = (total_mem * 10.0).round() / 10.0;

    let usage_string = format!(
        "CPU: {:.1}%   RAM: {:.1}GB / {:.0}GB",
        cpu_rounded, ram_used_rounded, ram_total_rounded
    );

    HardwareInfo {
        cpu_usage: cpu_rounded,
        ram_used_gb: ram_used_rounded as f32,
        ram_total_gb: ram_total_rounded as f32,
        ram_usage_percent: ram_percent,
        usage_string,
    }
}
