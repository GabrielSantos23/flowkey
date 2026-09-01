use base64::Engine;
use image::ImageEncoder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_TRAY_CAPACITY_BYTES: u64 = 1024 * 1024 * 1024; // 1.0 GB Storage Limit

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrayItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub extension: String,
    pub is_dir: bool,
    pub thumbnail: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrayInfo {
    pub items: Vec<TrayItem>,
    pub total_size_bytes: u64,
    pub max_capacity_bytes: u64,
}

fn get_tray_dir() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DynamicWin")
        .join("TrayFiles");
    if !data_dir.exists() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir
}

fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "avif" | "ico"
    )
}

fn generate_thumbnail(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    if !is_image_ext(&ext) {
        return None;
    }

    if let Ok(bytes) = fs::read(path) {
        if let Ok(img) = image::load_from_memory(&bytes) {
            let thumb = img.thumbnail(200, 200);
            let mut png_bytes = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
            if encoder
                .write_image(
                    thumb.to_rgba8().as_raw(),
                    thumb.width(),
                    thumb.height(),
                    image::ExtendedColorType::Rgba8,
                )
                .is_ok()
            {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
                return Some(format!("data:image/png;base64,{}", b64));
            }
        }
    }
    None
}

#[tauri::command]
pub fn get_tray_files() -> TrayInfo {
    let dir = get_tray_dir();
    let mut items = Vec::new();
    let mut total_size_bytes: u64 = 0;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let extension = path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();

            let timestamp = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or_else(|| {
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64
                });

            let thumbnail = generate_thumbnail(&path);
            let id = format!("tray_{}_{}", name, timestamp);

            total_size_bytes += size_bytes;

            items.push(TrayItem {
                id,
                name,
                path: path.to_string_lossy().to_string(),
                size_bytes,
                extension,
                is_dir,
                thumbnail,
                timestamp,
            });
        }
    }

    // Sort newest first
    items.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    TrayInfo {
        items,
        total_size_bytes,
        max_capacity_bytes: MAX_TRAY_CAPACITY_BYTES,
    }
}

#[tauri::command]
pub fn add_tray_files(paths: Vec<String>) -> Result<TrayInfo, String> {
    let dest_dir = get_tray_dir();
    let current_info = get_tray_files();
    let mut total_size = current_info.total_size_bytes;

    for path_str in &paths {
        let src = Path::new(path_str);
        if src.exists() {
            let file_size = src.metadata().map(|m| m.len()).unwrap_or(0);
            if total_size + file_size > MAX_TRAY_CAPACITY_BYTES {
                return Err(format!(
                    "Cannot add '{}': Tray limit of 1.0 GB would be exceeded.",
                    src.file_name().unwrap_or_default().to_string_lossy()
                ));
            }
            total_size += file_size;
        }
    }

    for path_str in paths {
        let src = Path::new(&path_str);
        if src.exists() {
            if let Some(file_name) = src.file_name() {
                let dest = dest_dir.join(file_name);
                if src.is_file() {
                    let _ = fs::copy(src, dest);
                } else if src.is_dir() {
                    let _ = copy_dir_all(src, &dest);
                }
            }
        }
    }

    Ok(get_tray_files())
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn remove_tray_file(path_or_name: String) -> Result<TrayInfo, String> {
    let p = Path::new(&path_or_name);
    let target = if p.is_absolute() {
        p.to_path_buf()
    } else {
        get_tray_dir().join(path_or_name)
    };

    if target.exists() {
        if target.is_dir() {
            fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(&target).map_err(|e| e.to_string())?;
        }
    }
    Ok(get_tray_files())
}

#[tauri::command]
pub fn clear_tray_files() -> Result<TrayInfo, String> {
    let dir = get_tray_dir();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let _ = fs::remove_dir_all(p);
            } else {
                let _ = fs::remove_file(p);
            }
        }
    }
    Ok(get_tray_files())
}

