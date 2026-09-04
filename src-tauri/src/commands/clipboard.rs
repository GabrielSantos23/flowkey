use base64::Engine;
use image::ImageEncoder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex as StdMutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

static CLIPBOARD_HISTORY: StdMutex<Option<Vec<ClipboardItemPayload>>> = StdMutex::new(None);
const MAX_HISTORY_ITEMS: usize = 100;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardColorFormats {
    pub hex: String,
    pub rgb: String,
    pub hsl: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardMetadata {
    pub app_name: Option<String>,
    pub app_icon: Option<String>,
    pub file_size: Option<String>,
    pub dimensions: Option<String>,
    pub color_formats: Option<ClipboardColorFormats>,
    pub line_count: Option<usize>,
    pub word_count: Option<usize>,
    pub char_count: Option<usize>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItemPayload {
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: String, // "text" | "image" | "link" | "color" | "email" | "file" | "folder" | "code"
    pub title: String,
    pub content: String,
    pub preview_url: Option<String>,
    pub description: Option<String>,
    pub metadata: Option<ClipboardMetadata>,
    pub is_pinned: bool,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UrlPreviewData {
    pub title: String,
    pub description: String,
    pub preview_url: Option<String>,
    pub app_name: String,
}

fn get_clipboard_file_path() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let data_dir = base.join("FlowKey");
    if !data_dir.exists() {
        let legacy_dir = base.join("DynamicWin");
        if legacy_dir.exists() {
            let _ = fs::create_dir_all(&data_dir);
            let legacy_file = legacy_dir.join("clipboard_history.json");
            let target_file = data_dir.join("clipboard_history.json");
            if legacy_file.exists() && !target_file.exists() {
                let _ = fs::copy(&legacy_file, &target_file);
            }
        } else {
            let _ = fs::create_dir_all(&data_dir);
        }
    }
    data_dir.join("clipboard_history.json")
}

fn load_history_from_disk() -> Vec<ClipboardItemPayload> {
    let file = get_clipboard_file_path();
    if file.exists() {
        if let Ok(contents) = fs::read_to_string(file) {
            if let Ok(items) = serde_json::from_str::<Vec<ClipboardItemPayload>>(&contents) {
                if !items.is_empty() {
                    return items;
                }
            }
        }
    }
    // Seed from KDE Plasma 6 Klipper history if available
    seed_from_kde_history()
}

fn save_history_to_disk(items: &[ClipboardItemPayload]) {
    let file = get_clipboard_file_path();
    if let Ok(json) = serde_json::to_string_pretty(items) {
        let _ = fs::write(file, json);
    }
}

fn add_item_to_history(item: ClipboardItemPayload) -> Vec<ClipboardItemPayload> {
    let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_history_from_disk());
    }

    let history = lock.as_mut().unwrap();
    let existing_idx = history.iter().position(|i| i.content == item.content);
    if let Some(idx) = existing_idx {
        let mut existing = history.remove(idx);
        existing.timestamp = item.timestamp;
        if item.preview_url.is_some() {
            existing.preview_url = item.preview_url;
        }
        if item.description.is_some() {
            existing.description = item.description;
        }
        if item.title.len() > existing.title.len() {
            existing.title = item.title;
        }
        if item.metadata.is_some() {
            existing.metadata = item.metadata;
        }
        history.insert(0, existing);
    } else {
        history.insert(0, item);
    }

    if history.len() > MAX_HISTORY_ITEMS {
        let mut unpinned_count = 0;
        history.retain(|i| {
            if i.is_pinned {
                true
            } else {
                unpinned_count += 1;
                unpinned_count <= MAX_HISTORY_ITEMS
            }
        });
    }

    save_history_to_disk(history);
    history.clone()
}

