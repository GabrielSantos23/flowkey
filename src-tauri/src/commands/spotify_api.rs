use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpotifyQueueTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album_art: String,
    pub duration_ms: u64,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SpotifyTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

pub struct SpotifyState {
    pub tokens: Mutex<Option<SpotifyTokens>>,
}

impl SpotifyState {
    pub fn new() -> Self {
        let tokens = load_stored_tokens();
        Self {
            tokens: Mutex::new(tokens),
        }
    }
}

fn get_config_path() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("dynamicwin");
    let _ = fs::create_dir_all(&dir);
    dir.push("spotify_tokens.json");
    dir
}

fn load_stored_tokens() -> Option<SpotifyTokens> {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(path) {
        serde_json::from_str::<SpotifyTokens>(&data).ok()
    } else {
        None
    }
}

fn save_tokens(tokens: &SpotifyTokens) {
    let path = get_config_path();
    if let Ok(json) = serde_json::to_string_pretty(tokens) {
        let _ = fs::write(path, json);
    }
}

fn get_env_credentials() -> (String, String, String) {
    let mut client_id = std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default();
    let mut client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default();
    let mut redirect_uri = std::env::var("SPOTIFY_REDIRECT_URI")
        .unwrap_or_else(|_| "http://127.0.0.1:8888/callback".to_string());

    if client_id.is_empty() {
        for path in &[".env", "../.env", "../../.env"] {
            if let Ok(contents) = fs::read_to_string(path) {
                for line in contents.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || !line.contains('=') {
                        continue;
                    }
                    let parts: Vec<&str> = line.splitn(2, '=').collect();
                    if parts.len() == 2 {
                        let key = parts[0].trim();
                        let val = parts[1].trim().trim_matches('"').trim_matches('\'');
                        if key == "SPOTIFY_CLIENT_ID" && !val.is_empty() {
                            client_id = val.to_string();
                        } else if key == "SPOTIFY_CLIENT_SECRET" && !val.is_empty() {
                            client_secret = val.to_string();
                        } else if key == "SPOTIFY_REDIRECT_URI" && !val.is_empty() {
                            redirect_uri = val.to_string();
                        }
                    }
                }
                if !client_id.is_empty() {
                    break;
                }
            }
        }
    }

    (client_id, client_secret, redirect_uri)
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn get_valid_token(state: &tauri::State<'_, SpotifyState>) -> Option<String> {
    let (client_id, client_secret, _) = get_env_credentials();
    let current_tokens = {
        let guard = state.tokens.lock().ok()?;
        guard.clone()
    };

    if let Some(tokens) = current_tokens {
        if tokens.expires_at > now_secs() + 60 && !tokens.access_token.is_empty() {
            return Some(tokens.access_token);
        }

        // Refresh token if expired and credentials present
        if !tokens.refresh_token.is_empty() && !client_id.is_empty() && !client_secret.is_empty() {
            let client = reqwest::Client::new();
            let res = client
                .post("https://accounts.spotify.com/api/token")
                .basic_auth(&client_id, Some(&client_secret))
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &tokens.refresh_token),
                ])
                .send()
                .await;

            if let Ok(resp) = res {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(access) = json.get("access_token").and_then(|v| v.as_str()) {
                        let expires_in = json.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
                        let updated = SpotifyTokens {
                            access_token: access.to_string(),
                            refresh_token: tokens.refresh_token.clone(),
                            expires_at: now_secs() + expires_in,
                        };
                        save_tokens(&updated);
                        if let Ok(mut guard) = state.tokens.lock() {
                            *guard = Some(updated);
                        }
                        return Some(access.to_string());
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn check_spotify_auth(state: tauri::State<'_, SpotifyState>) -> Result<bool, String> {
    let token = get_valid_token(&state).await;
    Ok(token.is_some())
}

#[tauri::command]
pub async fn get_spotify_access_token(state: tauri::State<'_, SpotifyState>) -> Result<Option<String>, String> {
    Ok(get_valid_token(&state).await)
}

#[tauri::command]
pub fn spotify_logout(state: tauri::State<'_, SpotifyState>) -> bool {
    let path = get_config_path();
    let _ = fs::remove_file(path);
    if let Ok(mut guard) = state.tokens.lock() {
        *guard = None;
    }
    true
}

#[tauri::command]
pub async fn spotify_login(state: tauri::State<'_, SpotifyState>) -> Result<bool, String> {
    let (client_id, client_secret, redirect_uri) = get_env_credentials();
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("Please configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env file".to_string());
    }

    let scopes = "user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played playlist-read-private playlist-read-collaborative user-library-read";
    let auth_url = format!(
        "https://accounts.spotify.com/authorize?response_type=code&client_id={}&scope={}&redirect_uri={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(scopes),
        urlencoding::encode(&redirect_uri)
    );

    // Open browser for OAuth
    let _ = open::that(&auth_url);

    // Listen locally on 127.0.0.1:8888 for callback code
    let listener = TcpListener::bind("127.0.0.1:8888").map_err(|e| e.to_string())?;
    listener.set_nonblocking(false).map_err(|e| e.to_string())?;

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let mut buffer = [0; 2048];
            let _ = stream.read(&mut buffer);
            let req = String::from_utf8_lossy(&buffer);

            if let Some(code_pos) = req.find("code=") {
                let after_code = &req[code_pos + 5..];
                let code: String = after_code
                    .chars()
                    .take_while(|c| *c != ' ' && *c != '&')
                    .collect();

                let html = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body style='font-family:sans-serif;background:#121212;color:white;text-align:center;padding-top:50px;'><h1>Spotify Connected!</h1><p>You can close this tab and return to DynamicWin.</p></body></html>";
                let _ = stream.write_all(html.as_bytes());

                // Exchange code for token
                let client = reqwest::Client::new();
                let token_res = client
                    .post("https://accounts.spotify.com/api/token")
                    .basic_auth(&client_id, Some(&client_secret))
                    .form(&[
                        ("grant_type", "authorization_code"),
                        ("code", &code),
                        ("redirect_uri", &redirect_uri),
                    ])
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                let json: serde_json::Value = token_res.json().await.map_err(|e| e.to_string())?;
                if let (Some(access), Some(refresh)) = (
                    json.get("access_token").and_then(|v| v.as_str()),
                    json.get("refresh_token").and_then(|v| v.as_str()),
                ) {
                    let expires_in = json.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
                    let tokens = SpotifyTokens {
                        access_token: access.to_string(),
                        refresh_token: refresh.to_string(),
                        expires_at: now_secs() + expires_in,
                    };
                    save_tokens(&tokens);
                    if let Ok(mut guard) = state.tokens.lock() {
                        *guard = Some(tokens);
                    }
                    return Ok(true);
                }
            }
            break;
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn get_spotify_queue(state: tauri::State<'_, SpotifyState>) -> Result<Vec<SpotifyQueueTrack>, String> {
    if let Some(token) = get_valid_token(&state).await {
        let client = reqwest::Client::new();
        let res = client
            .get("https://api.spotify.com/v1/me/player/queue")
            .bearer_auth(&token)
            .send()
            .await;

        if let Ok(resp) = res {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(queue_arr) = json.get("queue").and_then(|v| v.as_array()) {
                    let mut list = Vec::new();
                    for item in queue_arr.iter().take(15) {
                        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let title = item.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                        let artist = item
                            .get("artists")
                            .and_then(|v| v.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|a| a.get("name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown Artist")
                            .to_string();

                        let album_art = item
                            .get("album")
                            .and_then(|v| v.get("images"))
                            .and_then(|v| v.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|img| img.get("url"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let duration_ms = item.get("duration_ms").and_then(|v| v.as_u64()).unwrap_or(0);
                        let uri = item.get("uri").and_then(|v| v.as_str()).unwrap_or("").to_string();

                        list.push(SpotifyQueueTrack {
                            id,
                            title,
                            artist,
                            album_art,
                            duration_ms,
                            uri,
                        });
                    }
                    return Ok(list);
                }
            }
        }
    }

    // No placeholders! Return empty list when not authenticated or queue empty
    Ok(Vec::new())
}

#[tauri::command]
pub async fn get_spotify_shuffle_state(
    state: tauri::State<'_, SpotifyState>,
) -> Result<bool, String> {
    if let Some(token) = get_valid_token(&state).await {
        let client = reqwest::Client::new();
        if let Ok(resp) = client
            .get("https://api.spotify.com/v1/me/player")
            .bearer_auth(&token)
            .send()
            .await
        {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(shuffle) = json.get("shuffle_state").and_then(|s| s.as_bool()) {
                    return Ok(shuffle);
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        if let Ok(out) = Command::new("busctl")
            .args([
                "--user",
                "get-property",
                "org.mpris.MediaPlayer2.spotify",
                "/org/mpris/MediaPlayer2",
                "org.mpris.MediaPlayer2.Player",
                "Shuffle",
            ])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            if text.contains("true") {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn set_spotify_shuffle(
    state: tauri::State<'_, SpotifyState>,
    shuffle_state: bool,
) -> Result<bool, String> {
    if let Some(token) = get_valid_token(&state).await {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.spotify.com/v1/me/player/shuffle?state={}",
            shuffle_state
        );
        let _ = client.put(&url).bearer_auth(&token).send().await;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let _ = Command::new("busctl")
            .args([
                "--user",
                "set-property",
                "org.mpris.MediaPlayer2.spotify",
                "/org/mpris/MediaPlayer2",
                "org.mpris.MediaPlayer2.Player",
                "Shuffle",
                "b",
                if shuffle_state { "true" } else { "false" },
            ])
            .status();
    }

    Ok(true)
}

#[tauri::command]
pub async fn spotify_play(
    state: tauri::State<'_, SpotifyState>,
    uris: Option<Vec<String>>,
    context_uri: Option<String>,
    offset_position: Option<usize>,
) -> Result<bool, String> {
    if let Some(token) = get_valid_token(&state).await {
        let client = reqwest::Client::new();
        let mut body = serde_json::Map::new();

        if let Some(uris_list) = uris {
            body.insert("uris".to_string(), serde_json::Value::from(uris_list));
        }
        if let Some(ctx) = context_uri {
            body.insert("context_uri".to_string(), serde_json::Value::String(ctx));
            if let Some(pos) = offset_position {
                let mut offset_map = serde_json::Map::new();
                offset_map.insert("position".to_string(), serde_json::Value::Number(pos.into()));
                body.insert("offset".to_string(), serde_json::Value::Object(offset_map));
            }
        }

        let res = client
            .put("https://api.spotify.com/v1/me/player/play")
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await;

        if let Ok(resp) = res {
            if resp.status().is_success() {
                return Ok(true);
            }
            if resp.status().as_u16() == 404 {
                if let Ok(dev_resp) = client
                    .get("https://api.spotify.com/v1/me/player/devices")
                    .bearer_auth(&token)
                    .send()
                    .await
                {
                    if let Ok(dev_json) = dev_resp.json::<serde_json::Value>().await {
                        if let Some(devices) = dev_json.get("devices").and_then(|d| d.as_array()) {
                            if let Some(first_dev) = devices.first() {
                                if let Some(dev_id) = first_dev.get("id").and_then(|id| id.as_str()) {
                                    let play_url = format!("https://api.spotify.com/v1/me/player/play?device_id={}", dev_id);
                                    let retry_res = client
                                        .put(&play_url)
                                        .bearer_auth(&token)
                                        .json(&body)
                                        .send()
                                        .await;
                                    if let Ok(r) = retry_res {
                                        return Ok(r.status().is_success());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(false)
}
