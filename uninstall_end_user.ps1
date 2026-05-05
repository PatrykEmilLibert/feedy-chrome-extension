param(
    [string]$InstallRoot = "$env:LOCALAPPDATA\\FeedyChromeExtension"
)

$ErrorActionPreference = 'Stop'

$extensionDir = Join-Path $InstallRoot 'extension'
$chromeProfileDir = Join-Path $InstallRoot 'chrome_profile'
$launcherCmdPath = Join-Path $InstallRoot 'launch_feedy_chrome.cmd'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Feedy Chrome Macros.lnk'

if (Test-Path $extensionDir) {
    Remove-Item -Path $extensionDir -Recurse -Force
    Write-Output "Removed: $extensionDir"
} else {
    Write-Output "Not found: $extensionDir"
}

if (Test-Path $chromeProfileDir) {
    Remove-Item -Path $chromeProfileDir -Recurse -Force
    Write-Output "Removed: $chromeProfileDir"
} else {
    Write-Output "Not found: $chromeProfileDir"
}

if (Test-Path $launcherCmdPath) {
    Remove-Item -Path $launcherCmdPath -Force
    Write-Output "Removed: $launcherCmdPath"
} else {
    Write-Output "Not found: $launcherCmdPath"
}

if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
    Write-Output "Removed: $shortcutPath"
} else {
    Write-Output "Not found: $shortcutPath"
}

Write-Output "Uninstall finished."