#[tauri::command]
pub async fn load_clipboard_history() -> Vec<ClipboardItemPayload> {
    tokio::task::spawn_blocking(|| {
        let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
        if lock.is_none() {
            *lock = Some(load_history_from_disk());
        }
        lock.as_ref().unwrap().clone()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub fn save_clipboard_history(items: Vec<ClipboardItemPayload>) -> Result<bool, String> {
    save_history_to_disk(&items);
    let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
    *lock = Some(items);
    Ok(true)
}

#[tauri::command]
pub fn toggle_pin_clipboard_item(id: String) -> Vec<ClipboardItemPayload> {
    let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_history_from_disk());
    }
    let history = lock.as_mut().unwrap();
    if let Some(item) = history.iter_mut().find(|i| i.id == id) {
        item.is_pinned = !item.is_pinned;
    }
    save_history_to_disk(history);
    history.clone()
}

#[tauri::command]
pub fn delete_clipboard_item(id: String) -> Vec<ClipboardItemPayload> {
    let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_history_from_disk());
    }
    let history = lock.as_mut().unwrap();
    history.retain(|i| i.id != id);
    save_history_to_disk(history);
    history.clone()
}

#[tauri::command]
pub fn clear_clipboard_history() -> Vec<ClipboardItemPayload> {
    let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
    let history = lock.get_or_insert_with(load_history_from_disk);
    history.retain(|i| i.is_pinned);
    save_history_to_disk(history);
    history.clone()
}

#[tauri::command]
pub fn get_current_clipboard_item() -> Option<ClipboardItemPayload> {
    // 1. Try Image first from arboard
    if let Ok(mut cb) = arboard::Clipboard::new() {
        if let Ok(image_data) = cb.get_image() {
            if !image_data.bytes.is_empty() {
                if let Some(img_item) = parse_image_item(image_data) {
                    return Some(img_item);
                }
            }
        }
    }

    // 2. Try KDE Klipper / arboard text
    if let Some(text) = get_kde_clipboard_text().or_else(|| {
        arboard::Clipboard::new().ok().and_then(|mut cb| cb.get_text().ok())
    }) {
        if !text.trim().is_empty() {
            return Some(parse_text_item(text));
        }
    }

    None
}

#[tauri::command]
pub async fn fetch_url_preview(url: String) -> Result<UrlPreviewData, String> {
    if let Some((title, description, preview_url, app_name)) = fetch_url_metadata(url).await {
        Ok(UrlPreviewData {
            title,
            description,
            preview_url,
            app_name,
        })
    } else {
        Err("Failed to fetch preview".to_string())
    }
}

#[cfg(target_os = "linux")]
fn get_kde_clipboard_text() -> Option<String> {
    for cmd in &["qdbus6", "qdbus"] {
        if let Ok(output) = std::process::Command::new(cmd)
            .args(["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.getClipboardContents"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "linux"))]
fn get_kde_clipboard_text() -> Option<String> {
    None
}

#[cfg(target_os = "linux")]
fn set_kde_clipboard_text(text: &str) -> bool {
    for cmd in &["qdbus6", "qdbus"] {
        if let Ok(status) = std::process::Command::new(cmd)
            .args(["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.setClipboardContents", text])
            .status()
        {
            if status.success() {
                return true;
            }
        }
    }
    false
}

#[cfg(not(target_os = "linux"))]
fn set_kde_clipboard_text(_text: &str) -> bool {
    false
}

#[cfg(target_os = "linux")]
fn seed_from_kde_history() -> Vec<ClipboardItemPayload> {
    let mut items = Vec::new();
    for cmd in &["qdbus6", "qdbus"] {
        if let Ok(output) = std::process::Command::new(cmd)
            .args(["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.getClipboardHistoryMenu"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && !items.iter().any(|i: &ClipboardItemPayload| i.content == trimmed) {
                        items.push(parse_text_item(trimmed.to_string()));
                    }
                }
                if !items.is_empty() {
                    break;
                }
            }
        }
    }
    items
}

#[cfg(not(target_os = "linux"))]
fn seed_from_kde_history() -> Vec<ClipboardItemPayload> {
    Vec::new()
}

#[tauri::command]
pub fn set_clipboard_text(text: String) -> Result<bool, String> {
    let _ = set_kde_clipboard_text(&text);
    if let Ok(mut clipboard) = arboard::Clipboard::new() {
        let _ = clipboard.set_text(text);
    }
    Ok(true)
}

