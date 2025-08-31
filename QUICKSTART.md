# 🚀 Quick Start Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **FFmpeg** (for video processing)
3. **Git** (optional, for version control)

## 🛠️ Installation

1. **Clone the repository** (or download as ZIP):
   ```bash
   git clone https://github.com/yourusername/youtube-shorts-automation.git
   cd youtube-shorts-automation/project
   ```

2. **Run the setup script**:
   ```bash
   npm run setup
   ```
   This will:
   - Create a `.env` file with your configuration
   - Install all required dependencies

3. **Configure your API keys** (if not done during setup):
   - Get a YouTube API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Get a Pexels API key from [Pexels API](https://www.pexels.com/api/)
   - (Optional) Get a HuggingFace API key from [HuggingFace](https://huggingface.co/settings/tokens)

   Add these to your `.env` file.

## 🚀 Starting the Application

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open the dashboard**:
   - Go to http://localhost:3000 in your browser
   - Authenticate with YouTube when prompted

## 🔧 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Ensure FFmpeg is installed and added to your system PATH
   - On Windows, you may need to restart your terminal/IDE after installation

2. **YouTube Authentication Issues**
   - Make sure you've created OAuth credentials in Google Cloud Console
   - Set the redirect URI to `http://localhost:3000/auth/youtube/callback`
   - Ensure you've enabled the YouTube Data API v3

3. **API Rate Limits**
   - The free tiers of APIs have rate limits
   - Consider upgrading your API plans if you hit these limits

## 📝 Usage

1. **Create a New Short**
   - Go to the dashboard
   - Enter your topic and click "Generate"
   - The system will automatically:
     - Generate a script
     - Create voiceover
     - Find relevant videos
     - Assemble the final video
     - Upload to YouTube (if configured)

2. **Scheduling**
   - Use the scheduling feature to automatically post videos
   - Set your preferred publishing times in the settings

## 📚 Documentation

For more detailed information, please refer to the [full documentation](README.md).

## 🤝 Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) to get started.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
