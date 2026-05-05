param(
    [string]$InstallRoot = "$env:LOCALAPPDATA\\FeedyChromeExtension",
    [ValidateSet('isolated', 'current', 'custom')]
    [string]$ProfileMode = 'isolated',
    [string]$ChromeUserDataDir = '',
    [string]$ChromeProfileDirectory = 'Default',
    [switch]$Interactive,
    [switch]$SkipDesktopShortcut
)

$ErrorActionPreference = 'Stop'

function Resolve-ChromePath {
    $candidates = @(
        "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
        "$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe",
        "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function New-DesktopShortcut {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [string]$Arguments = '',
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [string]$IconLocation
    )

    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop "$Name.lnk"

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDirectory
    if ($IconLocation) {
        $shortcut.IconLocation = $IconLocation
    }
    $shortcut.Save()

    return $shortcutPath
}

function Resolve-InteractiveProfileMode {
    Write-Output ""
    Write-Output "Choose Chrome profile mode:"
    Write-Output "  1) isolated (recommended) - dedicated profile for this extension"
    Write-Output "  2) current   - existing Chrome User Data + selected profile"
    Write-Output "  3) custom    - custom User Data path + selected profile"
    Write-Output ""

    $choice = (Read-Host "Select option [1/2/3]").Trim()

    switch ($choice) {
        '1' {
            return @{
                ProfileMode = 'isolated'
                ChromeUserDataDir = ''
                ChromeProfileDirectory = 'Default'
            }
        }
        '2' {
            $profileDirInput = (Read-Host "Chrome profile directory (Default/Profile 1/...) [Default]").Trim()
            if ([string]::IsNullOrWhiteSpace($profileDirInput)) {
                $profileDirInput = 'Default'
            }

            return @{
                ProfileMode = 'current'
                ChromeUserDataDir = ''
                ChromeProfileDirectory = $profileDirInput
            }
        }
        '3' {
            $userDataInput = (Read-Host "Custom Chrome User Data directory path").Trim()
            if ([string]::IsNullOrWhiteSpace($userDataInput)) {
                throw "Custom mode requires Chrome User Data directory path."
            }

            $profileDirInput = (Read-Host "Chrome profile directory inside that path (Default/Profile 1/...) [Default]").Trim()
            if ([string]::IsNullOrWhiteSpace($profileDirInput)) {
                $profileDirInput = 'Default'
            }

            return @{
                ProfileMode = 'custom'
                ChromeUserDataDir = $userDataInput
                ChromeProfileDirectory = $profileDirInput
            }
        }
        default {
            throw "Invalid choice: $choice"
        }
    }
}

function Resolve-ProfileSettings {
    param(
        [string]$InstallRoot,
        [string]$ProfileMode,
        [string]$ChromeUserDataDir,
        [string]$ChromeProfileDirectory
    )

    $profileDir = if ([string]::IsNullOrWhiteSpace($ChromeProfileDirectory)) { 'Default' } else { $ChromeProfileDirectory.Trim() }

    if ($ProfileMode -eq 'isolated') {
        return @{
            Mode = 'isolated'
            UserDataDir = (Join-Path $InstallRoot 'chrome_profile')
            ProfileDirectory = $profileDir
            UseDisableExtensionsExcept = $true
        }
    }

    if ($ProfileMode -eq 'current') {
        return @{
            Mode = 'current'
            UserDataDir = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data"
            ProfileDirectory = $profileDir
            UseDisableExtensionsExcept = $false
        }
    }

    if ([string]::IsNullOrWhiteSpace($ChromeUserDataDir)) {
        throw "custom mode requires -ChromeUserDataDir value"
    }

    return @{
        Mode = 'custom'
        UserDataDir = $ChromeUserDataDir.Trim()
        ProfileDirectory = $profileDir
        UseDisableExtensionsExcept = $false
    }
}

$scriptRoot = $PSScriptRoot
$extensionDir = Join-Path $InstallRoot 'extension'
$launcherCmdPath = Join-Path $InstallRoot 'launch_feedy_chrome.cmd'
$chromePath = Resolve-ChromePath