#[tauri::command]
pub fn open_tray_file(path_or_name: String) -> Result<bool, String> {
    let p = Path::new(&path_or_name);
    let target = if p.is_absolute() {
        p.to_path_buf()
    } else {
        get_tray_dir().join(path_or_name)
    };

    open::that(target).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn show_in_folder(path_or_name: String) -> Result<bool, String> {
    let p = Path::new(&path_or_name);
    let target = if p.is_absolute() {
        p.to_path_buf()
    } else {
        get_tray_dir().join(path_or_name)
    };

    #[cfg(target_os = "windows")]
    {
        if target.exists() {
            let _ = std::process::Command::new("explorer")
                .arg(format!("/select,\"{}\"", target.to_string_lossy()))
                .spawn();
            return Ok(true);
        }
    }

    let folder = if target.is_dir() {
        target
    } else {
        target.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
    };

    open::that(folder).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn copy_tray_file_to_clipboard(path_or_name: String) -> Result<bool, String> {
    let p = Path::new(&path_or_name);
    let target = if p.is_absolute() {
        p.to_path_buf()
    } else {
        get_tray_dir().join(path_or_name)
    };

    if !target.exists() {
        return Err("File does not exist".to_string());
    }

    let target_str = target.to_string_lossy().to_string();

    // On Linux KDE/Gnome, set URI format and text
    #[cfg(target_os = "linux")]
    {
        for cmd in &["qdbus6", "qdbus"] {
            let uri = format!("copy\nfile://{}", target_str);
            let _ = std::process::Command::new(cmd)
                .args(["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.setClipboardContents", &uri])
                .status();
        }
    }

    if let Ok(mut cb) = arboard::Clipboard::new() {
        let _ = cb.set_text(&target_str);
    }

    Ok(true)
}

#[tauri::command]
pub async fn paste_clipboard_to_tray() -> Result<TrayInfo, String> {
    if let Ok(mut cb) = arboard::Clipboard::new() {
        if let Ok(img) = cb.get_image() {
            let mut png_bytes = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
            if encoder
                .write_image(
                    &img.bytes,
                    img.width as u32,
                    img.height as u32,
                    image::ExtendedColorType::Rgba8,
                )
                .is_ok()
            {
                let name = format!("pasted_image_{}.png", uuid::Uuid::new_v4());
                return save_bytes_to_tray(name, png_bytes);
            }
        }
        if let Ok(text) = cb.get_text() {
            let t = text.trim();
            if t.starts_with("http://") || t.starts_with("https://") {
                if let Ok(temp_path) = download_url_to_temp(t.to_string()).await {
                    return add_tray_files(vec![temp_path]);
                }
            } else if t.starts_with("file://") {
                let path = t.trim_start_matches("file://").to_string();
                return add_tray_files(vec![path]);
            }
            if !t.is_empty() {
                let name = format!("note_{}.txt", uuid::Uuid::new_v4());
                return save_bytes_to_tray(name, t.as_bytes().to_vec());
            }
        }
    }
    Err("Clipboard is empty or no valid content found".to_string())
}

#[tauri::command]
pub fn save_bytes_to_tray(file_name: String, bytes: Vec<u8>) -> Result<TrayInfo, String> {
    let dest_dir = get_tray_dir();
    let current_info = get_tray_files();
    if current_info.total_size_bytes + (bytes.len() as u64) > MAX_TRAY_CAPACITY_BYTES {
        return Err("Cannot save: Tray limit of 1.0 GB would be exceeded.".to_string());
    }

    let clean_name = if file_name.trim().is_empty() {
        format!("file_{}.bin", uuid::Uuid::new_v4())
    } else {
        file_name.trim().to_string()
    };

    let dest = dest_dir.join(&clean_name);
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(get_tray_files())
}

#[tauri::command]
pub async fn save_temp_dropped_file(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("DynamicWin_Temp");
    if !temp_dir.exists() {
        let _ = tokio::fs::create_dir_all(&temp_dir).await;
    }

    let clean_name = if file_name.trim().is_empty() {
        format!("dropped_file_{}.bin", uuid::Uuid::new_v4())
    } else {
        file_name.trim().to_string()
    };

    let path = temp_dir.join(&clean_name);
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_url_to_temp(url: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("DynamicWin_Temp");
    if !temp_dir.exists() {
        let _ = tokio::fs::create_dir_all(&temp_dir).await;
    }

    if url.starts_with("http://") || url.starts_with("https://") {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let res = client
            .get(&url)
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Download failed with status {}", res.status()));
        }

        let content_type = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let bytes = res.bytes().await.map_err(|e| e.to_string())?;

        let mut ext = "jpg".to_string();
        let mut final_bytes = bytes.to_vec();

        if let Ok(format) = image::guess_format(&bytes) {
            ext = match format {
                image::ImageFormat::Png => "png".to_string(),
                image::ImageFormat::Jpeg => "jpg".to_string(),
                image::ImageFormat::WebP => "webp".to_string(),
                image::ImageFormat::Gif => "gif".to_string(),
                image::ImageFormat::Bmp => "bmp".to_string(),
                _ => "png".to_string(),
            };
        } else if content_type.contains("image/svg") {
            ext = "svg".to_string();
        } else if content_type.contains("text/html") {
            let html_text = String::from_utf8_lossy(&bytes).to_string();
            let mut extracted_img_url = None;
            for line in html_text.lines() {
                if line.contains("og:image") || line.contains("twitter:image") {
                    if let Some(c_idx) = line.find("content=") {
                        let rest = &line[c_idx + 8..];
                        if let Some(quote) = rest.chars().next() {
                            if quote == '"' || quote == '\'' {
                                if let Some(end) = rest[1..].find(quote) {
                                    extracted_img_url = Some(rest[1..=end].to_string());
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if let Some(real_url) = extracted_img_url {
                if let Ok(img_res) = client.get(&real_url).send().await {
                    if img_res.status().is_success() {
                        let img_bytes = img_res.bytes().await.unwrap_or_default();
                        if let Ok(fmt) = image::guess_format(&img_bytes) {
                            ext = match fmt {
                                image::ImageFormat::Png => "png".to_string(),
                                image::ImageFormat::Jpeg => "jpg".to_string(),
                                image::ImageFormat::WebP => "webp".to_string(),
                                image::ImageFormat::Gif => "gif".to_string(),
                                _ => "jpg".to_string(),
                            };
                            final_bytes = img_bytes.to_vec();
                        }
                    }
                }
            }
        }

        let name = format!("web_photo_{}.{}", uuid::Uuid::new_v4(), ext);
        let path = temp_dir.join(name);
        tokio::fs::write(&path, &final_bytes)
            .await
            .map_err(|e| e.to_string())?;

        Ok(path.to_string_lossy().to_string())
    } else {
        Err("Invalid URL scheme".to_string())
    }
}
