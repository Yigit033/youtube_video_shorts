const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
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
const musicService = require('./services/music');
const IntelligentMusicService = require('./services/intelligentMusicService');
const intelligentMusicService = new IntelligentMusicService();
const ImageGenerationService = require('./services/imageGeneration');
const imageGenerationService = new ImageGenerationService();
const VideoGenerationService = require('./services/videoGeneration');
const videoGenerationService = new VideoGenerationService();
const EnhancedVideoGenerationService = require('./services/enhancedVideoGeneration');
const enhancedVideoGenerationService = new EnhancedVideoGenerationService();
const professionalVideoService = require('./services/professionalVideoService');
const cleanupService = require('./services/cleanup');
const ScriptParser = require('./services/scriptParser');
const videoStorageService = require('./services/videoStorage');
const instagramService = require('./services/instagram');
const instagramMetadataService = require('./services/instagramMetadata');
const videoWatermarkService = require('./services/videoWatermark');
const tiktokService = require('./services/tiktok');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const uploadRoutes = require('./routes/upload');
const instagramRoutes = require('./routes/instagram');
const tiktokRoutes = require('./routes/tiktok');

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

// TikTok verification file endpoints (MUST be before static middleware)
// TikTok uses different verification methods:
// 1. Standard path: /.well-known/tiktok-verification.txt
// 2. Alternative path: /tiktok-verification.txt
// 3. Random filename: /[random-filename] (e.g., /ss2U7ApyD14ezFEkraY4b1D5pVuuwinQ)
// Verification code and filename are read from environment variables

// Log verification settings on startup
const tiktokVerificationCode = process.env.TIKTOK_VERIFICATION_CODE;
const tiktokVerificationFilename = process.env.TIKTOK_VERIFICATION_FILENAME;
console.log('🔍 [TikTok Verification] Configuration:');
console.log(`   Code: ${tiktokVerificationCode ? '✅ Set' : '❌ Not set (using default)'}`);
console.log(`   Filename: ${tiktokVerificationFilename ? `✅ ${tiktokVerificationFilename}` : '❌ Not set'}`);

// Standard verification path
app.get('/.well-known/tiktok-verification.txt', (req, res) => {
  const verificationCode = tiktokVerificationCode || 'i5QlW46IXRGI0kz00Ryxz9a6foOfKJxC';
  console.log(`📄 [TikTok] Serving verification file: /.well-known/tiktok-verification.txt`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(`tiktok-developers-site-verification=${verificationCode}`);
});

// Alternative verification path
app.get('/tiktok-verification.txt', (req, res) => {
  const verificationCode = tiktokVerificationCode || 'i5QlW46IXRGI0kz00Ryxz9a6foOfKJxC';
  console.log(`📄 [TikTok] Serving verification file: /tiktok-verification.txt`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(`tiktok-developers-site-verification=${verificationCode}`);
});

// Dynamic verification file endpoint (for random filenames)
if (tiktokVerificationFilename) {
  app.get(`/${tiktokVerificationFilename}`, (req, res) => {
    const verificationCode = tiktokVerificationCode || 'i5QlW46IXRGI0kz00Ryxz9a6foOfKJxC';
    console.log(`📄 [TikTok] Serving verification file: /${tiktokVerificationFilename}`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(`tiktok-developers-site-verification=${verificationCode}`);
  });
  console.log(`✅ [TikTok] Verification endpoint registered: /${tiktokVerificationFilename}`);
} else {
  console.log(`⚠️ [TikTok] TIKTOK_VERIFICATION_FILENAME not set - random filename endpoint not available`);
}

app.use(express.static('public'));

// Store for tracking job progress (with automatic cleanup)
const jobProgress = new Map();
const JOB_RETENTION_TIME = 60 * 60 * 1000; // 1 hour

// Clean up old jobs periodically
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobProgress.entries()) {
    if (job.completedAt && (now - job.completedAt) > JOB_RETENTION_TIME) {
      jobProgress.delete(jobId);
      console.log(`🧹 Cleaned up old job: ${jobId}`);
    }
  }
}, 30 * 60 * 1000); // Every 30 minutes

// Use routes
app.use('/api', apiRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/auth/instagram', instagramRoutes); // NEW: Instagram OAuth callback için /auth/instagram route'u
app.use('/api/tiktok', tiktokRoutes);
app.use('/auth/tiktok', tiktokRoutes); // NEW: TikTok OAuth callback için /auth/tiktok route'u
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
app.use('/upload', uploadRoutes);
// Serve temp files (videos, exports) for browser preview
app.use('/temp', express.static(path.join(__dirname, 'temp')));
// Serve videos for Instagram upload (public URL via ngrok)
app.use('/videos', express.static(path.join(__dirname, 'temp', 'output')));


// Terms of Service endpoint (for TikTok verification)
app.get('/terms', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terms of Service - YouTube Shorts Automation Platform</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { color: #333; }
            h2 { color: #666; margin-top: 30px; }
            p { margin: 15px 0; }
        </style>
    </head>
    <body>
        <h1>Terms of Service</h1>
        <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using the YouTube Shorts Automation Platform, you accept and agree to be bound by the terms and provision of this agreement.</p>
        
        <h2>2. Use License</h2>
        <p>Permission is granted to temporarily use the YouTube Shorts Automation Platform for personal and commercial video creation purposes. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
        <ul>
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose without explicit permission</li>
            <li>Attempt to decompile or reverse engineer any software</li>
        </ul>
        
        <h2>3. User Content</h2>
        <p>You retain all rights to content you create using this platform. You are responsible for ensuring your content complies with YouTube, Instagram, TikTok, and other platform policies.</p>
        
        <h2>4. API Usage</h2>
        <p>This platform integrates with third-party APIs (YouTube, Instagram, TikTok). You are responsible for complying with each platform's terms of service and API usage policies.</p>
        
        <h2>5. Disclaimer</h2>
        <p>The materials on this platform are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
        
        <h2>6. Limitations</h2>
        <p>In no event shall the platform or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on this platform.</p>
        
        <h2>7. Revisions</h2>
        <p>The platform may revise these terms of service at any time without notice. By using this platform you are agreeing to be bound by the then current version of these terms of service.</p>
        
        <h2>8. Contact Information</h2>
        <p>If you have any questions about these Terms of Service, please contact us through the platform.</p>
    </body>
    </html>
  `);
});

// Privacy Policy endpoint (for TikTok verification)
app.get('/privacy', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Privacy Policy - YouTube Shorts Automation Platform</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { color: #333; }
            h2 { color: #666; margin-top: 30px; }
            p { margin: 15px 0; }
        </style>
    </head>
    <body>
        <h1>Privacy Policy</h1>
        <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h2>1. Information We Collect</h2>
        <p>We collect information that you provide directly to us, including:</p>
        <ul>
            <li>Account information (YouTube, Instagram, TikTok credentials via OAuth)</li>
            <li>Content you upload (images, videos, scripts)</li>
            <li>Usage data and preferences</li>
        </ul>
        
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
            <li>Provide and maintain our service</li>
            <li>Process video creation and uploads</li>
            <li>Authenticate with third-party platforms (YouTube, Instagram, TikTok)</li>
            <li>Improve our services</li>
        </ul>
        
        <h2>3. Third-Party Services</h2>
        <p>We integrate with the following third-party services:</p>
        <ul>
            <li><strong>YouTube API:</strong> For video uploads and channel management</li>
            <li><strong>Instagram Graph API:</strong> For Reels uploads</li>
            <li><strong>TikTok Content Posting API:</strong> For video uploads</li>
            <li><strong>Pexels/Pixabay:</strong> For stock media</li>
            <li><strong>AI Services:</strong> For content generation</li>
        </ul>
        <p>Your data is shared with these services only as necessary to provide functionality. Please review each platform's privacy policy.</p>
        
        <h2>4. Data Storage</h2>
        <p>Your uploaded media files and generated videos are stored temporarily on our servers for processing. Files are automatically deleted after processing completion or after a retention period.</p>
        
        <h2>5. OAuth Tokens</h2>
        <p>We store OAuth tokens securely to enable cross-posting functionality. You can revoke access at any time through the respective platform's settings.</p>
        
        <h2>6. Data Security</h2>
        <p>We implement appropriate security measures to protect your information. However, no method of transmission over the Internet is 100% secure.</p>
        
        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
            <li>Access your personal data</li>
            <li>Request deletion of your data</li>
            <li>Revoke API access tokens</li>
            <li>Opt-out of data collection (may limit functionality)</li>
        </ul>
        
        <h2>8. Changes to This Policy</h2>
        <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
        
        <h2>9. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us through the platform.</p>
    </body>
    </html>
  `);
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Configure multer for custom file uploads (images, music, thumbnail)
const customUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir;
    if (file.fieldname === 'customImages') {
      uploadDir = path.join(__dirname, 'temp', 'custom_images');
    } else if (file.fieldname === 'customMusic') {
      uploadDir = path.join(__dirname, 'temp', 'custom_music');
    } else if (file.fieldname === 'customThumbnail') {
      uploadDir = path.join(__dirname, 'temp', 'thumbnails');
    } else {
      uploadDir = path.join(__dirname, 'temp', 'uploads');
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `custom_${file.fieldname}_${uniqueSuffix}${ext}`);
  }
});

