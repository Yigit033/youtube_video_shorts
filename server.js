const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import services
const aiService = require('./services/ai');
const ttsService = require('./services/tts');
const videoService = require('./services/video');
const youtubeService = require('./services/youtube');
const seoService = require('./services/seoService');
const pexelsService = require('./services/pexels');
const PixabayService = require('./services/pixabay');
const pixabayService = new PixabayService();
const MusicService = require('./services/music');
const musicService = new MusicService();
const ImageGenerationService = require('./services/imageGeneration');
const imageGenerationService = new ImageGenerationService();
const VideoGenerationService = require('./services/videoGeneration');
const videoGenerationService = new VideoGenerationService();
const EnhancedVideoGenerationService = require('./services/enhancedVideoGeneration');
const enhancedVideoGenerationService = new EnhancedVideoGenerationService();
const professionalVideoService = require('./services/professionalVideoService');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const uploadRoutes = require('./routes/upload');

// Import production middleware
const securityMiddleware = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Check required environment variables
const requiredEnvVars = [
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'PEXELS_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.log('Please create a .env file with the required variables');
}

// Apply production security middleware
securityMiddleware(app);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Store for tracking job progress
const jobProgress = new Map();

// Use routes
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
app.use('/upload', uploadRoutes);
// Serve temp files (videos, exports) for browser preview
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate and upload YouTube Shorts
app.post('/api/generate-shorts', async (req, res) => {
  const { topic, count = 1, publishDate } = req.body;
  const jobId = `job_${Date.now()}`;
  
  // Initialize job progress
  jobProgress.set(jobId, {
    status: 'started',
    progress: 0,
    currentStep: 'Initializing...',
    videos: [],
    errors: []
  });

  res.json({ jobId, message: 'Video generation started' });

  // Start async processing
  processVideosAsync(jobId, topic, count, publishDate);
});

// Generate image prompts from topic
function generateImagePrompts(topic) {
  const prompts = [];
  
  // Base prompt
  prompts.push(topic);
  
  // Add variations based on topic keywords
  if (topic.includes('family') || topic.includes('cafe') || topic.includes('coffee')) {
    prompts.push('family sitting together in a cozy cafe, warm lighting');
    prompts.push('people drinking coffee and tea, relaxed atmosphere');
    prompts.push('modern cafe interior with people enjoying drinks');
  } else if (topic.includes('movie') || topic.includes('film')) {
    prompts.push('people watching movie together, cozy home theater');
    prompts.push('friends sharing popcorn while watching film');
    prompts.push('cinema experience, people enjoying movie');
  } else if (topic.includes('house') || topic.includes('home')) {
    prompts.push('beautiful modern house exterior, architectural design');
    prompts.push('family working together on home improvement');
    prompts.push('cozy home interior, warm and inviting atmosphere');
  } else {
    // Generic prompts
    prompts.push('people enjoying activities together, happy atmosphere');
    prompts.push('modern lifestyle, people connecting and sharing');
    prompts.push('beautiful scenery, people in natural environment');
  }
  
  return prompts.slice(0, 4); // Return max 4 prompts
}

// Get job status
app.get('/api/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const progress = jobProgress.get(jobId) || { status: 'not_found' };
  res.json(progress);
});

