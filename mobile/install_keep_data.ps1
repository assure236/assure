param(
  [string]$DeviceId = "",
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  throw "adb not found at $adb"
}

$apk = Join-Path $projectRoot "build\app\outputs\flutter-apk\app-arm64-v8a-release.apk"

if ($Build -or -not (Test-Path $apk)) {
  flutter build apk --release --target-platform android-arm64 --split-per-abi
}

if (-not (Test-Path $apk)) {
  throw "APK not found at $apk"
}

$installArgs = @()
if ($DeviceId -ne "") {
  $installArgs += @("-s", $DeviceId)
}
$installArgs += @("install", "-r", "-d", $apk)

& $adb @installArgs

Write-Output "Install complete (replace mode). Existing app data preserved when signing key/app id match."
