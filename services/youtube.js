const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const seoService = require('./seoService');

class YouTubeService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback';
    
    this.oauth2Client = null;
    this.youtube = null;
    this.tokensPath = path.join(__dirname, '..', 'temp', 'youtube_tokens.json');
    
    this.initializeAuth();
  }

  initializeAuth() {
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  YouTube credentials not configured');
      console.log('Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env file');
      console.log('Get credentials from: https://console.cloud.google.com/apis/credentials');
      return;
    }

    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      // Set up auto-refresh of tokens
      this.oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
          // Store the refresh token
          this.saveTokens(tokens);
        }
      });

      // Load saved tokens if they exist
      this.loadSavedTokens();

      // Initialize YouTube API client
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      
      console.log('✅ YouTube service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize YouTube service:', error.message);
      throw error;
    }
  }

  getAuthUrl() {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleCallback(code) {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Save tokens for future use
      this.saveTokens(tokens);
      
      console.log('✅ YouTube authentication successful');
      return tokens;
    } catch (error) {
      console.error('YouTube auth error:', error);
      throw new Error('Failed to authenticate with YouTube');
    }
  }

  loadSavedTokens() {
    try {
      if (fs.existsSync(this.tokensPath)) {
        const tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8'));
        this.oauth2Client.setCredentials(tokens);
        console.log('✅ Loaded saved YouTube tokens');
      }
    } catch (error) {
      console.error('Failed to load saved tokens:', error);
    }
  }

  saveTokens(tokens) {
    try {
      const tempDir = path.dirname(this.tokensPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(this.tokensPath, JSON.stringify(tokens, null, 2));
      console.log('💾 YouTube tokens saved');
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  isAuthenticated() {
    if (!this.oauth2Client) return false;
    
    const credentials = this.oauth2Client.credentials;
    return !!(credentials.access_token || credentials.refresh_token);
  }

  /**
   * Uploads a video to YouTube with SEO optimization
   * @param {Object|string} params - Either parameters object or videoPath string
   * @param {string} [params.videoPath] - Path to the video file (required)
   * @param {string} [params.title] - Video title (will be SEO optimized if empty)
   * @param {string} [params.description] - Video description (will be SEO optimized if empty)
   * @param {string[]} [params.tags] - Array of video tags (will be generated if empty)
   * @param {string|Date} [params.publishAt] - Publish date (for scheduling)
   * @param {string} [params.topic] - Video topic for SEO optimization
   * @param {boolean} [params.enableABTest] - Whether to generate A/B test variations
   * @param {string[]} [params.translateTo] - Array of language codes to translate to
   * @returns {Promise<Object>} Upload result with videoId, URL, and variations
   */
  async uploadVideo(params) {
    console.log('🚀 Starting YouTube upload process with SEO optimization...');
    
    // Parameter extraction with better validation
    let videoPath, title, description, tags = [], publishAt = null, topic = '', enableABTest = false, translateTo = [];
    
    try {
      // Handle both parameter styles
      if (typeof params === 'string') {
        videoPath = params;
        title = arguments[1] || '';
        description = arguments[2] || '';
        tags = Array.isArray(arguments[3]) ? arguments[3] : [];
        publishAt = arguments[4] || null;
        topic = arguments[5] || '';
      } else if (params && typeof params === 'object') {
        videoPath = params.videoPath || '';
        title = params.title || '';
        description = params.description || '';
        tags = Array.isArray(params.tags) ? params.tags : [];
        publishAt = params.publishAt || null;
        topic = params.topic || '';
        enableABTest = !!params.enableABTest;
        translateTo = Array.isArray(params.translateTo) ? params.translateTo : [];
      } else {
        throw new Error('Invalid parameters for uploadVideo');
      }
      
      // Validate required parameters
      if (!videoPath || typeof videoPath !== 'string') {
        throw new Error('videoPath is required and must be a string');
      }
      
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Generate SEO optimized metadata if needed
      if (!title || !description || !tags.length) {
        console.log('🔍 Generating SEO optimized metadata...');
        const seoData = await seoService.generateSEOMetadata(topic || title || 'video content');
        
        // Only override if not provided
        if (!title) title = seoData.title;
        if (!description) description = seoData.description;
        if (!tags.length) tags = seoData.tags;
      }

      // Generate safe metadata
      title = this.generateSafeTitle(title);
      description = this.generateSafeDescription(description);
      tags = this.processTags(tags);
      
      console.log('📝 Video metadata:');
      console.log(`- Title: ${title}`);
      console.log(`- Description: ${description.substring(0, 50)}...`);
      console.log(`- Tags: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? `... (${tags.length - 5} more)` : ''}`);
      console.log(`- Publish at: ${publishAt || 'Immediately'}`);
      
      // Handle A/B testing variations if enabled
      let variations = [];
      if (enableABTest) {
        console.log('🧪 Generating A/B test variations...');
        const baseMetadata = { title, description, tags };
        variations = seoService.generateABTestVariations(baseMetadata);
        console.log(`✅ Generated ${variations.length} A/B test variations`);
      }

      // Handle translations if requested
      const translations = {};
      if (translateTo.length > 0) {
        console.log('🌍 Processing translations...');
        for (const lang of translateTo) {
          try {
            const [translatedTitle, translatedDesc] = await Promise.all([
              seoService.translateText(title, lang),
              seoService.translateText(description, lang)
            ]);
            translations[lang] = {
              title: translatedTitle,
              description: translatedDesc,
              tags: await Promise.all(tags.map(tag => seoService.translateText(tag, lang)))
            };
            console.log(`✅ Translated to ${lang}: ${translatedTitle.substring(0, 30)}...`);
          } catch (error) {
            console.error(`❌ Failed to translate to ${lang}:`, error.message);
          }
        }
      }
      
      // Initialize YouTube client if needed
      if (!this.oauth2Client) {
        throw new Error('YouTube client not initialized. Check your credentials.');
      }
      
      // Ensure we have valid credentials
      if (!this.oauth2Client.credentials) {
        await this.loadTokens();
      }
      
      // Refresh token if needed
      if (this.oauth2Client.credentials.expiry_date < Date.now()) {
        await this.oauth2Client.refreshAccessToken();
      }

      const videoMetadata = {
        snippet: {
          title: title || 'Generated YouTube Short',
          description: description || 'Created with YouTube Shorts Automation',
          tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(tag => tag.trim()) : []),
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: publishAt ? 'private' : 'public',
          selfDeclaredMadeForKids: false,
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
          ...(publishAt && { publishAt: new Date(publishAt).toISOString() })
        }
      };

      // Add publish time if provided
      if (publishAt) {
        videoMetadata.status.publishAt = new Date(publishAt).toISOString();
        videoMetadata.status.privacyStatus = 'private'; // Required for scheduled videos
      }

      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: videoMetadata,
        media: {
          body: fs.createReadStream(videoPath)
        }
      });

      const videoId = response.data.id;
      const videoUrl = `https://youtube.com/watch?v=${videoId}`;
      const videoTitle = response.data.snippet.title;
      
      console.log('🎉 ===== YOUTUBE UPLOAD SUCCESSFUL! =====');
      console.log(`📺 Video Title: ${videoTitle}`);
      console.log(`🔗 Video URL: ${videoUrl}`);
      console.log(`📊 Video ID: ${videoId}`);
      console.log(`⏰ Upload Time: ${new Date().toLocaleString()}`);
      console.log(`📱 Status: ${publishAt ? 'Scheduled for ' + new Date(publishAt).toLocaleString() : 'Published Now'}`);
      console.log('==========================================');
      
      return {
        videoId,
        url: videoUrl,
        title: videoTitle,
        status: publishAt ? 'scheduled' : 'published',
        publishAt: publishAt || new Date().toISOString(),
        message: `🎉 Video "${videoTitle}" successfully ${publishAt ? 'scheduled' : 'published'}!`
      };

    } catch (error) {
      console.error('YouTube upload error:', error);
      
      if (error.code === 401) {
        throw new Error('YouTube authentication expired. Please re-authenticate.');
      }
      
      throw new Error(`YouTube upload failed: ${error.message}`);
    }
  }

  async createVideoMontage(videoClips, videoIndex) {
    const montageOutput = path.join(this.outputDir, `montage_temp_${videoIndex}.mp4`);

    return new Promise((resolve, reject) => {
      // Filter valid video clips
      const validClips = videoClips.filter(clip => 
        clip.path && !clip.isPlaceholder && fs.existsSync(clip.path)
      );

      if (validClips.length === 0) {
        // Create a colored background video
        return this.createColoredBackground(montageOutput, resolve, reject);
      }

      const command = ffmpeg();
      
      // Add each video clip
      validClips.forEach(clip => {
        command.input(clip.path);
      });

      // Create filter to resize and concatenate videos
      let filterComplex = '';
      
      // Scale each video to Shorts format (1080x1920)
      validClips.forEach((_, index) => {
        filterComplex += `[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[v${index}];`;
      });
      
      // Concatenate all scaled videos
      const videoInputs = validClips.map((_, index) => `[v${index}]`).join('');
      filterComplex += `${videoInputs}concat=n=${validClips.length}:v=1:a=0[outv]`;

      command
        .complexFilter(filterComplex)
        .map('[outv]')
        .noAudio() // Remove audio from source videos
        .duration(30) // Keep to 30 seconds
        .fps(30)
        .videoCodec('libx264')
        .outputOptions(['-preset', 'fast', '-crf', '23'])
        .output(montageOutput)
        .on('end', () => resolve(montageOutput))
        .on('error', (error) => {
          console.error('Montage creation failed:', error);
          this.createColoredBackground(montageOutput, resolve, reject);
        })
        .run();
    });
  }

  createColoredBackground(outputPath, resolve, reject) {
    // Create a gradient background video as fallback
    ffmpeg()
      .input('color=c=0x1e3a8a:s=1080x1920:d=30:r=30')
      .inputFormat('lavfi')
      .videoCodec('libx264')
      .outputOptions(['-preset', 'fast', '-crf', '23'])
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Created background video: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  }

  async addAudioAndSubtitles(videoPath, audioPath, script, outputPath) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg().input(videoPath);

      let filterComplex = '[0:v]';
      let mapVideo = '[video]';
      let mapAudio = null;

      // Add audio if available
      if (audioPath && fs.existsSync(audioPath)) {
        command.input(audioPath);
        filterComplex = '[0:v]';
        mapAudio = '[1:a]';
        
        // Ensure audio duration matches video
        command.audioFilters('apad=pad_dur=30');
      }

      // Add subtitle filter if script is available
      if (script && script.trim().length > 0) {
        const subtitleFilter = this.generateSubtitleFilter(script);
        filterComplex += subtitleFilter;
      }

      filterComplex += mapVideo;

      command
        .complexFilter(filterComplex)
        .map(mapVideo);

      // Map audio if available
      if (mapAudio) {
        command.map(mapAudio);
      }

      command
        .duration(30)
        .fps(30)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset', 'fast',
          '-crf', '23',
          '-avoid_negative_ts', 'make_zero'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generates a safe title that meets YouTube's requirements
   * @param {string} title - The original title
   * @returns {string} Safe title
   */
  generateSafeTitle(title) {
    // Ensure title is a string
    let safeTitle = String(title || '').trim();
    
    // If empty or too short, generate a default title
    if (safeTitle.length < 3) {
      safeTitle = `YouTube Short - ${new Date().toLocaleString()}`;
      console.log('ℹ️  Using auto-generated title');
    }
    
    // Ensure title is not too long (YouTube limit: 100 chars)
    if (safeTitle.length > 100) {
      safeTitle = safeTitle.substring(0, 97) + '...';
      console.log('ℹ️  Truncated title to 100 characters');
    }
    
    return safeTitle;
  }

  /**
   * Generates a safe description that meets YouTube's requirements
   * @param {string} desc - The original description
   * @returns {string} Safe description
   */
  generateSafeDescription(desc) {
    // Ensure description is a string
    let safeDesc = String(desc || '').trim();
    
    // If empty, use a default description
    if (safeDesc.length === 0) {
      safeDesc = 'Created with YouTube Shorts Automation Platform\n\n';
      safeDesc += '🔔 Subscribe for more amazing content!\n';
      safeDesc += '👍 Like and share if you enjoyed this video!\n';
      safeDesc += '💬 Leave a comment below with your thoughts!';
      console.log('ℹ️  Using default description');
    }
    
    // Ensure description is not too long (YouTube limit: 5000 chars)
    if (safeDesc.length > 5000) {
      safeDesc = safeDesc.substring(0, 4997) + '...';
      console.log('ℹ️  Truncated description to 5000 characters');
    }
    
    return safeDesc;
  }

  /**
   * Processes and validates video tags
   * @param {Array} tags - Array of tag strings
   * @returns {Array} Processed tags array
   */
  processTags(tags) {
    if (!Array.isArray(tags)) {
      tags = [];
    }
    
    // Add default tags if none provided
    if (tags.length === 0) {
      tags = ['shorts', 'youtubeshorts', 'viral', 'trending'];
    }
    
    // Process each tag
    return tags
      .filter(tag => {
        // Remove non-string tags
        if (typeof tag !== 'string') return false;
        
        // Remove empty tags after trimming
        const trimmed = tag.trim();
        if (!trimmed) return false;
        
        // Remove tags that are too long (YouTube limit: 30 chars)
        if (trimmed.length > 30) {
          console.log(`ℹ️  Removed tag (too long): ${trimmed}`);
          return false;
        }
        
        return true;
      })
      .map(tag => tag.trim().toLowerCase())
      .filter((tag, index, self) => self.indexOf(tag) === index) // Remove duplicates
      .slice(0, 15); // YouTube limit: 15 tags
  }

  generateSubtitleFilter(script) {
    // Create simple subtitles that appear throughout the video
    const cleanScript = script
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/:/g, '\\:')
      .substring(0, 100); // Limit length

    return `drawtext=text='${cleanScript}':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.7:boxborderw=3:x=(w-text_w)/2:y=h-120:enable='between(t,2,28)'`;
  }

  // Test the AI service connection
  async testConnection() {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Test by getting channel info
      const response = await this.youtube.channels.list({
        part: ['snippet'],
        mine: true
      });

      return { 
        success: true, 
        channelTitle: response.data.items[0]?.snippet?.title || 'Unknown Channel'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new YouTubeService();