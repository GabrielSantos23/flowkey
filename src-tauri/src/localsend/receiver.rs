use axum::{
    body::Body,
    body::Bytes,
    extract::{ConnectInfo, DefaultBodyLimit, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::sync::{oneshot, Mutex, RwLock};
use tower_http::cors::CorsLayer;

use crate::localsend::device::{InfoDto, LocalSendDevice, RegisterDto};
use crate::localsend::discovery::LOCALSEND_PORT;
use crate::localsend::transfer::{
    FileDto, IncomingFileDto, IncomingTransferRequest, PrepareUploadRequestDto, PrepareUploadResponseDto,
    TransferProgressPayload,
};

#[derive(Clone)]
pub struct ReceiverState {
    pub app: AppHandle,
    pub my_device: Arc<RwLock<LocalSendDevice>>,
    pub incoming_sessions: Arc<RwLock<HashMap<String, IncomingSessionInfo>>>,
    pub pending_confirmations: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    pub cert_pem: String,
    pub key_pem: String,
}

#[derive(Clone)]
pub struct IncomingSessionInfo {
    pub session_id: String,
    pub sender: LocalSendDevice,
    pub files: HashMap<String, IncomingFileDto>, // fileId -> info
    pub file_tokens: HashMap<String, String>,    // fileId -> token
    pub target_directory: PathBuf,
}

#[derive(Deserialize, Debug, Default)]
pub struct UploadQuery {
    #[serde(alias = "sessionId", alias = "session_id", default)]
    pub session_id: String,
    #[serde(alias = "fileId", alias = "file_id", default)]
    pub file_id: String,
    #[serde(default)]
    pub token: String,
}

#[derive(Deserialize, Debug, Default)]
pub struct CancelQuery {
    #[serde(alias = "sessionId", alias = "session_id", default)]
    pub session_id: String,
}

pub async fn start_receiver_server(
    app: AppHandle,
    my_device: Arc<RwLock<LocalSendDevice>>,
    incoming_sessions: Arc<RwLock<HashMap<String, IncomingSessionInfo>>>,
    pending_confirmations: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    cert_pem: String,
    key_pem: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = ReceiverState {
        app,
        my_device,
        incoming_sessions,
        pending_confirmations,
        cert_pem: cert_pem.clone(),
        key_pem: key_pem.clone(),
    };

    let app_router = Router::new()
        // v2 endpoints
        .route("/api/localsend/v2/info", get(handle_get_info))
        .route("/api/localsend/v2/register", post(handle_post_register))
        .route("/api/localsend/v2/prepare-upload", post(handle_prepare_upload))
        .route("/api/localsend/v2/upload", post(handle_upload_file))
        .route("/api/localsend/v2/cancel", post(handle_cancel_transfer))
        // Aliases for v1 and short path compatibility
        .route("/api/localsend/v1/info", get(handle_get_info))
        .route("/api/localsend/v1/register", post(handle_post_register))
        .route("/api/localsend/v1/prepare-upload", post(handle_prepare_upload))
        .route("/api/localsend/v1/upload", post(handle_upload_file))
        .route("/api/localsend/v1/cancel", post(handle_cancel_transfer))
        .route("/api/v2/info", get(handle_get_info))
        .route("/api/v2/register", post(handle_post_register))
        .route("/api/v2/prepare-upload", post(handle_prepare_upload))
        .route("/api/v2/upload", post(handle_upload_file))
        .route("/api/v2/cancel", post(handle_cancel_transfer))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::disable())
        .with_state(state);

    let rustls_config = axum_server::tls_rustls::RustlsConfig::from_pem(
        cert_pem.as_bytes().to_vec(),
        key_pem.as_bytes().to_vec(),
    )
    .await?;

    let addr = SocketAddr::from(([0, 0, 0, 0], LOCALSEND_PORT));
    println!("[LocalSend Server] Starting LocalSend HTTPS server on port {}", LOCALSEND_PORT);

    tauri::async_runtime::spawn(async move {
        if let Err(e) = axum_server::bind_rustls(addr, rustls_config)
            .serve(app_router.into_make_service_with_connect_info::<SocketAddr>())
            .await
        {
            eprintln!("[LocalSend Server] HTTPS server error: {:?}", e);
        }
    });

    Ok(())
}

async fn handle_get_info(State(state): State<ReceiverState>) -> impl IntoResponse {
    println!("[LocalSend Server] GET /api/localsend/v2/info");
    let dev = state.my_device.read().await;
    Json(InfoDto {
        alias: dev.alias.clone(),
        version: "2.1".to_string(),
        device_model: dev.device_model.clone(),
        device_type: dev.device_type.clone(),
        fingerprint: dev.fingerprint.clone(),
        port: Some(dev.port),
        protocol: Some(dev.protocol.clone()),
        download: true,
    })
}

async fn handle_post_register(
    State(state): State<ReceiverState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> impl IntoResponse {
    println!("[LocalSend Server] POST /api/localsend/v2/register from {:?}: {}", addr, String::from_utf8_lossy(&body));
    let reg: Result<RegisterDto, _> = serde_json::from_slice(&body);
    let dev = state.my_device.read().await.clone();

    if let Ok(reg) = reg {
        if reg.fingerprint != dev.fingerprint {
            let device_ip = addr.ip().to_string();
            let device = LocalSendDevice {
                alias: reg.alias.clone(),
                version: Some(reg.version.clone()),
                device_model: reg.device_model.clone(),
                device_type: reg.device_type.clone(),
                fingerprint: reg.fingerprint.clone(),
                port: reg.port,
                protocol: reg.protocol.clone(),
                download: Some(reg.download),
                announce: reg.announce,
                ip: device_ip.clone(),
                last_seen: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            };
            let _ = state.app.emit("localsend://device-found", &device);

            // Reply with announcement back if requested
            if reg.announce.unwrap_or(true) {
                let my_dev_clone = dev.clone();
                let target_protocol = reg.protocol;
                let target_ip = device_ip;
                let target_port = reg.port;
                let cert_clone = state.cert_pem.clone();
                let key_clone = state.key_pem.clone();

                tauri::async_runtime::spawn(async move {
                    let client = crate::localsend::build_reqwest_client(&cert_clone, &key_clone);

                    let reply_url = format!(
                        "{}://{}:{}/api/localsend/v2/register",
                        target_protocol, target_ip, target_port
                    );

                    let back_dto = RegisterDto {
                        alias: my_dev_clone.alias,
                        version: "2.1".to_string(),
                        device_model: my_dev_clone.device_model,
                        device_type: my_dev_clone.device_type,
                        fingerprint: my_dev_clone.fingerprint,
                        port: my_dev_clone.port,
                        protocol: my_dev_clone.protocol,
                        download: true,
                        announce: Some(false),
                    };

                    let _ = client.post(&reply_url).json(&back_dto).send().await;
                });
            }
        }
    }

    Json(RegisterDto {
        alias: dev.alias.clone(),
        version: "2.1".to_string(),
        device_model: dev.device_model.clone(),
        device_type: dev.device_type.clone(),
        fingerprint: dev.fingerprint.clone(),
        port: dev.port,
        protocol: dev.protocol.clone(),
        download: true,
        announce: Some(false),
    })
}

async fn handle_prepare_upload(
    State(state): State<ReceiverState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> impl IntoResponse {
    println!("[LocalSend Server] POST /api/localsend/v2/prepare-upload from {:?}: {}", addr, String::from_utf8_lossy(&body));

    let payload: PrepareUploadRequestDto = match serde_json::from_slice(&body) {
        Ok(p) => p,
        Err(e) => {
            println!("[LocalSend Server] Strict parse failed: {:?}, attempting dynamic JSON fallback", e);
            match serde_json::from_slice::<serde_json::Value>(&body) {
                Ok(val) => {
                    let info_val = val.get("info").cloned().unwrap_or_default();
                    let alias = info_val.get("alias").and_then(|v| v.as_str()).unwrap_or("Unknown Device").to_string();
                    let version = info_val.get("version").and_then(|v| v.as_str()).unwrap_or("2.1").to_string();
                    let device_model = info_val.get("deviceModel").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let device_type = info_val.get("deviceType").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let fingerprint = info_val.get("fingerprint").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let port = info_val.get("port").and_then(|v| v.as_u64()).map(|p| p as u16);
                    let protocol = info_val.get("protocol").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let download = info_val.get("download").and_then(|v| v.as_bool()).unwrap_or(true);

                    let mut files = HashMap::new();
                    if let Some(files_obj) = val.get("files").and_then(|v| v.as_object()) {
                        for (k, fval) in files_obj {
                            let id = fval.get("id").and_then(|v| v.as_str()).unwrap_or(k).to_string();
                            let file_name = fval.get("fileName").and_then(|v| v.as_str()).unwrap_or("received_file").to_string();
                            let size = fval.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                            let file_type = fval.get("fileType").and_then(|v| v.as_str()).unwrap_or("application/octet-stream").to_string();
                            files.insert(k.clone(), FileDto {
                                id,
                                file_name,
                                size,
                                file_type,
                                sha256: None,
                                preview: None,
                            });
                        }
                    }

                    PrepareUploadRequestDto {
                        info: InfoDto {
                            alias,
                            version,
                            device_model,
                            device_type,
                            fingerprint,
                            port,
                            protocol,
                            download,
                        },
                        files,
                    }
                }
                Err(err) => {
                    println!("[LocalSend Server] Fatal: cannot parse prepare-upload body: {:?}", err);
                    return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid JSON" }))).into_response();
                }
            }
        }
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    let mut file_tokens = HashMap::new();
    let mut incoming_files = HashMap::new();
    let mut file_list_dto = Vec::new();
    let mut total_size = 0;

    for (file_id, file_dto) in payload.files {
        let token = uuid::Uuid::new_v4().to_string();
        file_tokens.insert(file_id.clone(), token.clone());
        if !file_dto.id.is_empty() && file_dto.id != file_id {
            file_tokens.insert(file_dto.id.clone(), token.clone());
        }

        let inc_dto = IncomingFileDto {
            id: if !file_dto.id.is_empty() { file_dto.id.clone() } else { file_id.clone() },
            file_name: file_dto.file_name.clone(),
            size: file_dto.size,
            file_type: file_dto.file_type.clone(),
            preview: file_dto.preview.clone(),
        };

        total_size += file_dto.size;
        file_list_dto.push(inc_dto.clone());
        incoming_files.insert(file_id.clone(), inc_dto.clone());
        if !file_dto.id.is_empty() {
            incoming_files.insert(file_dto.id.clone(), inc_dto);
        }
    }

    let sender_device = LocalSendDevice {
        alias: payload.info.alias,
        version: Some(payload.info.version),
        device_model: payload.info.device_model,
        device_type: payload.info.device_type,
        fingerprint: payload.info.fingerprint,
        port: payload.info.port.unwrap_or(LOCALSEND_PORT),
        protocol: payload.info.protocol.unwrap_or_else(|| "https".to_string()),
        download: Some(payload.info.download),
        announce: None,
        ip: addr.ip().to_string(),
        last_seen: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    };

    let download_dir = dirs::download_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Downloads")
    });
    let _ = tokio::fs::create_dir_all(&download_dir).await;

    let session_info = IncomingSessionInfo {
        session_id: session_id.clone(),
        sender: sender_device.clone(),
        files: incoming_files,
        file_tokens: file_tokens.clone(),
        target_directory: download_dir,
    };

    // Save session in registry
    {
        let mut sessions = state.incoming_sessions.write().await;
        sessions.insert(session_id.clone(), session_info);
    }

    // Create confirmation channel and notify React UI
    let (tx, rx) = oneshot::channel::<bool>();
    {
        let mut pendings = state.pending_confirmations.lock().await;
        pendings.insert(session_id.clone(), tx);
    }

    let transfer_request = IncomingTransferRequest {
        session_id: session_id.clone(),
        sender: sender_device,
        files: file_list_dto,
        total_size,
    };

    println!("[LocalSend Server] Emitting localsend://incoming-transfer to UI for session: {}", session_id);
    let _ = state.app.emit("localsend://incoming-transfer", &transfer_request);

    // Wait for React UI user decision (with 60s timeout)
    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(true)) => {
            println!("[LocalSend Server] Transfer ACCEPTED for sessionId={}", session_id);
            // User accepted
            (StatusCode::OK, Json(PrepareUploadResponseDto {
                session_id,
                files: file_tokens,
            })).into_response()
        }
        _ => {
            println!("[LocalSend Server] Transfer REJECTED/TIMED OUT for sessionId={}", session_id);
            // User rejected or timed out
            let mut sessions = state.incoming_sessions.write().await;
            sessions.remove(&session_id);
            StatusCode::FORBIDDEN.into_response()
        }
    }
}

