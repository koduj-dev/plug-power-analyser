#!/usr/bin/env bash
# Installs Plug Power Analyser as a per-user LaunchAgent on macOS (no sudo
# needed; runs while the installing user is logged in). Run from the
# repository root after `npm run build`:
#   packaging/macos/install.sh
set -euo pipefail

LABEL=dev.koduj.plug-power-analyser
INSTALL_DIR=/usr/local/opt/plug-power-analyser
PLIST_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PLIST_SRC_DIR/../.." && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_DEST="$LAUNCH_AGENTS_DIR/$LABEL.plist"

if [[ ! -d "$REPO_ROOT/backend/dist" || ! -d "$REPO_ROOT/frontend/dist" ]]; then
  echo "Build output not found. Run 'npm run build' from the repository root first." >&2
  exit 1
fi

sudo mkdir -p "$INSTALL_DIR"
sudo rm -rf "$INSTALL_DIR/backend" "$INSTALL_DIR/frontend"
sudo cp -r "$REPO_ROOT/backend" "$INSTALL_DIR/backend"
sudo cp -r "$REPO_ROOT/frontend/dist" "$INSTALL_DIR/frontend/dist" 2>/dev/null || {
  sudo mkdir -p "$INSTALL_DIR/frontend"
  sudo cp -r "$REPO_ROOT/frontend/dist" "$INSTALL_DIR/frontend/dist"
}
sudo chown -R "$(whoami)" "$INSTALL_DIR"

mkdir -p "$HOME/Library/Application Support/PlugPowerAnalyser"
mkdir -p "$HOME/Library/Logs/PlugPowerAnalyser"
mkdir -p "$LAUNCH_AGENTS_DIR"

sed "s#__HOME__#$HOME#g" "$PLIST_SRC_DIR/$LABEL.plist" > "$PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load -w "$PLIST_DEST"

echo "Installed and started $LABEL"
echo "Logs: $HOME/Library/Logs/PlugPowerAnalyser/"
echo "Stop with: launchctl unload $PLIST_DEST"