const customUpload = multer({
  storage: customUploadStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 150 // Max 150 files (unlimited images + 1 music + buffer)
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'customImages') {
      // Accept images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for customImages'));
      }
    } else if (file.fieldname === 'customVideos') {
      // Accept videos
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed for customVideos'));
      }
    } else if (file.fieldname === 'customMusic') {
      // Accept audio
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for customMusic'));
      }
    } else if (file.fieldname === 'customThumbnail') {
      // Accept JPEG/PNG for thumbnails
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG/PNG files are allowed for customThumbnail'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Generate and upload YouTube Shorts - ENHANCED with custom input support
app.post('/api/generate-shorts', customUpload.fields([
  { name: 'customImages', maxCount: 100 }, // Unlimited images support
  { name: 'customVideos', maxCount: 100 }, // Video clips support (8-second videos)
  { name: 'customMusic', maxCount: 1 },
  { name: 'customThumbnail', maxCount: 1 } // Thumbnail for YouTube videos
]), async (req, res) => {
  try {
    // Extract form data (can be from multipart/form-data or JSON)
    const topic = req.body.topic || '';
    const count = parseInt(req.body.count) || 1;
    const publishDate = req.body.publishDate || null;
    const videoFormat = req.body.videoFormat || 'shorts';
    const ttsProvider = req.body.ttsProvider || 'auto';
    const ttsVoice = req.body.ttsVoice || 'auto';
    const coquiVoice = req.body.coquiVoice || 'auto';
    const xttsVoice = req.body.xttsVoice || 'auto';
    // CRITICAL: Handle subtitlesEnabled correctly - "false" string means disabled
    // Default to true if not explicitly set to false
    const subtitlesEnabledRaw = req.body.subtitlesEnabled;
    const subtitlesEnabled = subtitlesEnabledRaw !== 'false' && subtitlesEnabledRaw !== false;
    console.log(`🔤 [Subtitles] User preference: ${subtitlesEnabled ? 'ENABLED' : 'DISABLED (Audio only)'}`);
    const videoStyle = req.body.videoStyle || 'entertaining';
    const targetAudience = req.body.targetAudience || 'gen-z';
    const videoDuration = req.body.videoDuration || '30-45s';
    const mood = req.body.mood || 'energetic';
    const ctaType = req.body.ctaType || 'follow';
    const customScript = req.body.customScript || '';
    const customTitle = req.body.customTitle || '';
    const customDescription = req.body.customDescription || '';
    const customTags = req.body.customTags || '';
    const useCustomInput = req.body.useCustomInput === 'true';
    const crossPostToInstagram = req.body.crossPostToInstagram === 'true';
    const crossPostToTikTok = req.body.crossPostToTikTok === 'true';
    
    // Extract uploaded files
    const customImages = req.files && req.files['customImages'] ? req.files['customImages'] : [];
    const customVideos = req.files && req.files['customVideos'] ? req.files['customVideos'] : [];
    const customMusic = req.files && req.files['customMusic'] ? req.files['customMusic'][0] : null;
    const customThumbnail = req.files && req.files['customThumbnail'] ? req.files['customThumbnail'][0] : null;
    
    // Parse mediaSequence from request body
    let mediaSequence = null;
    if (req.body.mediaSequence) {
      try {
        mediaSequence = JSON.parse(req.body.mediaSequence);
        console.log(`📋 [Media Sequence] Received ${mediaSequence.length} items in sequence`);
      } catch (e) {
        console.warn('⚠️  [Media Sequence] Failed to parse, will use upload order');
      }
    }
    
    // Validation
    if (!topic && !customScript) {
      return res.status(400).json({ error: 'Please provide either a topic or a custom script' });
    }
    
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

    // Prepare custom input data
    // Parse custom tags: split by comma, trim, filter empty, remove # symbols
    let parsedCustomTags = null;
    if (customTags && customTags.trim()) {
      parsedCustomTags = customTags
        .split(',')
        .map(tag => tag.trim().replace(/^#+/, '')) // Remove # symbols
        .filter(tag => tag.length > 0)
        .slice(0, 15); // YouTube limit: 15 tags
      console.log(`🏷️  [Custom Tags] Parsed ${parsedCustomTags.length} tags: ${parsedCustomTags.join(', ')}`);
    }
    
    const customImagesMeta = customImages.map((file, idx) => ({
      path: file.path,
      originalName: file.originalname,
      storedName: file.filename,
      order: idx
    }));
    
    const customVideosMeta = customVideos.map((file, idx) => ({
      path: file.path,
      originalName: file.originalname,
      storedName: file.filename,
      order: idx
    }));
    
    const customInput = {
      images: customImagesMeta,
      videos: customVideosMeta,
      mediaSequence: mediaSequence, // NEW: Media sequence for ordering
      script: customScript,
      music: customMusic ? customMusic.path : null,
      thumbnail: customThumbnail ? customThumbnail.path : null,
      title: customTitle.trim() || null,
      description: customDescription.trim() || null,
      tags: parsedCustomTags, // NEW: Custom tags array
      enabled: useCustomInput && (customImagesMeta.length > 0 || customVideosMeta.length > 0 || customScript || customMusic)
    };
    
    if (customInput.enabled) {
      console.log(`📸 [Custom Input] Enabled:`);
      console.log(`   - Images: ${customInput.images.length}`);
      console.log(`   - Script: ${customInput.script ? 'Yes (' + customInput.script.length + ' chars)' : 'No'}`);
      console.log(`   - Music: ${customInput.music ? 'Yes' : 'No'}`);
      console.log(`   - Thumbnail: ${customInput.thumbnail ? 'Yes' : 'No'}`);
      console.log(`   - Title: ${customInput.title ? 'Yes (' + customInput.title.length + ' chars)' : 'No (will use AI)'}`);
      console.log(`   - Description: ${customInput.description ? 'Yes (' + customInput.description.length + ' chars)' : 'No (will use AI)'}`);
      console.log(`   - Tags: ${customInput.tags ? 'Yes (' + customInput.tags.length + ' tags)' : 'No (will use AI)'}`);
    }

    // Start async processing with user preferences and custom input
    const options = { 
      videoStyle, 
      targetAudience, 
      videoDuration, 
      mood, 
      ctaType,
      videoFormat,
      ttsProvider, // NEW: TTS provider selection (xtts, coqui, piper, gtts, auto)
      ttsVoice,
      coquiVoice, // NEW: Coqui TTS voice selection
      xttsVoice, // NEW: XTTS-v2 voice selection
      subtitlesEnabled,
      crossPostToInstagram, // NEW: Cross-posting to Instagram option
      crossPostToTikTok, // NEW: Cross-posting to TikTok option
      customInput // NEW: Pass custom input to processing
    };
  processVideosAsync(jobId, topic, count, publishDate, options);
  } catch (error) {
    console.error('❌ Error in /api/generate-shorts:', error);
    res.status(500).json({ error: error.message });
  }
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
// NEW: Get auth URL for adding new account
app.get('/api/youtube/auth', (req, res) => {
  try {
    // CRITICAL: Use the redirect URI from .env (must match Google Cloud Console)
    // This must be exactly the same as registered in Google Cloud Console
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/youtube/callback`;
    console.log(`🔗 Using redirect URI: ${redirectUri}`);
    const authUrl = youtubeService.getAuthUrl(null, redirectUri);
    res.json({ authUrl });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Handle OAuth callback for new account
app.post('/api/youtube/callback', async (req, res) => {
  const { code } = req.body;
  try {
    const result = await youtubeService.handleCallback(code, true);
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      accountId: result.accountId,
      channelInfo: result.channelInfo,
      email: result.email,
      isNew: result.isNew
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Get list of all accounts
app.get('/api/youtube/accounts', (req, res) => {
  try {
    const accounts = youtubeService.getAccounts();
    const currentAccount = youtubeService.getCurrentAccount();
    res.json({ 
      accounts,
      currentAccount,
      authenticated: accounts.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Select account
app.post('/api/youtube/accounts/select', (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }
    
    youtubeService.selectAccount(accountId);
    const currentAccount = youtubeService.getCurrentAccount();
    res.json({ 
      success: true, 
      message: 'Account selected',
      currentAccount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Remove account
app.delete('/api/youtube/accounts/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    youtubeService.removeAccount(accountId);
    const currentAccount = youtubeService.getCurrentAccount();
    res.json({ 
      success: true, 
      message: 'Account removed',
      currentAccount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check authentication status (legacy support + multi-account)
app.get('/api/youtube/auth-status', (req, res) => {
  const accounts = youtubeService.getAccounts();
  const currentAccount = youtubeService.getCurrentAccount();
  const isAuthenticated = accounts.length > 0;
  
  res.json({ 
    authenticated: isAuthenticated,
    accountsCount: accounts.length,
    accounts, // Add accounts array to response
    currentAccount
  });
});

// Backend endpoints for image management tracking
app.post('/api/images/removed', (req, res) => {
  try {
    const { fileName, remainingCount, timestamp } = req.body;
    console.log(`🗑️ [Image Management] Image removed: ${fileName}, Remaining: ${remainingCount}`);
    // Optional: Log to file or database for analytics
    res.json({ success: true, message: 'Image removal logged' });
  } catch (error) {
    console.warn('⚠️ [Image Management] Failed to log image removal:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/updated', (req, res) => {
  try {
    const { fileCount, timestamp } = req.body;
    console.log(`📸 [Image Management] File list updated: ${fileCount} images`);
    // Optional: Log to file or database for analytics
    res.json({ success: true, message: 'File list update logged', fileCount });
  } catch (error) {
    console.warn('⚠️ [Image Management] Failed to log file list update:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get available Piper TTS voices
app.get('/api/piper-voices', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Recursive function to find .onnx files
    const findOnnxFiles = (dir, depth = 0, maxDepth = 3) => {
      const files = [];
      if (depth > maxDepth) return files;
      
      try {
        if (!fs.existsSync(dir)) return files;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile() && entry.name.endsWith('.onnx')) {
            files.push(fullPath);
          } else if (entry.isDirectory() && depth < maxDepth) {
            // Recursively search subdirectories
            files.push(...findOnnxFiles(fullPath, depth + 1, maxDepth));
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
      
      return files;
    };
    
    // Common Piper voice directories (including recursive search)
    const possibleDirs = [
      process.env.PIPER_MODELS_DIR || process.env.PIPER_VOICES_DIR,
      process.env.PIPER_PATH ? path.dirname(process.env.PIPER_PATH) : null,
      path.join(process.cwd(), 'piper', 'models'),
      path.join(process.cwd(), 'piper'),
      'C:\\piper',
      'C:\\piper\\models',
      path.join(process.env.HOME || process.env.USERPROFILE || '', 'piper', 'models'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', 'piper'),
      path.join(process.env.USERPROFILE || '', 'Downloads', 'piper'),
      path.join(process.env.USERPROFILE || '', 'Documents', 'piper')
    ].filter(Boolean);
    
    const voices = [];
    const foundDirs = new Set();
    const searchedDirs = [];
    
    console.log('🔍 [Piper Voices] Scanning for .onnx files...');
    
    // Search for .onnx files (recursively)
    for (const dir of possibleDirs) {
      if (!dir) continue;
      
      searchedDirs.push(dir);
      const onnxFiles = findOnnxFiles(dir);
      
      for (const filePath of onnxFiles) {
        try {
          const fileName = path.basename(filePath);
          const jsonPath = filePath.replace('.onnx', '.onnx.json');
          
          // Extract voice name from filename (e.g., en_US-lessac-medium.onnx -> en_US-lessac-medium)
          const nameMatch = fileName.match(/([a-z_]+-[a-z]+-[a-z]+)\.onnx$/i);
          const voiceName = nameMatch ? nameMatch[1] : fileName.replace('.onnx', '');
          
          // Try to read quality from JSON if available
          let quality = 'medium';
          try {
            if (fs.existsSync(jsonPath)) {
              const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              quality = jsonContent.quality || jsonContent.speaker || 'medium';
            }
          } catch (e) {
            // Ignore JSON read errors
          }
          
          voices.push({
            name: voiceName,
            path: filePath,
            quality: quality,
            filename: fileName
          });
          
          foundDirs.add(path.dirname(filePath));
          console.log(`✅ [Piper Voices] Found: ${voiceName} at ${filePath}`);
        } catch (error) {
          console.warn(`⚠️ [Piper Voices] Error processing ${filePath}:`, error.message);
        }
      }
    }
    
    // Also check PIPER_MODEL env variable if set
    if (process.env.PIPER_MODEL && fs.existsSync(process.env.PIPER_MODEL)) {
      const modelPath = process.env.PIPER_MODEL;
      const modelName = path.basename(modelPath, '.onnx');
      const nameMatch = modelName.match(/([a-z_]+)-([a-z]+)$/i);
      const voiceName = nameMatch ? `${nameMatch[1]}-${nameMatch[2]}` : modelName;
      
      // Check if already in list
      if (!voices.find(v => v.path === modelPath)) {
        voices.push({
          name: voiceName,
          path: modelPath,
          quality: 'medium',
          filename: path.basename(modelPath)
        });
      }
    }
    
    // Remove duplicates
    const uniqueVoices = [];
    const seenPaths = new Set();
    for (const voice of voices) {
      if (!seenPaths.has(voice.path)) {
        seenPaths.add(voice.path);
        uniqueVoices.push(voice);
      }
    }
    
    console.log(`✅ [Piper Voices] Found ${uniqueVoices.length} unique voice(s)`);
    
    res.json({
      success: true,
      voices: uniqueVoices,
      count: uniqueVoices.length,
      searchedDirs: Array.from(foundDirs),
      allSearchedDirs: searchedDirs,
      debug: {
        envPIPER_MODEL: process.env.PIPER_MODEL || 'not set',
        envPIPER_PATH: process.env.PIPER_PATH || 'not set'
      }
    });
  } catch (error) {
    console.error('❌ [Piper Voices] Error scanning voices:', error);
    res.json({
      success: false,
      voices: [],
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get available Coqui TTS voices
// XTTS-v2 voice samples endpoint
app.get('/api/xtts-voices', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Path to voice_samples directory
    const voiceSamplesDir = path.join(process.cwd(), 'voice_samples');
    const voices = [];
    
    if (!fs.existsSync(voiceSamplesDir)) {
      console.warn('⚠️ [XTTS Voices] voice_samples directory not found');
      return res.json({ success: true, voices: [] });
    }
    
    console.log('🎭 [XTTS Voices] Scanning voice_samples directory...');
    
    const files = fs.readdirSync(voiceSamplesDir);
    
    for (const file of files) {
      if (file.endsWith('.wav')) {
        // Extract friendly name from filename
        // e.g., "narrator_sample_2.wav" -> "Narrator Sample 2"
        // e.g., "audio_2.wav" -> "Audio 2"
        const baseName = file.replace('.wav', '');
        const friendlyName = baseName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, char => char.toUpperCase());
        
        voices.push({
          id: file, // Full filename with .wav
          name: friendlyName,
          filename: file,
          description: `XTTS-v2 Voice Cloning`
        });
      }
    }
    
    // Sort by name
    voices.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`✅ [XTTS Voices] Found ${voices.length} voice sample(s)`);
    res.json({ success: true, voices });
    
  } catch (error) {
    console.error('❌ [XTTS Voices] Error:', error);
    res.status(500).json({ success: false, error: error.message, voices: [] });
  }
});

app.get('/api/coqui-voices', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Path to vctk_voice_samples directory
    const samplesDir = path.join(process.cwd(), 'vctk_voice_samples');
    const voices = [];
    
    // If samples directory exists, scan for voice samples
    if (fs.existsSync(samplesDir)) {
      console.log('🔍 [Coqui Voices] Scanning vctk_voice_samples directory...');
      
      const files = fs.readdirSync(samplesDir);
      
      for (const file of files) {
        // Match pattern: pXXX_sample(...).wav or pXXX_sample.wav
        const match = file.match(/^(p\d+)_sample/);
        if (match) {
          const speakerId = match[1];
          
          // Extract description from filename if available (e.g., "p260_sample(süper_kadın).wav")
          const descMatch = file.match(/\(([^)]+)\)/);
          const description = descMatch ? descMatch[1] : null;
          
          // Check if this speaker is already added
          if (!voices.find(v => v.id === speakerId)) {
            voices.push({
              id: speakerId,
              name: description ? `${speakerId} (${description})` : speakerId,
              description: description || 'Default voice',
              filename: file
            });
          }
        }
      }
      
      // Sort by speaker ID
      voices.sort((a, b) => a.id.localeCompare(b.id));
      
      console.log(`✅ [Coqui Voices] Found ${voices.length} voice(s) from samples`);
    } else {
      console.log('⚠️ [Coqui Voices] vctk_voice_samples directory not found');
    }
    
    // If no voices found from samples, provide default list
    if (voices.length === 0) {
      // Default VCTK speakers (common ones)
      const defaultSpeakers = [
        { id: 'p225', name: 'p225 (Male)', description: 'Male voice' },
        { id: 'p226', name: 'p226 (Male)', description: 'Male voice' },
        { id: 'p227', name: 'p227 (Female)', description: 'Female voice' },
        { id: 'p228', name: 'p228 (Male)', description: 'Male voice' },
        { id: 'p229', name: 'p229 (Female)', description: 'Female voice' },
        { id: 'p230', name: 'p230 (Male - Default)', description: 'Default male voice' },
        { id: 'p231', name: 'p231 (Female)', description: 'Female voice' },
        { id: 'p232', name: 'p232 (Male)', description: 'Male voice' },
        { id: 'p233', name: 'p233 (Female)', description: 'Female voice' },
        { id: 'p234', name: 'p234 (Male)', description: 'Male voice' },
        { id: 'p236', name: 'p236 (Male)', description: 'Male voice' },
        { id: 'p254', name: 'p254 (Male)', description: 'Male voice' },
        { id: 'p260', name: 'p260 (Female)', description: 'Female voice' },
        { id: 'p287', name: 'p287 (Male)', description: 'Male voice' },
        { id: 'p313', name: 'p313 (Male)', description: 'Male voice' },
        { id: 'p316', name: 'p316 (Female)', description: 'Female voice' },
        { id: 'p317', name: 'p317 (Female)', description: 'Female voice' }
      ];
      
      voices.push(...defaultSpeakers);
      console.log(`📋 [Coqui Voices] Using default speaker list (${voices.length} voices)`);
    }
    
    res.json({
      success: true,
      voices: voices,
      count: voices.length,
      model: process.env.COQUI_MODEL || 'tts_models/en/vctk/vits'
    });
  } catch (error) {
    console.error('❌ [Coqui Voices] Error scanning voices:', error);
    res.json({
      success: false,
      voices: [],
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
    
    // Save video for re-upload feature
    let savedVideoId = null;
    try {
      const currentAccount = youtubeService.getCurrentAccount();
      const savedVideo = await videoStorageService.saveVideo(absPath, {
        title: metaTitle,
        description: metaDescription || '',
        tags: metaTags,
        topic: topic || '',
        script: '',
        videoFormat: isShort ? 'shorts' : 'youtube',
        thumbnailPath: null
      });
      
      savedVideoId = savedVideo.videoId;
      
      // Add upload history
      await videoStorageService.addUploadHistory(savedVideoId, {
        accountId: currentAccount?.accountId || null,
        channelName: currentAccount?.channelInfo?.title || 'Unknown Channel',
        channelId: currentAccount?.channelInfo?.id || null,
        youtubeVideoId: result.videoId,
        youtubeUrl: result.url
      });
    } catch (storageError) {
      console.warn(`⚠️ [VideoStorage] Failed to save video (non-critical): ${storageError.message}`);
    }
    
    return res.json({ 
      success: true, 
      result: {
        ...result,
        savedVideoId: savedVideoId
      }
    });
  } catch (error) {
    console.error('❌ Upload-to-YouTube failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all saved videos (for re-upload feature)
app.get('/api/saved-videos', async (req, res) => {
  try {
    const videos = videoStorageService.getAllSavedVideos();
    return res.json({ success: true, videos });
  } catch (error) {
    console.error('❌ Failed to get saved videos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific saved video details
app.get('/api/saved-video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStorageService.getSavedVideo(videoId);
    
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    return res.json({ success: true, video });
  } catch (error) {
    console.error('❌ Failed to get saved video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Re-upload video to multiple channels
app.post('/api/reupload-video', async (req, res) => {
  try {
    const { videoId, accountIds, customMetadata } = req.body || {};
    
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }
    
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, error: 'accountIds array is required' });
    }
    
    // Get saved video
    const savedVideo = videoStorageService.getSavedVideo(videoId);
    if (!savedVideo) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    // Check if video file exists
    if (!fs.existsSync(savedVideo.videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    
    // Use custom metadata if provided, otherwise use saved metadata
    const metadata = customMetadata || savedVideo.metadata;
    
    const results = [];
    const errors = [];
    
    // Upload to each selected account
    for (const accountId of accountIds) {
      try {
        console.log(`🚀 [Re-upload] Uploading to account: ${accountId}`);
        
        const uploadResult = await youtubeService.uploadVideo({
          videoPath: savedVideo.videoPath,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          thumbnailPath: metadata.thumbnailPath,
          accountId: accountId
        });
        
        // Add upload history
        const account = youtubeService.getAccount(accountId);
        await videoStorageService.addUploadHistory(videoId, {
          accountId: accountId,
          channelName: account?.channelInfo?.title || 'Unknown Channel',
          channelId: account?.channelInfo?.id || null,
          youtubeVideoId: uploadResult.videoId,
          youtubeUrl: uploadResult.url
        });
        
        results.push({
          accountId,
          channelName: account?.channelInfo?.title || 'Unknown Channel',
          success: true,
          videoId: uploadResult.videoId,
          url: uploadResult.url
        });
        
        console.log(`✅ [Re-upload] Successfully uploaded to ${account?.channelInfo?.title || accountId}`);
      } catch (error) {
        console.error(`❌ [Re-upload] Failed to upload to ${accountId}:`, error.message);
        errors.push({
          accountId,
          error: error.message
        });
      }
    }
    
    return res.json({
      success: true,
      results,
      errors,
      message: `Uploaded to ${results.length} channel(s), ${errors.length} failed`
    });
  } catch (error) {
    console.error('❌ Re-upload failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete saved video
app.delete('/api/saved-video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const deleted = await videoStorageService.deleteVideo(videoId);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    return res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('❌ Failed to delete saved video:', error);
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

// Intelligently expand short scripts without repetition
function expandScriptIntelligently(script, topic, targetWordCount, options) {
  const currentWords = script.split(/\s+/);
  const currentWordCount = currentWords.length;
  const neededWords = targetWordCount - currentWordCount;
  
  if (neededWords <= 0) return script;
  
  // Extract key points from existing script
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const mainPoints = sentences.slice(0, 3); // Get first 3 meaningful sentences
  
  // Create expansion based on topic and style
  const videoStyle = options.videoStyle || 'entertaining';
  
  // Style-specific expansion templates
  const expansionTemplates = {
    'entertaining': [
      `Here's what makes ${topic} so fascinating.`,
      `The best part? It's easier than you think.`,
      `I tested this myself and the results were amazing.`,
      `You'll be surprised by how simple this really is.`,
      `This method works for everyone, no exceptions.`
    ],
    'educational': [
      `Let me break down the key facts about ${topic}.`,
      `Research shows this approach is highly effective.`,
      `Here's the science behind why this works.`,
      `Experts recommend this strategy for best results.`,
      `Understanding ${topic} can transform your perspective.`
    ],
    'motivational': [
      `Remember, ${topic} is within your reach.`,
      `You have everything you need to succeed.`,
      `Take the first step today, right now.`,
      `Your future self will thank you for this.`,
      `Believe in yourself and make it happen.`
    ],
    'storytelling': [
      `Let me share what I learned about ${topic}.`,
      `This discovery changed everything for me.`,
      `The journey taught me valuable lessons.`,
      `Here's what happened when I tried this.`,
      `Looking back, this was a turning point.`
    ],
    'controversial': [
      `Most people get ${topic} completely wrong.`,
      `The truth might surprise you.`,
      `Here's what they don't want you to know.`,
      `I'll show you the real facts.`,
      `This goes against everything you've heard.`
    ],
    'quick-tips': [
      `Here's the fastest way to master ${topic}.`,
      `Skip the complicated methods, use this instead.`,
      `This shortcut saves you time and effort.`,
      `Focus on these key points for success.`,
      `Apply this technique immediately.`
    ]
  };
  
  const templates = expansionTemplates[videoStyle] || expansionTemplates['entertaining'];
  
  // Add expansions until we reach target word count (avoid repetition)
  let expandedScript = script;
  let addedWords = 0;
  const usedTemplates = new Set(); // Track used templates to avoid repetition
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loop
  
  while (addedWords < neededWords && attempts < maxAttempts) {
    attempts++;
    const templateIndex = Math.floor(Math.random() * templates.length);
    const template = templates[templateIndex];
    
    // Skip if we've used this exact template before
    if (usedTemplates.has(templateIndex)) {
      // If all templates used, break
      if (usedTemplates.size >= templates.length) break;
      continue;
    }
    
    usedTemplates.add(templateIndex);
    const templateWords = template.split(/\s+/).length;
    
    // Check if adding this template would exceed target (with small buffer)
    if (addedWords + templateWords <= neededWords + 10) {
      expandedScript += ' ' + template;
      addedWords += templateWords;
    } else {
      // If we're close to target, break
      break;
    }
  }
  
  // Add CTA if not already present
  const cta = options.ctaType === 'watch-more' ? 'Watch till end!' : 
               options.ctaType === 'follow' ? 'Follow for more!' :
               options.ctaType === 'comment' ? 'Comment below!' :
               options.ctaType === 'share' ? 'Share this!' : '';
  
  if (cta && !expandedScript.toLowerCase().includes(cta.toLowerCase().replace('!', ''))) {
    expandedScript += ' ' + cta;
  }
  
  return expandedScript.trim();
}

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

async function processVideosAsync(jobId, topic, count, publishDate, options = {}) {
  const progress = jobProgress.get(jobId);
  const tempFiles = []; // Track temp files for cleanup
  const customInput = options.customInput || { enabled: false };
  
  try {
    for (let i = 0; i < count; i++) {
      updateProgress(jobId, `Preparing video ${i + 1}/${count}`, (i / count) * 20);
      
      // HYBRID MODE: Use custom script if provided, otherwise generate with AI
      let scriptData;
      let cleanScriptText;
      
      if (customInput.enabled && customInput.script) {
        // Use custom script
        console.log(`📝 [Custom] Using provided script (${customInput.script.length} chars)`);
        cleanScriptText = customInput.script.trim();
        
        // Use custom title/description if provided, otherwise use AI
        const finalTitle = customInput.title || aiService.generateViralTitle(topic || 'Video', options);
        const finalDescription = customInput.description || aiService.generateSEODescription(cleanScriptText, topic || 'Video', options);
        
        if (customInput.title) {
          console.log(`📝 [Custom] Using provided title (${customInput.title.length} chars)`);
        } else {
          console.log(`🤖 [AI] Generating title (custom title not provided)`);
        }
        
        if (customInput.description) {
          console.log(`📝 [Custom] Using provided description (${customInput.description.length} chars)`);
        } else {
          console.log(`🤖 [AI] Generating description (custom description not provided)`);
        }
        
        // CRITICAL: Use custom tags if provided, otherwise generate with AI
        let finalHashtags;
        if (customInput.enabled && customInput.tags && customInput.tags.length > 0) {
          finalHashtags = customInput.tags;
          console.log(`🏷️  [Custom] Using provided tags (${finalHashtags.length} tags)`);
        } else {
          finalHashtags = aiService.generateViralHashtags(topic || 'Video', options);
          console.log(`🤖 [AI] Generating tags (custom tags not provided)`);
        }
        
        scriptData = {
          script: cleanScriptText,
          title: finalTitle,
          description: finalDescription,
          hashtags: finalHashtags
        };
      } else {
      // Generate script using AI with user preferences
        console.log(`🤖 [AI] Generating script from topic: "${topic}"`);
        scriptData = await aiService.generateScript(topic, options);
      
      // CRITICAL: Clean script text - remove JSON formatting if present
        cleanScriptText = scriptData.script || scriptData;
      if (typeof cleanScriptText === 'object') {
        cleanScriptText = cleanScriptText.script || JSON.stringify(cleanScriptText);
      }
      // Remove JSON artifacts
      cleanScriptText = cleanScriptText
        .replace(/^\{[\s\S]*"script":\s*"/m, '')
        .replace(/"[\s\S]*\}$/m, '')
        .replace(/\\n/g, ' ')
        .replace(/\\/g, '')
        .trim();
      }
      
      // Calculate target word count based on video duration
      // Average speaking rate: ~150 words per minute = 2.5 words per second
      // NOTE: If custom images are provided, targetDuration will be calculated from image count
      // So we need to calculate word count dynamically
      let targetWordCount;
      
      if (customInput.enabled && customInput.images && customInput.images.length > 0) {
        // Calculate word count based on estimated duration from images
        // Will be calculated after targetDuration is determined
        // For now, use a placeholder - will be recalculated below
        targetWordCount = 120; // Placeholder, will be updated
      } else {
        const targetWordCounts = {
          '15-30s': 60,   // 30s * 2.5 = 75 words (use 60 for safety)
          '30-45s': 90,   // 45s * 2.5 = 112 words (use 90 for safety)
          '45-60s': 120   // 60s * 2.5 = 150 words (use 120 for safety)
        };
        targetWordCount = targetWordCounts[options.videoDuration] || 90;
      }
      
      // CRITICAL: If custom script is provided, NEVER trim or modify it
      // User provided the exact script they want, so we must use it as-is
      const isCustomScript = customInput.enabled && customInput.script;
      let wordCount = cleanScriptText.split(/\s+/).length;
      let customScriptDuration = null; // Will be calculated if custom script exists
      
      if (isCustomScript) {
        // Custom script - use exactly as provided, no trimming or modification
        console.log(`📝 [Custom Script] Using provided script as-is (${wordCount} words) - NO TRIM, NO MODIFICATION`);
        // Calculate target duration based on actual script length
        // CRITICAL: Adjust words per second based on COQUI_LENGTH_SCALE
        // length_scale > 1.0 = slower, < 1.0 = faster
        // Default: 2.5 words/sec, but actual TTS speed varies significantly
        const actualWordCount = wordCount;
        const lengthScale = parseFloat(process.env.COQUI_LENGTH_SCALE) || 1.0;
        // Base rate: 2.925 words/sec (increased from 2.5), adjusted by length_scale
        // length_scale=1.3 means 30% slower, so effective rate = 2.925 / 1.3 ≈ 2.25 words/sec
        // IMPROVED: Increased base rate to achieve ~2.25 words/sec for better duration estimation
        const baseWordsPerSecond = 2.925;
        const adjustedWordsPerSecond = baseWordsPerSecond / Math.max(0.8, lengthScale); // Cap at 0.8 to prevent extreme values
        
        // Duration = wordCount / wordsPerSecond (noktalama duraklamaları hesaba katılmıyor)
        const wordDuration = actualWordCount / adjustedWordsPerSecond;
        customScriptDuration = Math.ceil(wordDuration);
        
        console.log(`📝 [Custom Script] Estimated duration: ${customScriptDuration}s`);
        console.log(`   📊 Word duration: ${wordDuration.toFixed(2)}s (${actualWordCount} words / ${adjustedWordsPerSecond.toFixed(2)} words/sec)`);
        console.log(`   📊 Using ${adjustedWordsPerSecond.toFixed(2)} words/sec (length_scale: ${lengthScale}, base: ${baseWordsPerSecond})`);
        console.log(`   ⚠️  Note: This is an ESTIMATE. Actual TTS duration will be measured and target adjusted accordingly.`);
      } else {
        // AI-generated script - apply length checks and adjustments
        wordCount = cleanScriptText.split(/\s+/).length;
        let retryCount = 0;
        const maxRetries = 2;
        
        // If script is too short, try to regenerate with better prompt
        while (wordCount < targetWordCount * 0.7 && retryCount < maxRetries) {
          console.log(`⚠️  Script too short (${wordCount} words), target is ${targetWordCount} words. Regenerating with enhanced prompt... (attempt ${retryCount + 1}/${maxRetries})`);
          
          try {
            // Regenerate with explicit word count requirement
            const enhancedScriptData = await aiService.generateScript(topic, {
              ...options,
              explicitWordCount: targetWordCount,
              regenerate: true
            });
            
            let newScriptText = enhancedScriptData.script || enhancedScriptData;
            if (typeof newScriptText === 'object') {
              newScriptText = newScriptText.script || JSON.stringify(newScriptText);
            }
            
            // Clean the new script
            newScriptText = newScriptText
              .replace(/^\{[\s\S]*"script":\s*"/m, '')
              .replace(/"[\s\S]*\}$/m, '')
              .replace(/\\n/g, ' ')
              .replace(/\\/g, '')
              .trim();
            
            const newWordCount = newScriptText.split(/\s+/).length;
            
            if (newWordCount >= targetWordCount * 0.7) {
              cleanScriptText = newScriptText;
              wordCount = newWordCount;
              scriptData.script = cleanScriptText; // Update scriptData too
              console.log(`✅ Regenerated script: ${wordCount} words (target: ${targetWordCount})`);
              break;
            } else {
              console.log(`⚠️  Regenerated script still too short (${newWordCount} words), trying again...`);
              retryCount++;
            }
          } catch (regenerateError) {
            console.warn('⚠️  Failed to regenerate script:', regenerateError.message);
            retryCount++;
      }
        }
        
        // If still too short after retries, use intelligent expansion (not repetition)
        if (wordCount < targetWordCount * 0.7) {
          console.log(`⚠️  Script still short (${wordCount} words) after ${maxRetries} retries. Using intelligent expansion...`);
          cleanScriptText = expandScriptIntelligently(cleanScriptText, topic, targetWordCount, options);
          wordCount = cleanScriptText.split(/\s+/).length;
        } else if (wordCount > targetWordCount * 1.3) {
          // Script too long - trim it intelligently (keep beginning and end)
          // NOTE: This only applies to AI-generated scripts, NOT custom scripts
          console.log(`⚠️  Script too long (${wordCount} words), trimming to ${targetWordCount} words`);
          const words = cleanScriptText.split(/\s+/);
          const keepStart = Math.floor(targetWordCount * 0.6); // Keep 60% from start
          const keepEnd = targetWordCount - keepStart; // Rest from end
          cleanScriptText = words.slice(0, keepStart).join(' ') + ' ... ' + words.slice(-keepEnd).join(' ');
          wordCount = cleanScriptText.split(/\s+/).length;
        }
      }
      
      // Only log word count comparison for AI-generated scripts
      if (!isCustomScript) {
        console.log(`📝 Final script (${wordCount} words, target: ${targetWordCount}) for ${options.videoDuration} video: ${cleanScriptText.substring(0, 150)}...`);
      } else {
        console.log(`📝 [Custom Script] Final script (${wordCount} words) - will be read completely: ${cleanScriptText.substring(0, 150)}...`);
      }
      
      updateProgress(jobId, `Generating voice narration ${i + 1}/${count}`, (i / count) * 20 + 10);
      
      // CRITICAL: Remove scene markers [1], [2], etc. from script before TTS
      // ScriptParser automatically removes scene numbers and returns clean text
      const parsedScript = ScriptParser.parseScript(cleanScriptText);
      const ttsScriptText = parsedScript.text; // This is clean text without [1], [2], etc.
      
      if (parsedScript.format === 'scene') {
        console.log(`🎬 [TTS] Scene-based script detected: Removed ${parsedScript.sceneCount} scene markers for TTS`);
      }
      
      // Generate TTS audio with CLEAN script text (no scene markers) and selected voice
      const ttsOptions = {};
      if (options.ttsProvider && options.ttsProvider !== 'auto') {
        ttsOptions.provider = options.ttsProvider;
        console.log(`🎯 [TTS] Using provider: ${options.ttsProvider}`);
      }
      if (options.ttsVoice && options.ttsVoice !== 'auto') {
        ttsOptions.piperVoice = options.ttsVoice;
      }
      if (options.coquiVoice && options.coquiVoice !== 'auto') {
        ttsOptions.coquiSpeaker = options.coquiVoice;
        console.log(`🎤 [Coqui TTS] Using selected voice: ${options.coquiVoice}`);
      }
      if (options.xttsVoice && options.xttsVoice !== 'auto') {
        ttsOptions.xttsVoice = options.xttsVoice;
        console.log(`🎭 [XTTS-v2] Using selected voice: ${options.xttsVoice}`);
      }
      const rawAudioPath = await ttsService.generateSpeech(ttsScriptText, `video_${i + 1}`, ttsOptions);
      tempFiles.push(rawAudioPath);
      
      // Get intelligent background music (Freesound + Pixabay + Curated) with user mood preference
      // ENHANCED: Map video style to mood if mood is not explicitly set
      let finalMood = options.mood || 'auto';
      if (finalMood === 'auto' || !finalMood) {
        // Style → Mood mapping for better music selection
        const styleToMood = {
          'entertaining': 'fun',
          'educational': 'professional',
          'motivational': 'energetic',
          'storytelling': 'dramatic',
          'controversial': 'dramatic',
          'quick-tips': 'energetic'
        };
        finalMood = styleToMood[options.videoStyle] || 'energetic';
        console.log(`🎵 [Music] Mapped style "${options.videoStyle}" → mood "${finalMood}"`);
      }
      
      console.log(`🎵 [Music] Searching for intelligent background music (mood: ${finalMood}, style: ${options.videoStyle})...`);
      const musicRecommendation = await intelligentMusicService.recommendMusic(cleanScriptText, {
        duration: 60,
        mood: finalMood, // Use mapped/selected mood
        energy: finalMood === 'energetic' || finalMood === 'fun' ? 'high' : finalMood === 'calm' ? 'low' : 'medium',
        genre: 'auto',
        videoStyle: options.videoStyle // Pass style for better matching
      });
      
      // Get actual audio duration helper
      const getAudioDuration = async (audioFilePath) => {
        return new Promise((resolve) => {
          const ffmpeg = require('fluent-ffmpeg');
          ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
              console.warn('⚠️ Could not get audio duration, using fallback');
              resolve(0);
            } else {
              const duration = parseFloat(metadata.format.duration);
              console.log(`🎵 [Audio] Duration: ${duration.toFixed(2)}s`);
              resolve(duration);
            }
          });
        });
      };
      
      // CRITICAL: Calculate target duration
      // Priority: Custom script duration > Custom images duration > Selected video duration
      let targetDuration;
      
      // If custom script was used, use script-based duration (or max with image-based)
      if (isCustomScript && customScriptDuration) {
        if (customInput.enabled && customInput.images && customInput.images.length > 0) {
          // Both custom script and images - use max of both
          const imageCount = customInput.images.length;
          const avgSecondsPerImage = 6.5;
          const transitionTime = 0.4;
          const totalTransitions = imageCount - 1;
          const imageBasedDuration = Math.round((imageCount * avgSecondsPerImage) + (totalTransitions * transitionTime));
          targetDuration = Math.max(imageBasedDuration, customScriptDuration);
          console.log(`🎯 [Custom Input] Duration: ${targetDuration}s (max of image-based ${imageBasedDuration}s and script-based ${customScriptDuration}s)`);
        } else {
          // Only custom script - use script-based duration
          targetDuration = customScriptDuration;
          console.log(`🎯 [Custom Script] Using script-based target duration: ${targetDuration}s`);
        }
      } else if (customInput.enabled && customInput.images && customInput.images.length > 0) {
        // Calculate duration based on image count using "less but effective" principle
        // Average: 6.5 seconds per image + 0.4s transition between images
        const imageCount = customInput.images.length;
        const avgSecondsPerImage = 6.5;
        const transitionTime = 0.4;
        const totalTransitions = imageCount - 1;
        
        const imageBasedDuration = Math.round((imageCount * avgSecondsPerImage) + (totalTransitions * transitionTime));
        
        // If custom script exists, use max of image-based and script-based duration
        if (isCustomScript) {
          const scriptBasedDuration = Math.ceil(wordCount / 2.5);
          targetDuration = Math.max(imageBasedDuration, scriptBasedDuration);
          console.log(`🎯 [Custom Input] Duration: ${targetDuration}s (max of image-based ${imageBasedDuration}s and script-based ${scriptBasedDuration}s)`);
        } else {
          targetDuration = imageBasedDuration;
        }
        
        // Recalculate target word count based on custom duration (only for AI scripts)
        if (!isCustomScript) {
          // Average speaking rate: ~150 words per minute = 2.5 words per second
          targetWordCount = Math.round(targetDuration * 2.5 * 0.8); // 80% safety margin
        }
        
        console.log(`🎯 [Custom Images] Calculating duration from ${imageCount} images:`);
        console.log(`   Formula: ${imageCount} images × ${avgSecondsPerImage}s + ${totalTransitions} transitions × ${transitionTime}s`);
        console.log(`   Target duration: ${targetDuration}s (~${Math.floor(targetDuration / 60)}:${(targetDuration % 60).toString().padStart(2, '0')})`);
        if (!isCustomScript) {
          console.log(`   Target word count: ${targetWordCount} words (${targetDuration}s × 2.5 words/s × 0.8)`);
        }
      } else {
        // Use selected video duration option
        targetDuration = options.videoDuration === '15-30s' ? 30 : options.videoDuration === '45-60s' ? 60 : 45;
        console.log(`🎯 [Narration] Target duration: ${targetDuration}s for ${options.videoDuration} video`);
      }
      
      // Get actual narration duration
      let actualNarrationDuration = await getAudioDuration(rawAudioPath);
      console.log(`🎤 [Narration] Actual duration: ${actualNarrationDuration.toFixed(2)}s`);
      
      // CRITICAL: For custom scripts, adjust target duration based on ACTUAL TTS duration
      // TTS speed may differ significantly from estimated (2.5 words/sec), so we must use real duration
      if (isCustomScript) {
        const oldTarget = targetDuration;
        const durationDifference = Math.abs(actualNarrationDuration - targetDuration);
        const durationRatio = actualNarrationDuration / targetDuration;
        
        console.log(`🔍 [Custom Script] Duration Analysis:`);
        console.log(`   📊 Estimated: ${targetDuration}s, Actual TTS: ${actualNarrationDuration.toFixed(2)}s`);
        console.log(`   📊 Difference: ${durationDifference.toFixed(2)}s (${(durationRatio * 100).toFixed(1)}% of estimated)`);
        
        // Calculate media-based duration if images/videos exist
        let mediaBasedDuration = 0;
        if (customInput.enabled && ((customInput.images?.length || 0) > 0 || (customInput.videos?.length || 0) > 0)) {
          const imageCount = customInput.images?.length || 0;
          const videoCount = customInput.videos?.length || 0;
          const avgSecondsPerImage = 6.5;
          const avgSecondsPerVideo = 8.0;
          const transitionTime = 0.4;
          const totalMedia = imageCount + videoCount;
          const totalTransitions = Math.max(0, totalMedia - 1);
          mediaBasedDuration = Math.round((imageCount * avgSecondsPerImage) + (videoCount * avgSecondsPerVideo) + (totalTransitions * transitionTime));
          console.log(`   📊 Media duration: ${mediaBasedDuration}s (${imageCount} images × ${avgSecondsPerImage}s + ${videoCount} videos × ${avgSecondsPerVideo}s + ${totalTransitions} transitions × ${transitionTime}s)`);
        }
        
        // CRITICAL: Always update target to match actual TTS duration (if significantly different)
        // But ensure target is at least media duration to have enough visual content
        // If TTS is shorter than media, use media duration (extend audio with silence)
        // If TTS is longer than media, use TTS duration (extend media with last frame)
        const newTarget = Math.max(Math.ceil(actualNarrationDuration), mediaBasedDuration);
        
        if (newTarget !== targetDuration) {
          const oldTargetForLog = targetDuration;
          targetDuration = newTarget;
          console.log(`🔄 [Custom Script] Target duration updated: ${oldTargetForLog}s → ${targetDuration}s`);
          console.log(`   📊 Decision: max(TTS ${actualNarrationDuration.toFixed(2)}s, Media ${mediaBasedDuration}s) = ${targetDuration}s`);
          
          if (actualNarrationDuration < mediaBasedDuration) {
            console.log(`   ⚠️  TTS (${actualNarrationDuration.toFixed(2)}s) < Media (${mediaBasedDuration}s) → Audio will be extended with silence`);
          } else if (actualNarrationDuration > mediaBasedDuration) {
            console.log(`   ⚠️  TTS (${actualNarrationDuration.toFixed(2)}s) > Media (${mediaBasedDuration}s) → Media will be extended with last frame`);
          } else {
            console.log(`   ✅ TTS (${actualNarrationDuration.toFixed(2)}s) ≈ Media (${mediaBasedDuration}s) → Perfect match!`);
          }
        } else {
          console.log(`   ✅ Target duration (${targetDuration}s) already matches requirements`);
        }
      }
      
      // CRITICAL: Ensure narration matches target duration EXACTLY
      // If narration is shorter, extend it by looping the last portion (not silence padding)
      let audioPath = rawAudioPath;
      let finalNarrationDuration = actualNarrationDuration;
      
      if (actualNarrationDuration < targetDuration * 0.9) {
        console.log(`⚠️  [Narration] Too short (${actualNarrationDuration.toFixed(2)}s), extending to ${targetDuration}s...`);
        // CRITICAL: Use silence padding instead of looping to avoid script repetition
        // Looping causes the script to repeat multiple times, which is unacceptable
        const extendedAudioPath = path.join(path.dirname(rawAudioPath), `video_${i + 1}_extended.wav`);
        try {
          const ffmpeg = require('fluent-ffmpeg');
          await new Promise((resolve, reject) => {
            // Use silence padding to extend audio (NOT looping - that causes script repetition!)
            ffmpeg(rawAudioPath)
              .audioFilters(`apad=whole_dur=${targetDuration}`)
              .output(extendedAudioPath)
              .on('end', () => {
                console.log(`✅ [Narration] Extended to ${targetDuration}s with silence padding (NO LOOP - prevents script repetition)`);
                resolve();
              })
              .on('error', (err) => {
                console.warn(`⚠️ Failed to extend narration: ${err.message}`);
                reject(err);
              })
              .run();
          });
          audioPath = extendedAudioPath;
          tempFiles.push(extendedAudioPath);
          // CRITICAL: Keep original narration duration for subtitle sync (don't use targetDuration)
          // Subtitle timing should be based on actual narration, not extended duration
          finalNarrationDuration = actualNarrationDuration; // Keep original for subtitle sync
        } catch (extendError) {
          console.warn('⚠️ Could not extend narration, using original');
        }
      } else if (actualNarrationDuration > targetDuration * 1.1) {
        // If narration is too long, check if we should trim
        // CRITICAL: NEVER trim custom scripts - user provided exact script, must read fully
        if (isCustomScript) {
          // Custom script: Update target to match actual narration (script must be read fully)
          console.log(`📝 [Custom Script] Narration (${actualNarrationDuration.toFixed(2)}s) longer than target (${targetDuration}s)`);
          console.log(`   ⚠️  NOT trimming - custom script must be read fully. Updating target to ${actualNarrationDuration.toFixed(2)}s`);
          targetDuration = Math.ceil(actualNarrationDuration);
          finalNarrationDuration = actualNarrationDuration; // Keep full narration
        } else {
          // AI-generated script: Trim to target duration
          console.log(`⚠️  [Narration] Too long (${actualNarrationDuration.toFixed(2)}s), trimming to ${targetDuration}s...`);
          const trimmedAudioPath = path.join(path.dirname(rawAudioPath), `video_${i + 1}_trimmed.wav`);
          try {
            const ffmpeg = require('fluent-ffmpeg');
            await new Promise((resolve, reject) => {
              ffmpeg(rawAudioPath)
                .audioFilters(`atrim=0:${targetDuration}`)
                .output(trimmedAudioPath)
                .on('end', () => {
                  console.log(`✅ [Narration] Trimmed to ${targetDuration}s`);
                  resolve();
                })
                .on('error', (err) => {
                  console.warn(`⚠️ Failed to trim narration: ${err.message}`);
                  reject(err);
                })
                .run();
            });
            audioPath = trimmedAudioPath;
            tempFiles.push(trimmedAudioPath);
            finalNarrationDuration = targetDuration;
          } catch (trimError) {
            console.warn('⚠️ Could not trim narration, using original');
          }
        }
      }
      
      // HYBRID MODE: Use custom music if provided, otherwise use AI-selected music
      let finalMusicPath = null;
      
      if (customInput.enabled && customInput.music && fs.existsSync(customInput.music)) {
        // Use custom uploaded music
        console.log(`🎵 [Custom] Using provided music: ${path.basename(customInput.music)}`);
        finalMusicPath = customInput.music;
        tempFiles.push(finalMusicPath);
      } else if (musicRecommendation && musicRecommendation.selected && musicRecommendation.selected.path) {
        // Use AI-selected music
        finalMusicPath = musicRecommendation.selected.path;
        console.log(`✅ [Music] Selected: ${musicRecommendation.selected.title} from ${musicRecommendation.selected.source}`);
        tempFiles.push(finalMusicPath);
      }
        
      // Mix with background music if available - ensure final audio is EXACTLY targetDuration
      if (finalMusicPath) {
        console.log(`🎵 [Music] Mixing with narration (target: ${targetDuration}s, narration: ${finalNarrationDuration.toFixed(2)}s)`);
        
        // Mix narration with background music - Music will loop to match target duration
        audioPath = await musicService.mixAudioWithMusic(audioPath, finalMusicPath, `video_${i + 1}_with_music.wav`, { targetDuration });
        tempFiles.push(audioPath);
        
        // Verify final audio duration matches target EXACTLY
        const finalDuration = await getAudioDuration(audioPath);
        console.log(`✅ [Final Audio] Duration: ${finalDuration.toFixed(2)}s (target: ${targetDuration}s)`);
        
        // If still not matching, force trim/extend to exact duration
        // CRITICAL: Use silence padding instead of looping to avoid script repetition
        // CRITICAL: NEVER trim custom scripts - must read fully
        if (Math.abs(finalDuration - targetDuration) > 2) {
          console.log(`⚠️  [Audio] Duration mismatch (${finalDuration.toFixed(2)}s vs ${targetDuration}s), adjusting...`);
          const adjustedAudioPath = path.join(path.dirname(audioPath), `video_${i + 1}_adjusted.wav`);
          try {
            const ffmpeg = require('fluent-ffmpeg');
            await new Promise((resolve, reject) => {
              if (finalDuration < targetDuration) {
                // CRITICAL: Extend by silence padding (NOT looping - prevents script repetition!)
                ffmpeg(audioPath)
                  .audioFilters(`apad=whole_dur=${targetDuration}`)
                  .output(adjustedAudioPath)
                  .on('end', () => {
                    console.log(`✅ [Audio] Extended to ${targetDuration}s with silence (NO LOOP)`);
                    resolve();
                  })
                  .on('error', reject)
                  .run();
              } else if (isCustomScript) {
                // Custom script: Update target to match actual duration (never trim)
                console.log(`📝 [Custom Script] Final audio (${finalDuration.toFixed(2)}s) longer than target (${targetDuration}s)`);
                console.log(`   ⚠️  NOT trimming - custom script must be read fully. Updating target to ${finalDuration.toFixed(2)}s`);
                targetDuration = Math.ceil(finalDuration);
                // Copy audio as-is (no trim)
                fs.copyFileSync(audioPath, adjustedAudioPath);
                resolve();
      } else {
                // AI-generated script: Trim to exact duration
                ffmpeg(audioPath)
                  .audioFilters(`atrim=0:${targetDuration}`)
                  .output(adjustedAudioPath)
                  .on('end', () => {
                    console.log(`✅ [Audio] Trimmed to ${targetDuration}s`);
                    resolve();
                  })
                  .on('error', reject)
                  .run();
              }
            });
            audioPath = adjustedAudioPath;
            tempFiles.push(adjustedAudioPath);
            console.log(`✅ [Audio] Adjusted to exactly ${targetDuration}s`);
          } catch (adjustError) {
            console.warn('⚠️ Could not adjust audio duration, using original');
          }
        }
      } else {
        // No music - ensure narration matches target duration
        // CRITICAL: NEVER trim custom scripts - must read fully
        if (Math.abs(finalNarrationDuration - targetDuration) > 1) {
          if (isCustomScript && finalNarrationDuration > targetDuration) {
            // Custom script: Update target to match actual narration (never trim)
            console.log(`📝 [Custom Script] Narration (${finalNarrationDuration.toFixed(2)}s) longer than target (${targetDuration}s)`);
            console.log(`   ⚠️  NOT trimming - custom script must be read fully. Updating target to ${finalNarrationDuration.toFixed(2)}s`);
            targetDuration = Math.ceil(finalNarrationDuration);
            // Audio is already correct, no adjustment needed
          } else {
            // AI-generated script or narration shorter: Adjust to target
            console.log(`⚠️  [Narration] Adjusting to exact target duration (${finalNarrationDuration.toFixed(2)}s -> ${targetDuration}s)`);
            const adjustedAudioPath = path.join(path.dirname(audioPath), `video_${i + 1}_adjusted.wav`);
            try {
              const ffmpeg = require('fluent-ffmpeg');
              await new Promise((resolve, reject) => {
              if (finalNarrationDuration < targetDuration) {
                // CRITICAL: Use silence padding instead of looping (prevents script repetition!)
                ffmpeg(audioPath)
                  .audioFilters(`apad=whole_dur=${targetDuration}`)
                  .output(adjustedAudioPath)
                  .on('end', () => {
                    console.log(`✅ [Narration] Extended to ${targetDuration}s with silence (NO LOOP)`);
                    resolve();
                  })
                  .on('error', reject)
                  .run();
              } else {
                // Only trim if NOT custom script (custom scripts must be read fully)
                if (isCustomScript) {
                  // Custom script: Update target to match actual narration (never trim)
                  console.log(`📝 [Custom Script] Narration (${finalNarrationDuration.toFixed(2)}s) longer than target (${targetDuration}s)`);
                  console.log(`   ⚠️  NOT trimming - custom script must be read fully. Updating target to ${finalNarrationDuration.toFixed(2)}s`);
                  targetDuration = Math.ceil(finalNarrationDuration);
                  // Copy audio as-is (no trim)
                  fs.copyFileSync(audioPath, adjustedAudioPath);
                  resolve();
                } else {
                  // AI-generated script: Trim to target duration
                  ffmpeg(audioPath)
                    .audioFilters(`atrim=0:${targetDuration}`)
                    .output(adjustedAudioPath)
                    .on('end', () => {
                      console.log(`✅ [Narration] Trimmed to ${targetDuration}s`);
                      resolve();
                    })
                    .on('error', reject)
                    .run();
                }
              }
              });
              audioPath = adjustedAudioPath;
              tempFiles.push(adjustedAudioPath);
              // CRITICAL: Keep original narration duration for subtitle sync
              // Don't change finalNarrationDuration - subtitles need actual narration length
              console.log(`✅ [Narration] Adjusted audio file (subtitle sync uses original ${finalNarrationDuration.toFixed(2)}s)`);
            } catch (adjustError) {
              console.warn('⚠️ Could not adjust narration duration, using original');
            }
          }
        }
        console.log(`✅ [Narration] Final duration: ${finalNarrationDuration.toFixed(2)}s (target: ${targetDuration}s)`);
      }
      
      // HYBRID MODE: Use custom images/videos if provided, otherwise fetch from stock sources
      let videoClips = [];
      
      if (customInput.enabled && ((customInput.images?.length || 0) > 0 || (customInput.videos?.length || 0) > 0)) {
        const imageEntries = (customInput.images || []).map((item, idx) => ({
          path: item.path,
          originalName: item.originalName || path.basename(item.path),
          storedName: item.storedName || path.basename(item.path),
          initialOrder: typeof item.order === 'number' ? item.order : idx,
          type: 'image',
          used: false
        }));
        
        const videoEntries = (customInput.videos || []).map((item, idx) => ({
          path: item.path,
          originalName: item.originalName || path.basename(item.path),
          storedName: item.storedName || path.basename(item.path),
          initialOrder: typeof item.order === 'number' ? item.order : idx,
          type: 'video',
          duration: 8,
          used: false
        }));
        
        console.log(`📸 [Custom] Using ${imageEntries.length} images + ${videoEntries.length} videos`);

        const addToMap = (map, key, entry) => {
          if (!key) return;
          const normalizedKey = key.trim().toLowerCase();
          if (!map.has(normalizedKey)) {
            map.set(normalizedKey, []);
          }
          map.get(normalizedKey).push(entry);
        };

        const consumeFromMap = (map, key) => {
          if (!key) return null;
          const normalizedKey = key.trim().toLowerCase();
          const list = map.get(normalizedKey);
          if (!list || list.length === 0) {
            return null;
          }
          while (list.length > 0) {
            const entry = list.shift();
            if (entry && !entry.used) {
              entry.used = true;
              return entry;
            }
          }
          return null;
        };

        const consumeFromQueue = (list) => {
          const entry = list.find(item => !item.used);
          if (entry) {
            entry.used = true;
            return entry;
          }
          return null;
        };

        const imageOriginalMap = new Map();
        const imageStoredMap = new Map();
        imageEntries.forEach(entry => {
          addToMap(imageOriginalMap, entry.originalName, entry);
          addToMap(imageStoredMap, entry.storedName, entry);
        });

        const videoOriginalMap = new Map();
        const videoStoredMap = new Map();
        videoEntries.forEach(entry => {
          addToMap(videoOriginalMap, entry.originalName, entry);
          addToMap(videoStoredMap, entry.storedName, entry);
        });

        let sequenceOrderCounter = 0;
        const pushClip = (entry) => {
          if (!entry || !entry.path) return;
          if (!fs.existsSync(entry.path)) {
            console.warn(`⚠️ [Custom] File path does not exist: ${entry.path}`);
            return;
          }
          videoClips.push({
            path: entry.path,
            source: 'custom',
            type: entry.type,
            quality: 100,
            order: sequenceOrderCounter++,
            duration: entry.type === 'video' ? (entry.duration || 8) : null,
            width: null,
            height: null
          });
          tempFiles.push(entry.path);
        };

        const sequenceItems = Array.isArray(customInput.mediaSequence) ? customInput.mediaSequence : [];

        if (sequenceItems.length > 0) {
          console.log(`📋 [Custom] Using mediaSequence for ordering (${sequenceItems.length} items)`);

          sequenceItems.forEach((seqItem, seqIndex) => {
            const desiredType = seqItem.type === 'video' ? 'video' : 'image';
            const lookupName = (seqItem.originalName || seqItem.filename || '').trim();
            let entry = null;

            if (desiredType === 'image') {
              entry = consumeFromMap(imageOriginalMap, lookupName) || consumeFromMap(imageStoredMap, lookupName);
              if (!entry) {
                entry = consumeFromQueue(imageEntries);
                if (entry) {
                  console.warn(`⚠️ [Custom] Image fallback used for sequence item ${seqIndex + 1} (${lookupName || 'unnamed'})`);
                }
              }
            } else {
              entry = consumeFromMap(videoOriginalMap, lookupName) || consumeFromMap(videoStoredMap, lookupName);
              if (!entry) {
                entry = consumeFromQueue(videoEntries);
                if (entry) {
                  console.warn(`⚠️ [Custom] Video fallback used for sequence item ${seqIndex + 1} (${lookupName || 'unnamed'})`);
                }
              }
            }

            if (entry) {
              entry.used = true;
              pushClip(entry);
            } else {
              console.warn(`⚠️ [Custom] Sequence item not matched: ${lookupName || 'unnamed'} (type: ${desiredType})`);
            }
          });
        } else {
          console.log(`📋 [Custom] No mediaSequence provided, using upload order (images first, then videos)`);
          imageEntries
            .sort((a, b) => a.initialOrder - b.initialOrder)
            .forEach(entry => {
              if (!entry.used) {
                entry.used = true;
                pushClip(entry);
              }
            });
          videoEntries
            .sort((a, b) => a.initialOrder - b.initialOrder)
            .forEach(entry => {
              if (!entry.used) {
                entry.used = true;
                pushClip(entry);
              }
            });
        }

        // Append any remaining unused media to ensure nothing is lost
        const remainingImages = imageEntries.filter(entry => !entry.used);
        const remainingVideos = videoEntries.filter(entry => !entry.used);
        if (remainingImages.length > 0 || remainingVideos.length > 0) {
          console.log(`ℹ️  [Custom] Appending ${remainingImages.length} unused images and ${remainingVideos.length} unused videos at the end`);
          remainingImages.forEach(entry => {
            entry.used = true;
            pushClip(entry);
          });
          remainingVideos.forEach(entry => {
            entry.used = true;
            pushClip(entry);
          });
        }

        console.log(`✅ [Custom] Prepared ${videoClips.length} media items for video montage (${videoClips.filter(c => c.type === 'image').length} images, ${videoClips.filter(c => c.type === 'video').length} videos)`);
      } else {
        // Fetch from stock sources (existing behavior)
      const keywords = extractVisualKeywords(scriptData.script);
      const searchTopic = (keywords && keywords.length > 0) ? keywords.slice(0,3).join(' ') : topic;
        console.log(`🔍 [AI] Searching stock videos for: "${searchTopic}"`);
      
      // Fetch from both sources in parallel - OPTIMAL COUNT FOR 30-45s VIDEOS
        // Pass videoFormat to get correct orientation (landscape for youtube, portrait for shorts)
      const [pexelsVideos, pixabayVideos] = await Promise.allSettled([
          pexelsService.fetchVideos(searchTopic, 5, options.videoFormat || 'shorts'), // 5 videos from Pexels
          pixabayService.fetchVideos(searchTopic, 5, options.videoFormat || 'shorts')  // 5 videos from Pixabay
      ]);
      
      if (pexelsVideos.status === 'fulfilled' && Array.isArray(pexelsVideos.value)) {
        videoClips.push(...pexelsVideos.value);
        pexelsVideos.value.forEach(v => tempFiles.push(v.path));
      }
      if (pixabayVideos.status === 'fulfilled' && Array.isArray(pixabayVideos.value)) {
        videoClips.push(...pixabayVideos.value);
        pixabayVideos.value.forEach(v => tempFiles.push(v.path));
      }

      // CRITICAL: We MUST have real videos - no fallback to images!
      if (videoClips.length < 5) {
        console.error(`❌ INSUFFICIENT VIDEOS: Only ${videoClips.length} videos found!`);
        console.log(`🔄 Trying broader search terms...`);
        
          // Try generic searches as last resort (with correct orientation)
        const genericSearches = ['people', 'lifestyle', 'nature', 'city', 'technology'];
        for (const generic of genericSearches) {
          if (videoClips.length >= 5) break;
          
          const [moreVideos] = await Promise.allSettled([
              pexelsService.fetchVideos(generic, 3, options.videoFormat || 'shorts')
          ]);
          
          if (moreVideos.status === 'fulfilled' && Array.isArray(moreVideos.value)) {
            videoClips.push(...moreVideos.value);
            moreVideos.value.forEach(v => tempFiles.push(v.path));
          }
        }
      }
      
      // Sort by quality and take the best ones
      videoClips.sort((a, b) => (b.quality || 0) - (a.quality || 0));
      videoClips = videoClips.slice(0, 8); // Take top 8 videos for 60-second video
      
        console.log(`🎬 [AI] Total HIGH-QUALITY videos collected: ${videoClips.length}`);
      }
      
      updateProgress(jobId, `Assembling video ${i + 1}/${count}`, (i / count) * 20 + 18);
      
      // Get final audio duration to pass to video assembly
      const finalAudioDuration = await getAudioDuration(audioPath);
      console.log(`🎯 [Video Assembly] Final audio duration: ${finalAudioDuration.toFixed(2)}s`);
      
      // CRITICAL: Use TTS script text for subtitles to ensure perfect synchronization
      // TTS reads ttsScriptText, so subtitles must match exactly what TTS read
      const subtitleScriptText = ttsScriptText; // Use the exact text that TTS read
      
      // CRITICAL: Use actual narration duration (NOT extended duration) for subtitle sync
      // finalNarrationDuration is the REAL narration length (without silence padding)
      // This ensures subtitles sync perfectly with the actual spoken words, not the extended audio
      const actualNarrationDurationForSubtitles = finalNarrationDuration || actualNarrationDuration;
      console.log(`🎯 [Subtitles] Using actual narration duration: ${actualNarrationDurationForSubtitles.toFixed(2)}s (NOT extended ${finalAudioDuration.toFixed(2)}s)`);
      
      // Assemble video with FFmpeg - use TTS script text for perfect subtitle sync
      const finalVideoPath = await videoService.assembleVideo({
        audioPath,
        videoClips,
        script: {
          text: subtitleScriptText,
          imageCount: customInput.enabled && customInput.images ? customInput.images.length : null,
          actualNarrationDuration: actualNarrationDurationForSubtitles, // CRITICAL: Pass actual narration duration
          parsedScript: parsedScript, // CRITICAL: Pass parsed script with scene info for audio-based timing
          audioPath: rawAudioPath, // CRITICAL FIX: Pass RAW TTS audio (NO music) for Whisper word-level timing
          finalAudioPath: audioPath // CRITICAL: Final audio with music for video output
        },
        videoIndex: i + 1,
        videoFormat: options.videoFormat || 'shorts', // NEW: Pass format (shorts or youtube)
        subtitlesEnabled: options.subtitlesEnabled !== false, // NEW: Pass subtitles option (default: true)
        targetDuration: finalAudioDuration // NEW: Pass target duration for montage
      });
      // CRITICAL: Don't add finalVideoPath to tempFiles - it will be saved for re-upload
      // tempFiles.push(finalVideoPath); // REMOVED - video will be saved to permanent storage
      
      updateProgress(jobId, `Uploading to YouTube ${i + 1}/${count}`, (i / count) * 20 + 19);
      
      // CRITICAL: Ensure title and description are clean and professional
      // Priority: Custom input > scriptData > AI generation
      let finalTitle;
      if (customInput.enabled && customInput.title) {
        // Use custom title if provided
        finalTitle = customInput.title.trim();
        console.log(`📝 [Title] Using custom title: ${finalTitle.substring(0, 60)}...`);
      } else {
        // Use scriptData title or generate with AI
        finalTitle = scriptData.title;
        if (!finalTitle || typeof finalTitle !== 'string' || finalTitle.includes('{') || finalTitle.includes('[')) {
          finalTitle = aiService.generateViralTitle(topic, options);
          console.log(`📝 [Title] Generated new title with duration awareness: ${finalTitle}`);
        } else {
          // Clean title from any JSON artifacts
          finalTitle = finalTitle
            .replace(/^\{[\s\S]*?"title":\s*"/m, '')
            .replace(/"[\s\S]*\}$/m, '')
            .replace(/\\n/g, ' ')
            .replace(/\\/g, '')
            .replace(/\{[\s\S]*?\}/g, '')
            .replace(/\[[\s\S]*?\]/g, '')
            .trim();
        }
      }
      
      // Generate description with JSON cleaning and duration awareness
      // Priority: Custom input > scriptData > AI generation
      let finalDescription;
      if (customInput.enabled && customInput.description) {
        // Use custom description if provided
        finalDescription = customInput.description.trim();
        console.log(`📝 [Description] Using custom description (${finalDescription.length} chars)`);
      } else {
        // Use scriptData description or generate with AI
        finalDescription = scriptData.description;
        if (!finalDescription || typeof finalDescription !== 'string' || finalDescription.includes('{') || finalDescription.includes('[')) {
          finalDescription = aiService.generateSEODescription(cleanScriptText, topic, options);
          console.log(`📝 [Description] Generated new description with duration awareness`);
        } else {
          // Clean description from any JSON artifacts
          finalDescription = finalDescription
            .replace(/^\{[\s\S]*?"description":\s*"/m, '')
            .replace(/"[\s\S]*\}$/m, '')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\{[\s\S]*?\}/g, '')
            .replace(/\[[\s\S]*?\]/g, '')
            .trim();
        }
      }
      
      // CRITICAL: Determine final tags - Priority: Custom tags > scriptData.hashtags > AI generation
      let finalTags;
      if (customInput.enabled && customInput.tags && customInput.tags.length > 0) {
        // Use custom tags if provided
        finalTags = customInput.tags;
        console.log(`🏷️  [Tags] Using custom tags (${finalTags.length} tags): ${finalTags.slice(0, 5).join(', ')}${finalTags.length > 5 ? '...' : ''}`);
      } else if (scriptData.hashtags && scriptData.hashtags.length > 0) {
        // Use scriptData hashtags (from AI generation)
        finalTags = scriptData.hashtags;
        console.log(`🏷️  [Tags] Using AI-generated tags (${finalTags.length} tags): ${finalTags.slice(0, 5).join(', ')}${finalTags.length > 5 ? '...' : ''}`);
      } else {
        // Fallback: Generate tags with AI
        finalTags = aiService.generateViralHashtags(topic || 'Video', options);
        console.log(`🏷️  [Tags] Generated fallback tags (${finalTags.length} tags)`);
      }
      
      // Upload to YouTube
      try {
        console.log(`🚀 Starting YouTube upload for video ${i + 1}/${count}...`);
        console.log(`📝 [Metadata] Title: ${finalTitle.substring(0, 60)}...`);
        console.log(`📝 [Metadata] Description: ${finalDescription.substring(0, 80)}...`);
        console.log(`🏷️  [Metadata] Tags: ${finalTags.slice(0, 5).join(', ')}${finalTags.length > 5 ? `... (${finalTags.length - 5} more)` : ''}`);
        let uploadResult;
        try {
          uploadResult = await youtubeService.uploadVideo({
          videoPath: finalVideoPath,
            title: finalTitle,
            description: finalDescription,
            tags: finalTags,
            publishAt: publishDate,
            thumbnailPath: customInput.thumbnail || null
          });
        } catch (uploadError) {
          // Check if it's an authentication error
          if (uploadError.message && uploadError.message.includes('authentication expired')) {
            console.error(`❌ [YouTube Upload] Authentication error: ${uploadError.message}`);
            updateProgress(jobId, `❌ YouTube authentication expired. Please reconnect your account.`, 100);
            throw new Error(`YouTube upload failed: ${uploadError.message}`);
          }
          throw uploadError;
        }
        
        // CRITICAL: Save video to permanent storage before cleanup (for multi-channel re-upload)
        let savedVideoId = null;
        try {
          const currentAccount = youtubeService.getCurrentAccount();
          const savedVideo = await videoStorageService.saveVideo(finalVideoPath, {
            title: finalTitle,
            description: finalDescription,
            tags: finalTags,
            topic: topic || '',
            script: cleanScriptText,
            videoFormat: options.videoFormat || 'shorts',
            thumbnailPath: customInput.thumbnail || null
          });
          
          savedVideoId = savedVideo.videoId;
          
          // Add upload history
          await videoStorageService.addUploadHistory(savedVideoId, {
            accountId: currentAccount?.accountId || null,
            channelName: currentAccount?.channelInfo?.title || 'Unknown Channel',
            channelId: currentAccount?.channelInfo?.id || null,
            youtubeVideoId: uploadResult.videoId,
            youtubeUrl: uploadResult.url
          });
          
          console.log(`💾 [VideoStorage] Video saved for re-upload: ${savedVideoId}`);
        } catch (storageError) {
          console.warn(`⚠️ [VideoStorage] Failed to save video (non-critical): ${storageError.message}`);
          // Don't fail the upload if storage fails
        }
        
        // Update progress with completed video
        progress.videos.push({
          title: finalTitle,
          videoId: uploadResult.videoId,
          url: `https://youtube.com/watch?v=${uploadResult.videoId}`,
          savedVideoId: savedVideoId // Include saved video ID for re-upload feature
        });
        
        console.log(`✅ Video ${i + 1}/${count} uploaded successfully: ${uploadResult.url}`);
        updateProgress(jobId, `Video ${i + 1}/${count} completed`, ((i + 1) / count) * 100);
        
        // OPTIONAL: Cross-post to Instagram if enabled, account is connected, and video format is Shorts
        // CRITICAL: Only Shorts format (9:16, max 90s) is suitable for Instagram Reels
        if (options.crossPostToInstagram && savedVideoId && options.videoFormat === 'shorts') {
          try {
            const instagramAccount = instagramService.getCurrentAccount();
            if (instagramAccount) {
              console.log(`📱 [Instagram] Cross-posting Shorts to Instagram Reels...`);
              
              // Add watermark for Instagram
              let watermarkedVideoPath = finalVideoPath;
              try {
                const currentAccount = youtubeService.getCurrentAccount();
                const channelUrl = `https://youtube.com/channel/${currentAccount?.channelInfo?.id || ''}`;
                watermarkedVideoPath = await videoWatermarkService.addSimpleWatermark(
                  finalVideoPath,
                  '📺 Full video on YouTube',
                  'bottom-right'
                );
                console.log(`✅ [Instagram] Watermark added for cross-posting`);
              } catch (watermarkError) {
                console.warn(`⚠️ [Instagram] Watermark failed, using original video: ${watermarkError.message}`);
              }
              
              // Generate Instagram caption
              const instagramCaption = instagramMetadataService.generateCompleteCaption({
                title: finalTitle,
                description: finalDescription,
                tags: finalTags,
                topic: topic || '',
                youtubeUrl: uploadResult.url,
                videoFormat: options.videoFormat || 'shorts'
              });
              
              // Upload to Instagram (async - don't block)
              instagramService.uploadReel({
                videoPath: watermarkedVideoPath,
                caption: instagramCaption,
                accountId: instagramService.currentAccountId
              }).then(instagramResult => {
                console.log(`✅ [Instagram] Cross-posted successfully: ${instagramResult.url}`);
                
                // Add Instagram upload history
                videoStorageService.addUploadHistory(savedVideoId, {
                  platform: 'instagram',
                  accountId: instagramService.currentAccountId,
                  username: instagramAccount.username,
                  reelId: instagramResult.reelId,
                  reelUrl: instagramResult.url
                }).catch(err => {
                  console.warn(`⚠️ [Instagram] Failed to add upload history: ${err.message}`);
                });
                
                // Clean up watermarked video after upload
                if (watermarkedVideoPath !== finalVideoPath && fs.existsSync(watermarkedVideoPath)) {
                  setTimeout(() => {
                    try {
                      fs.unlinkSync(watermarkedVideoPath);
                      console.log(`🧹 [Instagram] Cleaned up watermarked video`);
                    } catch (cleanupError) {
                      console.warn(`⚠️ [Instagram] Failed to cleanup: ${cleanupError.message}`);
                    }
                  }, 10000); // Wait 10 seconds
                }
            }).catch(instagramError => {
              // Check if it's an authentication error
              if (instagramError.message && instagramError.message.includes('authentication expired')) {
                console.error(`❌ [Instagram] Cross-posting failed: ${instagramError.message}`);
                console.error(`⚠️ [Instagram] Please reconnect your Instagram account to continue cross-posting`);
              } else {
                console.error(`❌ [Instagram] Cross-posting failed: ${instagramError.message}`);
              }
              // Don't fail the entire job if Instagram upload fails
            });
            } else {
              console.log(`⚠️ [Instagram] Cross-posting enabled but no Instagram account connected`);
            }
          } catch (crossPostError) {
            console.warn(`⚠️ [Instagram] Cross-posting error (non-critical): ${crossPostError.message}`);
            // Don't fail the entire job if cross-posting fails
          }
        }
        
        // OPTIONAL: Cross-post to TikTok if enabled and account is connected
        if (options.crossPostToTikTok && savedVideoId) {
          try {
            const tiktokAccount = tiktokService.getCurrentAccount();
            if (tiktokAccount) {
              console.log(`📱 [TikTok] Cross-posting to TikTok...`);
              
              // Generate TikTok caption (simpler than Instagram)
              const tiktokCaption = `${finalTitle}\n\n${finalDescription || ''}`.trim();
              
              // Upload to TikTok (async - don't block)
              tiktokService.uploadVideo({
                videoPath: finalVideoPath,
                caption: tiktokCaption,
                privacyLevel: 'PUBLIC_TO_EVERYONE',
                accountId: tiktokService.currentAccountId
              }).then(tiktokResult => {
                console.log(`✅ [TikTok] Cross-posted successfully: ${tiktokResult.url}`);
                
                // Add TikTok upload history
                videoStorageService.addUploadHistory(savedVideoId, {
                  platform: 'tiktok',
                  accountId: tiktokService.currentAccountId,
                  username: tiktokAccount.username,
                  videoId: tiktokResult.videoId,
                  videoUrl: tiktokResult.url
                }).catch(err => {
                  console.warn(`⚠️ [TikTok] Failed to add upload history: ${err.message}`);
                });
              }).catch(tiktokError => {
                // Check if it's an authentication error
                if (tiktokError.message && (tiktokError.message.includes('expired') || tiktokError.message.includes('refresh'))) {
                  console.error(`❌ [TikTok] Cross-posting failed: ${tiktokError.message}`);
                  console.error(`⚠️ [TikTok] Please reconnect your TikTok account to continue cross-posting`);
                } else {
                  console.error(`❌ [TikTok] Cross-posting failed: ${tiktokError.message}`);
                }
                // Don't fail the entire job if TikTok upload fails
              });
            } else {
              console.log(`⚠️ [TikTok] Cross-posting enabled but no TikTok account connected`);
            }
          } catch (crossPostError) {
            console.warn(`⚠️ [TikTok] Cross-posting error (non-critical): ${crossPostError.message}`);
            // Don't fail the entire job if cross-posting fails
          }
        }
        
        // Clean up temp files for this video (but keep saved video and finalVideoPath)
        // CRITICAL: Don't delete finalVideoPath - it's already saved to permanent storage
        const tempFilesToClean = tempFiles.filter(f => f !== finalVideoPath);
        await cleanupService.cleanupAfterProcessing(tempFilesToClean);
        tempFiles.length = 0; // Clear array
        
        // Clean up finalVideoPath after a delay (to ensure it's saved)
        setTimeout(async () => {
          try {
            if (fs.existsSync(finalVideoPath)) {
              fs.unlinkSync(finalVideoPath);
              console.log(`🗑️ [Cleanup] Deleted original video file: ${path.basename(finalVideoPath)}`);
            }
          } catch (error) {
            console.warn(`⚠️ [Cleanup] Could not delete original video file: ${error.message}`);
          }
        }, 5000); // 5 second delay to ensure video is saved
        
      } catch (uploadError) {
        console.error(`❌ YouTube upload failed for video ${i + 1}/${count}:`, uploadError.message);
        progress.errors.push(`Upload failed: ${uploadError.message}`);
        updateProgress(jobId, `Upload failed for video ${i + 1}/${count}`, ((i + 1) / count) * 100, 'error');
        
        // Clean up temp files even on error
        await cleanupService.cleanupAfterProcessing(tempFiles);
        tempFiles.length = 0;
        
        // Continue with next video instead of stopping
        continue;
      }
    }
    
    updateProgress(jobId, 'All videos completed successfully!', 100, 'completed');
    progress.completedAt = Date.now();
    
  } catch (error) {
    console.error('❌ Error processing videos:', error);
    progress.errors.push(error.message);
    updateProgress(jobId, `Error: ${error.message}`, progress.progress, 'error');
    progress.completedAt = Date.now();
    
    // Clean up any remaining temp files
    if (tempFiles.length > 0) {
      await cleanupService.cleanupAfterProcessing(tempFiles);
    }
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

// Start cleanup service
cleanupService.scheduleAutomaticCleanup();

app.listen(PORT, () => {
  console.log('\n🚀 YouTube Shorts Automation Platform');
  console.log('=====================================');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🎬 Ready to create amazing YouTube Shorts!`);
  console.log('\n✅ Services Status:');
  console.log('   • AI Service: Ready');
  console.log('   • TTS Service: Ready (Piper TTS priority)');
  console.log('   • Music Service: Ready (Freesound + Synthetic)');
  console.log('   • Video Service: Ready');
  console.log('   • Cleanup Service: Scheduled');
  console.log('\n🔧 Next Steps:');
  console.log('   1. Check your .env file (use .env.example as template)');
  console.log('   2. Authenticate with YouTube via dashboard');
  console.log('   3. Start creating viral content!');
  console.log('\n💡 All services optimized for FREE usage!\n');
});