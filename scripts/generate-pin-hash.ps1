# generate-pin-hash.ps1 — Windows PowerShell PIN hash generator
# Usage: .\generate-pin-hash.ps1 [-Pin 1234]
# If no -Pin is given, prompts for PIN interactively.

param(
    [string]$Pin
)

$ITERATIONS = 100000

function Get-PinHash($value) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    [byte[]]$bytes = [System.Text.Encoding]::UTF8.GetBytes($value)
    for ($i = 0; $i -lt $ITERATIONS; $i++) {
        $bytes = $sha256.ComputeHash($bytes)
    }
    return ([System.BitConverter]::ToString($bytes) -replace '-').ToLower()
}

if (-not $Pin) {
    $Pin = Read-Host -Prompt "Enter 4-digit PIN"
}

if ($Pin -notmatch '^\d{4}$') {
    Write-Error "PIN must be exactly 4 digits."
    exit 1
}

$hash = Get-PinHash -value $Pin
Write-Host ""
Write-Host "PIN          : $Pin"
Write-Host "Iterations   : $ITERATIONS"
Write-Host "Hash         : $hash"
Write-Host ""
Write-Host "Copy this hash into your security-audit.js / test.html files."
