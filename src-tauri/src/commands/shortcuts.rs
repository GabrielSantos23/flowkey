use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct ShortcutItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
}

#[tauri::command]
pub fn launch_shortcut(path: String) -> Result<bool, String> {
    if path.starts_with("http://") || path.starts_with("https://") {
        open::that(&path).map_err(|e| e.to_string())?;
        return Ok(true);
    }

    open::that(&path).map_err(|e| e.to_string())?;
    Ok(true)
}
