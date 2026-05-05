#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ROOT="${1:-$HOME/Library/Application Support/FeedyChromeExtension}"
EXTENSION_DIR="$INSTALL_ROOT/extension"
LAUNCHER_PATH="$HOME/Desktop/Feedy Chrome Macros.command"

resolve_chrome_bin() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

if ! CHROME_BIN="$(resolve_chrome_bin)"; then
  echo "Chrome binary not found. Install Google Chrome first." >&2
  exit 1
fi

required_files=(
  "manifest.json"
  "content_script.js"
  "service_worker.js"
  "sidepanel.html"
  "sidepanel.css"
  "sidepanel.js"
  "README.md"
)

for name in "${required_files[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$name" ]]; then
    echo "Missing required extension file: $name" >&2
    exit 1
  fi
done

mkdir -p "$EXTENSION_DIR"

for name in "${required_files[@]}"; do
  cp "$SCRIPT_DIR/$name" "$EXTENSION_DIR/$name"
done

cat > "$LAUNCHER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
"$CHROME_BIN" --load-extension="$EXTENSION_DIR"
EOF

chmod +x "$LAUNCHER_PATH"

echo "Installed extension files to: $EXTENSION_DIR"
echo "Created desktop launcher: $LAUNCHER_PATH"
echo
echo "Important: this mode starts Chrome with --load-extension from launcher."
echo "For standard one-click install, publish to Chrome Web Store."
