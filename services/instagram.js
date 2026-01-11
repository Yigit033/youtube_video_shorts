const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Instagram Graph API Service
 * Handles Instagram Business account authentication and Reels upload
 * Requires: Meta Business account + Instagram Business account
 */
class InstagramService {
  constructor() {
    this.appId = process.env.INSTAGRAM_APP_ID;
    this.appSecret = process.env.INSTAGRAM_APP_SECRET;
    this.redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/auth/instagram/callback';
    
    // Multi-account support (similar to YouTube)
    this.accounts = new Map(); // accountId -> { accessToken, instagramAccountId, username, accountInfo }
    this.currentAccountId = null;
    this.accountsDataPath = path.join(__dirname, '..', 'temp', 'instagram_accounts.json');
    
    // Graph API base URL
    this.graphApiBase = 'https://graph.facebook.com/v18.0';
    
    // Public video URL base (for Instagram video_url parameter)
    // Extract from INSTAGRAM_REDIRECT_URI (ngrok URL) or use default
    this.publicVideoBaseUrl = this.getPublicVideoBaseUrl();
    
    // Temporary public videos directory (for Instagram upload)
    this.publicVideosDir = path.join(__dirname, '..', 'temp', 'output');
    this.ensurePublicVideosDir();
    
    this.initializeAuth();
  }

  /**
   * Get public video base URL from redirect URI (ngrok URL)
   */
  getPublicVideoBaseUrl() {
    if (this.redirectUri && this.redirectUri.includes('ngrok')) {
      // Extract ngrok base URL from redirect URI
      const url = new URL(this.redirectUri);
      return `${url.protocol}//${url.host}`;
    }
    // Fallback to localhost (for development)
    return process.env.PUBLIC_VIDEO_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Ensure public videos directory exists
   */
  ensurePublicVideosDir() {
    if (!fs.existsSync(this.publicVideosDir)) {
      fs.mkdirSync(this.publicVideosDir, { recursive: true });
    }
  }

  initializeAuth() {
    if (!this.appId || !this.appSecret) {
      console.warn('⚠️  Instagram credentials not configured');
      console.log('Please set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in your .env file');
      console.log('Get credentials from: https://developers.facebook.com/apps/');
      return;
    }

    try {
      this.loadSavedAccounts();
      console.log('✅ Instagram service initialized');
      console.log(`📊 Loaded ${this.accounts.size} Instagram account(s)`);
    } catch (error) {
      console.error('❌ Failed to initialize Instagram service:', error.message);
    }
  }

  /**
   * Load saved Instagram accounts from file
   */
  loadSavedAccounts() {
    try {
      if (fs.existsSync(this.accountsDataPath)) {
        const accountsData = JSON.parse(fs.readFileSync(this.accountsDataPath, 'utf8'));
        
        for (const [accountId, accountData] of Object.entries(accountsData.accounts || {})) {
          this.accounts.set(accountId, accountData);
        }
        
        // Set current account if available
        if (accountsData.currentAccountId && this.accounts.has(accountsData.currentAccountId)) {
          this.currentAccountId = accountsData.currentAccountId;
        } else if (this.accounts.size > 0) {
          // Use first account as default
          this.currentAccountId = Array.from(this.accounts.keys())[0];
        }
      }
    } catch (error) {
      console.error('❌ Failed to load Instagram accounts:', error.message);
    }
  }

  /**
   * Save Instagram accounts to file
   */
  saveAccounts() {
    try {
      const accountsData = {
        accounts: {},
        currentAccountId: this.currentAccountId
      };
      
      for (const [accountId, accountData] of this.accounts.entries()) {
        accountsData.accounts[accountId] = accountData;
      }
      
      fs.writeFileSync(this.accountsDataPath, JSON.stringify(accountsData, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Failed to save Instagram accounts:', error.message);
    }
  }

  /**
   * Get authorization URL for Instagram OAuth
   */
  getAuthUrl() {
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_read_engagement',
      'pages_show_list'
    ].join(',');
    
    return `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${this.appId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.get(`${this.graphApiBase}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
          code: code
        }
      });