async fn handle_upload_file(
    State(state): State<ReceiverState>,
    Query(query): Query<UploadQuery>,
    body: Body,
) -> Result<StatusCode, StatusCode> {
    println!("[LocalSend Server] POST /upload query: {:?}", query);
    let session = {
        let sessions = state.incoming_sessions.read().await;
        sessions.get(&query.session_id).cloned()
    };

    let session = match session {
        Some(s) => s,
        None => {
            println!("[LocalSend Server] Upload failed: session {} not found", query.session_id);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    // Verify token
    if session.file_tokens.get(&query.file_id) != Some(&query.token) {
        println!("[LocalSend Server] Upload failed: invalid token for fileId {}", query.file_id);
        return Err(StatusCode::UNAUTHORIZED);
    }

    let file_info = match session.files.get(&query.file_id) {
        Some(f) => f.clone(),
        None => {
            println!("[LocalSend Server] Upload failed: fileId {} not found in session", query.file_id);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    let is_text = file_info.file_type.starts_with("text/plain")
        || file_info.file_name.ends_with(".txt")
        || file_info.file_name == "Text.txt"
        || file_info.file_name == "text.txt";

    let dest_path = session.target_directory.join(&file_info.file_name);
    let mut file_opt = if !is_text {
        if let Some(parent) = dest_path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        match File::create(&dest_path).await {
            Ok(f) => Some(f),
            Err(e) => {
                println!("[LocalSend Server] Failed to create file at {}: {:?}", dest_path.display(), e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    } else {
        None
    };

    let mut stream = body.into_data_stream();
    let mut transferred: u64 = 0;
    let mut text_buffer = Vec::new();
    let mut hasher = Sha256::new();
    let start_time = Instant::now();
    let mut last_emit = Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk: Bytes = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                println!("[LocalSend Server] Stream read error: {:?}", e);
                if !is_text {
                    let _ = tokio::fs::remove_file(&dest_path).await;
                }
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        if let Some(ref mut file) = file_opt {
            if let Err(e) = file.write_all(&chunk).await {
                println!("[LocalSend Server] File write error: {:?}", e);
                let _ = tokio::fs::remove_file(&dest_path).await;
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        } else {
            text_buffer.extend_from_slice(&chunk);
        }

        hasher.update(&chunk);
        transferred += chunk.len() as u64;

        if last_emit.elapsed().as_millis() > 150 || transferred >= file_info.size {
            let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.001);
            let speed = transferred as f64 / elapsed_secs;
            let progress = if file_info.size > 0 {
                (transferred as f64 / file_info.size as f64).min(1.0)
            } else {
                1.0
            };

            let payload = TransferProgressPayload {
                transfer_id: query.session_id.clone(),
                device_id: session.sender.fingerprint.clone(),
                file_name: file_info.file_name.clone(),
                transferred_bytes: transferred,
                total_bytes: file_info.size,
                progress,
                speed,
                status: if transferred >= file_info.size {
                    "completed".to_string()
                } else {
                    "receiving".to_string()
                },
                error: None,
                text_content: if is_text && !text_buffer.is_empty() {
                    Some(String::from_utf8_lossy(&text_buffer).to_string())
                } else {
                    None
                },
            };

            let _ = state.app.emit("localsend://transfer-progress", &payload);
            last_emit = Instant::now();
        }
    }

    if let Some(ref mut file) = file_opt {
        let _ = file.flush().await;
        println!("[LocalSend Server] Successfully received file: {} ({} bytes)", file_info.file_name, transferred);
    } else {
        println!("[LocalSend Server] Successfully received text message ({} bytes), stored in memory", transferred);
    }

    let final_text = if is_text {
        Some(String::from_utf8_lossy(&text_buffer).to_string())
    } else {
        None
    };

    let payload = TransferProgressPayload {
        transfer_id: query.session_id.clone(),
        device_id: session.sender.fingerprint.clone(),
        file_name: file_info.file_name.clone(),
        transferred_bytes: transferred,
        total_bytes: file_info.size,
        progress: 1.0,
        speed: 0.0,
        status: "completed".to_string(),
        error: None,
        text_content: final_text,
    };
    let _ = state.app.emit("localsend://transfer-completed", &payload);

    Ok(StatusCode::OK)
}

async fn handle_cancel_transfer(
    State(state): State<ReceiverState>,
    Query(query): Query<CancelQuery>,
) -> impl IntoResponse {
    let mut sessions = state.incoming_sessions.write().await;
    sessions.remove(&query.session_id);

    let _ = state.app.emit(
        "localsend://transfer-cancelled",
        serde_json::json!({ "transferId": query.session_id }),
    );
    StatusCode::OK
}
