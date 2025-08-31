# YouTube Shorts Automation Platform

A complete Node.js application that automatically generates and uploads YouTube Shorts using only free and open-source tools.

## 🚀 Features

- **AI-Powered Script Generation** - Uses HuggingFace's free inference API
- **Text-to-Speech** - Local Piper TTS integration (open-source)
- **Stock Video Fetching** - Pexels API for vertical video clips
- **Automated Video Assembly** - FFmpeg for montage, audio, and subtitles
- **YouTube Upload** - Automatic upload with scheduling capabilities
- **Web Dashboard** - Clean, responsive interface for easy management

## 📋 Prerequisites

### Required Software

1. **Node.js** (v16 or higher)
   ```bash
   node --version
   ```

2. **FFmpeg** (for video processing)
   - **Windows**: Run the setup script below or download from [ffmpeg.org](https://ffmpeg.org/download.html)
   - **macOS/Linux**: 
     ```bash
     # macOS
     brew install ffmpeg
     
     # Ubuntu/Debian
     sudo apt update && sudo apt install ffmpeg
     ```

3. **Windows Setup (Recommended)**
   Run the setup script as Administrator:
   ```powershell
   # Open PowerShell as Administrator and run:
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\setup-tts-windows.ps1
   ```
   This will install:
   - eSpeak (local TTS)
   - FFmpeg (if not already installed)
   - Configure system paths

4. **Manual Installation (Alternative)**
   - [eSpeak](https://espeak.sourceforge.net/download.html) - For local TTS fallback
   - [FFmpeg](https://ffmpeg.org/download.html) - For audio/video processing

### API Keys (All Free)

1. **HuggingFace API Key** (Required for AI and Cloud TTS)
   - Visit: https://huggingface.co/settings/tokens
   - Create a free account and generate an API token
   - Add to `.env` as `HUGGINGFACE_API_KEY`

2. **Pexels API Key**
   - Visit: https://www.pexels.com/api/
   - Create a free account and get your API key

3. **YouTube Data API**
   - Go to: https://console.cloud.google.com/
   - Create a new project
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials (Desktop application type)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/youtube-shorts-automation.git
   cd youtube-shorts-automation
   ```

2. **Run the setup script** (Windows)
   ```powershell
   # Run as Administrator
   .\setup-tts-windows.ps1
   ```
   
   This will install all required dependencies and verify the setup.

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Create Required Directories**
   ```bash
   mkdir -p temp/audio temp/videos temp/output
   ```

4. **Optional: Install Piper TTS**
   ```bash
   mkdir piper
   cd piper
   # Download Piper for your platform:
   # https://github.com/rhasspy/piper/releases
   
   # Download a voice model (example):
   mkdir models
   cd models
   wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
   wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
   ```

## 🎯 Usage

1. **Start the Server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

2. **Open Dashboard**
   - Navigate to: http://localhost:3000
   - Complete YouTube authentication when prompted

3. **Generate Shorts**
   - Enter your topic (e.g., "space exploration", "cooking tips")
   - Select number of videos to generate
   - Optionally set a publish date/time
   - Click "Generate & Upload Shorts"

4. **Monitor Progress**
   - Watch real-time progress in the dashboard
   - View generated videos once complete
   - Access your videos directly on YouTube

## 🏗️ Architecture

```
├── server.js              # Main Express server
├── services/
│   ├── ai.js             # HuggingFace text generation
│   ├── tts.js            # Piper TTS integration
│   ├── video.js          # FFmpeg video assembly
│   ├── youtube.js        # YouTube Data API
│   └── pexels.js         # Stock video fetching
├── public/
│   ├── index.html        # Dashboard UI
│   └── script.js         # Frontend JavaScript
├── routes/
│   └── api.js           # API routes and testing
└── temp/                # Temporary files (auto-created)
    ├── audio/           # Generated TTS files
    ├── videos/          # Downloaded stock videos
    └── output/          # Final assembled videos
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HUGGINGFACE_API_KEY` | HuggingFace inference API key | Yes |
| `PEXELS_API_KEY` | Pexels stock video API key | Yes |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth client ID | Yes |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth client secret | Yes |
| `YOUTUBE_REDIRECT_URI` | OAuth redirect URI | No |
| `PORT` | Server port | No |

### Workflow

1. **Script Generation**: AI generates engaging script with title and description
2. **Voice Narration**: Piper TTS converts script to audio
3. **Stock Videos**: Pexels API fetches relevant vertical video clips
4. **Video Assembly**: FFmpeg combines clips, adds audio and subtitles
5. **Upload**: YouTube Data API uploads with metadata and scheduling

## 🛠 Troubleshooting

### Common Issues

1. **TTS Not Working**
   - Check if eSpeak is installed: `espeak --version`
   - Verify FFmpeg is in your PATH: `ffmpeg -version`
   - Ensure your HuggingFace API key is set in `.env`

2. **FFmpeg not found**
   - Run the setup script as Administrator
   - Or install manually:
     ```bash
     # Linux
     sudo apt install ffmpeg
     
     # macOS
     brew install ffmpeg
     
     # Windows
     # Download from https://ffmpeg.org/download.html
     ```

2. **Piper TTS not working**
   - Falls back to espeak or silent audio
   - Download Piper binary and models manually
   - Check file permissions

3. **YouTube authentication fails**
   - Verify OAuth credentials in Google Console
   - Check redirect URI matches exactly
   - Ensure YouTube Data API v3 is enabled

4. **Pexels videos not downloading**
   - Check API key validity
   - Verify internet connection
   - System falls back to colored backgrounds

### Performance Tips

- Start with 1-2 videos to test the workflow
- Ensure stable internet for video downloads
- Monitor temp directory size (auto-cleanup implemented)
- Use specific topics for better video matching

## 📝 License

MIT License - Feel free to modify and distribute

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start the server
npm start

# 4. Open http://localhost:3000
# 5. Authenticate with YouTube
# 6. Generate your first Short!
```

## 📊 System Requirements

- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 1GB free space for temporary files
- **Network**: Stable internet for API calls and downloads
- **OS**: Linux, macOS, or Windows with WSL

---

🎬 **Ready to create viral YouTube Shorts automatically!**