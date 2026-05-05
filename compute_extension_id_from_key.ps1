param(
    [string]$KeyPath = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($KeyPath)) {
    $KeyPath = Join-Path $PSScriptRoot 'signing\\feedy_extension.pem'
}

if (-not (Test-Path $KeyPath)) {
    throw "Key file not found: $KeyPath"
}

function Resolve-PythonCommand {
    $candidates = @(
        'py -3',
        'python',
        "$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe"
    )

    foreach ($candidate in $candidates) {
        $head = $candidate.Split(' ')[0]
        if ($head -match '\\.exe$') {
            if (Test-Path $head) {
                return $candidate
            }
        } else {
            $cmd = Get-Command $head -ErrorAction SilentlyContinue
            if ($cmd) {
                return $candidate
            }
        }
    }

    return $null
}

$pythonCommand = Resolve-PythonCommand
if (-not $pythonCommand) {
    throw "Python not found. Install Python 3 with package 'cryptography' to use this helper script."
}

$pythonCode = @"
from cryptography.hazmat.primitives import serialization
import hashlib

with open(r'$KeyPath', 'rb') as f:
    pem = f.read()

key = serialization.load_pem_private_key(pem, password=None)
pub = key.public_key().public_bytes(
    serialization.Encoding.DER,
    serialization.PublicFormat.SubjectPublicKeyInfo,
)

h = hashlib.sha256(pub).digest()[:16]
alphabet = 'abcdefghijklmnop'
ext_id = ''.join(alphabet[b >> 4] + alphabet[b & 15] for b in h)
print(ext_id)
"@

$tempPy = Join-Path $env:TEMP ("feedy_ext_id_{0}.py" -f ([guid]::NewGuid().ToString('N')))
Set-Content -Path $tempPy -Value $pythonCode -Encoding UTF8

try {
    $result = Invoke-Expression "$pythonCommand \"$tempPy\""
    $extensionId = ($result | Select-Object -Last 1).Trim()
}
finally {
    if (Test-Path $tempPy) {
        Remove-Item $tempPy -Force
    }
}

if ($extensionId -notmatch '^[a-p]{32}$') {
    throw "Failed to compute extension ID."
}

Write-Output $extensionId
