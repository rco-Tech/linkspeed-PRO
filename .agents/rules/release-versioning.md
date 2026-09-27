# Release & Version Management Rule

Whenever a new version of LinkSpeed Pro is prepared or released:

1. **Version Synchronization (Mandatory Files)**:
   Any version bump (e.g. `vX.Y.Z`) MUST be updated and synchronized across all of the following files:
   - `package.json`: `"version": "X.Y.Z"`
   - `package-lock.json`: `"version": "X.Y.Z"` (in top-level and `packages[""]`)
   - `electron-main.js`: `title: 'LinkSpeed Pro vX.Y.Z'`
   - `public/index.html`:
     - `#btnBrandVersion` (`vX.Y.Z`)
     - `.brand-badge.version-pill` (`vX.Y.Z`)
     - `#aboutReleaseVer` (`vX.Y.Z (Production)`)
   - `public/sw.js`: `const CACHE_NAME = 'linkspeed-pro-vX.Y.Z';`

2. **Binary Assets & Scanner Validation**:
   - Ensure the native Windows scanner binary `bin/linkspeed-win-scanner.exe` is compiled from `src/scanner-windows.cs` via `npm run compile:scanner`.

3. **Git Commit, Tag & Push (GitHub Releases Trigger)**:
   - Commit all changes:
     ```bash
     git add -A
     git commit -m "chore: bump version to vX.Y.Z"
     git push origin main
     ```
   - Create an annotated Git tag matching `vX.Y.Z`:
     ```bash
     git tag -a vX.Y.Z -m "Release vX.Y.Z: <Highlights/Changelog>"
     ```
   - Push the Git tag to GitHub:
     ```bash
     git push origin vX.Y.Z
     ```

4. **CI Release Workflow & Asset Verification**:
   - Pushing the tag triggers `.github/workflows/release.yml`.
   - The workflow builds and attaches all release assets to `https://github.com/rco-Tech/linkspeed-PRO/releases`:
     - macOS Apple Silicon (`arm64`) & Intel (`x64`) DMG & ZIP
     - Linux AppImage & DEB
     - Windows Setup Installer (`.exe`), Portable Standalone (`.exe`), and `latest.yml` update manifest.
   - Verify that the release workflow executes and finishes successfully.
