<p align="center">
  <img src="public/icons/icon-512.png" width="160" height="160" alt="LinkSpeed Pro Logo" />
</p>

<h1 align="center">LinkSpeed Pro</h1>

<p align="center">
  <strong>USB Cable Negotiated Speed &amp; Hardware Link Inspector (PWA)</strong><br />
  Inspect physical USB negotiated link speeds, detect charge-only cable bottlenecks, and explore complete hardware topology trees just like macOS System Report.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Link%20Speed-Up%20to%2040%20Gb%2Fs-00f0ff?style=flat-square" alt="Link Speed" />
  <img src="https://img.shields.io/badge/PWA-Installable-10b981?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-3b82f6?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square" alt="License" />
</p>

---

## 🚀 Quick Start

Ensure Node.js (v18+) is installed on your system.

### 🍎 On macOS:

**Option 1 — 1-Click Finder Launcher (Easiest)**:
- Open Finder, navigate to the folder, and double-click:
  👉 **`LinkSpeed-Pro.command`**  
  *(Automatically opens Terminal, starts the daemon, and launches your browser to `http://localhost:4321`)*

**Option 2 — Terminal / Zero-Setup**:
```bash
# Direct run from anywhere (no clone needed):
npx github:rco-Tech/linkspeed-PRO

# Or if you already cloned the repo:
cd ~/Projects/active-link-speed && ./start.sh
```

**Option 3 — Add to macOS Dock as a Native App**:
1. Open `http://localhost:4321` in **Safari** or **Chrome**.
2. In **Safari**: Click `File` ➔ `Add to Dock...` (or in **Chrome**: Click the Install icon in the address bar).
3. LinkSpeed Pro now opens in its own frameless window directly from your Dock!

---

### 🐧 On Linux:

```bash
cd /home/robert/Projects/active-link-speed
./start.sh
```

Then open your browser to:
👉 **[http://localhost:4321](http://localhost:4321)**

---

## 🎯 How to Test a USB Cable for Speed & Bottlenecks

1. **Open the Cable Workbench**: Go to `http://localhost:4321` in your browser.
2. **Connect a Fast Peripheral**: Take a high-speed external USB-C SSD (e.g., Samsung T7, SanDisk Extreme, NVMe enclosure) or USB 3.x drive.
3. **Plug It In Using the Mystery Cable**: Plug the peripheral into your computer using the USB-C cable you want to test.
4. **Instant Link Analysis**:
   - **Full Speed (10 Gb/s or 5 Gb/s)**: The app chimes and confirms:  
     `⚡ Optimal Speed Verified: 10 Gb/s SuperSpeed+ (Gen 2). High-speed data lanes verified.`
   - **Bottleneck (480 Mb/s)**: If your 10 Gb/s SSD only negotiates at 480 Mb/s, LinkSpeed Pro highlights a high-visibility warning:  
     `🚨 USB Cable Bottleneck Detected! Hardware reports USB 3.2 capability, but negotiated at only 480 Mb/s. Your cable is a charge-only cable without SuperSpeed data lines!`

---

## 💻 Features

- **Real-Time Sub-Second Hotplug Detection**: Streams live hardware events via Server-Sent Events (SSE). Plugging or unplugging a cable triggers instant UI updates and audio chimes.
- **Dynamic Speedometer Gauge**: Visual representation of physical link speed across all tiers:
  - ⚡ **40 Gb/s**: USB4 / Thunderbolt 4
  - 🟣 **20 Gb/s**: USB 3.2 Gen 2x2
  - 🔵 **10 Gb/s**: USB 3.2 Gen 2 (SuperSpeed+)
  - 🟢 **5 Gb/s**: USB 3.2 Gen 1 (SuperSpeed)
  - 🟡 **480 Mb/s**: USB 2.0 (High-Speed / Charge Cable)
  - ⚪ **12 Mb/s / 1.5 Mb/s**: Full-Speed & Low-Speed peripherals
- **macOS System Report Tree**: Full hierarchical tree of Host Controllers, Root Hubs, External Hubs, and connected devices.
- **Deep Inspector Drawer**: Slide-over drawer with raw descriptor details:
  - Negotiated Speed vs Device Descriptor (`bcdUSB`)
  - Bus Power Draw (`bMaxPower` in mA)
  - Vendor ID (VID), Product ID (PID) with vendor lookup
  - Serial Number, Firmware Revision (`bcdDevice`)
  - Bus path, device number, sysfs location
  - One-click JSON hardware report export
- **Installable PWA**: Progressive Web App with offline service worker, custom dark-mode design, and one-click desktop app installation.
- **Built-in Cable Simulator**: Test the interface with simulated 480 Mb/s bottleneck cables and 40 Gb/s Thunderbolt drives anytime from the top bar.

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Installable PWA Frontend                   │
│   (Cable Workbench · Speedometer · System Report Tree)   │
└───────────────────────────▲─────────────────────────────┘
                            │  SSE Stream / REST API
┌───────────────────────────┴─────────────────────────────┐
│             Local Native Bridge (server.js)             │
│            Runs locally on http://localhost:4321        │
└───────────────────────────▲─────────────────────────────┘
                            │  Kernel Hardware Queries
    ┌───────────────────────┴───────────────────────┐
    │                                               │
┌───┴─────────────────────────┐   ┌─────────────────┴─────────────────┐
│     Linux Kernel Engine     │   │        macOS Kernel Engine        │
│  /sys/bus/usb/devices/      │   │  system_profiler SPUSBDataType    │
│  /sys/bus/thunderbolt/      │   │  SPThunderboltDataType            │
└─────────────────────────────┘   └───────────────────────────────────┘
```

---

## 📄 License
MIT
