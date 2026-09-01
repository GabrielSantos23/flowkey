# FlowKey

<p align="center">
  <img src="https://img.shields.io/badge/Rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white">
  <img src="https://img.shields.io/badge/Tauri-2.0-%2324C8D8.svg?style=for-the-badge&logo=tauri&logoColor=white">
  <img src="https://img.shields.io/badge/React-18-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB">
  <img src="https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/Tailwind_CSS-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white">
</p>

### What is it?
A [Dynamic Island](https://support.apple.com/en-us/guide/iphone/iph28f50d10d/ios) and macOS Dynamic Notch inspired desktop overlay built with **Tauri 2 (Rust) + React (TypeScript + Framer Motion + Tailwind CSS)**.

FlowKey brings widgets, music controls, system telemetry, and an interactive file tray clipboard directly into a sleek, physics-animated floating island or top-anchored notch. Cross-platform support for **Linux (KDE / GNOME / Wayland / X11)** and **Windows (10 / 11)**.

---

## ✨ Features

- **🏝️ Dynamic Island & Notch Modes**:
  - Floating pill (Dynamic Island) or top-anchored notch with smooth Bézier curvature (MacBook Notch).
  - Physics-based spring animations with second-order dynamics and backdrop glassmorphism.
- **🎵 Media Controller & Spectrum Visualizer**:
  - Live track, artist, album, and status from Spotify and system media players.
  - Interactive playback controls (Play/Pause, Previous, Next).
  - Real-time animated audio frequency visualizer spectrum.
- **🌦️ Live Weather & Forecast**:
  - Automatic geolocation lookup via Geo-IP and Open-Meteo API.
  - Temperature display with one-click °C / °F switching and location privacy toggle.
- **⏱️ Digital Stopwatch & Countdown Timer**:
  - Interactive time steppers with up/down controls.
  - Timer Over alert HUD overlay with audio chime synthesis.
- **🚀 Quick Launch Shortcuts**:
  - 4 customizable slots for launching applications, folders, scripts, or web URLs.
- **📁 File Tray Clipboard**:
  - Drag and drop files directly onto the island to store them in your local tray clipboard.
  - Open files in default programs, reveal in system file manager, or remove items.
- **📊 System Telemetry (Small Widgets)**:
  - Real-time CPU % load and RAM GB usage via Rust `sysinfo`.
  - Battery percentage, charging indicators, and AC power status.
  - Microphone & Webcam activity detection dots.
  - Digital clock and active countdown timer pill.
- **🎨 Customization & Theme Engine**:
  - Built-in presets: **Dark**, **Light**, **Candy**, **Forest Dawn**, **Sunset Glow**.
  - Live Custom JSON Theme palette editor with real-time CSS variable injection.
  - Custom slot manager to position small widgets on Left, Middle, or Right sections.

---

## 🛠️ Development & Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/) (1.78+)
- [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/)
- System dependencies:
  - **Linux (Debian/Ubuntu)**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - **Linux (Arch)**: `sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl gtk3 libayatana-appindicator`
  - **Windows / macOS**: Supported out of the box.

### Quick Start

```bash
# 1. Install dependencies
bun install
# or: npm install

# 2. Run in development mode
bun run tauri dev
# or: npm run tauri dev

# 3. Build standalone binary
bun run tauri build
# or: npm run tauri build
```

---

## 📂 Project Structure

```
├── public/                 # Assets (audio chimes, icons, fonts)
│   ├── icons/
│   └── sounds/
├── src/                    # React Frontend
│   ├── components/         # Dynamic Island, Notch curves, overlays
│   │   ├── overlays/       # Volume, Brightness, Timer Over, Drop zone
│   │   ├── settings/       # Settings modal, Theme editor, Slot manager
│   │   ├── tray/           # File Tray clipboard
│   │   └── widgets/        # Small & Big widgets (Media, Weather, Timer, Shortcuts)
│   ├── context/            # Theme & Settings providers
│   ├── types/              # TypeScript definitions
│   └── utils/              # Sound synthesis & theme presets
└── src-tauri/              # Rust Backend
    ├── capabilities/       # Tauri v2 security & permissions
    ├── src/
    │   ├── commands/       # Hardware, Battery, Media, Weather, Tray, Shortcuts, Settings
    │   ├── lib.rs          # Tauri plugins, System Tray, command handlers
    │   └── main.rs         # Application entry point
    └── tauri.conf.json     # Window, transparent overlay, and tray config
```