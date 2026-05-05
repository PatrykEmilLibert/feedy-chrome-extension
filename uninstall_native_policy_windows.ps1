param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [ValidateSet('CurrentUser', 'LocalMachine')]
    [string]$PolicyScope = 'CurrentUser'
)

$ErrorActionPreference = 'Stop'

function Get-PolicyRegistryPath {
    param([string]$PolicyScope)

    if ($PolicyScope -eq 'LocalMachine') {
        return 'HKLM:\Software\Policies\Google\Chrome\ExtensionInstallForcelist'
    }

    return 'HKCU:\Software\Policies\Google\Chrome\ExtensionInstallForcelist'
}

$registryPath = Get-PolicyRegistryPath -PolicyScope $PolicyScope

if (-not (Test-Path $registryPath)) {
    Write-Output "Policy path not found: $registryPath"
    Write-Output "Nothing to remove."
    exit 0
}

$item = Get-ItemProperty -Path $registryPath
$removedCount = 0

foreach ($property in $item.PSObject.Properties) {
    $name = [string]$property.Name
    if ($name -like 'PS*') {
        continue
    }

    $rawValue = [string]$property.Value
    if ($rawValue -match '^([a-p]{32});') {
        $idFromEntry = $Matches[1]
        if ($idFromEntry -eq $ExtensionId) {
            Remove-ItemProperty -Path $registryPath -Name $name -ErrorAction Stop
            Write-Output "Removed policy entry $name from $registryPath"
            $removedCount += 1
        }
    }
}

if ($removedCount -eq 0) {
    Write-Output "No matching policy entries found for extension ID $ExtensionId"
}

Write-Output ""
Write-Output "Close all Chrome windows and open Chrome again."
Write-Output "The extension should be removed if no other policy re-installs it."
