# Python Dependencies Setup for Local GPU Video Generation
Write-Host "🐍 Setting up Python dependencies for local GPU video generation..." -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found! Please install Python 3.8+ first." -ForegroundColor Red
    exit 1
}

# Check if pip is available
try {
    $pipVersion = pip --version
    Write-Host "✅ pip found: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pip not found! Please install pip first." -ForegroundColor Red
    exit 1
}

# Install PyTorch with CUDA support (if available)
Write-Host "🔧 Installing PyTorch with CUDA support..." -ForegroundColor Yellow
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Install other dependencies
Write-Host "📦 Installing other Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Check CUDA availability
Write-Host "🔍 Checking CUDA availability..." -ForegroundColor Yellow
python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('GPU Count:', torch.cuda.device_count() if torch.cuda.is_available() else 0); print('GPU Name:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'); print('VRAM:', round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 1), 'GB') if torch.cuda.is_available() else 'N/A')"

Write-Host "✅ Python dependencies setup complete!" -ForegroundColor Green
Write-Host "💡 If you have a GPU, local video generation will be much faster!" -ForegroundColor Cyan
