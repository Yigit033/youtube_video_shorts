# Text-to-Speech (TTS) Setup Guide

This guide will help you set up the TTS functionality for the YouTube Shorts Automation Platform on Windows.

## Prerequisites

1. **Node.js** (v14 or later)
2. **FFmpeg** (for audio processing)
3. **eSpeak** (optional, for local TTS fallback)

## Installation Steps

### 1. Install Dependencies

Run the setup script as Administrator to install required dependencies:

```powershell
# Open PowerShell as Administrator and run:
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-tts-windows.ps1
```

This script will:
- Install Chocolatey (if not already installed)
- Install eSpeak (local TTS)
- Install FFmpeg (for audio processing)

### 2. Configure Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# HuggingFace API Key (required for AI and cloud TTS)
HUGGINGFACE_API_KEY=your_api_key_here

# Pexels API Key (for stock videos)
PEXELS_API_KEY=your_pexels_api_key

# YouTube API Configuration
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REFRESH_TOKEN=your_refresh_token
```

### 3. Verify Installation

After running the setup script, verify everything is working:

```powershell
# Check if eSpeak is installed
espeak --version

# Check if FFmpeg is installed
ffmpeg -version
```

## TTS Fallback System

The system will try TTS methods in this order:
1. **HuggingFace TTS** (cloud-based, requires API key)
2. **eSpeak** (local, requires installation)
3. **Windows Built-in TTS** (works without additional setup)
4. **Silent Audio** (fallback if all else fails)

## Troubleshooting

### Common Issues

1. **eSpeak not found**
   - Ensure you ran the setup script as Administrator
   - Check if eSpeak is installed at `C:\Program Files\eSpeak\command_line\espeak.exe`

2. **FFmpeg not found**
   - Run the setup script as Administrator
   - Add FFmpeg to your system PATH

3. **API Key Errors**
   - Verify your `.env` file has the correct API keys
   - Check your HuggingFace account for API rate limits

### Testing TTS

You can test the TTS functionality by running:

```javascript
const tts = new TTSService();
tts.testTTS()
  .then(result => console.log('TTS Test Result:', result))
  .catch(error => console.error('TTS Test Failed:', error));
```

## Manual Installation (Alternative)

If the setup script doesn't work, you can install manually:

1. **Install eSpeak**
   - Download from: https://espeak.sourceforge.net/download.html
   - Install to default location: `C:\Program Files\eSpeak`

2. **Install FFmpeg**
   - Download from: https://ffmpeg.org/download.html
   - Add to system PATH

## Support

For additional help, please open an issue on the project's GitHub repository.
