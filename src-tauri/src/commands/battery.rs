use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub has_battery: bool,
    pub percentage: u32,
    pub is_charging: bool,
    pub status: String,
}

#[tauri::command]
pub fn get_battery_status() -> BatteryInfo {
    // Linux power supply check
    #[cfg(target_os = "linux")]
    {
        let power_supply_dir = Path::new("/sys/class/power_supply");
        if power_supply_dir.exists() {
            if let Ok(entries) = fs::read_dir(power_supply_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("BAT") {
                        let capacity_path = entry.path().join("capacity");
                        let status_path = entry.path().join("status");

                        let capacity: u32 = fs::read_to_string(capacity_path)
                            .ok()
                            .and_then(|s| s.trim().parse().ok())
                            .unwrap_or(100);

                        let status = fs::read_to_string(status_path)
                            .unwrap_or_else(|_| "Full".to_string())
                            .trim()
                            .to_string();

                        let is_charging = status.eq_ignore_ascii_case("charging");

                        return BatteryInfo {
                            has_battery: true,
                            percentage: capacity.min(100),
                            is_charging,
                            status,
                        };
                    }
                }
            }
        }
    }

    // Windows power status check
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let mut sps = std::mem::zeroed::<windows_sys::Win32::System::Power::SYSTEM_POWER_STATUS>();
            if windows_sys::Win32::System::Power::GetSystemPowerStatus(&mut sps) != 0 {
                let has_battery = sps.BatteryFlag != 128 && sps.BatteryFlag != 255;
                let percentage = if sps.BatteryLifePercent != 255 {
                    (sps.BatteryLifePercent as u32).min(100)
                } else {
                    100
                };
                let is_charging = (sps.BatteryFlag & 8) != 0 || sps.ACLineStatus == 1;
                let status = if is_charging {
                    if percentage >= 100 {
                        "Full".to_string()
                    } else {
                        "Charging".to_string()
                    }
                } else {
                    "Discharging".to_string()
                };

                return BatteryInfo {
                    has_battery,
                    percentage,
                    is_charging,
                    status,
                };
            }
        }
    }

    // Default desktop / plugged-in fallback
    BatteryInfo {
        has_battery: true,
        percentage: 100,
        is_charging: true,
        status: "AC Connected".to_string(),
    }
}
