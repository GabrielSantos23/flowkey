use serde::{Deserialize, Serialize};

fn default_version() -> String {
    "2.1".to_string()
}

fn default_port() -> u16 {
    53317
}

fn default_protocol() -> String {
    "http".to_string()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSendDevice {
    pub alias: String,
    #[serde(default)]
    pub version: Option<String>,
    pub device_model: Option<String>,
    pub device_type: Option<String>, // "mobile", "desktop", "web", "headless", "server"
    pub fingerprint: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_protocol")]
    pub protocol: String, // "http" or "https"
    #[serde(default)]
    pub download: Option<bool>,
    pub announce: Option<bool>,
    #[serde(default)]
    pub ip: String,
    #[serde(default)]
    pub last_seen: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterDto {
    pub alias: String,
    #[serde(default = "default_version")]
    pub version: String,
    pub device_model: Option<String>,
    pub device_type: Option<String>,
    pub fingerprint: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default = "default_true")]
    pub download: bool,
    pub announce: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoDto {
    pub alias: String,
    #[serde(default = "default_version")]
    pub version: String,
    pub device_model: Option<String>,
    pub device_type: Option<String>,
    pub fingerprint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(default = "default_true")]
    pub download: bool,
}
