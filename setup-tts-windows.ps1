# Windows TTS Setup Script
Write-Host "🚀 Setting up TTS dependencies for Windows..." -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script requires administrator privileges to install software." -ForegroundColor Red
    Write-Host "Please right-click on this script and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Install Chocolatey if not already installed
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey package manager..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Install eSpeak
Write-Host "Installing eSpeak..."
choco install espeak -y

# Install FFmpeg
Write-Host "Installing FFmpeg..."
choco install ffmpeg -y

# Create a test script to verify installation
$testScript = @"
Write-Host "`n🎉 TTS Setup Complete!" -ForegroundColor Green
Write-Host "Installed components:" -ForegroundColor Cyan
Write-Host "- eSpeak: $(if (Test-Path 'C:\Program Files\eSpeak\command_line\espeak.exe') { '✅' } else { '❌' })"
Write-Host "- FFmpeg: $(if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { '✅' } else { '❌' })"

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Restart your terminal/IDE to update PATH variables"
Write-Host "2. Run 'npm start' to start the application"
Write-Host "3. If you still experience issues, please check the documentation"
"@

$testScript | Out-File -FilePath ".\verify-tts-setup.ps1" -Encoding UTF8

Write-Host "`n✅ Setup complete! Run .\verify-tts-setup.ps1 to verify the installation." -ForegroundColor Green
