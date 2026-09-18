# Contributing to LinkSpeed Pro

Thank you for your interest in contributing to **LinkSpeed Pro**! We welcome bug reports, feature suggestions, and pull requests.

## Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/rco-Tech/linkspeed-PRO.git
   cd linkspeed-PRO
   ```

2. **Start the local server:**
   ```bash
   npm start
   # or for live restart on edit:
   npm run dev
   ```

3. **Open the app:**
   Visit `http://localhost:4321` in your browser.

## Code Standards
- **Zero External Dependencies**: The backend uses native Node.js APIs (`http`, `fs`, `child_process`, `os`) to remain lightweight and instant to run.
- **Vanilla Modern JavaScript & CSS**: We use standard Web APIs, CSS variables, and modern syntax without bloated frameworks.
- **Cross-Platform Compatibility**: Hardware queries should gracefully support Linux (`/sys/bus/usb`, `/sys/bus/thunderbolt`) and macOS (`system_profiler`).

## Submitting Pull Requests
1. Create a feature branch (`git checkout -b feature/awesome-speed-metric`).
2. Test your changes on live hardware or with the built-in simulator.
3. Commit your changes with clear, descriptive commit messages.
4. Push to your branch and open a Pull Request against `main`.
