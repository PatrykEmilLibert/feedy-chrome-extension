# Feedy Chrome Extension (MVP)

This folder contains a Chrome Extension version of the macro runner.

## Implemented in MVP

- Side panel UI for creating and editing macros.
- UX closer to previous desktop app (classic sections, quick buttons, clearer labels).
- Macro action types:
  - `web_click`
  - `web_click_text`
  - `focus_input_fragment`
  - `key`
  - `text`
- Run selected macros on:
  - active tab
  - all tabs with same domain as active tab
  - all tabs in current window
- Parallel execution with configurable tab limit.
- True concurrent tab execution: each selected tab runs the full macro sequence independently, in parallel.
- `parallelLimit` now controls the size of the active worker pool (how many tabs run at the same time).
- Intermediate actions between macros restored (matching old sequence behavior).
- Toggle: skip intermediate actions after the first macro.
- Stop running batch.
- Import/export JSON data.
- Legacy CSV config import (old macros.csv formats).
- Element picker mode from active tab.
- Structured macro builder (desktop-like generated action sequence).

## Data format

Stored in `chrome.storage.local` under key `feedyDataV1`.

Compatible macro shape:

```json
{
  "macros": {
    "My macro": {
      "actions": [
        {"type": "web_click_text", "value": "Save", "tag": "button", "exact": true, "ignore_navigation": true},
        {"type": "key", "value": "tab"},
        {"type": "text", "value": "example"}
      ],
      "hotkey": "Brak"
    }
  },
  "settings": {
    "parallelLimit": 12,
    "postActionDelayMs": 0,
    "actionTimeoutMs": 12000,
    "repeats": 1,
    "skipIntermediateAfterFirstMacro": false
  }
}
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `feedy_chrome_extension`.
5. Click extension icon to open side panel.

## End-user installer (Windows)

This folder now includes a simple installer flow:

- run `install.bat` as normal user,
- files are copied to `%LOCALAPPDATA%\\FeedyChromeExtension\\extension`,
- dedicated Chrome profile is created in `%LOCALAPPDATA%\\FeedyChromeExtension\\chrome_profile`,
- desktop shortcut `Feedy Chrome Macros` is created.

The shortcut runs a local launcher script that starts Chrome with
`--user-data-dir`, `--disable-extensions-except` and `--load-extension`.
This gives easy local install, but it is still a developer-style side-load mode.

To remove it, run `uninstall.bat`.

## Native permanent install (Windows, no load-extension shortcut)

If you want the most native setup, use Chrome policy-based install:

- run `install_native_policy.bat`,
- provide extension ID from Chrome Web Store,
- keep default update URL unless you use your own CRX update server.

This writes Chrome policy `ExtensionInstallForcelist` (CurrentUser or LocalMachine).
After Chrome restart, extension installs as regular managed extension and stays installed.

To remove policy install, run `uninstall_native_policy.bat`.

Important:
- this requires real extension ID (usually from Chrome Web Store publish),
- unpacked local folder cannot be installed permanently in native mode without policy/update source,
- for LocalMachine scope, run installer as Administrator.

## Developer mode during install

Short answer: not reliably.

Chrome does not provide a supported public API to toggle Developer mode from external installer scripts.
You can only ask user to turn it on manually in `chrome://extensions` for unpacked-load flow.

If you want native, permanent behavior without Developer mode, use policy + CRX update source.

## No Chrome Web Store fee: self-hosted update source

You can avoid Chrome Web Store by hosting your own CRX and update manifest over HTTPS.

What you need:
- stable extension ID (derived from your signing key),
- CRX file signed with the same key on each release,
- update manifest XML (`update.xml`) hosted publicly via HTTPS,
- policy install entry: `extension_id;https://your-domain/update.xml`.

Recommended hosting options:
- GitHub Releases + GitHub Pages (simple and cheap),
- Cloudflare R2 + static domain,
- AWS S3 + CloudFront,
- any HTTPS static hosting under your control.

Full end-to-end GitHub setup is documented in:
- `GITHUB_SETUP.md`

Helper script included:
- `generate_update_xml.ps1` creates `update.xml` for your CRX URL and version.

Example:
1. Host `feedy.crx` at `https://example.com/chrome/feedy.crx`
2. Run:
  `powershell -File .\\generate_update_xml.ps1 -ExtensionId <ID> -CrxUrl https://example.com/chrome/feedy.crx -OutputPath .\\update.xml`
3. Host generated `update.xml` at `https://example.com/chrome/update.xml`
4. Run native installer and provide update URL `https://example.com/chrome/update.xml`

## End-user installer (macOS)

This folder now also includes a simple macOS flow:

- run `install_macos.command`,
- files are copied to `~/Library/Application Support/FeedyChromeExtension/extension`,
- desktop launcher `Feedy Chrome Macros.command` is created.

The launcher starts Chrome with `--load-extension=...`.
This is easy local install, but still developer-style side-load mode.

To remove it, run `uninstall_macos.command`.

If Gatekeeper blocks first run, use Right Click -> Open once.

## True one-click consumer install

For standard end-user installation without side-load flags, publish to Chrome Web Store.
Then users install directly from the store page with one click.

## Notes

- This MVP runs only on HTTP/HTTPS tabs.
- It does not automate desktop/system-level actions.
- Existing desktop macros.json can be migrated by file import or by paste-import into the side panel JSON box.
- Legacy desktop macros.csv can also be imported from file picker (.csv).
- Structured macro builder:
  - fill structured fields in panel section "Dodaj Makro Strukturalne",
  - use desktop-like table for price modifiers (Przedzial, Mnoznik, Kwota dodana, Wysylka),
  - last table row behaves like desktop "Powyzej poprzedniego" row (interval is ignored there).
- Text field behavior:
  - after `Tab` action, if focus lands in an editable field, all text is selected,
  - `Right` key action moves caret to the end of text in editable fields,
  - `text` action replaces current selection (instead of always appending),
  - `focus_input_fragment` finds editable fields by text fragment and clicks/focuses the matched field,
    matching against field value/content, placeholder, aria-label, title, name, id, and associated `label` text.
