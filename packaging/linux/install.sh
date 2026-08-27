#!/usr/bin/env bash
# Installs Plug Power Analyser as a systemd service on Linux.
# Run from the repository root after `npm run build`, as root:
#   sudo packaging/linux/install.sh
set -euo pipefail

INSTALL_DIR=/opt/plug-power-analyser
DATA_DIR=/var/lib/plug-power-analyser
SERVICE_USER=plug-power-analyser
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/backend/dist" || ! -d "$REPO_ROOT/frontend/dist" ]]; then
  echo "Build output not found. Run 'npm run build' from the repository root first." >&2
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

mkdir -p "$INSTALL_DIR" "$DATA_DIR"
cp -r "$REPO_ROOT/backend/dist" "$INSTALL_DIR/backend-dist-new"
cp -r "$REPO_ROOT/backend/node_modules" "$INSTALL_DIR/backend-node_modules-new"
cp -r "$REPO_ROOT/frontend/dist" "$INSTALL_DIR/frontend-dist-new"

mkdir -p "$INSTALL_DIR/backend" "$INSTALL_DIR/frontend"
rm -rf "$INSTALL_DIR/backend/dist" "$INSTALL_DIR/backend/node_modules" "$INSTALL_DIR/frontend/dist"
mv "$INSTALL_DIR/backend-dist-new" "$INSTALL_DIR/backend/dist"
mv "$INSTALL_DIR/backend-node_modules-new" "$INSTALL_DIR/backend/node_modules"
mv "$INSTALL_DIR/frontend-dist-new" "$INSTALL_DIR/frontend/dist"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"

cp "$REPO_ROOT/packaging/linux/plug-power-analyser.service" /etc/systemd/system/plug-power-analyser.service
systemctl daemon-reload
systemctl enable --now plug-power-analyser.service

echo "Installed and started plug-power-analyser.service"
echo "Check status with: systemctl status plug-power-analyser"
echo "Logs with:         journalctl -u plug-power-analyser -f"
