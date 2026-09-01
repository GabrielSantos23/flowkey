use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter};
use crate::localsend::device::{InfoDto, LocalSendDevice, RegisterDto};

pub const LOCALSEND_MULTICAST_GROUP: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 167);
pub const LOCALSEND_PORT: u16 = 53317;

pub struct DiscoveryManager {
    devices: Arc<RwLock<HashMap<String, LocalSendDevice>>>,
    is_discovering: Arc<RwLock<bool>>,
    cert_pem: String,
    key_pem: String,
}

impl DiscoveryManager {
    pub fn new(devices: Arc<RwLock<HashMap<String, LocalSendDevice>>>, cert_pem: String, key_pem: String) -> Self {
        Self {
            devices,
            is_discovering: Arc::new(RwLock::new(false)),
            cert_pem,
            key_pem,
        }
    }

    /// Continuous background UDP listener on port 53317 to catch external announcements
    pub fn start_background_listener(&self, app: AppHandle, my_device: Arc<RwLock<LocalSendDevice>>) {
        let devices_store = self.devices.clone();
        let cert_pem = self.cert_pem.clone();
        let key_pem = self.key_pem.clone();

        // 1. Periodic background announcement broadcaster (heartbeat every 12s)
        let my_dev_bcast = my_device.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let dev = my_dev_bcast.read().await.clone();
                let announcement = RegisterDto {
                    alias: dev.alias,
                    version: "2.1".to_string(),
                    device_model: dev.device_model,
                    device_type: dev.device_type,
                    fingerprint: dev.fingerprint,
                    port: dev.port,
                    protocol: dev.protocol,
                    download: true,
                    announce: Some(true),
                };
                if let Ok(json) = serde_json::to_string(&announcement) {
                    send_announcements(&json).await;
                }
                tokio::time::sleep(Duration::from_secs(12)).await;
            }
        });

        // 2. Periodic background HTTP/HTTPS subnet scanner (handles Wi-Fi routers blocking UDP multicast)
        let my_dev_subnet = my_device.clone();
        let devices_sub = devices_store.clone();
        let app_sub = app.clone();
        let cert_sub = cert_pem.clone();
        let key_sub = key_pem.clone();
        tauri::async_runtime::spawn(async move {
            // Initial scan after 1s
            tokio::time::sleep(Duration::from_secs(1)).await;
            loop {
                let dev = my_dev_subnet.read().await.clone();
                scan_subnet_fallback(
                    devices_sub.clone(),
                    app_sub.clone(),
                    dev,
                    cert_sub.clone(),
                    key_sub.clone(),
                )
                .await;
                tokio::time::sleep(Duration::from_secs(20)).await;
            }
        });

        // 2. Continuous UDP receiver
        tauri::async_runtime::spawn(async move {
            let socket_result = create_multicast_socket().await;
            if let Ok(socket) = socket_result {
                let mut buf = [0u8; 8192];
                loop {
                    if let Ok((len, src)) = socket.recv_from(&mut buf).await {
                        if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                            if let Ok(reg) = serde_json::from_str::<RegisterDto>(text) {
                                let my_dev = my_device.read().await.clone();
                                if reg.fingerprint != my_dev.fingerprint {
                                    let device_ip = src.ip().to_string();
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

                                    let mut store = devices_store.write().await;
                                    let is_new = !store.contains_key(&device.fingerprint);
                                    store.insert(device.fingerprint.clone(), device.clone());

                                    if is_new {
                                        let _ = app.emit("localsend://device-found", &device);
                                    } else {
                                        let _ = app.emit("localsend://device-updated", &device);
                                    }

                                    // If announcement asks for response, reply back via HTTP register
                                    if reg.announce.unwrap_or(true) {
                                        let my_dev_clone = my_dev.clone();
                                        let target_protocol = reg.protocol.clone();
                                        let target_ip_clone = device_ip.clone();
                                        let target_port = reg.port;
                                        let client = crate::localsend::build_reqwest_client(&cert_pem, &key_pem);

                                        tauri::async_runtime::spawn(async move {
                                            let reply_url = format!(
                                                "{}://{}:{}/api/localsend/v2/register",
                                                target_protocol, target_ip_clone, target_port
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

                                            let _ = client.post(&reply_url).json(&back_dto).timeout(std::time::Duration::from_secs(3)).send().await;
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                eprintln!("[LocalSend] Could not bind background UDP listener on port 53317");
            }
        });
    }

    pub async fn is_discovering(&self) -> bool {
        *self.is_discovering.read().await
    }

    pub async fn stop_discovery(&self) {
        let mut disc = self.is_discovering.write().await;
        *disc = false;
    }

    pub async fn start_discovery(
        &self,
        app: AppHandle,
        my_device: LocalSendDevice,
        duration_secs: u64,
    ) {
        {
            let mut disc = self.is_discovering.write().await;
            if *disc {
                return;
            }
            *disc = true;
        }

        let is_discovering_flag = self.is_discovering.clone();
        let devices_store = self.devices.clone();
        let cert_pem = self.cert_pem.clone();
        let key_pem = self.key_pem.clone();

        tauri::async_runtime::spawn(async move {
            let start_time = Instant::now();
            let discovery_duration = Duration::from_secs(duration_secs);

            let announcement = RegisterDto {
                alias: my_device.alias.clone(),
                version: "2.1".to_string(),
                device_model: my_device.device_model.clone(),
                device_type: my_device.device_type.clone(),
                fingerprint: my_device.fingerprint.clone(),
                port: my_device.port,
                protocol: my_device.protocol.clone(),
                download: true,
                announce: Some(true),
            };

            let announcement_json = serde_json::to_string(&announcement).unwrap_or_default();

            // 1. Broadcast immediately to all network interfaces (multicast + broadcast)
            send_announcements(&announcement_json).await;

            // 2. Concurrently scan local /24 subnet via HTTP & HTTPS
            let devices_subnet = devices_store.clone();
            let app_subnet = app.clone();
            let my_device_clone = my_device.clone();
            let cert_clone = cert_pem.clone();
            let key_clone = key_pem.clone();
            tauri::async_runtime::spawn(async move {
                scan_subnet_fallback(devices_subnet, app_subnet, my_device_clone, cert_clone, key_clone).await;
            });

            // 3. Repeat announcement every 1.5s during discovery window
            while start_time.elapsed() < discovery_duration {
                if !*is_discovering_flag.read().await {
                    break;
                }

                send_announcements(&announcement_json).await;
                tokio::time::sleep(Duration::from_millis(1500)).await;
            }

            // Conclude discovery
            let mut disc = is_discovering_flag.write().await;
            *disc = false;
            let _ = app.emit("localsend://discovery-finished", ());
        });
    }

    /// Direct single IP probe (Manual IP Connect)
    pub async fn probe_ip(&self, app: AppHandle, my_device: LocalSendDevice, ip: String) -> Result<LocalSendDevice, String> {
        let client = crate::localsend::build_reqwest_client(&self.cert_pem, &self.key_pem);

        // 1. Try HTTPS
        let https_url = format!("https://{}:{}/api/localsend/v2/info", ip, LOCALSEND_PORT);
        match client.get(&https_url).send().await {
            Ok(resp) => {
                match resp.json::<InfoDto>().await {
                    Ok(info) => {
                        let device = LocalSendDevice {
                            alias: info.alias,
                            version: Some(info.version),
                            device_model: info.device_model,
                            device_type: info.device_type,
                            fingerprint: info.fingerprint.clone(),
                            port: LOCALSEND_PORT,
                            protocol: "https".to_string(),
                            download: Some(info.download),
                            announce: None,
                            ip: ip.clone(),
                            last_seen: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64,
                        };

                        let mut store = self.devices.write().await;
                        store.insert(device.fingerprint.clone(), device.clone());
                        let _ = app.emit("localsend://device-found", &device);

                        // Register ourselves with target
                        let reg_url = format!("https://{}:{}/api/localsend/v2/register", ip, LOCALSEND_PORT);
                        let reg_dto = RegisterDto {
                            alias: my_device.alias.clone(),
                            version: "2.1".to_string(),
                            device_model: my_device.device_model.clone(),
                            device_type: my_device.device_type.clone(),
                            fingerprint: my_device.fingerprint.clone(),
                            port: my_device.port,
                            protocol: my_device.protocol.clone(),
                            download: true,
                            announce: Some(false),
                        };
                        let _ = client.post(&reg_url).json(&reg_dto).send().await;

                        return Ok(device);
                    }
                    Err(e) => {
                        println!("[LocalSend] HTTPS json parse error: {:?}", e);
                    }
                }
            }
            Err(e) => {
                println!("[LocalSend] HTTPS request error: {:?}", e);
            }
        }

        // 2. Try HTTP
        let http_url = format!("http://{}:{}/api/localsend/v2/info", ip, LOCALSEND_PORT);
        match client.get(&http_url).send().await {
            Ok(resp) => {
                match resp.json::<InfoDto>().await {
                    Ok(info) => {
                        let device = LocalSendDevice {
                            alias: info.alias,
                            version: Some(info.version),
                            device_model: info.device_model,
                            device_type: info.device_type,
                            fingerprint: info.fingerprint.clone(),
                            port: LOCALSEND_PORT,
                            protocol: "http".to_string(),
                            download: Some(info.download),
                            announce: None,
                            ip: ip.clone(),
                            last_seen: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64,
                        };

                        let mut store = self.devices.write().await;
                        store.insert(device.fingerprint.clone(), device.clone());
                        let _ = app.emit("localsend://device-found", &device);

                        let reg_url = format!("http://{}:{}/api/localsend/v2/register", ip, LOCALSEND_PORT);
                        let reg_dto = RegisterDto {
                            alias: my_device.alias,
                            version: "2.1".to_string(),
                            device_model: my_device.device_model,
                            device_type: my_device.device_type,
                            fingerprint: my_device.fingerprint,
                            port: my_device.port,
                            protocol: my_device.protocol,
                            download: true,
                            announce: Some(false),
                        };
                        let _ = client.post(&reg_url).json(&reg_dto).send().await;

                        return Ok(device);
                    }
                    Err(e) => {
                        println!("[LocalSend] HTTP json parse error: {:?}", e);
                    }
                }
            }
            Err(e) => {
                println!("[LocalSend] HTTP request error: {:?}", e);
            }
        }

        Err(format!("Could not connect to LocalSend at {}", ip))
    }
}

async fn send_announcements(announcement_json: &str) {
    use socket2::{Domain, Protocol, Socket, Type};

    let Ok(socket) = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP)) else {
        return;
    };
    let _ = socket.set_nonblocking(true);
    let _ = socket.set_broadcast(true);
    let _ = socket.set_multicast_loop_v4(true);
    let bind_addr: SocketAddr = "0.0.0.0:0".parse().unwrap();
    let _ = socket.bind(&bind_addr.into());

    let std_socket: std::net::UdpSocket = socket.into();
    let Ok(udp) = tokio::net::UdpSocket::from_std(std_socket) else {
        return;
    };

    let target_multicast = SocketAddrV4::new(LOCALSEND_MULTICAST_GROUP, LOCALSEND_PORT);
    let target_broadcast = SocketAddrV4::new(Ipv4Addr::new(255, 255, 255, 255), LOCALSEND_PORT);
    let bytes = announcement_json.as_bytes();

    let _ = udp.send_to(bytes, target_multicast).await;
    let _ = udp.send_to(bytes, target_broadcast).await;

    // Send subnet-specific broadcasts for each active interface
    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in interfaces {
            if let std::net::IpAddr::V4(ipv4) = ip {
                if !ipv4.is_loopback() {
                    let oct = ipv4.octets();
                    let subnet_bcast = SocketAddrV4::new(Ipv4Addr::new(oct[0], oct[1], oct[2], 255), LOCALSEND_PORT);
                    let _ = udp.send_to(bytes, subnet_bcast).await;
                }
            }
        }
    }
}

async fn create_multicast_socket() -> Result<tokio::net::UdpSocket, std::io::Error> {
    use socket2::{Domain, Protocol, Socket, Type};

    let socket = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    socket.set_reuse_address(true)?;
    #[cfg(unix)]
    let _ = socket.set_reuse_port(true);
    let _ = socket.set_broadcast(true);
    let _ = socket.set_multicast_loop_v4(true);
    socket.set_nonblocking(true)?;

    let bind_addr: SocketAddr = format!("0.0.0.0:{}", LOCALSEND_PORT).parse().unwrap();
    socket.bind(&bind_addr.into())?;

    let multi_addr = LOCALSEND_MULTICAST_GROUP;
    let any_addr = Ipv4Addr::new(0, 0, 0, 0);
    let _ = socket.join_multicast_v4(&multi_addr, &any_addr);

    // Join multicast on all active IPv4 interfaces
    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in interfaces {
            if let std::net::IpAddr::V4(ipv4) = ip {
                if !ipv4.is_loopback() {
                    let _ = socket.join_multicast_v4(&multi_addr, &ipv4);
                    let _ = socket.set_multicast_if_v4(&ipv4);
                }
            }
        }
    }

    let std_socket: std::net::UdpSocket = socket.into();
    tokio::net::UdpSocket::from_std(std_socket)
}

/// Fallback HTTP/HTTPS scanner querying `/api/localsend/v2/info` across active subnets
async fn scan_subnet_fallback(
    devices_store: Arc<RwLock<HashMap<String, LocalSendDevice>>>,
    app: AppHandle,
    my_device: LocalSendDevice,
    cert_pem: String,
    key_pem: String,
) {
    let client = crate::localsend::build_reqwest_client(&cert_pem, &key_pem);

    let mut active_ips: Vec<Ipv4Addr> = Vec::new();
    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in interfaces {
            if let std::net::IpAddr::V4(ipv4) = ip {
                if !ipv4.is_loopback() {
                    active_ips.push(ipv4);
                }
            }
        }
    }

    if active_ips.is_empty() {
        if let Ok(std::net::IpAddr::V4(ipv4)) = local_ip_address::local_ip() {
            active_ips.push(ipv4);
        }
    }

    for local_ip in active_ips {
        let octets = local_ip.octets();
        let mut handles = Vec::new();

        for last_octet in 1..=254 {
            if last_octet == octets[3] {
                continue;
            }

            let target_ip = format!("{}.{}.{}.{}", octets[0], octets[1], octets[2], last_octet);
            let client_clone = client.clone();
            let devices_clone = devices_store.clone();
            let app_clone = app.clone();
            let my_dev_clone = my_device.clone();

            handles.push(tauri::async_runtime::spawn(async move {
                // 1. Try HTTPS probe
                let https_url = format!("https://{}:{}/api/localsend/v2/info", target_ip, LOCALSEND_PORT);
                if let Ok(resp) = client_clone.get(&https_url).send().await {
                    if let Ok(info) = resp.json::<InfoDto>().await {
                        let device = LocalSendDevice {
                            alias: info.alias,
                            version: Some(info.version),
                            device_model: info.device_model,
                            device_type: info.device_type,
                            fingerprint: info.fingerprint.clone(),
                            port: LOCALSEND_PORT,
                            protocol: "https".to_string(),
                            download: Some(info.download),
                            announce: None,
                            ip: target_ip.clone(),
                            last_seen: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64,
                        };

                        let mut store = devices_clone.write().await;
                        let is_new = !store.contains_key(&device.fingerprint);
                        store.insert(device.fingerprint.clone(), device.clone());

                        if is_new {
                            let _ = app_clone.emit("localsend://device-found", &device);
                        }

                        let register_url = format!("https://{}:{}/api/localsend/v2/register", target_ip, LOCALSEND_PORT);
                        let reg_dto = RegisterDto {
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
                        let _ = client_clone.post(&register_url).json(&reg_dto).send().await;
                        return;
                    }
                }

                // 2. Fallback to HTTP probe
                let http_url = format!("http://{}:{}/api/localsend/v2/info", target_ip, LOCALSEND_PORT);
                if let Ok(resp) = client_clone.get(&http_url).send().await {
                    if let Ok(info) = resp.json::<InfoDto>().await {
                        let device = LocalSendDevice {
                            alias: info.alias,
                            version: Some(info.version),
                            device_model: info.device_model,
                            device_type: info.device_type,
                            fingerprint: info.fingerprint.clone(),
                            port: LOCALSEND_PORT,
                            protocol: "http".to_string(),
                            download: Some(info.download),
                            announce: None,
                            ip: target_ip.clone(),
                            last_seen: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64,
                        };

                        let mut store = devices_clone.write().await;
                        let is_new = !store.contains_key(&device.fingerprint);
                        store.insert(device.fingerprint.clone(), device.clone());

                        if is_new {
                            let _ = app_clone.emit("localsend://device-found", &device);
                        }

                        let register_url = format!("http://{}:{}/api/localsend/v2/register", target_ip, LOCALSEND_PORT);
                        let reg_dto = RegisterDto {
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
                        let _ = client_clone.post(&register_url).json(&reg_dto).send().await;
                    }
                }
            }));
        }

        let _ = futures_util::future::join_all(handles).await;
    }
}
