# Orpheus Windows Installer
# Usage: irm orpheus.dev/install.ps1 | iex
#        irm https://raw.githubusercontent.com/collectif-pixel/orpheus/main/scripts/install.ps1 | iex
#
# Environment variables:
#   ORPHEUS_INSTALL - Installation directory (default: ~/.orpheus)
$ErrorActionPreference = "Stop"
$Repo = "collectif-pixel/orpheus"
$InstallDir = if ($env:ORPHEUS_INSTALL) { $env:ORPHEUS_INSTALL } else { "$env:USERPROFILE\.orpheus" }
$BinDir = "$InstallDir\bin"
function Write-Info { param($Message) Write-Host "info  " -ForegroundColor Blue -NoNewline; Write-Host $Message }
function Write-Success { param($Message) Write-Host "success  " -ForegroundColor Green -NoNewline; Write-Host $Message }
function Write-Warn { param($Message) Write-Host "warn  " -ForegroundColor Yellow -NoNewline; Write-Host $Message }
function Write-Err { param($Message) Write-Host "error  " -ForegroundColor Red -NoNewline; Write-Host $Message }
function Get-LatestVersion {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing
    return $response.tag_name
}
function Get-Platform {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "windows-x64" }
        "ARM64" {
            Write-Warn "Windows ARM64 is not natively supported yet"
            Write-Info "The x64 binary will run via emulation"
            return "windows-x64"
        }
        default { throw "Unsupported architecture: $arch" }
    }
}
function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$BinDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$BinDir;$currentPath", "User")
        return $true
    }
    return $false
}
function Main {
    Write-Host ""
    Write-Host "Orpheus Installer" -ForegroundColor Blue
    Write-Host ""
    $target = Get-Platform
    Write-Info "Detected platform: $target"
    Write-Info "Fetching latest version..."
    $version = Get-LatestVersion
    if (-not $version) {
        Write-Err "Failed to fetch latest version"
        exit 1
    }
    Write-Info "Latest version: $version"
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $archiveName = "orpheus-$target.exe.tar.gz"
    $downloadUrl = "https://github.com/$Repo/releases/download/$version/$archiveName"
    $archivePath = "$BinDir\$archiveName"
    $outputPath = "$BinDir\orpheus.exe"
    Write-Info "Downloading $archiveName..."
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
    }
    catch {
        Write-Err "Failed to download: $_"
        exit 1
    }
    Write-Info "Extracting archive..."
    try {
        tar -xzf $archivePath -C $BinDir
        # Rename extracted binary to orpheus.exe
        $extractedBinary = "$BinDir\orpheus-$target.exe"
        if (Test-Path $extractedBinary) {
            Move-Item -Force $extractedBinary $outputPath
        }
        # Cleanup archive
        Remove-Item -Force $archivePath
    }
    catch {
        Write-Err "Failed to extract archive: $_"
        exit 1
    }
    $pathUpdated = Add-ToPath
    Write-Host ""
    Write-Success "Orpheus $version installed successfully!"
    Write-Host ""
    if ($pathUpdated) {
        Write-Info "PATH updated. Restart your terminal to use 'orpheus'"
        Write-Host ""
        Write-Info "Or run this in your current session:"
        Write-Host "  `$env:Path = `"$BinDir;`$env:Path`"" -ForegroundColor Yellow
    }
    else {
        Write-Info "Orpheus is already in your PATH"
    }
    Write-Host ""
    Write-Info "Get started:"
    Write-Host "  orpheus start      # Start the server"
    Write-Host "  orpheus --help     # Show all commands"
    Write-Host ""
}
Main
