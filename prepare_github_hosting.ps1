param(
    [Parameter(Mandatory = $true)]
    [string]$RepoOwner,

    [Parameter(Mandatory = $true)]
    [string]$RepoName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [string]$CrxPath = "$PSScriptRoot\\dist\\feedy_chrome_extension.crx",
    [string]$PublishDir = "$PSScriptRoot\\public"
)

$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found: $manifestPath"
}

$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Manifest version is empty."
}

if (-not (Test-Path $CrxPath)) {
    throw "CRX not found: $CrxPath. Run pack_crx_windows.ps1 first."
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null

$targetCrxName = 'feedy_chrome_extension.crx'
$targetCrxPath = Join-Path $PublishDir $targetCrxName
Copy-Item -Path $CrxPath -Destination $targetCrxPath -Force

$crxUrl = "https://$RepoOwner.github.io/$RepoName/$targetCrxName"
$updateXmlPath = Join-Path $PublishDir 'update.xml'

& "$PSScriptRoot\\generate_update_xml.ps1" `
    -ExtensionId $ExtensionId `
    -CrxUrl $crxUrl `
    -Version $version `
    -OutputPath $updateXmlPath

$generatedUtc = [DateTime]::UtcNow.ToString('u')
$indexHtml = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Feedy Chrome Extension Update Host</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 860px; margin: 32px auto; line-height: 1.5; padding: 0 16px; }
      code { background: #f3f3f3; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Feedy Chrome Extension Update Host</h1>
    <p>This page hosts update assets for enterprise/policy-based Chrome installation.</p>
    <ul>
      <li>Version: <strong>$version</strong></li>
      <li>Extension ID: <code>$ExtensionId</code></li>
      <li>CRX: <a href="./$targetCrxName">$targetCrxName</a></li>
      <li>Update manifest: <a href="./update.xml">update.xml</a></li>
      <li>Generated (UTC): $generatedUtc</li>
    </ul>
  </body>
</html>
"@

Set-Content -Path (Join-Path $PublishDir 'index.html') -Value $indexHtml -Encoding UTF8

Write-Output "Prepared GitHub Pages content in: $PublishDir"
Write-Output "CRX URL: $crxUrl"
Write-Output "Update URL: https://$RepoOwner.github.io/$RepoName/update.xml"
Write-Output "Extension ID: $ExtensionId"
