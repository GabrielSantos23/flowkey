pub mod device;
pub mod discovery;
pub mod errors;
pub mod receiver;
pub mod sender;
pub mod transfer;

use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::{oneshot, Mutex, RwLock};

use crate::localsend::device::LocalSendDevice;
use crate::localsend::discovery::{DiscoveryManager, LOCALSEND_PORT};
use crate::localsend::errors::LocalSendError;
use crate::localsend::receiver::{start_receiver_server, IncomingSessionInfo};
use crate::localsend::sender::SenderManager;

pub fn build_reqwest_client(cert_pem: &str, key_pem: &str) -> reqwest::Client {
    let mut pem = String::new();
    pem.push_str(key_pem);
    pem.push_str(cert_pem);
    let identity = reqwest::Identity::from_pem(pem.as_bytes()).unwrap();

    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .identity(identity)
        .build()
        .unwrap_or_default()
}

pub struct LocalSendState {
    pub my_device: Arc<RwLock<LocalSendDevice>>,
    pub discovered_devices: Arc<RwLock<HashMap<String, LocalSendDevice>>>,
    pub discovery: DiscoveryManager,
    pub sender: SenderManager,
    pub incoming_sessions: Arc<RwLock<HashMap<String, IncomingSessionInfo>>>,
    pub pending_confirmations: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl LocalSendState {
    pub fn new(app: &AppHandle) -> Self {
        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "DynamicWin Device".to_string());
        // Generate self-signed certificate for LocalSend mTLS
        // Includes actual LAN IPs in the SAN (as IpAddress SAN entries) so the TLS handshake works
        // regardless of the IP the phone connects to.
        let mut params = rcgen::CertificateParams::default();
        params.subject_alt_names.push(rcgen::SanType::DnsName("localhost".try_into().unwrap()));
        params.subject_alt_names.push(rcgen::SanType::IpAddress(std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))));
        if let Ok(ifs) = local_ip_address::list_afinet_netifas() {
            for (_, ip) in &ifs {
                if !ip.is_loopback() {
                    params.subject_alt_names.push(rcgen::SanType::IpAddress(*ip));
                }
            }
        }
        let key_pair = rcgen::KeyPair::generate().unwrap();
        let cert = params.self_signed(&key_pair).unwrap();
        let cert_der = cert.der().clone();
        let cert_pem = cert.pem();
        let key_pem = key_pair.serialize_pem();
        
        use sha2::Digest;
        let mut hasher = sha2::Sha256::new();
        hasher.update(&cert_der);
        let fingerprint = hex::encode(hasher.finalize());

        let local_ip_str = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "0.0.0.0".to_string());

        let my_device = LocalSendDevice {
            alias: hostname,
            version: Some("2.1".to_string()),
            device_model: Some("Linux Desktop".to_string()),
            device_type: Some("desktop".to_string()),
            fingerprint,
            port: LOCALSEND_PORT,
            protocol: "https".to_string(),
            download: Some(true),
            announce: Some(true),
            ip: local_ip_str,
            last_seen: 0,
        };

        let my_device_arc = Arc::new(RwLock::new(my_device));
        let discovered_devices = Arc::new(RwLock::new(HashMap::new()));
        let incoming_sessions = Arc::new(RwLock::new(HashMap::new()));
        let pending_confirmations = Arc::new(Mutex::new(HashMap::new()));

        let discovery = DiscoveryManager::new(discovered_devices.clone(), cert_pem.clone(), key_pem.clone());
        let sender = SenderManager::new(cert_pem.clone(), key_pem.clone());

        // Start background UDP multicast/broadcast listener
        discovery.start_background_listener(app.clone(), my_device_arc.clone());

        // Start background receiver server
        let app_handle = app.clone();
        let my_device_for_server = my_device_arc.clone();
        let sessions_for_server = incoming_sessions.clone();
        let pendings_for_server = pending_confirmations.clone();
        let cert_server = cert_pem.clone();
        let key_server = key_pem.clone();

        tauri::async_runtime::spawn(async move {
            if let Err(e) = start_receiver_server(
                app_handle,
                my_device_for_server,
                sessions_for_server,
                pendings_for_server,
                cert_server,
                key_server,
            )
            .await
            {
                eprintln!("[LocalSend] Receiver server error: {}", e);
            }
        });

        Self {
            my_device: my_device_arc,
            discovered_devices,
            discovery,
            sender,
            incoming_sessions,
            pending_confirmations,
        }
    }

    pub async fn get_my_device(&self) -> LocalSendDevice {
        self.my_device.read().await.clone()
    }

    pub async fn get_devices(&self) -> Vec<LocalSendDevice> {
        let store = self.discovered_devices.read().await;
        store.values().cloned().collect()
    }

    pub async fn start_discovery(&self, app: AppHandle, duration_secs: u64) {
        let my_device = self.get_my_device().await;
        self.discovery.start_discovery(app, my_device, duration_secs).await;
    }

    pub async fn stop_discovery(&self) {
        self.discovery.stop_discovery().await;
    }

    pub async fn is_discovering(&self) -> bool {
        self.discovery.is_discovering().await
    }

    pub async fn send_files(
        &self,
        app: AppHandle,
        target: LocalSendDevice,
        file_paths: Vec<String>,
    ) -> Result<String, LocalSendError> {
        let my_device = self.get_my_device().await;
        self.sender.send_files(app, my_device, target, file_paths).await
    }

    pub async fn send_text(
        &self,
        app: AppHandle,
        target: LocalSendDevice,
        text: String,
    ) -> Result<String, LocalSendError> {
        let my_device = self.get_my_device().await;
        self.sender.send_text(app, my_device, target, text).await
    }

    pub async fn cancel_transfer(&self, transfer_id: &str) {
        self.sender.cancel_transfer(transfer_id).await;
    }

    pub async fn accept_transfer(&self, session_id: &str) {
        println!("[LocalSend State] accept_transfer called for session_id: {}", session_id);
        let mut pendings = self.pending_confirmations.lock().await;
        if let Some(tx) = pendings.remove(session_id) {
            println!("[LocalSend State] Found pending confirmation channel for {}, sending true!", session_id);
            let _ = tx.send(true);
        } else {
            println!("[LocalSend State] Warning: No pending confirmation found for {}. Available keys: {:?}", session_id, pendings.keys().collect::<Vec<_>>());
        }
    }

    pub async fn reject_transfer(&self, session_id: &str) {
        println!("[LocalSend State] reject_transfer called for session_id: {}", session_id);
        let mut pendings = self.pending_confirmations.lock().await;
        if let Some(tx) = pendings.remove(session_id) {
            println!("[LocalSend State] Found pending confirmation channel for {}, sending false!", session_id);
            let _ = tx.send(false);
        }
        let mut sessions = self.incoming_sessions.write().await;
        sessions.remove(session_id);
    }

    pub async fn probe_ip(&self, app: AppHandle, ip: String) -> Result<LocalSendDevice, String> {
        let my_device = self.get_my_device().await;
        self.discovery.probe_ip(app, my_device, ip).await
    }
}