#[tauri::command]
pub fn set_clipboard_image(data_base64: String) -> Result<bool, String> {
    let clean_b64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_b64)
        .map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?.to_rgba8();
    let (width, height) = img.dimensions();
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard
        .set_image(arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: img.into_raw().into(),
        })
        .map_err(|e| e.to_string())?;
    Ok(true)
}

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn start_clipboard_listener(app: AppHandle) {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    // Initialize in-memory history on start
    {
        let mut lock = CLIPBOARD_HISTORY.lock().unwrap();
        if lock.is_none() {
            *lock = Some(load_history_from_disk());
        }
    }

    std::thread::spawn(move || {
        let mut last_text = String::new();
        let mut last_img_hash: u64 = 0;
        let mut clipboard_inst: Option<arboard::Clipboard> = arboard::Clipboard::new().ok();

        if let Some(ref mut cb) = clipboard_inst {
            if let Ok(t) = cb.get_text() {
                last_text = t;
            }
        }
        if last_text.is_empty() {
            if let Some(kde_t) = get_kde_clipboard_text() {
                last_text = kde_t;
            }
        }

        loop {
            std::thread::sleep(Duration::from_millis(500));

            if clipboard_inst.is_none() {
                clipboard_inst = arboard::Clipboard::new().ok();
            }

            // 1. Check for Image Bitmaps
            let mut detected_image = false;
            if let Some(ref mut cb) = clipboard_inst {
                if let Ok(image_data) = cb.get_image() {
                    let hash = calculate_img_hash(&image_data.bytes);
                    if hash != last_img_hash && !image_data.bytes.is_empty() {
                        last_img_hash = hash;
                        detected_image = true;
                        if let Some(payload) = parse_image_item(image_data) {
                            let history = add_item_to_history(payload.clone());
                            let _ = app.emit("clipboard-history-updated", &history);
                            let _ = app.emit("clipboard-item-captured", &payload);
                        }
                    }
                }
            }

            // 2. If no new image bitmap, check for Text / Files / Links / Colors
            if !detected_image {
                let text_opt = get_kde_clipboard_text().or_else(|| {
                    if let Some(ref mut cb) = clipboard_inst {
                        cb.get_text().ok()
                    } else {
                        None
                    }
                });

                if let Some(text) = text_opt {
                    if !text.is_empty() && text != last_text {
                        last_text = text.clone();
                        let payload = parse_text_item(text);
                        let history = add_item_to_history(payload.clone());
                        let _ = app.emit("clipboard-history-updated", &history);
                        let _ = app.emit("clipboard-item-captured", &payload);

                        // If link, fetch rich preview in background
                        if payload.item_type == "link" {
                            let app_clone = app.clone();
                            let mut item_clone = payload.clone();
                            let url_str = item_clone.content.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Some((title, desc, img, site)) = fetch_url_metadata(url_str).await {
                                    item_clone.title = title;
                                    item_clone.description = Some(desc);
                                    item_clone.preview_url = img;
                                    item_clone.metadata = Some(ClipboardMetadata {
                                        app_name: Some(site.clone()),
                                        app_icon: Some(site.to_lowercase()),
                                        file_size: None,
                                        dimensions: None,
                                        color_formats: None,
                                        line_count: None,
                                        word_count: None,
                                        char_count: None,
                                        language: None,
                                    });
                                    let hist = add_item_to_history(item_clone.clone());
                                    let _ = app_clone.emit("clipboard-history-updated", &hist);
                                    let _ = app_clone.emit("clipboard-item-captured", &item_clone);
                                }
                            });
                        }
                    }
                }
            }
        }
    });
}

fn calculate_img_hash(bytes: &[u8]) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;
    let mut s = DefaultHasher::new();
    let step = (bytes.len() / 256).max(1);
    for chunk in bytes.chunks(step) {
        s.write(chunk);
    }
    s.finish()
}

fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "0 B".to_string();
    }
    let k = 1024.0;
    let sizes = ["B", "KB", "MB", "GB"];
    let i = (bytes as f64).log(k).floor() as usize;
    let i = i.min(sizes.len() - 1);
    let val = (bytes as f64) / k.powi(i as i32);
    format!("{:.1} {}", val, sizes[i])
}

fn parse_hex_to_rgb(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    if clean.len() == 3 {
        let r = u8::from_str_radix(&clean[0..1].repeat(2), 16).unwrap_or(0);
        let g = u8::from_str_radix(&clean[1..2].repeat(2), 16).unwrap_or(0);
        let b = u8::from_str_radix(&clean[2..3].repeat(2), 16).unwrap_or(0);
        return format!("rgb({}, {}, {})", r, g, b);
    } else if clean.len() >= 6 {
        let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0);
        return format!("rgb({}, {}, {})", r, g, b);
    }
    "rgb(0, 0, 0)".to_string()
}

fn parse_hex_to_hsl(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    let (r, g, b) = if clean.len() == 3 {
        let r = u8::from_str_radix(&clean[0..1].repeat(2), 16).unwrap_or(0) as f64 / 255.0;
        let g = u8::from_str_radix(&clean[1..2].repeat(2), 16).unwrap_or(0) as f64 / 255.0;
        let b = u8::from_str_radix(&clean[2..3].repeat(2), 16).unwrap_or(0) as f64 / 255.0;
        (r, g, b)
    } else if clean.len() >= 6 {
        let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0) as f64 / 255.0;
        let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0) as f64 / 255.0;
        let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0) as f64 / 255.0;
        (r, g, b)
    } else {
        (0.0, 0.0, 0.0)
    };

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let mut h = 0.0;
    let mut s = 0.0;
    let l = (max + min) / 2.0;

    if max != min {
        let d = max - min;
        s = if l > 0.5 {
            d / (2.0 - max - min)
        } else {
            d / (max + min)
        };
        if max == r {
            h = (g - b) / d + (if g < b { 6.0 } else { 0.0 });
        } else if max == g {
            h = (b - r) / d + 2.0;
        } else {
            h = (r - g) / d + 4.0;
        }
        h /= 6.0;
    }

    format!("hsl({:.0}, {:.0}%, {:.0}%)", h * 360.0, s * 100.0, l * 100.0)
}

fn detect_source_app_name(url_opt: Option<&str>) -> String {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("sh")
            .arg("-c")
            .arg("xdotool getactivewindow getwindowpid 2>/dev/null | xargs -I {} cat /proc/{}/comm 2>/dev/null")
            .output()
        {
            let comm = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !comm.is_empty() {
                return match comm.to_lowercase().as_str() {
                    "chrome" | "google-chrome" => "Google Chrome".to_string(),
                    "firefox" => "Firefox".to_string(),
                    "brave" | "brave-browser" => "Brave".to_string(),
                    "code" | "vscode" => "VS Code".to_string(),
                    "discord" => "Discord".to_string(),
                    "nautilus" => "Files".to_string(),
                    "dolphin" => "Dolphin".to_string(),
                    "thunderbird" => "Mail".to_string(),
                    "spotify" => "Spotify".to_string(),
                    _ => {
                        let mut chars = comm.chars();
                        match chars.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                        }
                    }
                };
            }
        }
    }

    if let Some(url) = url_opt {
        if let Ok(parsed) = reqwest::Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                let domain = host.trim_start_matches("www.");
                if domain.contains("github.com") {
                    return "GitHub".to_string();
                } else if domain.contains("openai.com") {
                    return "OpenAI".to_string();
                } else if domain.contains("youtube.com") || domain.contains("youtu.be") {
                    return "YouTube".to_string();
                } else if domain.contains("figma.com") {
                    return "Figma".to_string();
                } else if domain.contains("twitter.com") || domain.contains("x.com") {
                    return "X".to_string();
                } else if domain.contains("reddit.com") {
                    return "Reddit".to_string();
                }
                return domain.to_string();
            }
        }
    }

    "Chrome".to_string()
}

