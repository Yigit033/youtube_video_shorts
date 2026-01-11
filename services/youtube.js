const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const seoService = require('./seoService');

class YouTubeService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback';
    
    // Multi-account support
    this.accounts = new Map(); // accountId -> { tokens, oauth2Client, youtube, channelInfo }
    this.currentAccountId = null; // Selected account ID
    this.accountsDataPath = path.join(__dirname, '..', 'temp', 'youtube_accounts.json');
    
    // Legacy support (backward compatibility)
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
      // Load saved accounts (multi-account support)
      this.loadSavedAccounts();
      
      // Legacy support: Create default OAuth client for backward compatibility
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      // Set up auto-refresh of tokens
      this.oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
          // Store the refresh token (legacy)
          this.saveTokens(tokens);
        }
      });

      // Load saved tokens if they exist (legacy)
      this.loadSavedTokens();

      // Initialize YouTube API client (legacy)
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      
      // Initialize Analytics if tokens exist
      if (fs.existsSync(this.tokensPath)) {
        this.initializeAnalytics();
      }
      
      console.log('✅ YouTube service initialized');
      console.log(`📊 Loaded ${this.accounts.size} YouTube account(s)`);
    } catch (error) {
      console.error('❌ Failed to initialize YouTube service:', error.message);
      throw error;
    }
  }

  // NEW: Load saved accounts from file
  loadSavedAccounts() {
    try {
      if (fs.existsSync(this.accountsDataPath)) {
        const accountsData = JSON.parse(fs.readFileSync(this.accountsDataPath, 'utf8'));
        
        // Track seen accounts to prevent duplicates
        const seenChannelIds = new Set();
        const seenEmails = new Set();
        let duplicateCount = 0;
        
        // Restore accounts
        for (const [accountId, accountData] of Object.entries(accountsData.accounts || {})) {
          const channelId = accountData.channelInfo?.id || accountId;
          const email = accountData.email?.toLowerCase() || '';
          
          // Skip duplicates
          if (seenChannelIds.has(channelId)) {
            console.warn(`⚠️  Skipping duplicate account (same channel ID): ${channelId}`);
            duplicateCount++;
            continue;
          }
          
          if (email && seenEmails.has(email)) {
            console.warn(`⚠️  Skipping duplicate account (same email): ${email}`);
            duplicateCount++;
            continue;
          }
          
          seenChannelIds.add(channelId);
          if (email) seenEmails.add(email);
          
          this.restoreAccount(accountId, accountData);
        }
        
        // Clean up duplicates from file if found
        if (duplicateCount > 0) {
          console.log(`🧹 Found ${duplicateCount} duplicate(s), cleaning up...`);
          this.saveAccounts(); // This will save only unique accounts
        }
        
        // Restore current account selection
        if (accountsData.currentAccountId && this.accounts.has(accountsData.currentAccountId)) {
          this.currentAccountId = accountsData.currentAccountId;
        } else if (this.accounts.size > 0) {
          // If saved account doesn't exist, use first available
          this.currentAccountId = Array.from(this.accounts.keys())[0];
        }
        
        console.log(`✅ Loaded ${this.accounts.size} saved account(s)`);
      }
    } catch (error) {
      console.error('❌ Error loading saved accounts:', error.message);
    }
  }
  
  // NEW: Restore account from saved data
  restoreAccount(accountId, accountData) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      oauth2Client.setCredentials(accountData.tokens);
      
      // Set up auto-refresh
      oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
          accountData.tokens = { ...accountData.tokens, ...tokens };
          this.saveAccount(accountId, accountData);
        }
      });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      this.accounts.set(accountId, {
        tokens: accountData.tokens,
        oauth2Client,
        youtube,
        channelInfo: accountData.channelInfo || null,
        email: accountData.email || null,
        addedAt: accountData.addedAt || Date.now()
      });
      
      console.log(`✅ Restored account: ${accountData.channelInfo?.title || accountId}`);
    } catch (error) {
      console.error(`❌ Error restoring account ${accountId}:`, error.message);
    }
  }
  
  // NEW: Save accounts to file
  saveAccounts() {
    try {
      const tempDir = path.dirname(this.accountsDataPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const accountsData = {
        currentAccountId: this.currentAccountId,
        accounts: {}
      };
      
      for (const [accountId, account] of this.accounts.entries()) {
        accountsData.accounts[accountId] = {
          tokens: account.tokens,
          channelInfo: account.channelInfo,
          email: account.email,
          addedAt: account.addedAt
        };
      }
      
      fs.writeFileSync(this.accountsDataPath, JSON.stringify(accountsData, null, 2));
      console.log('💾 YouTube accounts saved');
    } catch (error) {
      console.error('❌ Failed to save accounts:', error);
    }
  }
  
  // NEW: Save single account
  saveAccount(accountId, accountData) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.tokens = accountData.tokens || account.tokens;
      account.channelInfo = accountData.channelInfo || account.channelInfo;
      account.email = accountData.email || account.email;
      account.addedAt = accountData.addedAt || account.addedAt;
    }
    this.saveAccounts();
    }

  getAuthUrl(state = null, redirectUri = null) {
    // Create temporary OAuth client for new account
    const tempOAuth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri || this.redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/userinfo.email' // Get email for account identification
    ];

    const authUrl = tempOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state || 'new-account' // State to identify this is a new account
    });
    
    return authUrl;
  }

  async handleCallback(code, isNewAccount = true) {
    try {
      // Create temporary OAuth client to get tokens
      const tempOAuth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      const { tokens } = await tempOAuth2Client.getToken(code);
      tempOAuth2Client.setCredentials(tokens);
      
      // Get user info (email) for account identification
      const oauth2 = google.oauth2({ version: 'v2', auth: tempOAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      
      // Get channel info
      const youtube = google.youtube({ version: 'v3', auth: tempOAuth2Client });
      const channelsResponse = await youtube.channels.list({
        part: ['snippet', 'id'],
        mine: true
      });
      
      if (!channelsResponse.data.items || channelsResponse.data.items.length === 0) {
        throw new Error('No YouTube channel found for this account');
      }
      
      const channel = channelsResponse.data.items[0];
      const channelId = channel.id;
      const channelInfo = {
        id: channelId,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.default?.url || null
      };
      
      // Create account ID (use channel ID as unique identifier)
      const accountId = channelId;
      
      // Check if account already exists
      if (this.accounts.has(accountId)) {
        console.log(`⚠️  Account already exists: ${channelInfo.title}`);
        // Update tokens
        const existingAccount = this.accounts.get(accountId);
        existingAccount.tokens = tokens;
        existingAccount.oauth2Client.setCredentials(tokens);
        this.saveAccount(accountId, {
          tokens,
          channelInfo,
          email,
          addedAt: existingAccount.addedAt
        });
        return { accountId, channelInfo, email, isNew: false };
      }
      
      // Create OAuth client for this account
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      oauth2Client.setCredentials(tokens);
      
      // Set up auto-refresh
      oauth2Client.on('tokens', (newTokens) => {
        if (newTokens.refresh_token) {
          const account = this.accounts.get(accountId);
          if (account) {
            account.tokens = { ...account.tokens, ...newTokens };
            this.saveAccount(accountId, account);
          }
        }
      });
      
      const accountYoutube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Save account
      this.accounts.set(accountId, {
        tokens,
        oauth2Client,
        youtube: accountYoutube,
        channelInfo,
        email,
        addedAt: Date.now()
      });
      
      // Set as current account if no account is selected
      if (!this.currentAccountId) {
        this.currentAccountId = accountId;
      }
      
      // Save accounts
      this.saveAccounts();
      
      // Legacy support: Also save to old tokens file for backward compatibility
      if (isNewAccount && this.accounts.size === 1) {
      this.saveTokens(tokens);
        this.oauth2Client = oauth2Client;
        this.youtube = accountYoutube;
      }
      
      console.log(`✅ YouTube authentication successful: ${channelInfo.title} (${email})`);
      return { accountId, channelInfo, email, isNew: true };
    } catch (error) {
      console.error('YouTube auth error:', error);
      throw new Error('Failed to authenticate with YouTube: ' + error.message);
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
      console.error('❌ Error loading tokens:', error.message);
    }
  }

  async initializeAnalytics() {
    try {
      const analyticsService = require('./youtubeAnalytics');
      await analyticsService.initialize(this.oauth2Client);
    } catch (error) {
      console.error('❌ Error initializing YouTube Analytics:', error.message);
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

  isAuthenticated(accountId = null) {
    // If accountId specified, check that account
    if (accountId) {
      const account = this.accounts.get(accountId);
      if (!account) return false;
      const credentials = account.oauth2Client.credentials;
      return !!(credentials.access_token || credentials.refresh_token);
    }
    
    // Check current account
    if (this.currentAccountId) {
      const account = this.accounts.get(this.currentAccountId);
      if (account) {
        const credentials = account.oauth2Client.credentials;
        return !!(credentials.access_token || credentials.refresh_token);
      }
    }
    
    // Legacy support
    if (!this.oauth2Client) return false;
    const credentials = this.oauth2Client.credentials;
    return !!(credentials.access_token || credentials.refresh_token);
  }
  
  // NEW: Get list of all accounts
  getAccounts() {
    const accountsList = [];
    const seenEmails = new Set();
    const seenChannelIds = new Set();
    
    for (const [accountId, account] of this.accounts.entries()) {
      // Skip duplicates: same email or same channel ID
      const email = account.email?.toLowerCase() || '';
      const channelId = account.channelInfo?.id || accountId;
      
      if (email && seenEmails.has(email)) {
        console.warn(`⚠️  Skipping duplicate account (same email): ${email}`);
        continue;
      }
      
      if (seenChannelIds.has(channelId)) {
        console.warn(`⚠️  Skipping duplicate account (same channel ID): ${channelId}`);
        continue;
      }
      
      seenEmails.add(email);
      seenChannelIds.add(channelId);
      
      accountsList.push({
        accountId,
        channelInfo: account.channelInfo,
        email: account.email,
        addedAt: account.addedAt,
        isCurrent: accountId === this.currentAccountId
      });
    }
    
    console.log(`📋 getAccounts() returning ${accountsList.length} unique account(s)`);
    return accountsList;
  }
  
  // NEW: Get current account
  getAccount(accountId) {
    if (!accountId) {
      return null;
    }
    return this.accounts.get(accountId) || null;
  }

  getCurrentAccount() {
    if (!this.currentAccountId) return null;
    const account = this.accounts.get(this.currentAccountId);
    if (!account) return null;
    
    return {
      accountId: this.currentAccountId,
      channelInfo: account.channelInfo,
      email: account.email,
      addedAt: account.addedAt
    };
  }
  
  // NEW: Select account
  selectAccount(accountId) {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    this.currentAccountId = accountId;
    this.saveAccounts();
    console.log(`✅ Selected account: ${this.accounts.get(accountId).channelInfo?.title || accountId}`);
    return true;
  }
  
  // NEW: Remove account
  removeAccount(accountId) {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    // Don't allow removing if it's the only account
    if (this.accounts.size === 1) {
      throw new Error('Cannot remove the only account');
    }
    
    this.accounts.delete(accountId);
    
    // If removed account was current, select another one
    if (this.currentAccountId === accountId) {
      const remainingAccounts = Array.from(this.accounts.keys());
      this.currentAccountId = remainingAccounts[0] || null;
    }
    
    this.saveAccounts();
    console.log(`🗑️  Removed account: ${accountId}`);
    return true;
  }
  
  // NEW: Get account's YouTube client (for upload)
  async getAccountYouTube(accountId = null) {
    const targetAccountId = accountId || this.currentAccountId;
    
    if (!targetAccountId) {
      // Legacy fallback
      if (this.youtube) return this.youtube;
      throw new Error('No account selected and no legacy client available');
    }
    
    const account = this.accounts.get(targetAccountId);
    if (!account) {
      throw new Error(`Account ${targetAccountId} not found`);
    }
    
    // Refresh token if needed
    if (account.oauth2Client.credentials.expiry_date && account.oauth2Client.credentials.expiry_date < Date.now()) {
      try {
        await account.oauth2Client.refreshAccessToken();
        console.log(`✅ Token refreshed successfully for account ${targetAccountId}`);
      } catch (err) {
        const errorMessage = err.message || '';
        const isInvalidGrant = errorMessage.includes('invalid_grant') || 
                              (err.response && err.response.data && err.response.data.error === 'invalid_grant');
        
        if (isInvalidGrant) {
          console.error(`❌ [YouTube Auth] Token expired or revoked for account ${targetAccountId}`);
          console.error(`❌ [YouTube Auth] Error: ${err.response?.data?.error_description || 'Token has been expired or revoked'}`);
          throw new Error(`YouTube authentication expired. Please reconnect your YouTube account. Go to the dashboard and click "Connect YouTube Account" to re-authenticate.`);
        } else {
          console.error(`⚠️  Failed to refresh token for account ${targetAccountId}:`, err.message);
          throw new Error(`Failed to refresh YouTube token: ${err.message}`);
        }
      }
    }
    
    return account.youtube;
  }
  
  // NEW: Get account's OAuth client
  getAccountOAuth(accountId = null) {
    const targetAccountId = accountId || this.currentAccountId;
    
    if (!targetAccountId) {
      // Legacy fallback
      return this.oauth2Client;
    }
    
    const account = this.accounts.get(targetAccountId);
    if (!account) {
      throw new Error(`Account ${targetAccountId} not found`);
    }
    
    return account.oauth2Client;
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
   * @param {string} [params.thumbnailPath] - Path to custom thumbnail image (JPEG/PNG)
   * @returns {Promise<Object>} Upload result with videoId, URL, and variations
   */
  async uploadVideo(params) {
    console.log('🚀 Starting YouTube upload process with SEO optimization...');
    
    // Parameter extraction with better validation
      let videoPath, title, description, tags = [], publishAt = null, topic = '', enableABTest = false, translateTo = [], thumbnailPath = null, accountId = null;
    
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
        thumbnailPath = params.thumbnailPath || null;
        accountId = params.accountId || null; // NEW: Account ID for multi-account support
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
      
      // CRITICAL: Get YouTube client for selected account (or use accountId from params)
      const targetAccountId = accountId || this.currentAccountId;
      const youtube = await this.getAccountYouTube(targetAccountId);
      const oauth2Client = this.getAccountOAuth(targetAccountId);
      
      // Get current account info for logging
      const currentAccount = this.getCurrentAccount();
      if (currentAccount) {
        console.log(`📺 Uploading to account: ${currentAccount.channelInfo?.title || currentAccount.accountId} (${currentAccount.email})`);
      }
      
      // Ensure we have valid credentials
      if (!oauth2Client.credentials) {
        throw new Error('YouTube account not authenticated. Please authenticate first.');
      }
      
      // Refresh token if needed
      if (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date < Date.now()) {
        try {
          await oauth2Client.refreshAccessToken();
          console.log('✅ Token refreshed successfully');
        } catch (refreshError) {
          const errorMessage = refreshError.message || '';
          const errorData = refreshError.response?.data;
          const isInvalidGrant = errorMessage.includes('invalid_grant') || 
                                (errorData && errorData.error === 'invalid_grant');
          
          if (isInvalidGrant) {
            console.error('❌ [YouTube Auth] Token expired or revoked');
            console.error(`❌ [YouTube Auth] Error: ${errorData?.error_description || 'Token has been expired or revoked'}`);
            throw new Error('YouTube authentication expired. Please reconnect your YouTube account. Go to the dashboard and click "Connect YouTube Account" to re-authenticate.');
          } else {
            console.error('⚠️  Failed to refresh token:', refreshError.message);
            throw new Error(`Failed to refresh YouTube token: ${refreshError.message}`);
          }
        }
      }

      const videoMetadata = {
        snippet: {
          title: title || 'Generated YouTube Short',
          description: description || 'Created with YouTube Shorts Automation',
          tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(tag => tag.trim()) : []),
          categoryId: '1', // Film & Animation (changed from People & Blogs for documentary/history videos)
          defaultLanguage: 'en-US', // Video language: English (United States)
          defaultAudioLanguage: 'en-US' // Title and description language: English (United States)
        },
        status: {
          privacyStatus: 'public', // Will be updated below if valid publishAt
          selfDeclaredMadeForKids: false
        }
      };

      // ROBUST DATE VALIDATION: Prevent invalid date errors
      if (publishAt) {
        try {
          const parsedDate = new Date(publishAt);
          const now = new Date();
          const maxDate = new Date('2100-01-01');
          const minDate = new Date('2020-01-01');
          
          // Validate date is reasonable (between 2020 and 2100)
          if (isNaN(parsedDate.getTime())) {
            console.warn(`⚠️ [YouTube] Invalid publishAt date format: ${publishAt} - Publishing immediately`);
          } else if (parsedDate.getFullYear() > 2100 || parsedDate.getFullYear() < 2020) {
            console.warn(`⚠️ [YouTube] Invalid year in publishAt: ${parsedDate.getFullYear()} - Publishing immediately`);
          } else if (parsedDate < now) {
            console.warn(`⚠️ [YouTube] publishAt is in the past: ${publishAt} - Publishing immediately`);
          } else {
            // Valid date - apply scheduling
            videoMetadata.status.publishAt = parsedDate.toISOString();
            videoMetadata.status.privacyStatus = 'private'; // Required for scheduled videos
            console.log(`📅 [YouTube] Scheduled for: ${parsedDate.toLocaleString()}`);
          }
        } catch (dateError) {
          console.warn(`⚠️ [YouTube] Date parsing error: ${dateError.message} - Publishing immediately`);
        }
      }

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: videoMetadata,
        media: {
          body: fs.createReadStream(videoPath)
        }
      });

      const videoId = response.data.id;
      const videoUrl = `https://youtube.com/watch?v=${videoId}`;
      const videoTitle = response.data.snippet.title;
      
      // Upload custom thumbnail if provided
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        try {
          console.log(`🖼️  Uploading custom thumbnail: ${path.basename(thumbnailPath)}`);
          // Determine MIME type from file extension
          const ext = path.extname(thumbnailPath).toLowerCase();
          const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
          
          await youtube.thumbnails.set({
            videoId: videoId,
            media: {
              body: fs.createReadStream(thumbnailPath),
              mimeType: mimeType
            }
          });
          console.log(`✅ Custom thumbnail uploaded successfully`);
        } catch (thumbnailError) {
          console.warn(`⚠️  Failed to upload custom thumbnail: ${thumbnailError.message}`);
          // Don't fail the entire upload if thumbnail fails
        }
      }
      
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
    
    // Process each tag - remove # symbols (they go in description, not tags)
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
      .map(tag => tag.trim().toLowerCase().replace(/^#+/, '')) // Remove # prefix
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
  async testConnection(accountId = null) {
    const targetAccountId = accountId || this.currentAccountId;
    
    if (!this.isAuthenticated(targetAccountId)) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Test by getting channel info
      const youtube = await this.getAccountYouTube(targetAccountId);
      const response = await youtube.channels.list({
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