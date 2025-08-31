# Free Setup Guide for YouTube Shorts Automation

This guide will help you set up the YouTube Shorts Automation platform using completely free services.

## 1. Prerequisites

- Node.js 16+ installed
- FFmpeg installed (for video processing)
- Python 3.8+ (for some TTS features)

## 2. Free Services Setup

### 2.1. Hugging Face (for AI features)
1. Go to [Hugging Face](https://huggingface.co/)
2. Create a free account
3. Go to [Access Tokens](https://huggingface.co/settings/tokens)
4. Create a new access token
5. Add it to your `.env` file:
   ```
   HUGGINGFACE_API_KEY=your_token_here
   ```

### 2.2. YouTube API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add the credentials to your `.env` file:
   ```
   YOUTUBE_CLIENT_ID=your_client_id
   YOUTUBE_CLIENT_SECRET=your_client_secret
   YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
   ```

### 2.3. Pexels API (for free stock videos)
1. Go to [Pexels](https://www.pexels.com/api/)
2. Create a free account
3. Get your API key
4. Add it to your `.env` file:
   ```
   PEXELS_API_KEY=your_api_key
   ```

## 3. Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install FFmpeg:
   - Windows: `choco install ffmpeg` (using Chocolatey)
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

## 4. Features

### Free Text-to-Speech
- Uses Microsoft Edge's free TTS API
- Supports multiple languages
- No API key required

### Free Translation
- Uses Hugging Face's free translation models
- Supports all major languages
- Limited to 2 languages at once in free tier

### Free Video Processing
- Uses FFmpeg for all video processing
- No watermarks or limitations

## 5. Usage

### Basic Usage
```javascript
const youtube = require('./services/youtubeEnhanced');

// Upload a video with SEO optimization
youtube.uploadVideo({
  videoPath: './path/to/video.mp4',
  title: 'My Amazing Video',
  description: 'Check out this amazing content!',
  tags: ['shorts', 'viral', 'trending'],
  enableABTest: true, // Enable A/B testing
  translateTo: ['es', 'fr'] // Translate to Spanish and French
});
```

### Text-to-Speech
```javascript
const tts = require('./services/freeTTSService');

// Convert text to speech
tts.saveToFile(
  'Hello, this is a test of the free TTS service!',
  './output/speech.mp3',
  'en-US' // Language code
);
```

## 6. Rate Limits and Quotas

- **Hugging Face**: ~10,000 free inferences/month
- **YouTube API**: 10,000 units/day (1 video upload = ~1600 units)
- **Pexels API**: 200 requests/hour, 200,000/month

## 7. Troubleshooting

### Video Upload Fails
- Check your YouTube API quota
- Ensure OAuth tokens are valid
- Verify video format (MP4 recommended)

### TTS Not Working
- Check internet connection
- Ensure FFmpeg is installed
- Try a different language code

## 8. Contributing

Feel free to contribute to this project! Some areas for improvement:
- Add more free TTS voices
- Implement more video editing features
- Add support for more languages

## 9. License

This project is open source and available under the [MIT License](LICENSE).
