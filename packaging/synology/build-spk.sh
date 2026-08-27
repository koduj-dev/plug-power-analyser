#!/usr/bin/env bash
# Builds a Synology DSM .spk package from the current build output.
# Run from the repository root after `npm run build`:
#   packaging/synology/build-spk.sh
#
# Produces PlugPowerAnalyser-<version>.spk at the repo root. Upload it in
# DSM via Package Center -> Manual Install (top-right dropdown next to
# "Install"). The Node.js v22 package must already be installed from
# Package Center -- this package does not bundle a Node.js runtime.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG_SRC_DIR="$REPO_ROOT/packaging/synology"
BUILD_DIR="$REPO_ROOT/.synology-build"

if [[ ! -d "$REPO_ROOT/backend/dist" || ! -d "$REPO_ROOT/frontend/dist" ]]; then
  echo "Build output not found. Run 'npm run build' from the repository root first." >&2
  exit 1
fi

VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/payload/backend" "$BUILD_DIR/payload/frontend"

echo "Staging backend..."
cp -r "$REPO_ROOT/backend/dist" "$BUILD_DIR/payload/backend/dist"
cp "$REPO_ROOT/backend/package.json" "$BUILD_DIR/payload/backend/package.json"

echo "Staging frontend..."
cp -r "$REPO_ROOT/frontend/dist" "$BUILD_DIR/payload/frontend/dist"

echo "Installing production-only backend dependencies into the package payload..."
npm install --omit=dev --no-audit --no-fund --prefix "$BUILD_DIR/payload/backend" >/dev/null

echo "Packing package.tgz..."
tar -C "$BUILD_DIR/payload" --owner=root --group=root -czf "$BUILD_DIR/package.tgz" backend frontend

echo "Assembling SPK contents..."
mkdir -p "$BUILD_DIR/spk-root/scripts" "$BUILD_DIR/spk-root/conf"
CHECKSUM="$(md5sum "$BUILD_DIR/package.tgz" | cut -d' ' -f1)"
sed "s/__VERSION__/${VERSION}-1/; s/__CHECKSUM__/${CHECKSUM}/" "$PKG_SRC_DIR/INFO.template" > "$BUILD_DIR/spk-root/INFO"
cp "$BUILD_DIR/package.tgz" "$BUILD_DIR/spk-root/package.tgz"
cp "$PKG_SRC_DIR/scripts/"* "$BUILD_DIR/spk-root/scripts/"
cp "$PKG_SRC_DIR/conf/privilege" "$BUILD_DIR/spk-root/conf/privilege"
chmod +x "$BUILD_DIR/spk-root/scripts/"*

SPK_FILE="$REPO_ROOT/PlugPowerAnalyser-${VERSION}.spk"
tar -C "$BUILD_DIR/spk-root" --owner=root --group=root -cf "$SPK_FILE" package.tgz INFO scripts conf

rm -rf "$BUILD_DIR"

echo
echo "Built: $SPK_FILE"
echo "In DSM: Package Center -> (top-right dropdown) Manual Install -> select this file."
