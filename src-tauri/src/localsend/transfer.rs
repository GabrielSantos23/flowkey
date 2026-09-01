use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::localsend::device::{InfoDto, LocalSendDevice};

fn default_file_type() -> String {
    "application/octet-stream".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDto {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub file_name: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default = "default_file_type")]
    pub file_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareUploadRequestDto {
    pub info: InfoDto,
    pub files: HashMap<String, FileDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareUploadResponseDto {
    pub session_id: String,
    pub files: HashMap<String, String>, // fileId -> token
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressPayload {
    pub transfer_id: String,
    pub device_id: String,
    pub file_name: String,
    pub transferred_bytes: u64,
    pub total_bytes: u64,
    pub progress: f64,
    pub speed: f64, // bytes per second
    pub status: String,
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingFileDto {
    pub id: String,
    pub file_name: String,
    pub size: u64,
    pub file_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingTransferRequest {
    pub session_id: String,
    pub sender: LocalSendDevice,
    pub files: Vec<IncomingFileDto>,
    pub total_size: u64,
}
