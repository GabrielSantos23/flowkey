use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationItem {
    pub detected_source_language: Option<String>,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeepLTranslateResponse {
    pub translations: Vec<TranslationItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeepLUsageResponse {
    pub character_count: u64,
    pub character_limit: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationUsage {
    pub character_count: u64,
    pub character_limit: u64,
    pub remaining_characters: u64,
    pub percent_used: f32,
    pub is_limit_reached: bool,
    pub is_online: bool,
    pub api_tier: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LanguageOption {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalUsageStats {
    pub month: String,
    pub character_count: u64,
    pub character_limit: u64,
}

const DEFAULT_MONTHLY_LIMIT: u64 = 50_000;

fn get_config_path() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("FlowKey");
    let _ = fs::create_dir_all(&dir);
    let mut path = dir.clone();
    path.push("translation_usage.json");
    if !path.exists() {
        let mut legacy = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        legacy.push("dynamicwin");
        legacy.push("translation_usage.json");
        if legacy.exists() {
            let _ = fs::copy(&legacy, &path);
        }
    }
    path
}

fn get_current_month() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let days = secs / 86400;
    let year = 1970 + days / 365;
    let month = (days % 365) / 30 + 1;
    format!("{:04}-{:02}", year, month.min(12))
}

fn load_local_usage() -> LocalUsageStats {
    let current_month = get_current_month();
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(mut stats) = serde_json::from_str::<LocalUsageStats>(&data) {
            if stats.month == current_month {
                return stats;
            } else {
                stats.month = current_month;
                stats.character_count = 0;
                stats.character_limit = DEFAULT_MONTHLY_LIMIT;
                let _ = save_local_usage(&stats);
                return stats;
            }
        }
    }
    let stats = LocalUsageStats {
        month: current_month,
        character_count: 0,
        character_limit: DEFAULT_MONTHLY_LIMIT,
    };
    let _ = save_local_usage(&stats);
    stats
}

fn save_local_usage(stats: &LocalUsageStats) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(stats).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn get_api_key() -> Result<String, String> {
    let mut key = std::env::var("DEEPL_API_KEY").unwrap_or_default();

    if key.is_empty() {
        for path in &[".env", "../.env", "../../.env"] {
            if let Ok(contents) = fs::read_to_string(path) {
                for line in contents.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || !line.contains('=') {
                        continue;
                    }
                    let parts: Vec<&str> = line.splitn(2, '=').collect();
                    if parts.len() == 2 {
                        let k = parts[0].trim();
                        let val = parts[1].trim().trim_matches('"').trim_matches('\'');
                        if k == "DEEPL_API_KEY" && !val.is_empty() {
                            key = val.to_string();
                            break;
                        }
                    }
                }
                if !key.is_empty() {
                    break;
                }
            }
        }
    }

    if key.is_empty() {
        return Err("DeepL API Key not found. Please set DEEPL_API_KEY in your .env file.".to_string());
    }

    Ok(key)
}

fn get_base_url(key: &str) -> &'static str {
    if key.ends_with(":fx") {
        "https://api-free.deepl.com/v2"
    } else {
        "https://api.deepl.com/v2"
    }
}

