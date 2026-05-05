#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$SCRIPT_DIR/uninstall_macos.sh"

if "$SCRIPT_DIR/uninstall_macos.sh"; then
  echo
  echo "Uninstall completed."
else
  status=$?
  echo
  echo "Uninstall failed."
  read -n 1 -s -r -p "Press any key to close..."
  echo
  exit "$status"
fi

read -n 1 -s -r -p "Press any key to close..."
echo
