use futures_util::TryStreamExt;
use reqwest::Body;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::sync::RwLock;
use tokio_util::io::ReaderStream;

use crate::localsend::device::{InfoDto, LocalSendDevice};
use crate::localsend::errors::LocalSendError;
use crate::localsend::transfer::{
    FileDto, PrepareUploadRequestDto, PrepareUploadResponseDto, TransferProgressPayload,
};

pub struct SenderManager {
    active_cancels: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    cert_pem: String,
    key_pem: String,
}

impl SenderManager {
    pub fn new(cert_pem: String, key_pem: String) -> Self {
        Self {
            active_cancels: Arc::new(RwLock::new(HashMap::new())),
            cert_pem,
            key_pem,
        }
    }

    pub async fn cancel_transfer(&self, transfer_id: &str) {
        let cancels = self.active_cancels.read().await;
        if let Some(flag) = cancels.get(transfer_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }

    pub async fn send_files(
        &self,
        app: AppHandle,
        my_device: LocalSendDevice,
        target: LocalSendDevice,
        file_paths: Vec<String>,
    ) -> Result<String, LocalSendError> {
        let client = crate::localsend::build_reqwest_client(&self.cert_pem, &self.key_pem);

        let mut files_dto = HashMap::new();
        let mut local_files: Vec<(String, PathBuf, String, u64)> = Vec::new();

        // 1. Gather file metadata
        for (i, p) in file_paths.iter().enumerate() {
            let path = PathBuf::from(p);
            if !path.exists() {
                continue;
            }

            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let metadata = tokio::fs::metadata(&path).await?;
            let size = metadata.len();
            let file_id = format!("file_{}_{}", i, uuid::Uuid::new_v4());

            let mime = mime_guess::from_path(&path)
                .first_or_octet_stream()
                .to_string();

            files_dto.insert(
                file_id.clone(),
                FileDto {
                    id: file_id.clone(),
                    file_name: file_name.clone(),
                    size,
                    file_type: mime,
                    sha256: None,
                    preview: None,
                },
            );

            local_files.push((file_id, path, file_name, size));
        }

        if local_files.is_empty() {
            return Err(LocalSendError::InvalidPayload("No valid files to send".to_string()));
        }

        // 2. Prepare upload handshake
        let prepare_url = format!(
            "{}://{}:{}/api/localsend/v2/prepare-upload",
            target.protocol, target.ip, target.port
        );
        println!("[LocalSend Sender] Handshaking prepare-upload with URL: {}", prepare_url);

        let prepare_req = PrepareUploadRequestDto {
            info: InfoDto {
                alias: my_device.alias.clone(),
                version: "2.1".to_string(),
                device_model: my_device.device_model.clone(),
                device_type: my_device.device_type.clone(),
                fingerprint: my_device.fingerprint.clone(),
                port: Some(my_device.port),
                protocol: Some(my_device.protocol.clone()),
                download: true,
            },
            files: files_dto,
        };

        let resp = client
            .post(&prepare_url)
            .json(&prepare_req)
            .send()
            .await
            .map_err(|e| {
                println!("[LocalSend Sender] Failed to connect to prepare-upload: {:?}", e);
                LocalSendError::NetworkError(e.to_string())
            })?;

        println!("[LocalSend Sender] Prepare-upload status: {}", resp.status());

        if !resp.status().is_success() {
            return Err(LocalSendError::TransferRejected(format!(
                "Recipient rejected transfer with status {}",
                resp.status()
            )));
        }

        let prepare_res: PrepareUploadResponseDto = resp
            .json()
            .await
            .map_err(|e| {
                println!("[LocalSend Sender] Failed to parse prepare-upload response JSON: {:?}", e);
                LocalSendError::ProtocolError(e.to_string())
            })?;

        let session_id = prepare_res.session_id.clone();
        println!("[LocalSend Sender] Prepare-upload accepted! SessionId: {}", session_id);
        let cancel_flag = Arc::new(AtomicBool::new(false));

        {
            let mut cancels = self.active_cancels.write().await;
            cancels.insert(session_id.clone(), cancel_flag.clone());
        }

        let cancels_store = self.active_cancels.clone();
        let session_id_clone = session_id.clone();
        let target_clone = target.clone();

        // 3. Upload files asynchronously
        tauri::async_runtime::spawn(async move {
            for (file_id, file_path, file_name, file_size) in local_files {
                if cancel_flag.load(Ordering::SeqCst) {
                    let _ = app.emit(
                        "localsend://transfer-cancelled",
                        serde_json::json!({ "transferId": session_id_clone }),
                    );
                    break;
                }

                let token = match prepare_res.files.get(&file_id) {
                    Some(t) => t.clone(),
                    None => continue,
                };

                let upload_url = format!(
                    "{}://{}:{}/api/localsend/v2/upload?sessionId={}&fileId={}&token={}",
                    target_clone.protocol, target_clone.ip, target_clone.port, session_id_clone, file_id, token
                );
                println!("[LocalSend Sender] Uploading file: {} ({} bytes) to {}", file_name, file_size, upload_url);

                let file = match File::open(&file_path).await {
                    Ok(f) => f,
                    Err(e) => {
                        println!("[LocalSend Sender] Could not open file {}: {:?}", file_path.display(), e);
                        let _ = app.emit(
                            "localsend://transfer-failed",
                            serde_json::json!({ "transferId": session_id_clone, "error": e.to_string() }),
                        );
                        break;
                    }
                };

                let stream = ReaderStream::new(file);
                let app_progress = app.clone();
                let session_id_prog = session_id_clone.clone();
                let device_id_prog = target_clone.fingerprint.clone();
                let file_name_prog = file_name.clone();
                let start_time = Instant::now();
                let mut sent_bytes: u64 = 0;
                let mut last_emit = Instant::now();

                // Track stream progress
                let progress_stream = stream.inspect_ok(move |chunk| {
                    sent_bytes += chunk.len() as u64;
                    if last_emit.elapsed().as_millis() > 150 || sent_bytes >= file_size {
                        let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.001);
                        let speed = sent_bytes as f64 / elapsed_secs;
                        let progress = if file_size > 0 {
                            (sent_bytes as f64 / file_size as f64).min(1.0)
                        } else {
                            1.0
                        };

                        let payload = TransferProgressPayload {
                            transfer_id: session_id_prog.clone(),
                            device_id: device_id_prog.clone(),
                            file_name: file_name_prog.clone(),
                            transferred_bytes: sent_bytes,
                            total_bytes: file_size,
                            progress,
                            speed,
                            status: if sent_bytes >= file_size {
                                "completed".to_string()
                            } else {
                                "sending".to_string()
                            },
                            error: None,
                            text_content: None,
                        };

                        let _ = app_progress.emit("localsend://transfer-progress", &payload);
                        last_emit = Instant::now();
                    }
                });

                let body = Body::wrap_stream(progress_stream);
                let upload_resp = client
                    .post(&upload_url)
                    .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
                    .header(reqwest::header::CONTENT_LENGTH, file_size)
                    .body(body)
                    .send()
                    .await;

                match upload_resp {
                    Ok(res) if res.status().is_success() => {
                        println!("[LocalSend Sender] Successfully uploaded file: {}", file_name);
                        let payload = TransferProgressPayload {
                            transfer_id: session_id_clone.clone(),
                            device_id: target_clone.fingerprint.clone(),
                            file_name: file_name.clone(),
                            transferred_bytes: file_size,
                            total_bytes: file_size,
                            progress: 1.0,
                            speed: 0.0,
                            status: "completed".to_string(),
                            error: None,
                            text_content: None,
                        };
                        let _ = app.emit("localsend://transfer-completed", &payload);
                    }
                    Ok(res) => {
                        println!("[LocalSend Sender] Upload failed with HTTP status: {}", res.status());
                        let _ = app.emit(
                            "localsend://transfer-failed",
                            serde_json::json!({
                                "transferId": session_id_clone,
                                "error": format!("Upload failed with HTTP status {}", res.status())
                            }),
                        );
                        break;
                    }
                    Err(e) => {
                        println!("[LocalSend Sender] Upload error: {:?}", e);
                        let _ = app.emit(
                            "localsend://transfer-failed",
                            serde_json::json!({ "transferId": session_id_clone, "error": e.to_string() }),
                        );
                        break;
                    }
                }
            }

            let mut cancels = cancels_store.write().await;
            cancels.remove(&session_id_clone);
        });

        Ok(session_id)
    }

