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
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let data_dir = base.join("FlowKey").join("TrayFiles");
    if !data_dir.exists() {
        let legacy_dir = base.join("DynamicWin").join("TrayFiles");
        if legacy_dir.exists() {
            let _ = fs::create_dir_all(&data_dir);
            if let Ok(entries) = fs::read_dir(&legacy_dir) {
                for entry in entries.flatten() {
                    let dest = data_dir.join(entry.file_name());
                    if !dest.exists() {
                        let _ = fs::copy(entry.path(), dest);
                    }
                }
            }
        } else {
            let _ = fs::create_dir_all(&data_dir);
        }
    }
    data_dir
}

fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "avif" | "ico"
    )
}

fn get_thumbnails_cache_dir() -> PathBuf {
    let dir = get_tray_dir().join(".thumbnails");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn generate_thumbnail(path: &Path, timestamp: u64) -> Option<String> {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    if !is_image_ext(&ext) {
        return None;
    }

    let file_name = path.file_name()?.to_string_lossy();
    let cache_file_name = format!("{}_{}.thumb", file_name, timestamp);
    let cache_path = get_thumbnails_cache_dir().join(cache_file_name);

    if cache_path.exists() {
        if let Ok(cached_b64) = fs::read_to_string(&cache_path) {
            return Some(cached_b64);
        }
    }

    if let Ok(bytes) = fs::read(path) {
        if let Ok(img) = image::load_from_memory(&bytes) {
            let thumb = img.thumbnail(120, 120);
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
                let result = format!("data:image/png;base64,{}", b64);
                let _ = fs::write(&cache_path, &result);
                return Some(result);
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
            if name.starts_with('.') {
                continue;
            }
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

            let thumbnail = generate_thumbnail(&path, timestamp);
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

fn create_dib_from_image(img: &image::DynamicImage) -> Option<Vec<u8>> {
    let rgba = img.to_rgba8();
    let width = rgba.width() as i32;
    let height = rgba.height() as i32;
    let header_size = 40; // sizeof(BITMAPINFOHEADER)
    let image_size = (width * height * 4) as usize;
    let mut dib_bytes = vec![0u8; header_size + image_size];

    let bi_size = 40u32;
    let bi_width = width;
    let bi_height = -height; // Top-down DIB
    let bi_planes = 1u16;
    let bi_bit_count = 32u16;
    let bi_compression = 0u32; // BI_RGB
    let bi_size_image = image_size as u32;

    dib_bytes[0..4].copy_from_slice(&bi_size.to_le_bytes());
    dib_bytes[4..8].copy_from_slice(&bi_width.to_le_bytes());
    dib_bytes[8..12].copy_from_slice(&bi_height.to_le_bytes());
    dib_bytes[12..14].copy_from_slice(&bi_planes.to_le_bytes());
    dib_bytes[14..16].copy_from_slice(&bi_bit_count.to_le_bytes());
    dib_bytes[16..20].copy_from_slice(&bi_compression.to_le_bytes());
    dib_bytes[20..24].copy_from_slice(&bi_size_image.to_le_bytes());

    let raw = rgba.into_raw();
    for i in (0..raw.len()).step_by(4) {
        let r = raw[i];
        let g = raw[i + 1];
        let b = raw[i + 2];
        let a = raw[i + 3];

        let dest_idx = header_size + i;
        dib_bytes[dest_idx] = b;
        dib_bytes[dest_idx + 1] = g;
        dib_bytes[dest_idx + 2] = r;
        dib_bytes[dest_idx + 3] = a;
    }

    Some(dib_bytes)
}

#[tauri::command]
pub fn copy_tray_files_to_clipboard(paths_or_names: Vec<String>) -> Result<bool, String> {
    if paths_or_names.is_empty() {
        return Ok(false);
    }

    let mut valid_targets: Vec<PathBuf> = Vec::new();
    for p_str in &paths_or_names {
        let p = Path::new(p_str);
        let target = if p.is_absolute() {
            p.to_path_buf()
        } else {
            get_tray_dir().join(p_str)
        };
        if target.exists() {
            valid_targets.push(target);
        }
    }

    if valid_targets.is_empty() {
        return Err("No valid files found".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::DataExchange::{
            CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW,
            SetClipboardData,
        };
        use windows_sys::Win32::System::Memory::{
            GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT,
        };
        use windows_sys::Win32::UI::Shell::DROPFILES;
        const CF_DIB: u32 = 8;
        const CF_HDROP: u32 = 15;

        let mut hdrop_wide: Vec<u16> = Vec::new();

        for target in &valid_targets {
            let canonical = target.canonicalize().unwrap_or_else(|_| target.clone());
            let mut path_str = canonical.to_string_lossy().to_string();
            if path_str.starts_with(r"\\?\") {
                path_str = path_str[4..].to_string();
            }
            path_str = path_str.replace('/', "\\");

            let mut w: Vec<u16> = path_str.encode_utf16().collect();
            w.push(0);
            hdrop_wide.extend(w);
        }
        hdrop_wide.push(0); // extra null terminator for DROPFILES list

        let dropfiles_size = std::mem::size_of::<DROPFILES>();
        let hdrop_total_bytes = dropfiles_size + hdrop_wide.len() * 2;

        unsafe {
            let mut opened = false;
            for _ in 0..10 {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(15));
            }

            if opened {
                EmptyClipboard();

                // 1. Set CF_HDROP (Native Windows File Objects for Explorer, Discord, Telegram, WhatsApp)
                let h_drop = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, hdrop_total_bytes);
                if !h_drop.is_null() {
                    let p_mem = GlobalLock(h_drop) as *mut u8;
                    if !p_mem.is_null() {
                        let p_drop = p_mem as *mut DROPFILES;
                        (*p_drop).pFiles = dropfiles_size as u32;
                        (*p_drop).fWide = 1;
                        (*p_drop).fNC = 0;
                        (*p_drop).pt.x = 0;
                        (*p_drop).pt.y = 0;

                        let p_dest = p_mem.add(dropfiles_size) as *mut u16;
                        std::ptr::copy_nonoverlapping(hdrop_wide.as_ptr(), p_dest, hdrop_wide.len());

                        GlobalUnlock(h_drop);
                        SetClipboardData(CF_HDROP as _, h_drop);
                    }
                }

                // 2. Set Preferred DropEffect (DROPEFFECT_COPY = 1) for Windows Explorer & Shell
                let preferred_drop_str: Vec<u16> = "Preferred DropEffect\0".encode_utf16().collect();
                let cf_preferred_dropeffect = RegisterClipboardFormatW(preferred_drop_str.as_ptr());
                if cf_preferred_dropeffect != 0 {
                    let h_effect = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, 4);
                    if !h_effect.is_null() {
                        let p_effect = GlobalLock(h_effect) as *mut u32;
                        if !p_effect.is_null() {
                            *p_effect = 1; // 1 = DROPEFFECT_COPY
                            GlobalUnlock(h_effect);
                            SetClipboardData(cf_preferred_dropeffect, h_effect);
                        }
                    }
                }

                // 3. If single image, also set CF_DIB
                if valid_targets.len() == 1 {
                    let ext = valid_targets[0].extension().unwrap_or_default().to_string_lossy().to_string();
                    if is_image_ext(&ext) {
                        if let Ok(bytes) = fs::read(&valid_targets[0]) {
                            if let Ok(img) = image::load_from_memory(&bytes) {
                                if let Some(dib_data) = create_dib_from_image(&img) {
                                    let h_dib = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, dib_data.len());
                                    if !h_dib.is_null() {
                                        let p_mem = GlobalLock(h_dib) as *mut u8;
                                        if !p_mem.is_null() {
                                            std::ptr::copy_nonoverlapping(dib_data.as_ptr(), p_mem, dib_data.len());
                                            GlobalUnlock(h_dib);
                                            SetClipboardData(CF_DIB as _, h_dib);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                CloseClipboard();
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let uris: Vec<String> = valid_targets.iter().map(|t| format!("file://{}", t.to_string_lossy())).collect();
        let payload = format!("copy\n{}", uris.join("\n"));
        for cmd in &["qdbus6", "qdbus"] {
            let _ = std::process::Command::new(cmd)
                .args(["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.setClipboardContents", &payload])
                .status();
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        if let Ok(mut cb) = arboard::Clipboard::new() {
            let lines: Vec<String> = valid_targets.iter().map(|t| t.to_string_lossy().to_string()).collect();
            let _ = cb.set_text(lines.join("\n"));
        }
    }

    Ok(true)
}

#[tauri::command]
pub fn copy_tray_file_to_clipboard(path_or_name: String) -> Result<bool, String> {
    copy_tray_files_to_clipboard(vec![path_or_name])
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

fn sanitize_filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | '?' | '%' | '*' | ':' | '|' | '"' | '<' | '>' => '_',
            c => c,
        })
        .collect();
    let clean = clean.trim().to_string();
    if clean.is_empty() {
        format!("file_{}.bin", uuid::Uuid::new_v4())
    } else {
        clean
    }
}

#[tauri::command]
pub fn save_bytes_to_tray(file_name: String, bytes: Vec<u8>) -> Result<TrayInfo, String> {
    let dest_dir = get_tray_dir();
    let current_info = get_tray_files();
    if current_info.total_size_bytes + (bytes.len() as u64) > MAX_TRAY_CAPACITY_BYTES {
        return Err("Cannot save: Tray limit of 1.0 GB would be exceeded.".to_string());
    }

    let clean_name = sanitize_filename(&file_name);
    let dest = dest_dir.join(&clean_name);
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(get_tray_files())
}

#[tauri::command]
pub fn save_base64_to_tray(file_name: String, base64_data: String) -> Result<TrayInfo, String> {
    let clean_b64 = if let Some(idx) = base64_data.find(";base64,") {
        &base64_data[idx + 8..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_b64.trim())
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    save_bytes_to_tray(file_name, bytes)
}

#[tauri::command]
pub async fn save_temp_dropped_file(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("FlowKey_Temp");
    if !temp_dir.exists() {
        let _ = tokio::fs::create_dir_all(&temp_dir).await;
    }

    let clean_name = sanitize_filename(&file_name);
    let path = temp_dir.join(&clean_name);
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_url_to_temp(url: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("FlowKey_Temp");
    if !temp_dir.exists() {
        let _ = tokio::fs::create_dir_all(&temp_dir).await;
    }

    if url.starts_with("data:image/") {
        let clean_b64 = if let Some(idx) = url.find(";base64,") {
            &url[idx + 8..]
        } else {
            &url
        };
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_b64.trim())
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        let ext = if url.contains("image/png") {
            "png"
        } else if url.contains("image/webp") {
            "webp"
        } else if url.contains("image/gif") {
            "gif"
        } else {
            "jpg"
        };
        let name = format!("web_photo_{}.{}", uuid::Uuid::new_v4(), ext);
        let path = temp_dir.join(name);
        tokio::fs::write(&path, &bytes).await.map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }

    if url.starts_with("http://") || url.starts_with("https://") {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let res = client
            .get(&url)
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
            .header("Sec-Fetch-Dest", "image")
            .header("Sec-Fetch-Mode", "no-cors")
            .header("Sec-Fetch-Site", "cross-site")
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