// YouTube OAuth routes
app.get('/api/youtube/auth', (req, res) => {
  try {
    const authUrl = youtubeService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/youtube/callback', async (req, res) => {
  const { code } = req.body;
  try {
    await youtubeService.handleCallback(code);
    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check authentication status
app.get('/api/youtube/auth-status', (req, res) => {
  const isAuthenticated = youtubeService.isAuthenticated();
  res.json({ authenticated: isAuthenticated });
});

// Get available music options
app.get('/api/music-options', async (req, res) => {
  try {
    const { mood } = req.query;
    
    // Enhanced curated music options (YouTube Audio Library style)
    const musicOptions = {
      'calm': [
        { id: 'calm_1', title: 'Peaceful Ambient', duration: '30s', source: 'Free Music', mood: 'calm', genre: 'Ambient' },
        { id: 'calm_2', title: 'Soft Piano', duration: '45s', source: 'Free Music', mood: 'calm', genre: 'Classical' },
        { id: 'calm_3', title: 'Gentle Strings', duration: '60s', source: 'Free Music', mood: 'calm', genre: 'Orchestral' },
        { id: 'calm_4', title: 'Nature Sounds', duration: '30s', source: 'Free Music', mood: 'calm', genre: 'Nature' },
        { id: 'calm_5', title: 'Meditation', duration: '45s', source: 'Free Music', mood: 'calm', genre: 'Ambient' }
      ],
      'energetic': [
        { id: 'energetic_1', title: 'Upbeat Electronic', duration: '30s', source: 'Free Music', mood: 'energetic', genre: 'Electronic' },
        { id: 'energetic_2', title: 'Fast Beat', duration: '45s', source: 'Free Music', mood: 'energetic', genre: 'Dance' },
        { id: 'energetic_3', title: 'Dance Music', duration: '60s', source: 'Free Music', mood: 'energetic', genre: 'Dance' },
        { id: 'energetic_4', title: 'Workout Music', duration: '30s', source: 'Free Music', mood: 'energetic', genre: 'Fitness' },
        { id: 'energetic_5', title: 'High Energy', duration: '45s', source: 'Free Music', mood: 'energetic', genre: 'Rock' }
      ],
      'dramatic': [
        { id: 'drama_1', title: 'Epic Cinematic', duration: '30s', source: 'Free Music', mood: 'dramatic', genre: 'Cinematic' },
        { id: 'drama_2', title: 'Intense Action', duration: '45s', source: 'Free Music', mood: 'dramatic', genre: 'Action' },
        { id: 'drama_3', title: 'Powerful Orchestral', duration: '60s', source: 'Free Music', mood: 'dramatic', genre: 'Orchestral' },
        { id: 'drama_4', title: 'Thriller', duration: '30s', source: 'Free Music', mood: 'dramatic', genre: 'Thriller' },
        { id: 'drama_5', title: 'Heroic Theme', duration: '45s', source: 'Free Music', mood: 'dramatic', genre: 'Epic' }
      ],
      'professional': [
        { id: 'pro_1', title: 'Corporate Background', duration: '30s', source: 'Free Music', mood: 'professional', genre: 'Corporate' },
        { id: 'pro_2', title: 'Business Presentation', duration: '45s', source: 'Free Music', mood: 'professional', genre: 'Corporate' },
        { id: 'pro_3', title: 'Executive Summary', duration: '60s', source: 'Free Music', mood: 'professional', genre: 'Corporate' },
        { id: 'pro_4', title: 'Conference Room', duration: '30s', source: 'Free Music', mood: 'professional', genre: 'Corporate' },
        { id: 'pro_5', title: 'Board Meeting', duration: '45s', source: 'Free Music', mood: 'professional', genre: 'Corporate' }
      ],
      'fun': [
        { id: 'fun_1', title: 'Playful Jingle', duration: '30s', source: 'Free Music', mood: 'fun', genre: 'Jingle' },
        { id: 'fun_2', title: 'Cheerful Melody', duration: '45s', source: 'Free Music', mood: 'fun', genre: 'Pop' },
        { id: 'fun_3', title: 'Happy Tune', duration: '60s', source: 'Free Music', mood: 'fun', genre: 'Pop' },
        { id: 'fun_4', title: 'Kids Theme', duration: '30s', source: 'Free Music', mood: 'fun', genre: 'Children' },
        { id: 'fun_5', title: 'Party Time', duration: '45s', source: 'Free Music', mood: 'fun', genre: 'Party' }
      ],
      'upbeat': [
        { id: 'upbeat_1', title: 'Happy Upbeat', duration: '30s', source: 'Free Music', mood: 'upbeat', genre: 'Pop' },
        { id: 'upbeat_2', title: 'Energetic Pop', duration: '45s', source: 'Free Music', mood: 'upbeat', genre: 'Pop' },
        { id: 'upbeat_3', title: 'Positive Vibes', duration: '60s', source: 'Free Music', mood: 'upbeat', genre: 'Electronic' },
        { id: 'upbeat_4', title: 'Summer Vibes', duration: '30s', source: 'Free Music', mood: 'upbeat', genre: 'Indie' },
        { id: 'upbeat_5', title: 'Morning Energy', duration: '45s', source: 'Free Music', mood: 'upbeat', genre: 'Rock' }
      ]
    };

    const selectedMood = mood || 'professional';
    const options = musicOptions[selectedMood] || musicOptions['professional'];
    
    res.json({
      success: true,
      musicOptions: options,
      mood: selectedMood,
      totalTracks: options.length,
      source: 'Curated Free Music Database (YouTube Audio Library Style)',
      note: 'All tracks are royalty-free and safe for commercial use'
    });
  } catch (error) {
    console.error('Error fetching music options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch music options'
    });
  }
});

// Professional video processing endpoint
app.post('/api/process-professional', async (req, res) => {
  try {
    const { 
      videoId, 
      contentBrief, 
      targetFormat, 
      musicStyle, 
      musicSelection,
      selectedMusicId,
      colorGrading,
      addSubtitles,
      addMusic,
      batchExport,
      subtitleStyle
    } = req.body;
    
    if (!videoId || !contentBrief) {
      return res.status(400).json({ 
        success: false, 
        error: 'Video ID and content brief are required' 
      });
    }

    const videoPath = path.join(__dirname, 'temp', 'uploads', `${videoId}.mp4`);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video file not found' 
      });
    }

    console.log('🎬 [Professional] Starting video analysis...');
    
    // Analyze video content
    const analysis = await professionalVideoService.analyzeVideoContent(videoPath, contentBrief);
    
    console.log('🎬 [Professional] Processing video with effects...');
    
    // Process video with professional effects
    const processedVideo = await professionalVideoService.processVideo(videoPath, {
      targetFormat,
      musicStyle: musicStyle === 'auto' ? analysis.recommendations.musicStyle : musicStyle,
      musicSelection: musicSelection || 'auto',
      selectedMusicId: selectedMusicId || null,
      colorGrading: colorGrading === 'auto' ? analysis.recommendations.colorGrading : colorGrading,
      effects: analysis.recommendations.effects,
      addSubtitles,
      addMusic,
      batchExport,
      subtitleStyle,
      contentBrief
    });

    console.log('🎬 [Professional] Exporting to multiple formats...');
    
    // Export to different formats
    const exports = await professionalVideoService.exportToFormats(processedVideo, [targetFormat]);

    // Map local file paths to web URLs for preview/download
    const toWebUrl = (fp) => {
      if (!fp) return null;
      const rel = path.relative(path.join(__dirname), fp).replace(/\\/g, '/');
      return `/` + rel; // e.g., /temp/batch_exports/shorts_x.mp4
    };

    const webProcessed = toWebUrl(processedVideo);
    const webExports = {};
    Object.keys(exports || {}).forEach((k) => {
      webExports[k] = toWebUrl(exports[k]);
    });

    res.json({
      success: true,
      videoId,
      analysis,
      processedVideo: webProcessed,
      exports: webExports,
      message: 'Video processed successfully'
    });

  } catch (error) {
    console.error('❌ [Professional] Processing failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload processed/exported video to YouTube (with optional scheduling)
app.post('/api/upload-to-youtube', async (req, res) => {
  try {
    const { fileUrl, title, description, tags, scheduleISO, isShort, topic } = req.body || {};
    if (!fileUrl || !title) {
      return res.status(400).json({ success: false, error: 'fileUrl and title are required' });
    }

    // Convert web URL (/temp/...) back to absolute path
    const rel = fileUrl.replace(/^\//, '').replace(/\\/g, '/');
    const absPath = path.join(__dirname, rel);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found on server' });
    }

    // If metadata not provided, generate with SEO service using topic/contentBrief fallback
    let metaTitle = title;
    let metaDescription = description;
    let metaTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s => s.trim()).filter(Boolean) : []);

    if (!metaTitle || !metaDescription || metaTags.length === 0) {
      try {
        const seed = topic || 'video content';
        const seo = await seoService.generateSEOMetadata(seed);
        if (!metaTitle) metaTitle = seo.title;
        if (!metaDescription) metaDescription = seo.description;
        if (metaTags.length === 0) metaTags = seo.tags;
      } catch (e) {
        console.warn('SEO suggestion failed, using minimal metadata');
      }
    }

    const params = {
      videoPath: absPath,
      title: metaTitle,
      description: metaDescription || '',
      tags: metaTags,
      isShort: Boolean(isShort),
      publishAt: scheduleISO || null
    };

    const result = await youtubeService.uploadVideo(params);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Upload-to-YouTube failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI metadata suggest (for pre-filling modal fields)
app.post('/api/ai-metadata-suggest', async (req, res) => {
  try {
    const { topic } = req.body || {};
    const seed = topic || 'video content';
    const data = await seoService.generateSEOMetadata(seed);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function extractVisualKeywords(text) {
  try {
    if (!text) return [];
    const lowered = text.toLowerCase();
    const tokens = lowered
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const stop = new Set(['the','and','a','an','of','to','in','on','for','with','is','it','this','that','as','by','from','at','be','are','was','were','or','we','you','they','he','she','i','our','your']);
    const freq = new Map();
    for (const t of tokens) {
      if (t.length < 3 || stop.has(t)) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    return Array.from(freq.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(([w]) => w);
  } catch { return []; }
}

async function processVideosAsync(jobId, topic, count, publishDate) {
  const progress = jobProgress.get(jobId);
  
  try {
    for (let i = 0; i < count; i++) {
      updateProgress(jobId, `Generating script for video ${i + 1}/${count}`, (i / count) * 20);
      
      // Generate script using AI
      const scriptData = await aiService.generateScript(topic);
      
      updateProgress(jobId, `Generating voice narration ${i + 1}/${count}`, (i / count) * 20 + 10);
      
      // Generate TTS audio with background music
      const rawAudioPath = await ttsService.generateSpeech(scriptData.script, `video_${i + 1}`);
      
      // Add background music
      const musicPath = await musicService.getBackgroundMusic('upbeat', 60);
      const audioPath = musicPath ? 
        await musicService.mixAudioWithMusic(rawAudioPath, musicPath, `video_${i + 1}_with_music.wav`) :
        rawAudioPath;
      
      // Prefer stock videos by script keywords
      let videoClips = [];
      const keywords = extractVisualKeywords(scriptData.script);
      const searchTopic = (keywords && keywords.length > 0) ? keywords.slice(0,3).join(' ') : topic;
      console.log(`🎥 Searching stock videos for: "${searchTopic}"`);
      const [pexelsVideos, pixabayVideos] = await Promise.allSettled([
        pexelsService.fetchVideos(searchTopic, 5),
        pixabayService.fetchVideos(searchTopic, 5)
      ]);
      if (pexelsVideos.status === 'fulfilled' && Array.isArray(pexelsVideos.value)) videoClips.push(...pexelsVideos.value);
      if (pixabayVideos.status === 'fulfilled' && Array.isArray(pixabayVideos.value)) videoClips.push(...pixabayVideos.value);

      // If not enough stock clips, generate AI images and build slideshow
      if (videoClips.length < 6) {
        updateProgress(jobId, `Generating AI images ${i + 1}/${count}`, (i / count) * 20 + 15);
        console.log(`🎨 Generating AI images for: "${topic}"`);
        const imagePrompts = generateImagePrompts(topic);
        const aiImages = [];
        for (const prompt of imagePrompts) {
          for (let k = 0; k < 2; k++) {
            const imagePath = await imageGenerationService.generateImage(prompt, `ai_image_${Date.now()}_${k}`);
            if (imagePath) aiImages.push(imagePath);
          }
        }
        console.log(`✅ Generated ${aiImages.length} AI images`);

        if (aiImages.length > 0) {
          const enhancedVideos = await enhancedVideoGenerationService.generateMultipleVideos(aiImages, `enhanced_ffmpeg_${Date.now()}`);
          if (enhancedVideos.length > 0) videoClips.push(...enhancedVideos);
        }
      }
      
      // Sort by quality and take the best ones
      videoClips.sort((a, b) => (b.quality || 0) - (a.quality || 0));
      videoClips = videoClips.slice(0, 6); // Take top 6 videos
      
      console.log(`🎬 Total videos collected: ${videoClips.length}`);
      
      updateProgress(jobId, `Assembling video ${i + 1}/${count}`, (i / count) * 20 + 18);
      
      // Assemble video with FFmpeg
      const finalVideoPath = await videoService.assembleVideo({
        audioPath,
        videoClips,
        script: scriptData.script,
        videoIndex: i + 1
      });
      
      updateProgress(jobId, `Uploading to YouTube ${i + 1}/${count}`, (i / count) * 20 + 19);
      
      // Upload to YouTube
      try {
        console.log(`🚀 Starting YouTube upload for video ${i + 1}/${count}...`);
        const uploadResult = await youtubeService.uploadVideo({
          videoPath: finalVideoPath,
          title: scriptData.title,
          description: scriptData.description,
          tags: scriptData.hashtags,
          publishAt: publishDate
        });
        
        // Update progress with completed video
        progress.videos.push({
          title: scriptData.title,
          videoId: uploadResult.videoId,
          url: `https://youtube.com/watch?v=${uploadResult.videoId}`
        });
        
        console.log(`✅ Video ${i + 1}/${count} uploaded successfully: ${uploadResult.url}`);
        updateProgress(jobId, `Video ${i + 1}/${count} completed`, ((i + 1) / count) * 100);
      } catch (uploadError) {
        console.error(`❌ YouTube upload failed for video ${i + 1}/${count}:`, uploadError.message);
        progress.errors.push(`Upload failed: ${uploadError.message}`);
        updateProgress(jobId, `Upload failed for video ${i + 1}/${count}`, ((i + 1) / count) * 100, 'error');
        // Continue with next video instead of stopping
        continue;
      }
    }
    
    updateProgress(jobId, 'All videos completed successfully!', 100, 'completed');
    
  } catch (error) {
    console.error('Error processing videos:', error);
    progress.errors.push(error.message);
    updateProgress(jobId, `Error: ${error.message}`, progress.progress, 'error');
  }
}

function updateProgress(jobId, step, progressPercent, status = 'processing') {
  const progress = jobProgress.get(jobId);
  if (progress) {
    progress.currentStep = step;
    progress.progress = Math.round(progressPercent);
    progress.status = status;
    jobProgress.set(jobId, progress);
  }
}

app.listen(PORT, () => {
  console.log('\n🚀 YouTube Shorts Automation Platform');
  console.log('=====================================');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🎬 Ready to create amazing YouTube Shorts!`);
  console.log('\n🔧 Make sure to:');
  console.log('   1. Configure your .env file with API keys');
  console.log('   2. Install FFmpeg on your system');
  console.log('   3. Authenticate with YouTube via the dashboard');
  console.log('\n💡 Check the README.md for detailed setup instructions\n');
});