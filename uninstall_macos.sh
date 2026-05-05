#!/usr/bin/env bash
set -euo pipefail

INSTALL_ROOT="${1:-$HOME/Library/Application Support/FeedyChromeExtension}"
EXTENSION_DIR="$INSTALL_ROOT/extension"
LAUNCHER_PATH="$HOME/Desktop/Feedy Chrome Macros.command"

if [[ -d "$EXTENSION_DIR" ]]; then
  rm -rf "$EXTENSION_DIR"
  echo "Removed: $EXTENSION_DIR"
else
  echo "Not found: $EXTENSION_DIR"
fi

if [[ -f "$LAUNCHER_PATH" ]]; then
  rm -f "$LAUNCHER_PATH"
  echo "Removed: $LAUNCHER_PATH"
else
  echo "Not found: $LAUNCHER_PATH"
fi

echo "Uninstall finished."
