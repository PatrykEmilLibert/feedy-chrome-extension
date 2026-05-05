param(
    [string]$ProjectDir = "$PSScriptRoot",
    [string]$OutputDir = "$(Split-Path -Parent $PSScriptRoot)\\releases"
)

$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $ProjectDir 'manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Manifest version is empty"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$zipName = "feedy_chrome_extension_v$version.zip"
$zipPath = Join-Path $OutputDir $zipName
if (Test-Path $zipPath) {
    try {
        Remove-Item $zipPath -Force
    }
    catch {
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $zipName = "feedy_chrome_extension_v${version}_${timestamp}.zip"
        $zipPath = Join-Path $OutputDir $zipName
        Write-Warning "Default zip is locked. Using alternate output: $zipPath"
    }
}

$includeFiles = @(
    'manifest.json',
    'content_script.js',
    'service_worker.js',
    'sidepanel.html',
    'sidepanel.css',
    'sidepanel.js',
    'README.md',
    'install_end_user.ps1',
    'uninstall_end_user.ps1',
    'install.bat',
    'uninstall.bat',
    'install_native_policy_windows.ps1',
    'uninstall_native_policy_windows.ps1',
    'install_native_policy.bat',
    'uninstall_native_policy.bat',
    'generate_update_xml.ps1',
    'compute_extension_id_from_key.ps1',
    'pack_crx_windows.ps1',
    'prepare_github_hosting.ps1',
    'GITHUB_SETUP.md',
    'install_macos.sh',
    'uninstall_macos.sh',
    'install_macos.command',
    'uninstall_macos.command'
)

$sourceFiles = @()
foreach ($name in $includeFiles) {
    $fullPath = Join-Path $ProjectDir $name
    if (-not (Test-Path $fullPath)) {
        throw "Required file missing for release: $name"
    }
    $sourceFiles += $fullPath
}

Compress-Archive -Path $sourceFiles -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Release package created: $zipPath"
