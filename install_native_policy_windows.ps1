param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [string]$UpdateUrl = 'https://clients2.google.com/service/update2/crx',

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

function Get-PolicyValues {
    param([string]$RegistryPath)

    if (-not (Test-Path $RegistryPath)) {
        return @{}
    }

    $item = Get-ItemProperty -Path $RegistryPath
    $result = @{}

    foreach ($property in $item.PSObject.Properties) {
        $name = [string]$property.Name
        if ($name -like 'PS*') {
            continue
        }
        $result[$name] = [string]$property.Value
    }

    return $result
}

$registryPath = Get-PolicyRegistryPath -PolicyScope $PolicyScope
New-Item -Path $registryPath -Force | Out-Null

$targetValue = "$ExtensionId;$UpdateUrl"
$values = Get-PolicyValues -RegistryPath $registryPath
$existingName = $null

foreach ($entry in $values.GetEnumerator()) {
    $rawValue = [string]$entry.Value
    if ($rawValue -match '^([a-p]{32});') {
        $idFromEntry = $Matches[1]
        if ($idFromEntry -eq $ExtensionId) {
            $existingName = [string]$entry.Key
            break
        }
    }
}

if ($existingName) {
    Set-ItemProperty -Path $registryPath -Name $existingName -Value $targetValue -Type String
    Write-Output "Updated policy entry $existingName in $registryPath"
} else {
    $index = 1
    while ($values.ContainsKey([string]$index)) {
        $index += 1
    }

    New-ItemProperty -Path $registryPath -Name ([string]$index) -Value $targetValue -PropertyType String -Force | Out-Null
    Write-Output "Created policy entry $index in $registryPath"
}

Write-Output ""
Write-Output "Extension ID: $ExtensionId"
Write-Output "Update URL: $UpdateUrl"
Write-Output "Policy scope: $PolicyScope"
Write-Output ""
Write-Output "Close all Chrome windows and open Chrome again."
Write-Output "The extension should install permanently in the selected Chrome profile context."
