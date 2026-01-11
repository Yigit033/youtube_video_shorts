const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const seoService = require('./seoService');

class YouTubeEnhanced {
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
          this.saveTokens(tokens);
        }
      });

      // Load saved tokens if they exist
      this.loadSavedTokens();

      // Initialize YouTube API client
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      
      console.log('✅ YouTube Enhanced service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize YouTube Enhanced service:', error.message);
      throw error;
    }
  }

  async loadSavedTokens() {
    try {
      if (fs.existsSync(this.tokensPath)) {
        const tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8'));
        this.oauth2Client.setCredentials(tokens);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load saved tokens:', error.message);
    }
  }

  async saveTokens(tokens) {
    try {
      const dir = path.dirname(this.tokensPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.tokensPath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('❌ Failed to save tokens:', error.message);
    }
  }

  isAuthenticated() {
    if (!this.oauth2Client) return false;
    const credentials = this.oauth2Client.credentials;
    return !!(credentials.access_token || credentials.refresh_token);
  }

  /**
   * Uploads a video to YouTube with SEO optimization
   * @param {Object} options - Upload options
   * @param {string} options.videoPath - Path to the video file
   * @param {string} [options.title] - Video title
   * @param {string} [options.description] - Video description
   * @param {string[]} [options.tags] - Array of video tags
   * @param {string|Date} [options.publishAt] - Publish date (for scheduling)
   * @param {string} [options.topic] - Video topic for SEO optimization
   * @param {boolean} [options.enableABTest] - Whether to generate A/B test variations
   * @param {string[]} [options.translateTo] - Array of language codes to translate to
   * @returns {Promise<Object>} Upload result with videoId and URL
   */
  async uploadVideo({
    videoPath,
    title = '',
    description = '',
    tags = [],
    publishAt = null,
    topic = '',
    enableABTest = false,
    translateTo = []
  } = {}) {
    console.log('🚀 Starting YouTube upload process with SEO optimization...');
    
    try {
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
      
      // Handle A/B testing variations if enabled (limited in free tier)
      let variations = [];
      if (enableABTest) {
        console.log('🧪 Generating A/B test variations (limited in free tier)...');
        const baseMetadata = { 
          title: this.generateSafeTitle(title),
          description: this.generateSafeDescription(description),
          tags: this.processTags(tags)
        };
        
        // Simple A/B variations without API calls
        variations = [
          { 
            ...baseMetadata, 
            title: `🤔 ${baseMetadata.title} - Did You Know?`,
            variation: 'question'
          },
          { 
            ...baseMetadata, 
            title: `🔥 ${baseMetadata.title.split(' - ')[0]} - Viral Trend!`,
            variation: 'trending'
          }
        ];
        
        console.log(`✅ Generated ${variations.length} A/B test variations`);
      }

      // Handle translations if requested (limited to 2 languages in free tier)
      const translations = {};
      const maxFreeTranslations = 2; // Limit to 2 languages in free tier
      
      if (translateTo.length > 0) {
        console.log('🌍 Processing translations (limited to 2 languages in free tier)...');
        const languagesToTranslate = translateTo.slice(0, maxFreeTranslations);
        
        for (const lang of languagesToTranslate) {
          try {
            // Only translate title and first 3 tags to save on API usage
            const [translatedTitle, translatedDesc] = await Promise.all([
              seoService.translateText(title, lang),
              seoService.translateText(description.substring(0, 100), lang) // Only first 100 chars
            ]);
            
            // Translate only first 3 tags to save on API usage
            const translatedTags = [];
            for (let i = 0; i < Math.min(3, tags.length); i++) {
              const translatedTag = await seoService.translateText(tags[i], lang);
              translatedTags.push(translatedTag);
            }
            
            translations[lang] = {
              title: translatedTitle,
              description: translatedDesc,
              tags: [...translatedTags, lang] // Add language code as a tag
            };
            
            console.log(`✅ Translated to ${lang}: ${translatedTitle.substring(0, 30)}...`);
          } catch (error) {
            console.error(`❌ Failed to translate to ${lang}:`, error.message);
            // Continue with other languages even if one fails
          }
        }
      }
      
      // Initialize YouTube client if needed
      if (!this.oauth2Client) {
        throw new Error('YouTube client not initialized. Check your credentials.');
      }
      
      // Ensure we have valid credentials
      if (!this.oauth2Client.credentials) {
        await this.loadSavedTokens();
      }

      // Refresh token if needed
      if (this.oauth2Client.credentials.expiry_date < Date.now()) {
        await this.oauth2Client.refreshAccessToken();
      }

      // Function to upload a single video variation
      const uploadVariation = async (metadata, suffix = '') => {
        try {
          const videoMetadata = {
            snippet: {
              title: metadata.title + (suffix ? ` ${suffix}` : ''),
              description: metadata.description,
              tags: metadata.tags,
              categoryId: '1', // Film & Animation (changed from People & Blogs for documentary/history videos)
              defaultLanguage: 'en-US', // Video language: English (United States)
              defaultAudioLanguage: 'en-US' // Title and description language: English (United States)
            },
            status: {
              privacyStatus: 'private', // Start as private for review
              selfDeclaredMadeForKids: false
            }
          };

          // Schedule if publishAt is provided
          if (publishAt) {
            videoMetadata.status.publishAt = new Date(publishAt).toISOString();
            videoMetadata.status.privacyStatus = 'private';
          }

          console.log(`📤 Uploading video${suffix ? ' ' + suffix : ''}...`);
          const response = await this.youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: videoMetadata,
            media: {
              body: fs.createReadStream(videoPath),
              mimeType: 'video/*'
            }
          });

          const videoId = response.data.id;
          const videoUrl = `https://youtu.be/${videoId}`;
          console.log(`✅ Video uploaded${suffix ? ' ' + suffix : ''}: ${videoUrl}`);
          
          return { videoId, url: videoUrl, metadata };
        } catch (error) {
          console.error(`❌ Upload failed${suffix ? ' ' + suffix : ''}:`, error.message);
          throw error;
        }
      };

      // Upload main video
      const mainUpload = await uploadVariation({ title, description, tags });
      const results = [mainUpload];

      // Upload A/B test variations
      for (const [index, variation] of variations.entries()) {
        try {
          const result = await uploadVariation(variation, `(A/B Test ${index + 1})`);
          results.push({ ...result, variation: variation.variation });
        } catch (error) {
          console.error(`❌ A/B test variation ${index + 1} failed:`, error.message);
        }
      }

      // Upload translations
      for (const [lang, translation] of Object.entries(translations)) {
        try {
          const result = await uploadVariation({
            title: translation.title,
            description: translation.description,
            tags: translation.tags
          }, `(${lang.toUpperCase()})`);
          
          results.push({ ...result, language: lang });
        } catch (error) {
          console.error(`❌ ${lang} translation upload failed:`, error.message);
        }
      }

      return {
        success: true,
        mainVideo: results[0],
        variations: results.slice(1),
        translations: Object.keys(translations).length > 0 
          ? Object.keys(translations) 
          : undefined
      };

    } catch (error) {
      console.error('❌ YouTube upload failed:', error.message);
      throw new Error(`YouTube upload failed: ${error.message}`);
    }
  }

  /**
   * Generates a safe title that meets YouTube's requirements
   * @private
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
   * @private
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
   * @private
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
}

module.exports = new YouTubeEnhanced();
