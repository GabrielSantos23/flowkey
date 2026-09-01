use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize, Clone)]
pub enum LocalSendError {
    NetworkError(String),
    DeviceNotFound(String),
    TransferRejected(String),
    TransferCancelled,
    IoError(String),
    InvalidPayload(String),
    ProtocolError(String),
    ServerBindError(String),
}

impl fmt::Display for LocalSendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LocalSendError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            LocalSendError::DeviceNotFound(msg) => write!(f, "Device not found: {}", msg),
            LocalSendError::TransferRejected(msg) => write!(f, "Transfer rejected: {}", msg),
            LocalSendError::TransferCancelled => write!(f, "Transfer cancelled by user"),
            LocalSendError::IoError(msg) => write!(f, "IO error: {}", msg),
            LocalSendError::InvalidPayload(msg) => write!(f, "Invalid payload: {}", msg),
            LocalSendError::ProtocolError(msg) => write!(f, "Protocol error: {}", msg),
            LocalSendError::ServerBindError(msg) => write!(f, "Server bind error: {}", msg),
        }
    }
}

impl std::error::Error for LocalSendError {}

impl From<std::io::Error> for LocalSendError {
    fn from(err: std::io::Error) -> Self {
        LocalSendError::IoError(err.to_string())
    }
}

impl From<reqwest::Error> for LocalSendError {
    fn from(err: reqwest::Error) -> Self {
        LocalSendError::NetworkError(err.to_string())
    }
}
