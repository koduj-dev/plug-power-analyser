#!/usr/bin/env bash
# Removes the Plug Power Analyser systemd service and installed application
# files. Keeps the data directory (/var/lib/plug-power-analyser) unless -d is
# passed, so telemetry survives reinstalls by default.
set -euo pipefail

DATA_DIR=/var/lib/plug-power-analyser
INSTALL_DIR=/opt/plug-power-analyser
SERVICE_USER=plug-power-analyser
PURGE_DATA=false

while getopts "d" opt; do
  case $opt in
    d) PURGE_DATA=true ;;
    *) ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

systemctl disable --now plug-power-analyser.service 2>/dev/null || true
rm -f /etc/systemd/system/plug-power-analyser.service
systemctl daemon-reload

rm -rf "$INSTALL_DIR"

if [[ "$PURGE_DATA" == "true" ]]; then
  rm -rf "$DATA_DIR"
  echo "Removed data directory $DATA_DIR"
else
  echo "Kept data directory $DATA_DIR (pass -d to remove it too)"
fi

if id "$SERVICE_USER" >/dev/null 2>&1; then
  userdel "$SERVICE_USER" 2>/dev/null || true
fi

echo "Uninstalled plug-power-analyser"