async fn fetch_url_metadata(url: String) -> Option<(String, String, Option<String>, String)> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .ok()?;

    let resp = client.get(&url).send().await.ok()?;
    let html = resp.text().await.ok()?;

    let mut title = None;
    let mut description = None;
    let mut image_url = None;
    let mut site_name = None;

    for line in html.lines() {
        if title.is_none() {
            if let Some(og_t) = extract_meta_content(line, "og:title") {
                title = Some(og_t);
            } else if line.contains("<title>") && line.contains("</title>") {
                if let Some(start) = line.find("<title>") {
                    if let Some(end) = line[start + 7..].find("</title>") {
                        title = Some(line[start + 7..start + 7 + end].trim().to_string());
                    }
                }
            }
        }

        if description.is_none() {
            if let Some(og_d) = extract_meta_content(line, "og:description") {
                description = Some(og_d);
            } else if let Some(meta_d) = extract_meta_name_content(line, "description") {
                description = Some(meta_d);
            }
        }

        if image_url.is_none() {
            if let Some(og_img) = extract_meta_content(line, "og:image") {
                image_url = Some(og_img);
            } else if let Some(tw_img) = extract_meta_name_content(line, "twitter:image") {
                image_url = Some(tw_img);
            }
        }

        if site_name.is_none() {
            if let Some(og_s) = extract_meta_content(line, "og:site_name") {
                site_name = Some(og_s);
            }
        }

        if title.is_some() && description.is_some() && image_url.is_some() {
            break;
        }
    }

    let final_title = title.unwrap_or_else(|| url.clone());
    let final_desc = description.unwrap_or_default();
    let final_site = site_name.unwrap_or_else(|| detect_source_app_name(Some(&url)));

    Some((final_title, final_desc, image_url, final_site))
}

fn extract_meta_content(line: &str, property: &str) -> Option<String> {
    if line.contains(&format!("property=\"{}\"", property))
        || line.contains(&format!("property='{}'", property))
    {
        if let Some(content_idx) = line.find("content=") {
            let rest = &line[content_idx + 8..];
            let quote = rest.chars().next()?;
            if quote == '"' || quote == '\'' {
                let inner = &rest[1..];
                if let Some(end_idx) = inner.find(quote) {
                    return Some(inner[..end_idx].to_string());
                }
            }
        }
    }
    None
}

fn extract_meta_name_content(line: &str, name: &str) -> Option<String> {
    if line.contains(&format!("name=\"{}\"", name))
        || line.contains(&format!("name='{}'", name))
    {
        if let Some(content_idx) = line.find("content=") {
            let rest = &line[content_idx + 8..];
            let quote = rest.chars().next()?;
            if quote == '"' || quote == '\'' {
                let inner = &rest[1..];
                if let Some(end_idx) = inner.find(quote) {
                    return Some(inner[..end_idx].to_string());
                }
            }
        }
    }
    None
}

// Clean and extract valid local paths from Dolphin/KDE/Nautilus clipboard
fn extract_clean_file_paths(text: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for raw_line in text.lines() {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() || trimmed == "copy" || trimmed == "cut" {
            continue;
        }

        let clean = if let Some(stripped) = trimmed.strip_prefix("file://") {
            urlencoding::decode(stripped).unwrap_or_else(|_| stripped.into()).to_string()
        } else {
            trimmed.to_string()
        };

        let path = PathBuf::from(&clean);
        if path.exists() {
            paths.push(path);
        }
    }
    paths
}

fn is_image_extension(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "avif" | "ico"
    )
}

fn read_image_preview_from_file(path: &Path) -> Option<(String, Option<String>, Option<String>)> {
    let bytes = fs::read(path).ok()?;
    let file_size = Some(format_size(bytes.len() as u64));

    if let Ok(img) = image::load_from_memory(&bytes) {
        let (w, h) = (img.width(), img.height());
        let dimensions = Some(format!("{} × {}", w, h));

        let thumb = img.thumbnail(600, 600);
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
            let data_url = format!("data:image/png;base64,{}", b64);
            return Some((data_url, dimensions, file_size));
        }
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let data_url = format!("data:{};base64,{}", mime, b64);
    Some((data_url, None, file_size))
}