    pub async fn send_text(
        &self,
        app: AppHandle,
        my_device: LocalSendDevice,
        target: LocalSendDevice,
        text: String,
    ) -> Result<String, LocalSendError> {
        let client = crate::localsend::build_reqwest_client(&self.cert_pem, &self.key_pem);
        let text_raw = text.clone();
        let text_bytes = text.into_bytes();
        let text_len = text_bytes.len() as u64;
        let file_id = format!("text_{}", uuid::Uuid::new_v4());
        let file_name = "Text.txt".to_string();

        let mut files_dto = HashMap::new();
        files_dto.insert(
            file_id.clone(),
            FileDto {
                id: file_id.clone(),
                file_name: file_name.clone(),
                size: text_len,
                file_type: "text/plain".to_string(),
                sha256: None,
                preview: Some(if text_raw.len() > 100 {
                    format!("{}...", &text_raw[..100])
                } else {
                    text_raw.clone()
                }),
            },
        );

        let prepare_url = format!(
            "{}://{}:{}/api/localsend/v2/prepare-upload",
            target.protocol, target.ip, target.port
        );
        println!("[LocalSend Sender] Sending text message to URL: {}", prepare_url);

        let prepare_req = PrepareUploadRequestDto {
            info: InfoDto {
                alias: my_device.alias.clone(),
                version: "2.1".to_string(),
                device_model: my_device.device_model.clone(),
                device_type: my_device.device_type.clone(),
                fingerprint: my_device.fingerprint.clone(),
                port: Some(my_device.port),
                protocol: Some(my_device.protocol.clone()),
                download: true,
            },
            files: files_dto,
        };

        let resp = client
            .post(&prepare_url)
            .json(&prepare_req)
            .send()
            .await
            .map_err(|e| LocalSendError::NetworkError(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(LocalSendError::TransferRejected(format!(
                "Recipient rejected text transfer with status {}",
                resp.status()
            )));
        }

        let prepare_res: PrepareUploadResponseDto = resp
            .json()
            .await
            .map_err(|e| LocalSendError::ProtocolError(e.to_string()))?;

        let session_id = prepare_res.session_id.clone();
        let token = prepare_res
            .files
            .get(&file_id)
            .cloned()
            .unwrap_or_default();

        let upload_url = format!(
            "{}://{}:{}/api/localsend/v2/upload?sessionId={}&fileId={}&token={}",
            target.protocol, target.ip, target.port, session_id, file_id, token
        );

        let app_clone = app.clone();
        let session_id_clone = session_id.clone();
        let target_clone = target.clone();
        let file_name_clone = file_name.clone();

        tauri::async_runtime::spawn(async move {
            let res = client
                .post(&upload_url)
                .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
                .header(reqwest::header::CONTENT_LENGTH, text_len)
                .body(text_bytes)
                .send()
                .await;

            match res {
                Ok(r) if r.status().is_success() => {
                    println!("[LocalSend Sender] Successfully sent text message!");
                    let payload = TransferProgressPayload {
                        transfer_id: session_id_clone.clone(),
                        device_id: target_clone.fingerprint.clone(),
                        file_name: file_name_clone,
                        transferred_bytes: text_len,
                        total_bytes: text_len,
                        progress: 1.0,
                        speed: 0.0,
                        status: "completed".to_string(),
                        error: None,
                        text_content: Some(text_raw),
                    };
                    let _ = app_clone.emit("localsend://transfer-completed", &payload);
                }
                Ok(r) => {
                    let _ = app_clone.emit(
                        "localsend://transfer-failed",
                        serde_json::json!({
                            "transferId": session_id_clone,
                            "error": format!("Upload failed with status {}", r.status())
                        }),
                    );
                }
                Err(e) => {
                    let _ = app_clone.emit(
                        "localsend://transfer-failed",
                        serde_json::json!({ "transferId": session_id_clone, "error": e.to_string() }),
                    );
                }
            }
        });

        Ok(session_id)
    }
}