      const { access_token, token_type } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }

      // Get long-lived token (60 days)
      const longLivedToken = await this.getLongLivedToken(access_token);
      
      // Get Instagram Business Account ID
      const instagramAccount = await this.getInstagramAccount(longLivedToken);
      
      return {
        accessToken: longLivedToken,
        instagramAccountId: instagramAccount.id,
        username: instagramAccount.username,
        accountInfo: instagramAccount
      };
    } catch (error) {
      console.error('❌ Failed to exchange code for token:', error.message);
      throw error;
    }
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async getLongLivedToken(shortLivedToken) {
    try {
      const response = await axios.get(`${this.graphApiBase}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken
        }
      });

      return response.data.access_token;
    } catch (error) {
      console.error('❌ Failed to get long-lived token:', error.message);
      // Return short-lived token as fallback
      return shortLivedToken;
    }
  }

  /**
   * Refresh long-lived token (can be called before 60 days expire)
   * Instagram long-lived tokens can be refreshed to extend their validity
   * CRITICAL: This is optional - if refresh fails, the existing token may still be valid
   */
  async refreshLongLivedToken(longLivedToken) {
    try {
      const response = await axios.get(`${this.graphApiBase}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: longLivedToken
        }
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('No access token in refresh response');
      }

      return response.data.access_token;
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorCode = errorData?.code;
      const errorMessage = errorData?.message || error.message;
      
      // Log detailed error for debugging
      if (error.response) {
        console.error(`❌ [Instagram] Token refresh failed (${error.response.status}): ${errorMessage}`);
        if (errorCode) {
          console.error(`❌ [Instagram] Error code: ${errorCode}`);
        }
      } else {
        console.error(`❌ [Instagram] Token refresh failed: ${errorMessage}`);
      }
      
      throw error;
    }
  }

  /**
   * Check if token is expired and refresh if needed
   * Instagram tokens don't have explicit expiry_date, so we check by making a test API call
   * CRITICAL: Token refresh is optional - if it fails, we use the existing token
   */
  async ensureValidToken(accountId = null) {
    const targetAccountId = accountId || this.currentAccountId;
    if (!targetAccountId) {
      throw new Error('No Instagram account selected');
    }

    const account = this.accounts.get(targetAccountId);
    if (!account) {
      throw new Error(`Account ${targetAccountId} not found`);
    }

    // CRITICAL: Token refresh is optional - don't fail if refresh doesn't work
    // Instagram long-lived tokens can be refreshed, but it's not always necessary
    // If refresh fails, we'll use the existing token and catch errors in the actual API call
    try {
      const refreshedToken = await this.refreshLongLivedToken(account.accessToken);
      if (refreshedToken !== account.accessToken) {
        console.log(`✅ [Instagram] Token refreshed for account ${targetAccountId}`);
        // Update account with new token
        account.accessToken = refreshedToken;
        if (account.accountInfo && account.accountInfo.pageAccessToken) {
          account.accountInfo.pageAccessToken = refreshedToken;
        }
        this.saveAccounts();
        return refreshedToken;
      }
      // Token is the same, no refresh needed
      return account.accessToken;
    } catch (refreshError) {
      // CRITICAL: Token refresh failure is not critical - use existing token
      // The actual API call will catch if the token is truly expired
      const errorData = refreshError.response?.data;
      const errorCode = errorData?.error?.code;
      const errorMessage = errorData?.error?.message || refreshError.message;
      
      // Log warning but don't fail - use existing token
      if (errorCode === 190 || errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        console.warn(`⚠️ [Instagram] Token may be expired for account ${targetAccountId}, but will try with existing token`);
        console.warn(`⚠️ [Instagram] If upload fails, please reconnect your Instagram account`);
      } else {
        console.warn(`⚠️ [Instagram] Could not refresh token for account ${targetAccountId}: ${errorMessage}`);
        console.warn(`⚠️ [Instagram] Using existing token - will proceed with upload`);
      }
      
      return account.accessToken; // Use existing token
    }
  }

  /**
   * Get Instagram Business Account ID from access token
   */
  async getInstagramAccount(accessToken) {
    try {
      // First, get Facebook Page ID
      const pagesResponse = await axios.get(`${this.graphApiBase}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,instagram_business_account'
        }
      });

      const pages = pagesResponse.data.data;
      if (!pages || pages.length === 0) {
        throw new Error('No Facebook Pages found. Please create a Facebook Page and connect it to Instagram Business account.');
      }

      // Find page with Instagram Business account
      for (const page of pages) {
        if (page.instagram_business_account) {
          const igAccountResponse = await axios.get(
            `${this.graphApiBase}/${page.instagram_business_account.id}`,
            {
              params: {
                access_token: page.access_token,
                fields: 'id,username,name,profile_picture_url'
              }
            }
          );

          return {
            id: igAccountResponse.data.id,
            username: igAccountResponse.data.username,
            name: igAccountResponse.data.name,
            pageId: page.id,
            pageAccessToken: page.access_token
          };
        }
      }

      throw new Error('No Instagram Business account found. Please connect your Instagram account to a Facebook Page.');
    } catch (error) {
      console.error('❌ Failed to get Instagram account:', error.message);
      throw error;
    }
  }

  /**
   * Add Instagram account
   */
  async addAccount(accessToken, instagramAccountId, username, accountInfo) {
    const accountId = `ig_${instagramAccountId}`;
    
    this.accounts.set(accountId, {
      accessToken,
      instagramAccountId,
      username,
      accountInfo,
      addedAt: Date.now()
    });

    if (!this.currentAccountId) {
      this.currentAccountId = accountId;
    }

    this.saveAccounts();
    console.log(`✅ Instagram account added: ${username} (${accountId})`);
    
    return accountId;
  }

  /**
   * Get current Instagram account
   */
  getCurrentAccount() {
    if (!this.currentAccountId) {
      return null;
    }
    return this.accounts.get(this.currentAccountId) || null;
  }

  /**
   * Get all Instagram accounts
   */
  getAccounts() {
    return Array.from(this.accounts.entries()).map(([accountId, accountData]) => ({
      accountId,
      username: accountData.username,
      instagramAccountId: accountData.instagramAccountId,
      accountInfo: accountData.accountInfo,
      isCurrent: accountId === this.currentAccountId
    }));
  }

  /**
   * Set current account
   */
  setCurrentAccount(accountId) {
    if (this.accounts.has(accountId)) {
      this.currentAccountId = accountId;
      this.saveAccounts();
      return true;
    }
    return false;
  }

  /**
   * Remove Instagram account
   */
  removeAccount(accountId) {
    if (this.accounts.has(accountId)) {
      this.accounts.delete(accountId);
      
      if (this.currentAccountId === accountId) {
        this.currentAccountId = this.accounts.size > 0 ? Array.from(this.accounts.keys())[0] : null;
      }
      
      this.saveAccounts();
      return true;
    }
    return false;
  }

  /**
   * Upload Reel to Instagram
   * @param {Object} params - { videoPath, caption, thumbnailPath?, accountId? }
   */
  async uploadReel(params) {
    try {
      const { videoPath, caption, thumbnailPath, accountId } = params;
      
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Get account (use provided accountId or current account)
      const account = accountId ? this.accounts.get(accountId) : this.getCurrentAccount();
      if (!account) {
        throw new Error('No Instagram account selected');
      }

      // Try to ensure token is valid (refresh if possible)
      let accessToken;
      try {
        accessToken = await this.ensureValidToken(accountId || this.currentAccountId);
      } catch (tokenError) {
        console.warn(`⚠️ [Instagram] Token validation failed: ${tokenError.message}`);
        accessToken = account.accessToken; // Use existing token, will fail if expired
      }

      const { instagramAccountId, accountInfo } = account;
      const pageAccessToken = accountInfo?.pageAccessToken || accessToken;

      console.log(`📤 [Instagram] Uploading Reel to ${account.username}...`);

      // Step 1: Create Reel container (returns containerId, publicVideoPath, videoUrl)
      const containerResult = await this.createReelContainer(
        videoPath,
        caption,
        instagramAccountId,
        pageAccessToken,
        thumbnailPath
      );

      const containerId = containerResult.containerId;
      const publicVideoPath = containerResult.publicVideoPath;
      const videoUrl = containerResult.videoUrl;

      console.log(`📦 [Instagram] Reel container created: ${containerId}`);

      // Step 2: Check container status and publish
      const reelId = await this.publishReel(containerId, instagramAccountId, pageAccessToken);
      
      // Step 3: Clean up public video file after successful upload
      if (publicVideoPath && fs.existsSync(publicVideoPath)) {
        setTimeout(() => {
          try {
            fs.unlinkSync(publicVideoPath);
            console.log(`🧹 [Instagram] Cleaned up public video file: ${path.basename(publicVideoPath)}`);
          } catch (cleanupError) {
            console.warn(`⚠️ [Instagram] Failed to cleanup public video: ${cleanupError.message}`);
          }
        }, 30000); // Wait 30 seconds to ensure Instagram has downloaded the video
      }

      console.log(`✅ [Instagram] Reel published successfully: ${reelId}`);
      console.log(`🔗 [Instagram] Reel URL: https://www.instagram.com/reel/${reelId}/`);

      return {
        success: true,
        reelId,
        url: `https://www.instagram.com/reel/${reelId}/`,
        username: account.username
      };
    } catch (error) {
      console.error('❌ [Instagram] Failed to upload Reel:', error.message);
      throw error;
    }
  }

  /**
   * Create Reel container (Step 1 of upload process)
   * Uses video_url instead of video_file for Instagram Graph API compatibility
   */
  async createReelContainer(videoPath, caption, instagramAccountId, accessToken, thumbnailPath) {
    try {
      // CRITICAL: Instagram Graph API requires video_url (public URL) instead of video_file
      // Copy video to public directory and create public URL
      const videoFileName = `ig_${Date.now()}_${path.basename(videoPath)}`;
      const publicVideoPath = path.join(this.publicVideosDir, videoFileName);
      
      console.log(`📋 [Instagram] Copying video to public directory: ${videoFileName}`);
      fs.copyFileSync(videoPath, publicVideoPath);
      
      // Create public URL (via ngrok)
      const videoUrl = `${this.publicVideoBaseUrl}/videos/${videoFileName}`;
      console.log(`🌐 [Instagram] Public video URL: ${videoUrl}`);
      
      // CRITICAL: Verify video file exists and is accessible
      if (!fs.existsSync(publicVideoPath)) {
        throw new Error(`Public video file not found: ${publicVideoPath}`);
      }
      
      const videoStats = fs.statSync(publicVideoPath);
      console.log(`📊 [Instagram] Video file size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Check video duration (Instagram Reels limit: 90 seconds)
      try {
        const ffmpeg = require('fluent-ffmpeg');
        await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(publicVideoPath, (err, metadata) => {
            if (!err && metadata && metadata.format && metadata.format.duration) {
              const duration = parseFloat(metadata.format.duration);
              console.log(`⏱️ [Instagram] Video duration: ${duration.toFixed(2)}s`);
              if (duration > 90) {
                console.warn(`⚠️ [Instagram] Video duration (${duration.toFixed(2)}s) exceeds Instagram Reels limit (90s)`);
              }
            }
            resolve();
          });
        });
      } catch (durationError) {
        console.warn(`⚠️ [Instagram] Could not check video duration: ${durationError.message}`);
      }
      
      // Prepare request data (using video_url instead of video_file)
      const requestData = {
        video_url: videoUrl,
        caption: caption || '',
        media_type: 'REELS'
      };
      
      // Add thumbnail if provided (as URL)
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        // For thumbnail, we can use cover_url with image data or URL
        // Instagram accepts cover_url as URL or image data
        // For simplicity, we'll skip thumbnail for now (optional)
        console.log('📸 [Instagram] Thumbnail provided but will be auto-generated by Instagram');
      }

      // Upload to Instagram using video_url
      let response;
      try {
        response = await axios.post(
          `${this.graphApiBase}/${instagramAccountId}/media`,
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (apiError) {
        const errorData = apiError.response?.data?.error;
        const errorCode = errorData?.code;
        const errorType = errorData?.type;
        const errorMessage = errorData?.message || apiError.message;
        
        // Check for authentication errors
        if (apiError.response && apiError.response.status === 401) {
          if (errorCode === 190 || errorType === 'OAuthException') {
            console.error(`❌ [Instagram Auth] Token expired: ${errorMessage}`);
            throw new Error(`Instagram authentication expired. Please reconnect your Instagram account. Go to the dashboard and click "Connect Instagram Account" to re-authenticate.`);
          }
        }
        
        // Check for "API access blocked" error (code 200)
        if (errorCode === 200 || errorMessage.includes('API access blocked')) {
          console.error(`❌ [Instagram] API access blocked: ${errorMessage}`);
          console.error(`❌ [Instagram] This usually means:`);
          console.error(`   1. App permissions are missing or revoked`);
          console.error(`   2. Instagram Business account is not properly connected`);
          console.error(`   3. App review may be required (for production apps)`);
          console.error(`   4. Token permissions are insufficient`);
          console.error(`   5. Instagram Graph API product may not be added to your app`);
          throw new Error(`Instagram API access blocked. Please check: 1) App permissions in Meta Developer Console, 2) Instagram Business account connection, 3) Instagram Graph API product is added, 4) Reconnect your Instagram account from the dashboard.`);
        }
        
        // Generic error
        console.error(`❌ [Instagram] Failed to create Reel container: ${errorMessage}`);
        if (errorCode) {
          console.error(`❌ [Instagram] Error code: ${errorCode}, Type: ${errorType || 'Unknown'}`);
        }
        throw apiError;
      }

      if (!response.data.id) {
        throw new Error('Failed to create Reel container');
      }

      console.log(`✅ [Instagram] Reel container created: ${response.data.id}`);
      
      // Return container ID and public video path for cleanup
      return {
        containerId: response.data.id,
        publicVideoPath: publicVideoPath,
        videoUrl: videoUrl
      };
    } catch (error) {
      console.error('❌ [Instagram] Failed to create Reel container:', error.message);
      if (error.response) {
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Publish Reel (Step 2 of upload process)
   * @param {string} containerId - Container ID (string) or container result object
   */
  async publishReel(containerId, instagramAccountId, accessToken, maxRetries = 30) {
    // Handle both string containerId and container result object
    const actualContainerId = typeof containerId === 'string' ? containerId : containerId.containerId;
    try {
      // Check container status
      let status = 'IN_PROGRESS';
      let retries = 0;

      // Initial wait: Instagram needs time to download and process the video
      console.log(`⏳ [Instagram] Waiting for container to process (initial 5s wait)...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      while (status === 'IN_PROGRESS' && retries < maxRetries) {
        // Progressive wait: longer waits as retries increase
        const waitTime = retries < 5 ? 3000 : 5000; // 3s for first 5 retries, then 5s
        await new Promise(resolve => setTimeout(resolve, waitTime));

        console.log(`🔄 [Instagram] Checking container status (attempt ${retries + 1}/${maxRetries})...`);

        const statusResponse = await axios.get(
          `${this.graphApiBase}/${actualContainerId}`,
          {
            params: {
              access_token: accessToken,
              fields: 'status_code,status'
            }
          }
        );

        status = statusResponse.data.status_code;
        retries++;

        console.log(`📊 [Instagram] Container status: ${status} (attempt ${retries}/${maxRetries})`);

        if (status === 'ERROR') {
          // Get detailed error information
          const errorInfo = statusResponse.data.status || statusResponse.data.error || 'Unknown error';
          const errorMessage = typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo);
          console.error(`❌ [Instagram] Container error details: ${errorMessage}`);
          
          // Try to get more details from container
          try {
            const detailedResponse = await axios.get(
              `${this.graphApiBase}/${actualContainerId}`,
              {
                params: {
                  access_token: accessToken,
                  fields: 'status_code,status,error'
                }
              }
            );
            if (detailedResponse.data.error) {
              console.error(`❌ [Instagram] Container error: ${JSON.stringify(detailedResponse.data.error, null, 2)}`);
            }
          } catch (detailError) {
            console.warn(`⚠️ [Instagram] Could not get detailed error: ${detailError.message}`);
          }
          
          throw new Error(`Reel container processing failed: ${errorMessage}`);
        }

        if (status === 'FINISHED') {
          console.log(`✅ [Instagram] Container ready after ${retries} attempts`);
          break;
        }
      }

      if (status !== 'FINISHED') {
        throw new Error(`Reel container not ready after ${maxRetries} retries (${maxRetries * 5}s total). Status: ${status}`);
      }

      // Publish the Reel
      const publishResponse = await axios.post(
        `${this.graphApiBase}/${instagramAccountId}/media_publish`,
        {
          creation_id: actualContainerId
        },
        {
          params: {
            access_token: accessToken
          }
        }
      );

      if (!publishResponse.data.id) {
        throw new Error('Failed to publish Reel');
      }

      return publishResponse.data.id;
    } catch (error) {
      console.error('❌ [Instagram] Failed to publish Reel:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get Instagram account insights (analytics)
   */
  async getAccountInsights(accountId = null, metric = 'impressions,reach,profile_views') {
    try {
      const account = accountId ? this.accounts.get(accountId) : this.getCurrentAccount();
      if (!account) {
        throw new Error('No Instagram account selected');
      }

      const { instagramAccountId, accountInfo } = account;
      const accessToken = accountInfo?.pageAccessToken || account.accessToken;

      const response = await axios.get(
        `${this.graphApiBase}/${instagramAccountId}/insights`,
        {
          params: {
            access_token: accessToken,
            metric: metric,
            period: 'day'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ [Instagram] Failed to get insights:', error.message);
      return null;
    }
  }

  /**
   * Get Reel insights
   */
  async getReelInsights(reelId, accountId = null) {
    try {
      const account = accountId ? this.accounts.get(accountId) : this.getCurrentAccount();
      if (!account) {
        throw new Error('No Instagram account selected');
      }

      const accessToken = account.accountInfo?.pageAccessToken || account.accessToken;

      const response = await axios.get(
        `${this.graphApiBase}/${reelId}/insights`,
        {
          params: {
            access_token: accessToken,
            metric: 'plays,likes,comments,shares,saved,reach,impressions'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ [Instagram] Failed to get Reel insights:', error.message);
      return null;
    }
  }
}

module.exports = new InstagramService();