fn parse_text_item(text: String) -> ClipboardItemPayload {
    let trimmed = text.trim();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let id = format!("clip_{}", uuid::Uuid::new_v4());
    let app_name = detect_source_app_name(None);

    // A. Check for Dolphin / KDE / System copied files or folders
    let file_paths = extract_clean_file_paths(&text);
    if !file_paths.is_empty() {
        if file_paths.len() == 1 {
            let path = &file_paths[0];
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string());
            let path_str = path.to_string_lossy().to_string();

            if path.is_dir() {
                return ClipboardItemPayload {
                    id,
                    item_type: "folder".to_string(),
                    title: name,
                    content: path_str,
                    preview_url: None,
                    description: None,
                    metadata: Some(ClipboardMetadata {
                        app_name: Some("Dolphin".to_string()),
                        app_icon: Some("finder".to_string()),
                        file_size: None,
                        dimensions: None,
                        color_formats: None,
                        line_count: None,
                        word_count: None,
                        char_count: None,
                        language: None,
                    }),
                    is_pinned: false,
                    timestamp,
                };
            }

            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();

            // Single Image File
            if is_image_extension(&ext) {
                if let Some((preview_data_url, dimensions, file_size)) = read_image_preview_from_file(path) {
                    return ClipboardItemPayload {
                        id,
                        item_type: "image".to_string(),
                        title: name,
                        content: path_str,
                        preview_url: Some(preview_data_url),
                        description: None,
                        metadata: Some(ClipboardMetadata {
                            app_name: Some("Dolphin".to_string()),
                            app_icon: Some("finder".to_string()),
                            file_size,
                            dimensions,
                            color_formats: None,
                            line_count: None,
                            word_count: None,
                            char_count: None,
                            language: None,
                        }),
                        is_pinned: false,
                        timestamp,
                    };
                }
            }

            // Single Non-Image File (PDF, DOCX, ZIP, etc.)
            let file_size = if let Ok(meta) = path.metadata() {
                Some(format_size(meta.len()))
            } else {
                None
            };

            return ClipboardItemPayload {
                id,
                item_type: "file".to_string(),
                title: name,
                content: path_str,
                preview_url: None,
                description: None,
                metadata: Some(ClipboardMetadata {
                    app_name: Some("Dolphin".to_string()),
                    app_icon: Some("finder".to_string()),
                    file_size,
                    dimensions: None,
                    color_formats: None,
                    line_count: None,
                    word_count: None,
                    char_count: None,
                    language: None,
                }),
                is_pinned: false,
                timestamp,
            };
        } else {
            // Multiple Files Copied
            let first_name = file_paths[0]
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let title = format!("{} files: {}, ...", file_paths.len(), first_name);
            let combined_paths = file_paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join("\n");

            return ClipboardItemPayload {
                id,
                item_type: "file".to_string(),
                title,
                content: combined_paths,
                preview_url: None,
                description: None,
                metadata: Some(ClipboardMetadata {
                    app_name: Some("Dolphin".to_string()),
                    app_icon: Some("finder".to_string()),
                    file_size: Some(format!("{} items", file_paths.len())),
                    dimensions: None,
                    color_formats: None,
                    line_count: Some(file_paths.len()),
                    word_count: None,
                    char_count: None,
                    language: None,
                }),
                is_pinned: false,
                timestamp,
            };
        }
    }

    // B. Check for Hex Color (#fff, #ffffff, #ffffff80)
    let is_hex = trimmed.starts_with('#')
        && (trimmed.len() == 4 || trimmed.len() == 7 || trimmed.len() == 9)
        && trimmed[1..].chars().all(|c| c.is_ascii_hexdigit());

    if is_hex {
        let rgb_str = parse_hex_to_rgb(trimmed);
        let hsl_str = parse_hex_to_hsl(trimmed);
        return ClipboardItemPayload {
            id,
            item_type: "color".to_string(),
            title: trimmed.to_string(),
            content: trimmed.to_string(),
            preview_url: None,
            description: None,
            metadata: Some(ClipboardMetadata {
                app_name: Some(app_name),
                app_icon: None,
                file_size: None,
                dimensions: None,
                color_formats: Some(ClipboardColorFormats {
                    hex: trimmed.to_string(),
                    rgb: rgb_str,
                    hsl: hsl_str,
                }),
                line_count: None,
                word_count: None,
                char_count: None,
                language: None,
            }),
            is_pinned: false,
            timestamp,
        };
    }

    // C. Check for Email
    if trimmed.contains('@')
        && trimmed.contains('.')
        && !trimmed.contains('\n')
        && !trimmed.contains(' ')
        && trimmed.split('@').count() == 2
    {
        return ClipboardItemPayload {
            id,
            item_type: "email".to_string(),
            title: trimmed.to_string(),
            content: trimmed.to_string(),
            preview_url: None,
            description: None,
            metadata: Some(ClipboardMetadata {
                app_name: Some("Mail".to_string()),
                app_icon: Some("mail".to_string()),
                file_size: None,
                dimensions: None,
                color_formats: None,
                line_count: None,
                word_count: None,
                char_count: None,
                language: None,
            }),
            is_pinned: false,
            timestamp,
        };
    }

    // D. Check for Web URL
    if (trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("www."))
        && !trimmed.contains('\n')
        && !trimmed.contains(' ')
    {
        let full_url = if trimmed.starts_with("www.") {
            format!("https://{}", trimmed)
        } else {
            trimmed.to_string()
        };
        let site_app = detect_source_app_name(Some(&full_url));
        return ClipboardItemPayload {
            id,
            item_type: "link".to_string(),
            title: full_url.clone(),
            content: full_url,
            preview_url: None,
            description: None,
            metadata: Some(ClipboardMetadata {
                app_name: Some(site_app),
                app_icon: None,
                file_size: None,
                dimensions: None,
                color_formats: None,
                line_count: None,
                word_count: None,
                char_count: None,
                language: None,
            }),
            is_pinned: false,
            timestamp,
        };
    }

    // E. General Text / Code
    let line_count = text.lines().count();
    let word_count = text.split_whitespace().count();
    let char_count = text.chars().count();
    let title = if text.len() > 60 {
        format!(
            "{}...",
            &text[..text.char_indices().nth(55).map(|(i, _)| i).unwrap_or(55)]
        )
    } else {
        text.replace('\n', " ")
    };

    ClipboardItemPayload {
        id,
        item_type: "text".to_string(),
        title,
        content: text,
        preview_url: None,
        description: None,
        metadata: Some(ClipboardMetadata {
            app_name: Some(app_name),
            app_icon: None,
            file_size: None,
            dimensions: None,
            color_formats: None,
            line_count: Some(line_count),
            word_count: Some(word_count),
            char_count: Some(char_count),
            language: None,
        }),
        is_pinned: false,
        timestamp,
    }
}

fn parse_image_item(image_data: arboard::ImageData) -> Option<ClipboardItemPayload> {
    let width = image_data.width as u32;
    let height = image_data.height as u32;
    if width == 0 || height == 0 {
        return None;
    }

    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    if encoder
        .write_image(
            &image_data.bytes,
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .is_err()
    {
        return None;
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    let data_url = format!("data:image/png;base64,{}", b64);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let id = format!("clip_{}", uuid::Uuid::new_v4());
    let app_name = detect_source_app_name(None);

    Some(ClipboardItemPayload {
        id,
        item_type: "image".to_string(),
        title: format!("Image ({}x{})", width, height),
        content: data_url.clone(),
        preview_url: Some(data_url),
        description: None,
        metadata: Some(ClipboardMetadata {
            app_name: Some(app_name),
            app_icon: None,
            file_size: Some(format_size(png_bytes.len() as u64)),
            dimensions: Some(format!("{} × {}", width, height)),
            color_formats: None,
            line_count: None,
            word_count: None,
            char_count: None,
            language: None,
        }),
        is_pinned: false,
        timestamp,
    })
}