if ($Interactive) {
    $interactiveResult = Resolve-InteractiveProfileMode
    $ProfileMode = $interactiveResult.ProfileMode
    $ChromeUserDataDir = $interactiveResult.ChromeUserDataDir
    $ChromeProfileDirectory = $interactiveResult.ChromeProfileDirectory
}

$profileSettings = Resolve-ProfileSettings `
    -InstallRoot $InstallRoot `
    -ProfileMode $ProfileMode `
    -ChromeUserDataDir $ChromeUserDataDir `
    -ChromeProfileDirectory $ChromeProfileDirectory

$chromeUserDataDir = $profileSettings.UserDataDir
$chromeProfileDir = Join-Path $chromeUserDataDir $profileSettings.ProfileDirectory

if (-not $chromePath) {
    throw "Chrome executable not found. Install Google Chrome first."
}

$requiredFiles = @(
    'manifest.json',
    'content_script.js',
    'service_worker.js',
    'sidepanel.html',
    'sidepanel.css',
    'sidepanel.js',
    'README.md'
)

foreach ($name in $requiredFiles) {
    $full = Join-Path $scriptRoot $name
    if (-not (Test-Path $full)) {
        throw "Missing required extension file: $name"
    }
}

New-Item -ItemType Directory -Force -Path $extensionDir | Out-Null
New-Item -ItemType Directory -Force -Path $chromeUserDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $chromeProfileDir | Out-Null

foreach ($name in $requiredFiles) {
    Copy-Item -Path (Join-Path $scriptRoot $name) -Destination (Join-Path $extensionDir $name) -Force
}

$useDisableExtensionsExcept = [bool]$profileSettings.UseDisableExtensionsExcept
$requiresClosedChrome = if ($profileSettings.Mode -eq 'isolated') { '0' } else { '1' }

$chromeArgs = @(
    '--new-window',
    "--user-data-dir=\"$chromeUserDataDir\"",
    "--profile-directory=\"$($profileSettings.ProfileDirectory)\""
)

if ($useDisableExtensionsExcept) {
    $chromeArgs += "--disable-extensions-except=\"$extensionDir\""
}

$chromeArgs += "--load-extension=\"$extensionDir\""

$chromeArgsString = ($chromeArgs -join ' ')

$launcherContent = @"
@echo off
setlocal
if "$requiresClosedChrome"=="1" (
  tasklist /FI "IMAGENAME eq chrome.exe" | find /I "chrome.exe" >nul
  if not errorlevel 1 (
    echo Chrome is currently running.
    echo Close all Chrome windows and run this shortcut again.
    pause
    exit /b 1
  )
)
start "" "$chromePath" $chromeArgsString
"@

Set-Content -Path $launcherCmdPath -Value $launcherContent -Encoding ASCII

if (-not $SkipDesktopShortcut) {
    $shortcutPath = New-DesktopShortcut `
        -Name 'Feedy Chrome Macros' `
        -TargetPath $launcherCmdPath `
        -WorkingDirectory $InstallRoot `
        -IconLocation $chromePath
}

Write-Output "Installed extension files to: $extensionDir"
Write-Output "Profile mode: $($profileSettings.Mode)"
Write-Output "Chrome User Data dir: $chromeUserDataDir"
Write-Output "Chrome profile dir: $chromeProfileDir"
Write-Output "Created launcher script: $launcherCmdPath"
if (-not $SkipDesktopShortcut) {
    Write-Output "Created desktop shortcut: $shortcutPath"
} else {
    Write-Output "Desktop shortcut creation skipped (--SkipDesktopShortcut)."
}
Write-Output ""
if ($requiresClosedChrome -eq '1') {
    Write-Output "Important: in current/custom mode close all Chrome windows before launching shortcut."
}
Write-Output "Important: shortcut runs launcher with --load-extension."
Write-Output "For fully standard one-click store install, publish the extension to Chrome Web Store."
