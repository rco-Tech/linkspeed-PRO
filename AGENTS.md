# LinkSpeed Pro — Development & Agent Guidelines

## 🚀 Release & Versioning Protocol (MANDATORY RULE)

Whenever releasing or preparing any new version (e.g., `vX.Y.Z`) of LinkSpeed Pro, you MUST strictly adhere to the following sequence:

### 1. Synchronize Version Strings Across All Required Files
Ensure that the version number is updated synchronously in all of these files:
- **`package.json`**: `"version": "X.Y.Z"`
- **`package-lock.json`**: `"version": "X.Y.Z"` (both root and `packages[""]`)
- **`electron-main.js`**: `title: 'LinkSpeed Pro vX.Y.Z'`
- **`public/index.html`**:
  - `#btnBrandVersion`: button text and title attribute (`vX.Y.Z`)
  - `.brand-badge.version-pill`: text (`vX.Y.Z`)
  - `#aboutReleaseVer`: text (`vX.Y.Z (Production)`)
- **`public/sw.js`**: `const CACHE_NAME = 'linkspeed-pro-vX.Y.Z';`

### 2. Validate Native Windows Scanner
- If `src/scanner-windows.cs` was modified, recompile the Windows native binary:
  ```powershell
  npm run compile:scanner
  ```
- Verify that `bin/linkspeed-win-scanner.exe` is present and staged.

### 3. Commit and Push to `main`
```bash
git add -A
git commit -m "chore: bump version to vX.Y.Z"
git push origin main
```

### 4. Create and Push the Release Git Tag (GitHub Releases Trigger)
GitHub Releases are automated via `.github/workflows/release.yml` which triggers on any tag matching `v*`. Creating and pushing the tag is required for the release to appear on GitHub:
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z: <Release Title & Summary>"
git push origin vX.Y.Z
```

### 5. Verify GitHub Actions Release Workflow
- The push triggers GitHub Actions runner jobs for:
  - macOS (Apple Silicon arm64 & Intel x64 DMG and ZIP)
  - Linux (x64 AppImage and DEB)
  - Windows (NSIS 1-Click Setup Installer, Portable Executable, and `dist/latest.yml`)
- Verify that the workflow runs and publishes the assets to:
  👉 **https://github.com/rco-Tech/linkspeed-PRO/releases**
