# PowerShell script to setup Faster-Whisper for offline subtitle generation
# This script downloads the Whisper model to local cache for reliable operation

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "FASTER-WHISPER SETUP FOR PERFECT SUBTITLE SYNC" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "❌ Error: Python not found!" -ForegroundColor Red
    Write-Host "💡 Please install Python 3.8 or higher" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Python found: $pythonCmd" -ForegroundColor Green

# Check if venv exists
if (Test-Path "venv") {
    Write-Host "✅ Virtual environment found" -ForegroundColor Green
    
    # Activate venv
    Write-Host "🔄 Activating virtual environment..." -ForegroundColor Cyan
    & "venv\Scripts\Activate.ps1"
    
} else {
    Write-Host "⚠️  Virtual environment not found, using global Python" -ForegroundColor Yellow
}

# Install faster-whisper if not installed
Write-Host "`n🔄 Checking faster-whisper installation..." -ForegroundColor Cyan
& $pythonCmd -c "import faster_whisper" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Installing faster-whisper..." -ForegroundColor Yellow
    & $pythonCmd -m pip install faster-whisper
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Failed to install faster-whisper!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ faster-whisper already installed" -ForegroundColor Green
}

# Download Whisper model
Write-Host "`n🎤 Downloading Whisper model (base)..." -ForegroundColor Cyan
Write-Host "⏳ This may take a few minutes on first run...`n" -ForegroundColor Yellow

& $pythonCmd "scripts\download_whisper_model.py" "base"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host "✅ SETUP COMPLETE!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "`n✨ Faster-Whisper is now ready for perfect subtitle sync!" -ForegroundColor Cyan
    Write-Host "✨ Model is cached locally for offline operation!" -ForegroundColor Cyan
    Write-Host "`n💡 You can now generate videos with perfect subtitle timing!" -ForegroundColor Yellow
} else {
    Write-Host "`n============================================================" -ForegroundColor Red
    Write-Host "❌ SETUP FAILED!" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "`n💡 Please check the error messages above" -ForegroundColor Yellow
    Write-Host "💡 You may need to install faster-whisper manually:" -ForegroundColor Yellow
    Write-Host "   pip install faster-whisper`n" -ForegroundColor White
    exit 1
}

