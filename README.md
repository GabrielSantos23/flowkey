\# FlowKey



> \*\*A lightweight, customizable command center for Windows.\*\*



FlowKey is a lightweight Windows desktop application, built with \*\*Tauri\*\*, that allows users to create, customize, and execute commands for the applications they use every day.



Instead of forcing users to memorize dozens of shortcuts, FlowKey lets them \*\*define their own commands, aliases, hotkeys, and action sequences\*\*.



A command can be as simple as controlling Spotify — or as complex as creating an entire workflow involving multiple applications.



---



\## ✨ Features



\### 🎯 Custom Commands



Create commands and give them any name you want.



```text

"Next Song"

"Skip"

"Next"

"Music"

```



All of them can execute the same action:



```text

Spotify → Next Track

```



---



\### ⌨️ Custom Global Shortcuts



Assign your own keyboard shortcuts to any command.



```text

Ctrl + Alt + →

&nbsp;       ↓

Spotify → Next Track

```



Change the shortcut whenever you want without changing the underlying action.



---



\### 🔍 Command Palette



Quickly access your commands from anywhere in Windows.



Press your configured global shortcut and search for:



```text

┌──────────────────────────────────────┐

│ 🔍 Search commands...               │

├──────────────────────────────────────┤

│ 🎵 Next Song                         │

│ ⏮ Previous Song                     │

│ 🔊 Increase Volume                  │

│ 💻 Work Mode                        │

└──────────────────────────────────────┘

```



Search supports command names and custom aliases.



---



\### 🧩 Application Integrations



FlowKey uses a plugin-based architecture to integrate with different applications.



Initial integrations:



\* 🎵 Spotify

\* 🪟 Windows

\* 🌐 Chrome

\* 💬 Discord

\* 💻 VS Code



More integrations can be added through plugins.



---



\### ⚡ Macros



Combine multiple actions into a single command.



For example:



\*\*Work Mode\*\*



```text

1\. Spotify → Pause

2\. Discord → Do Not Disturb

3\. VS Code → Open

4\. Windows → Enable Focus Mode

```



Then execute everything with:



```text

Ctrl + Alt + W

```



---



\### 🏷️ Aliases



Give commands multiple names.



```text

Command:

&nbsp;   Next Song



Aliases:

&nbsp;   next

&nbsp;   skip

&nbsp;   next music

&nbsp;   pular

&nbsp;   próxima

```



Searching for any of these terms will find the same command.



---



\### 🖥️ System Tray



FlowKey runs quietly in the Windows system tray.



It stays out of the way until you need it.



```text

Windows

&nbsp;  ↓

System Tray

&nbsp;  ↓

FlowKey

```



---



\### 💾 Local First



FlowKey is designed to work completely locally.



No account is required.



No cloud backend is required.



Your commands and configuration remain stored on your machine.



---



\# 🧠 How It Works



FlowKey is built around three main concepts:



```text

Command

&nbsp;  │

&nbsp;  ├── Name

&nbsp;  ├── Aliases

&nbsp;  ├── Shortcut

&nbsp;  │

&nbsp;  └── Actions

&nbsp;         │

&nbsp;         ├── Spotify → Next Track

&nbsp;         ├── Windows → Volume Up

&nbsp;         └── Chrome → New Tab

```



\### Command



The user-facing definition of what they want to do.



Example:



```text

"Next Song"

```



\### Action



A specific operation provided by an application plugin.



```text

Spotify → Next Track

```



\### Shortcut



A keyboard combination that executes a command.



```text

Ctrl + Alt + →

```



This separation allows users to change the way commands are triggered without modifying the actions themselves.



---



\# 🧩 Plugin Architecture



One of the main goals of FlowKey is to make integrations modular.



Each application is represented by a plugin.



```text

plugins/

│

├── spotify/

│   ├── manifest.json

│   └── index.ts

│

├── windows/

│   ├── manifest.json

│   └── index.ts

│

├── chrome/

│   ├── manifest.json

│   └── index.ts

│

└── discord/

&nbsp;   ├── manifest.json

&nbsp;   └── index.ts

```



A plugin defines the actions that it provides.



Example:



```json

{

&nbsp; "name": "Spotify",

&nbsp; "id": "spotify",

&nbsp; "version": "1.0.0",

&nbsp; "actions": \[

&nbsp;   {

&nbsp;     "id": "play\_pause",

&nbsp;     "name": "Play / Pause"

&nbsp;   },

&nbsp;   {

&nbsp;     "id": "next",

&nbsp;     "name": "Next Track"

&nbsp;   },

&nbsp;   {

&nbsp;     "id": "previous",

&nbsp;     "name": "Previous Track"

&nbsp;   }

&nbsp; ]

}

```



The core application doesn't need to know the implementation details of every application.



It only needs to know:



```text

Plugin

&nbsp;   ↓

Available Actions

&nbsp;   ↓

User Commands

```



---



\# 🏗️ Architecture



