# GitHub Deployment (A-Z)

This guide sets up full distribution for the Chrome extension using GitHub:

- GitHub Release ZIP for users who install manually,
- GitHub Pages hosting for `update.xml` + `.crx`,
- native permanent install on Windows via Chrome policy (no `--load-extension`).

## 1. Create GitHub repository

1. Create a new repository (for example `feedy-chrome-extension`).
2. Copy this whole folder into the repository root.
3. Commit and push to `main`.

## 2. Enable GitHub Pages

1. Open repository Settings -> Pages.
2. In Build and deployment, select **GitHub Actions**.
3. No branch selection is needed (workflow handles deployment).

## 3. First-time CRX signing key

Run once (Windows):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\pack_crx_windows.ps1 -CreateKeyIfMissing
```

This creates:

- `dist/feedy_chrome_extension.crx`
- `signing/feedy_extension.pem` (private key, never commit)

Important:

- keep `signing/feedy_extension.pem` safe and backed up,
- always reuse the same key for every release,
- do not commit this key to GitHub.

## 4. Get extension ID

You need extension ID for policy install. Easiest method:

1. Open `chrome://extensions`.
2. Enable Developer mode manually.
3. Drag and drop `dist/feedy_chrome_extension.crx` into Chrome and install once.
4. Copy the shown extension ID (32 chars `a-p`).

## 5. Prepare GitHub Pages files

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\prepare_github_hosting.ps1 -RepoOwner <OWNER> -RepoName <REPO> -ExtensionId <EXTENSION_ID>
```

This creates/updates:

- `public/feedy_chrome_extension.crx`
- `public/update.xml`
- `public/index.html`

Commit and push `public/*`.

## 6. Deploy update host

After push, GitHub Actions workflow `Deploy Update Host (GitHub Pages)` publishes files.

Your update URL becomes:

```text
https://<OWNER>.github.io/<REPO>/update.xml
```

## 7. Native permanent install on Windows

Use policy installer and provide:

- extension ID from step 4,
- update URL from step 6.

Interactive BAT:

```text
install_native_policy.bat
```

Direct PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install_native_policy_windows.ps1 -ExtensionId <EXTENSION_ID> -UpdateUrl https://<OWNER>.github.io/<REPO>/update.xml -PolicyScope CurrentUser
```

For all users on machine:

- use `-PolicyScope LocalMachine`,
- run as Administrator.

## 8. Release ZIP assets on tag

Workflow `Release ZIP` runs automatically for tags like `v0.1.2`.

Example:

```powershell
git tag v0.1.2
git push origin v0.1.2
```

ZIP is uploaded to GitHub Releases.

## 9. Update process for new version

1. Increase version in `manifest.json`.
2. Rebuild CRX with same key:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\pack_crx_windows.ps1
```

3. Regenerate `public/*`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\prepare_github_hosting.ps1 -RepoOwner <OWNER> -RepoName <REPO> -ExtensionId <EXTENSION_ID>
```

4. Commit and push `public/*`.
5. Restart Chrome on client machines (or wait for update check).

## Notes

- There is no supported API to force-toggle Chrome Developer mode from installer scripts.
- Native permanent install without Chrome Web Store works via policy + hosted update source (this setup).
