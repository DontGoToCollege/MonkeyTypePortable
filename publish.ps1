# Publishes Monkeytype Portable as a self-contained, single-file x64 executable.
# Usage:  .\publish.ps1            -> MonkeyType.exe (and dist\MonkeyType.exe)
#         .\publish.ps1 -Run       -> publish and launch
# Copy dist\MonkeyType.exe anywhere (USB stick, synced folder); it keeps its settings and results
# in a MonkeyType-Data folder next to itself. Needs the Edge WebView2 runtime (built into Windows 11).
# Refuses a version that's already in Versions\Archive: raise <Version> in the csproj first.
param([switch]$Run)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Join-Path $root "src\MonkeyTypePortable\MonkeyTypePortable.csproj"
$out  = Join-Path $root "dist"
$version = ([xml](Get-Content $proj)).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$archive = Join-Path $root "Versions\Archive\MonkeyType-$version.exe"
if (Test-Path $archive) { throw "Version $version is already archived. Raise <Version> in the csproj, then publish again." }

Get-Process MonkeyType -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$root*" } | Stop-Process -Force

Write-Host "Regenerating web data from captured/ ..." -ForegroundColor Cyan
python (Join-Path $root "tools\build-data.py")
if ($LASTEXITCODE -ne 0) { throw "build-data failed" }

Write-Host "Publishing Monkeytype Portable (Release, win-x64, self-contained, single file)..." -ForegroundColor Cyan
dotnet publish $proj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $out
if ($LASTEXITCODE -ne 0) { throw "publish failed" }

# Only the exe is needed; drop symbol/side files so the folder stays clean (keep the user's data folder).
Get-ChildItem $out -File | Where-Object { $_.Name -ne "MonkeyType.exe" } | Remove-Item -Force

$exe = Join-Path $out "MonkeyType.exe"
# Every build is kept: the current one at the top level, and a copy per version in Versions\Archive.
New-Item -ItemType Directory -Force (Split-Path $archive) | Out-Null
Copy-Item $exe $archive
Copy-Item $exe (Join-Path $root "MonkeyType.exe")
$size = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host "Done: $exe ($size MB)" -ForegroundColor Green
if ($Run) { Start-Process $exe }
