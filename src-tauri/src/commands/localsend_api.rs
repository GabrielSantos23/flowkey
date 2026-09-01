use tauri::{AppHandle, State};
use crate::localsend::device::LocalSendDevice;
use crate::localsend::LocalSendState;

#[tauri::command]
pub async fn localsend_start_discovery(
    state: State<'_, LocalSendState>,
    app: AppHandle,
    duration_secs: Option<u64>,
) -> Result<(), String> {
    let dur = duration_secs.unwrap_or(8);
    state.start_discovery(app, dur).await;
    Ok(())
}

#[tauri::command]
pub async fn localsend_stop_discovery(
    state: State<'_, LocalSendState>,
) -> Result<(), String> {
    state.stop_discovery().await;
    Ok(())
}

#[tauri::command]
pub async fn localsend_get_devices(
    state: State<'_, LocalSendState>,
) -> Result<Vec<LocalSendDevice>, String> {
    Ok(state.get_devices().await)
}

#[tauri::command]
pub async fn localsend_get_my_device(
    state: State<'_, LocalSendState>,
) -> Result<LocalSendDevice, String> {
    Ok(state.get_my_device().await)
}

#[tauri::command]
pub async fn localsend_is_discovering(
    state: State<'_, LocalSendState>,
) -> Result<bool, String> {
    Ok(state.is_discovering().await)
}

#[tauri::command]
pub async fn localsend_send_files(
    state: State<'_, LocalSendState>,
    app: AppHandle,
    target: LocalSendDevice,
    file_paths: Vec<String>,
) -> Result<String, String> {
    state
        .send_files(app, target, file_paths)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn localsend_send_text(
    state: State<'_, LocalSendState>,
    app: AppHandle,
    target: LocalSendDevice,
    text: String,
) -> Result<String, String> {
    state
        .send_text(app, target, text)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn localsend_cancel_transfer(
    state: State<'_, LocalSendState>,
    transfer_id: String,
) -> Result<(), String> {
    state.cancel_transfer(&transfer_id).await;
    Ok(())
}

#[tauri::command]
pub async fn localsend_accept_transfer(
    state: State<'_, LocalSendState>,
    session_id: String,
) -> Result<(), String> {
    state.accept_transfer(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn localsend_reject_transfer(
    state: State<'_, LocalSendState>,
    session_id: String,
) -> Result<(), String> {
    state.reject_transfer(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn localsend_probe_ip(
    state: State<'_, LocalSendState>,
    app: AppHandle,
    ip: String,
) -> Result<LocalSendDevice, String> {
    state.probe_ip(app, ip).await
}