#[tauri::command]
pub async fn get_translation_usage() -> Result<TranslationUsage, String> {
    let key = match get_api_key() {
        Ok(k) => k,
        Err(_) => {
            let local = load_local_usage();
            return Ok(TranslationUsage {
                character_count: local.character_count,
                character_limit: local.character_limit,
                remaining_characters: local.character_limit.saturating_sub(local.character_count),
                percent_used: (local.character_count as f32 / local.character_limit as f32) * 100.0,
                is_limit_reached: local.character_count >= local.character_limit,
                is_online: false,
                api_tier: "Offline".to_string(),
            });
        }
    };

    let base_url = get_base_url(&key);
    let usage_url = format!("{}/usage", base_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let mut local = load_local_usage();

    let mut is_online = false;
    let api_tier = if key.ends_with(":fx") { "Free".to_string() } else { "Pro".to_string() };

    if let Ok(resp) = client
        .get(&usage_url)
        .header("Authorization", format!("DeepL-Auth-Key {}", key))
        .send()
        .await
    {
        if resp.status().is_success() {
            is_online = true;
            if let Ok(usage_data) = resp.json::<DeepLUsageResponse>().await {
                // Keep local count in sync with DeepL's billed count for the month
                local.character_count = usage_data.character_count;
                let _ = save_local_usage(&local);
            }
        }
    }

    let remaining = local.character_limit.saturating_sub(local.character_count);
    let percent = if local.character_limit > 0 {
        ((local.character_count as f32 / local.character_limit as f32) * 100.0).min(100.0)
    } else {
        0.0
    };

    Ok(TranslationUsage {
        character_count: local.character_count,
        character_limit: local.character_limit,
        remaining_characters: remaining,
        percent_used: percent,
        is_limit_reached: local.character_count >= local.character_limit,
        is_online,
        api_tier,
    })
}

fn normalize_source_lang(src: Option<&str>) -> Option<String> {
    let s = src?.trim().to_uppercase();
    if s.is_empty() || s == "AUTO" {
        return None;
    }
    // DeepL API only accepts base language codes for source_lang (e.g. 'PT' instead of 'PT-BR', 'EN' instead of 'EN-US')
    let base = s.split('-').next().unwrap_or(&s);
    Some(base.to_string())
}

fn normalize_target_lang(tgt: &str) -> String {
    let s = tgt.trim().to_uppercase();
    match s.as_str() {
        "EN" => "EN-US".to_string(),
        "PT" => "PT-BR".to_string(),
        _ => s,
    }
}

#[tauri::command]
pub async fn translate_text(
    text: String,
    source_lang: Option<String>,
    target_lang: String,
) -> Result<DeepLTranslateResponse, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(DeepLTranslateResponse {
            translations: vec![TranslationItem {
                detected_source_language: None,
                text: "".to_string(),
            }],
        });
    }

    let char_count = trimmed.chars().count() as u64;
    let mut local = load_local_usage();

    // Check 50,000 monthly character limit guardrail
    if local.character_count + char_count > local.character_limit {
        return Err(format!(
            "Monthly translation limit reached ({}/{} characters used).",
            local.character_count, local.character_limit
        ));
    }

    let key = get_api_key()?;
    let base_url = get_base_url(&key);
    let translate_url = format!("{}/translate", base_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let normalized_tgt = normalize_target_lang(&target_lang);
    let mut body = serde_json::json!({
        "text": [trimmed],
        "target_lang": normalized_tgt
    });

    if let Some(normalized_src) = normalize_source_lang(source_lang.as_deref()) {
        body["source_lang"] = serde_json::json!(normalized_src);
    }

    let resp = client
        .post(&translate_url)
        .header("Authorization", format!("DeepL-Auth-Key {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("DeepL network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let error_body = resp.text().await.unwrap_or_default();
        return Err(format!("DeepL API error ({}): {}", status, error_body));
    }

    let data: DeepLTranslateResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse DeepL response: {}", e))?;

    // Update local usage counter
    local.character_count += char_count;
    let _ = save_local_usage(&local);

    Ok(data)
}

#[tauri::command]
pub fn get_supported_languages() -> Vec<LanguageOption> {
    vec![
        LanguageOption { code: "PT-BR".into(), name: "Portuguese (BR)".into(), native_name: "Português (Brasil)".into() },
        LanguageOption { code: "PT-PT".into(), name: "Portuguese (PT)".into(), native_name: "Português".into() },
        LanguageOption { code: "EN-US".into(), name: "English (US)".into(), native_name: "English (US)".into() },
        LanguageOption { code: "EN-GB".into(), name: "English (UK)".into(), native_name: "English (UK)".into() },
        LanguageOption { code: "ES".into(), name: "Spanish".into(), native_name: "Español".into() },
        LanguageOption { code: "DE".into(), name: "German".into(), native_name: "Deutsch".into() },
        LanguageOption { code: "FR".into(), name: "French".into(), native_name: "Français".into() },
        LanguageOption { code: "IT".into(), name: "Italian".into(), native_name: "Italiano".into() },
        LanguageOption { code: "JA".into(), name: "Japanese".into(), native_name: "日本語".into() },
        LanguageOption { code: "ZH-HANS".into(), name: "Chinese (Simplified)".into(), native_name: "简体中文".into() },
        LanguageOption { code: "RU".into(), name: "Russian".into(), native_name: "Русский".into() },
        LanguageOption { code: "NL".into(), name: "Dutch".into(), native_name: "Nederlands".into() },
        LanguageOption { code: "PL".into(), name: "Polish".into(), native_name: "Polski".into() },
        LanguageOption { code: "KO".into(), name: "Korean".into(), native_name: "한국어".into() },
        LanguageOption { code: "SV".into(), name: "Swedish".into(), native_name: "Svenska".into() },
        LanguageOption { code: "TR".into(), name: "Turkish".into(), native_name: "Türkçe".into() },
        LanguageOption { code: "AR".into(), name: "Arabic".into(), native_name: "العربية".into() },
    ]
}