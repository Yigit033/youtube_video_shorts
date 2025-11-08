# 🚀 Quick Start Guide - YouTube Shorts Automation

## 📋 Prerequisites Checklist

Before you start, make sure you have:

- ✅ **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- ✅ **FFmpeg** installed and in PATH - [Download](https://ffmpeg.org/download.html)
- ✅ **API Keys** (all free):
  - HuggingFace API Token
  - Pexels API Key
  - Pixabay API Key (optional)
  - YouTube OAuth Credentials
  - Freesound API Key (optional, for real music)

---

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd c:\youTube_shorts_automation_platform\project
npm install
```

### Step 2: Configure Environment
```bash
# Copy the example file
copy .env.example .env

# Edit .env with your API keys
notepad .env
```

**Required API Keys:**
```env
HUGGINGFACE_API_KEY=hf_your_token_here
PEXELS_API_KEY=your_pexels_key_here
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
```

**Optional (but recommended):**
```env
PIXABAY_API_KEY=your_pixabay_key_here
FREESOUND_API_KEY=your_freesound_key_here
```

### Step 3: Start the Server
```bash
npm start
```

You should see:
```
🚀 YouTube Shorts Automation Platform
=====================================
📊 Dashboard: http://localhost:3000
🎬 Ready to create amazing YouTube Shorts!

✅ Services Status:
   • AI Service: Ready
   • TTS Service: Ready (gTTS priority)
   • Music Service: Ready (Freesound + Synthetic)
   • Video Service: Ready
   • Cleanup Service: Scheduled
```

### Step 4: Open Dashboard
Open your browser and go to: **http://localhost:3000**

### Step 5: Authenticate with YouTube
1. Click "Authenticate with YouTube"
2. Sign in with your Google account
3. Grant permissions
4. You'll be redirected back to the dashboard

### Step 6: Create Your First Video!
1. Enter a topic (e.g., "cooking tips", "technology trends")
2. Select number of videos (start with 1)
3. Click "Generate & Upload Shorts"
4. Watch the progress in real-time!

---

## 🎯 How to Get API Keys (All FREE)

### 1. HuggingFace API Token
1. Go to https://huggingface.co/
2. Create a free account
3. Go to Settings → Access Tokens
4. Create a new token (read access is enough)
5. Copy and paste into `.env`

**Cost:** FREE, unlimited inference

### 2. Pexels API Key
1. Go to https://www.pexels.com/api/
2. Create a free account
3. Click "Get API Key"
4. Copy and paste into `.env`

**Cost:** FREE, 200 requests/hour, 20,000/month

### 3. Pixabay API Key (Optional)
1. Go to https://pixabay.com/api/docs/
2. Create a free account
3. Your API key is shown on the docs page
4. Copy and paste into `.env`

**Cost:** FREE, unlimited with rate limits

### 4. YouTube OAuth Credentials
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable "YouTube Data API v3"
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Choose "Desktop app" as application type
6. Download credentials JSON
7. Copy `client_id` and `client_secret` to `.env`

**Cost:** FREE, 10,000 units/day (enough for ~100 uploads)

### 5. Freesound API Key (Optional, for real music)
1. Go to https://freesound.org/apiv2/apply/
2. Create a free account
3. Apply for API key (instant approval)
4. Copy and paste into `.env`

**Cost:** FREE, 2000 requests/day

---

## 🎬 Usage Examples

### Example 1: Single Video
```
Topic: "5 Amazing Life Hacks"
Count: 1
Publish: Immediately
```

### Example 2: Batch Videos
```
Topic: "Technology Trends 2024"
Count: 3
Publish: Schedule for tomorrow
```

### Example 3: Trending Content
```
Topic: "Viral TikTok Trends"
Count: 5
Publish: Immediately
```

---

## 🔧 Troubleshooting

### Problem: "FFmpeg not found"
**Solution:**
```bash
# Windows: Download from https://ffmpeg.org/download.html
# Add to PATH or place ffmpeg.exe in project folder

# Test if FFmpeg is working:
ffmpeg -version
```

### Problem: "TTS not working"
**Solution:**
- Default TTS is gTTS (Google TTS) - no installation needed
- Make sure you have internet connection
- Check console logs for errors

### Problem: "No videos found"
**Solution:**
- Check if Pexels API key is valid
- Try a different topic (more generic)
- System will use AI-generated images as fallback

### Problem: "YouTube authentication failed"
**Solution:**
- Check if YouTube Data API v3 is enabled
- Verify OAuth credentials are correct
- Make sure redirect URI is: `http://localhost:3000/auth/youtube/callback`

### Problem: "Disk space full"
**Solution:**
- Cleanup service runs automatically every 6 hours
- Manual cleanup: Delete files in `temp/` folder
- Max temp size is 1GB (auto-managed)

---

## 📊 What Happens During Video Generation?

1. **Script Generation** (5-10 seconds)
   - AI generates engaging script with hooks and CTAs
   - SEO-optimized title and description
   - Trending hashtags

2. **Voice Narration** (10-20 seconds)
   - gTTS converts script to high-quality speech
   - Automatic chunking for long scripts

3. **Background Music** (5-10 seconds)
   - Searches Freesound for royalty-free music
   - Falls back to synthetic music if needed

4. **Stock Videos** (20-30 seconds)
   - Fetches from Pexels and Pixabay
   - AI-generated images as fallback
   - Quality scoring and selection

5. **Video Assembly** (30-60 seconds)
   - FFmpeg combines everything
   - Adds subtitles
   - Optimizes for YouTube Shorts (1080x1920)

6. **YouTube Upload** (30-60 seconds)
   - Uploads to your channel
   - Sets metadata and tags
   - Schedules if requested

**Total Time:** 2-4 minutes per video

---

## 💡 Pro Tips

### For Best Results:
1. **Use descriptive topics** - "How to cook pasta" is better than "pasta"
2. **Start with 1 video** - Test the workflow first
3. **Check your API limits** - Stay within free tiers
4. **Use Freesound API** - For real music instead of synthetic
5. **Schedule uploads** - Spread content over time for better engagement

### For Viral Content:
1. **Trending topics** - Check YouTube Shorts trending
2. **Emotional hooks** - Use "You won't believe..." style titles
3. **Short and punchy** - Keep scripts under 60 seconds
4. **Call to action** - Always end with "Like and Subscribe"
5. **Consistent posting** - Upload regularly for algorithm boost

### For Cost Optimization:
1. **Batch processing** - Generate multiple videos at once
2. **Reuse topics** - Slight variations on same theme
3. **Monitor API usage** - Check your quotas regularly
4. **Use local AI** - Install Ollama for offline AI (optional)

---

## 🎉 You're Ready!

Your YouTube Shorts Automation Platform is now fully configured and ready to create viral content!

**Next Steps:**
1. Open http://localhost:3000
2. Authenticate with YouTube
3. Create your first video
4. Watch it go viral! 🚀

**Need Help?**
- Check `README.md` for detailed documentation
- Check `README_UPDATES.md` for latest changes
- Check console logs for debugging

---

**Happy Creating! 🎬✨**
