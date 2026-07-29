#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_PLUGIN="$ROOT_DIR/lightroom/Spetly.lrplugin"
LIGHTROOM_MODULES_DIR="${LIGHTROOM_MODULES_DIR:-$HOME/Library/Application Support/Adobe/Lightroom/Modules}"
TARGET_PLUGIN="$LIGHTROOM_MODULES_DIR/Spetly.lrplugin"

if [[ ! -d "$SOURCE_PLUGIN" ]]; then
  echo "Missing source plugin: $SOURCE_PLUGIN" >&2
  exit 1
fi

mkdir -p "$LIGHTROOM_MODULES_DIR"
rm -rf "$TARGET_PLUGIN"
cp -R "$SOURCE_PLUGIN" "$TARGET_PLUGIN"

echo "Installed Spetly Lightroom plugin:"
echo "$TARGET_PLUGIN"
echo
echo "If Lightroom Classic is open, reload the plugin in File > Plug-in Manager or restart Lightroom Classic."
