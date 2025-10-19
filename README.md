# DynamicWin

<p align="center">
  <img src="https://img.shields.io/badge/c%23-%23239120.svg?style=for-the-badge&logo=csharp&logoColor=white">
  <a href="https://creativecommons.org/licenses/by-sa/4.0/"><img src="https://img.shields.io/static/v1?label=License&message=CC+BY-SA+4.0&color=%23c49b04&style=for-the-badge"></a>
  <a href="https://discord.gg/UHFuqB9NqR"><img src="https://dcbadge.limes.pink/api/server/https://discord.gg/UHFuqB9NqR)](https://discord.gg/UHFuqB9NqR"></a>
</p>

<p align="center">
  <img src="ReadmeFiles/preview.gif" style="border-radius:15px" alt="animated" width="1000" height="auto" />
</p>

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/FlorianButz/DynamicWin">DynamicWin</a> by <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://github.com/FlorianButz">Florian Butz</a> is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC BY-SA 4.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/sa.svg?ref=chooser-v1" alt=""></a></p>

### What is it?
A [Dynamic Island](https://support.apple.com/de-de/guide/iphone/iph28f50d10d/ios) inspired Windows App that brings in a bunch of features like widgets or a file tray that works like a clipboard.
Similar to dynamic notches that you can find on macOS like [NotchNook](https://lo.cafe/notchnook), this application brings the concept on Windows devices to life.

This project was made possible with [**FenUI**](https://github.com/FlorianButz/fenUISharp)

# Features
- A media controller
- - Favorites
- A calendar with Google Calendar integration
- File Tray
- - Files inside the Tray can be executed (e.g. a shortcut) with a double click
- - Files can be shared using the Windows File Share dialog
- - Files can be stored in the Tray for later use
- - ~~Shaking a currently dragged file will open a quick drop popup~~ (This had to be cut due to massive performance issues)
- Bluetooth view which shows the connected device and battery
- Activity system (Currently includes media player and BT view)
- - Spring notches (let you see or open an action which is not the current view)
- Swapping between views can be done by scrolling
- Auto updater

> [!NOTE] This repository currently only exists to host the releases. There is no source code here. 