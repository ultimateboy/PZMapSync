param(
    [string]$Browser = "Both",
    [string]$ExtensionId = "eiocboniaogecljgkoembpgpabaogfoa"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$hostDir = Join-Path $repoRoot "native-host"
$hostName = "com.pzmapsync.host"
$hostManifestPath = Join-Path $hostDir "$hostName.json"
$hostPath = Join-Path $hostDir "pzmapsync-native-host.cmd"

$manifest = [ordered]@{
    name = $hostName
    description = "PZMapSync native messaging host"
    path = $hostPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $hostManifestPath -Encoding ASCII

function Register-Host($registryPath) {
    & reg.exe add $registryPath /ve /t REG_SZ /d $hostManifestPath /f | Out-Null
}

if ($Browser -eq "Chrome" -or $Browser -eq "Both") {
    Register-Host "HKCU\Software\Google\Chrome\NativeMessagingHosts\$hostName"
}

if ($Browser -eq "Edge" -or $Browser -eq "Both") {
    Register-Host "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
}

Write-Host "Registered $hostName"
Write-Host "Manifest: $hostManifestPath"
Write-Host "Extension ID: $ExtensionId"
