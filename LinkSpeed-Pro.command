#!/usr/bin/env bash
# LinkSpeed Pro — macOS 1-Click Launcher
# Double-click this file in macOS Finder to launch the LinkSpeed Pro daemon and open your browser.
cd "$(dirname "$0")" || exit 1
echo "======================================================="
echo "⚡ Starting LinkSpeed Pro for macOS..."
echo "======================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not found on your PATH."
  echo "Please install Node.js from https://nodejs.org or run: brew install node"
  echo ""
  read -p "Press [Enter] to exit..."
  exit 1
fi

node server.js
