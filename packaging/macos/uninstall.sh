#!/usr/bin/env bash
# Removes the Plug Power Analyser LaunchAgent and installed application
# files. Keeps ~/Library/Application Support/PlugPowerAnalyser (telemetry
# database) unless -d is passed.
set -euo pipefail

LABEL=dev.koduj.plug-power-analyser
INSTALL_DIR=/usr/local/opt/plug-power-analyser
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
PURGE_DATA=false

while getopts "d" opt; do
  case $opt in
    d) PURGE_DATA=true ;;
    *) ;;
  esac
done

launchctl unload "$PLIST_DEST" 2>/dev/null || true
rm -f "$PLIST_DEST"
sudo rm -rf "$INSTALL_DIR"

if [[ "$PURGE_DATA" == "true" ]]; then
  rm -rf "$HOME/Library/Application Support/PlugPowerAnalyser"
  echo "Removed application data"
else
  echo "Kept application data (pass -d to remove it too)"
fi

echo "Uninstalled $LABEL"
