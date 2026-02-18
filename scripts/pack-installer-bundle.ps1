# Pack the NSIS installer into a single self-extracting exe that runs the installer when executed.
# Uses Windows built-in IExpress (no 7-Zip required).
# Run from repo root after building: .\scripts\pack-installer-bundle.ps1
# Output: release\JessiePlayer-1.0.0-Bundle.exe

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$releaseDir = Join-Path $repoRoot "release"

if (-not (Test-Path $releaseDir)) {
  Write-Error "Release folder not found. Run 'npm run dist:win' first."
}

# Read product name and version from package.json
$pkgPath = Join-Path $repoRoot "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$productName = $pkg.productName
$version = $pkg.version
$setupName = "${productName} Setup ${version}.exe"
$setupPath = Join-Path $releaseDir $setupName

if (-not (Test-Path $setupPath)) {
  Write-Error "Installer not found: $setupPath"
}

# IExpress fails if source path contains spaces; use a temp dir without spaces
$tempPack = Join-Path $env:TEMP "jessiepack"
if (Test-Path $tempPack) { Remove-Item -Recurse -Force $tempPack }
New-Item -ItemType Directory -Path $tempPack -Force | Out-Null
$setupCopy = Join-Path $tempPack "Setup.exe"
Copy-Item -Path $setupPath -Destination $setupCopy -Force

$bundleName = "JessiePlayer-${version}-Bundle.exe"
$bundlePath = Join-Path $releaseDir $bundleName
$sedPath = Join-Path $tempPack "pack.sed"

# SED: self-extraction directive for IExpress
# See https://ss64.com/nt/iexpress-sed.html
$sedContent = @"
[Version]
Class=IExpress
SEDVersion=3

[Options]
ExtractOnly=0
ShowInstallProgramWindow=1
HideExtractAnimation=0
RebootMode=N
ShowRebootUI=0
UseLongFileName=1
SourceFiles=Source
Strings=Strings
AppLaunched=%AppLaunched%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
InstallPrompt=%InstallPrompt%
PackagePurpose=InstallApp

[Source]
Source1=%File1%

[Strings]
AppLaunched=Setup.exe
TargetName=$bundleName
FriendlyName=$productName $version
InstallPrompt=This will run the Jessie Player installer. Continue?
File1=$($setupCopy -replace '\\', '\\')

"@

Set-Content -Path $sedPath -Value $sedContent -Encoding ASCII

# Build the self-extracting exe (output goes to current directory by default)
$workDir = Get-Location
Set-Location $tempPack
try {
  $iexpress = Join-Path $env:SystemRoot "System32\iexpress.exe"
  if (-not (Test-Path $iexpress)) {
    Write-Error "IExpress not found at $iexpress"
  }
  & $iexpress /N "pack.sed"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "IExpress failed with exit code $LASTEXITCODE"
  }
  $builtExe = Join-Path $tempPack $bundleName
  if (Test-Path $builtExe) {
    Copy-Item -Path $builtExe -Destination $bundlePath -Force
    Write-Host "Created: $bundlePath"
  } else {
    Write-Error "IExpress did not produce $bundleName"
  }
} finally {
  Set-Location $workDir
  Remove-Item -Recurse -Force $tempPack -ErrorAction SilentlyContinue
}

Write-Host "Done. Transfer '$bundleName' and run it to launch the installer."
