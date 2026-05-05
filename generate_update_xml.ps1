param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [Parameter(Mandatory = $true)]
    [string]$CrxUrl,

    [string]$Version = '',
    [string]$OutputPath = "$PSScriptRoot\\update.xml"
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Version)) {
    $manifestPath = Join-Path $PSScriptRoot 'manifest.json'
    if (-not (Test-Path $manifestPath)) {
        throw "manifest.json not found and -Version was not provided."
    }

    $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
    $Version = [string]$manifest.version
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Extension version is empty. Provide -Version explicitly or set manifest version."
}

$xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="$ExtensionId">
    <updatecheck codebase="$CrxUrl" version="$Version" />
  </app>
</gupdate>
"@

$targetDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

Set-Content -Path $OutputPath -Value $xml -Encoding UTF8

Write-Output "Generated update manifest: $OutputPath"
Write-Output "Extension ID: $ExtensionId"
Write-Output "Version: $Version"
Write-Output "CRX URL: $CrxUrl"
