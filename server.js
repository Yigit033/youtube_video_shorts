const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import services
const aiService = require('./services/ai');
const ttsService = require('./services/tts');
const videoService = require('./services/video');
const youtubeService = require('./services/youtube');
const pexelsService = require('./services/pexels');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');

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

async function processVideosAsync(jobId, topic, count, publishDate) {
  const progress = jobProgress.get(jobId);
  
  try {
    for (let i = 0; i < count; i++) {
      updateProgress(jobId, `Generating script for video ${i + 1}/${count}`, (i / count) * 20);
      
      // Generate script using AI
      const scriptData = await aiService.generateScript(topic);
      
      updateProgress(jobId, `Generating voice narration ${i + 1}/${count}`, (i / count) * 20 + 10);
      
      // Generate TTS audio
      const audioPath = await ttsService.generateSpeech(scriptData.script, `video_${i + 1}`);
      
      updateProgress(jobId, `Fetching stock videos ${i + 1}/${count}`, (i / count) * 20 + 15);
      
      // Fetch stock videos
      const videoClips = await pexelsService.fetchVideos(topic, 3);
      
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
      
      updateProgress(jobId, `Video ${i + 1}/${count} completed`, ((i + 1) / count) * 100);
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