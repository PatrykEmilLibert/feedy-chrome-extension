param(
    [string]$ExtensionDir = "$PSScriptRoot",
    [string]$OutputDir = "$PSScriptRoot\\dist",
    [string]$KeyPath = "$PSScriptRoot\\signing\\feedy_extension.pem",
    [switch]$CreateKeyIfMissing
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

$chromePath = Resolve-ChromePath
if (-not $chromePath) {
    throw "Chrome executable not found. Install Google Chrome first."
}

$manifestPath = Join-Path $ExtensionDir 'manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found in extension directory: $ExtensionDir"
}

$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Extension version in manifest is empty."
}

$extensionDirResolved = (Resolve-Path $ExtensionDir).Path
$extensionName = Split-Path -Leaf $extensionDirResolved
$extensionParent = Split-Path -Parent $extensionDirResolved
$tempCrxPath = Join-Path $extensionParent "$extensionName.crx"
$tempPemPath = Join-Path $extensionParent "$extensionName.pem"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$keyExists = Test-Path $KeyPath
if (-not $keyExists -and -not $CreateKeyIfMissing) {
    throw "Key file not found: $KeyPath. Use -CreateKeyIfMissing once for initial key generation."
}

if (Test-Path $tempCrxPath) {
    Remove-Item $tempCrxPath -Force
}
if (Test-Path $tempPemPath) {
    Remove-Item $tempPemPath -Force
}

$packArgs = @("--pack-extension=$extensionDirResolved")
if ($keyExists) {
    $packArgs += "--pack-extension-key=$KeyPath"
}

& $chromePath $packArgs | Out-Null

if (-not (Test-Path $tempCrxPath)) {
    throw "CRX pack failed. Expected output not found: $tempCrxPath"
}

if (-not $keyExists) {
    if (-not (Test-Path $tempPemPath)) {
        throw "CRX key generation failed. Expected PEM not found: $tempPemPath"
    }

    $keyDir = Split-Path -Parent $KeyPath
    New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
    Move-Item -Path $tempPemPath -Destination $KeyPath -Force
    Write-Output "Generated and saved signing key: $KeyPath"
}

$crxStablePath = Join-Path $OutputDir 'feedy_chrome_extension.crx'
$crxVersionedPath = Join-Path $OutputDir ("feedy_chrome_extension_v{0}.crx" -f $version)

Copy-Item -Path $tempCrxPath -Destination $crxStablePath -Force
Copy-Item -Path $tempCrxPath -Destination $crxVersionedPath -Force
Remove-Item $tempCrxPath -Force

Write-Output "CRX created: $crxStablePath"
Write-Output "CRX versioned copy: $crxVersionedPath"
Write-Output "Manifest version: $version"