```text

┌───────────────────────────────────────┐

│              React UI                 │

│                                       │

│  Command Palette                     │

│  Command Editor                      │

│  Settings                            │

│  Plugin Manager                      │

└───────────────────┬───────────────────┘

&nbsp;                   │

&nbsp;                   ▼

┌───────────────────────────────────────┐

│            FlowKey Core               │

│                                       │

│  Command Manager                     │

│  Shortcut Manager                    │

│  Macro Engine                        │

│  Plugin Manager                      │

│  Search Engine                       │

└───────────────────┬───────────────────┘

&nbsp;                   │

&nbsp;                   ▼

┌───────────────────────────────────────┐

│                Rust                   │

│                                       │

│  Global Hotkeys                      │

│  Windows APIs                        │

│  Process Management                  │

│  System Tray                         │

│  Native OS Operations                │

└───────────────────┬───────────────────┘

&nbsp;                   │

&nbsp;         ┌─────────┼─────────┐

&nbsp;         ▼         ▼         ▼

&nbsp;      Spotify   Windows    Chrome

&nbsp;      Plugin     Plugin     Plugin

```



---



\# 🛠️ Tech Stack



\### Desktop



\* \*\*Tauri 2\*\*

\* \*\*Rust\*\*



\### Frontend



\* \*\*React\*\*

\* \*\*TypeScript\*\*

\* \*\*Vite\*\*



\### Storage



\* \*\*SQLite\*\*



\### Windows



\* Windows APIs

\* Global keyboard shortcuts

\* System tray

\* Process management

\* Native media controls



---



\# 📂 Project Structure



```text

flowkey/

│

├── src/

│   ├── components/

│   ├── pages/

│   ├── hooks/

│   ├── stores/

│   ├── services/

│   └── types/

│

├── src-tauri/

│   ├── src/

│   │   ├── commands/

│   │   ├── hotkeys/

│   │   ├── plugins/

│   │   ├── system/

│   │   └── main.rs

│   │

│   └── tauri.conf.json

│

├── plugins/

│   ├── spotify/

│   ├── windows/

│   └── chrome/

│

├── database/

│   └── migrations/

│

└── README.md

```



---



\# 🚀 Getting Started



\## Requirements



\* Windows 10/11

\* Node.js

\* Rust

\* Tauri prerequisites



\## Installation



Clone the repository:



```bash

git clone https://github.com/yourusername/flowkey.git

```



Enter the project:



```bash

cd flowkey

```



Install dependencies:



```bash

npm install

```



Run the development environment:



```bash

npm run tauri dev

```



Build the application:



```bash

npm run tauri build

```



The generated Windows installer will be available in:



```text

src-tauri/target/release/bundle/

```



---

# 🗺️ Roadmap

## Phase 1 — Core

* [x] Basic desktop interface
* [x] System tray
* [x] Command creation
* [x] Command editing
* [x] Command deletion
* [x] SQLite persistence
* [x] Global shortcuts
* [x] Command Palette

## Phase 2 — Actions

* [x] Windows actions
* [x] Spotify integration
* [x] Application launching
* [x] Process management
* [x] Media controls

## Phase 3 — Customization

* [x] Custom command names
* [x] Aliases
* [x] Custom shortcuts
* [x] Favorites
* [x] Command categories
* [x] Drag & drop action ordering

## Phase 4 — Automation

* [x] Multiple actions per command
* [x] Action sequences
* [x] Delays between actions
* [x] Conditional actions
* [x] Workflow editor

## Phase 5 — Plugins

* [x] Plugin API
* [x] Plugin SDK
* [x] Plugin installation
* [x] Plugin management
* [x] Community plugins

---


\# 🔒 Privacy



FlowKey is designed with a \*\*local-first architecture\*\*.



The application does not require:



\* An account

\* A cloud backend

\* A subscription

\* Constant internet access



User-created commands and settings are stored locally.



---



\# 🎯 Project Goals



FlowKey aims to be:



\*\*Lightweight\*\*



> Minimal resource usage and fast startup.



\*\*Customizable\*\*



> Users decide how commands are named, triggered, and executed.



\*\*Extensible\*\*



> New applications can be integrated through plugins.



\*\*Local\*\*



> Core functionality works without a cloud service.



\*\*Simple\*\*



> Powerful automation without an unnecessarily complicated interface.



---



\# 📌 Example



A user wants a shortcut for Spotify.



They create:



```text

Name:

Skip



Aliases:

next

pular

próxima



Shortcut:

Ctrl + Alt + →

```



And assign:



```text

Spotify

└── Next Track

```



Now:



```text

Ctrl + Alt + →

&nbsp;       ↓

&nbsp;     Skip

&nbsp;       ↓

Spotify → Next Track

```



Later, they can change the command to:



```text

Ctrl + Shift + N

```



or rename it to:



```text

Next Song

```



without having to recreate the action.



---



\# 🤝 Contributing



Contributions, plugins, bug reports, and feature requests are welcome.



If you want to add support for a new application, the preferred approach is to create a new FlowKey plugin rather than modifying the core.



```text

New Integration

&nbsp;     ↓

Create Plugin

&nbsp;     ↓

Define Actions

&nbsp;     ↓

Register Plugin

&nbsp;     ↓

Available in FlowKey

```



---



\# 📄 License



This project is licensed under the MIT License.



---



<div align="center">



\*\*FlowKey\*\*



\*Your computer. Your commands. Your shortcuts.\*



</div>

