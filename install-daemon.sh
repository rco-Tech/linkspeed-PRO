#!/usr/bin/env bash
# ==============================================================================
# LinkSpeed Pro — Silent Background Daemon Installer (macOS & Linux)
# ==============================================================================
# Installs LinkSpeed Pro as an automatic background service on your user account.
# Once installed, the hardware daemon is ALWAYS live.
# You can open the PWA or browser to http://localhost:4321 without any terminal commands.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node || echo "/usr/local/bin/node")"
SERVER_JS="$DIR/server.js"

if [[ "$1" == "--uninstall" ]]; then
  echo "Uninstalling LinkSpeed Pro background service..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST="$HOME/Library/LaunchAgents/com.rcotech.linkspeed.plist"
    if [[ -f "$PLIST" ]]; then
      launchctl unload -w "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "✔️ macOS LaunchAgent removed."
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    systemctl --user stop linkspeed 2>/dev/null || true
    systemctl --user disable linkspeed 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/linkspeed.service"
    systemctl --user daemon-reload 2>/dev/null || true
    echo "✔️ Linux systemd user service removed."
  fi
  echo "LinkSpeed Pro daemon uninstalled successfully."
  exit 0
fi

echo "======================================================="
echo "⚡ Installing LinkSpeed Pro Silent Background Daemon"
echo "======================================================="
echo "Directory: $DIR"
echo "Node Path: $NODE_BIN"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not found. Please install Node.js first."
  exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
  LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
  mkdir -p "$LAUNCH_AGENTS"
  PLIST="$LAUNCH_AGENTS/com.rcotech.linkspeed.plist"

  # Unload previous version if running
  launchctl unload -w "$PLIST" 2>/dev/null || true

  cat <<EOF > "$PLIST"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rcotech.linkspeed</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$SERVER_JS</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>4321</string>
        <key>NO_OPEN</key>
        <string>1</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/linkspeed-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/linkspeed-daemon.err</string>
</dict>
</plist>
EOF

  launchctl load -w "$PLIST"
  echo "✔️ Successfully registered and loaded macOS LaunchAgent!"
  echo "✔️ Daemon will automatically start on login and run silently in the background."

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SERVICE_DIR"
  SERVICE_FILE="$SERVICE_DIR/linkspeed.service"

  cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=LinkSpeed Pro Hardware Bridge Daemon
After=network.target

[Service]
Type=simple
ExecStart=$NODE_BIN $SERVER_JS
Environment=PORT=4321
Environment=NO_OPEN=1
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now linkspeed.service
  echo "✔️ Successfully enabled and started Linux systemd user service!"
fi

echo ""
echo "🎉 Setup complete! You can now open http://localhost:4321 anytime."
echo "No terminal commands are ever needed again."
echo "(To uninstall later, simply run: ./install-daemon.sh --uninstall)"
