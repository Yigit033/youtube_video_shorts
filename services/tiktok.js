const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * TikTok Content Posting API Service
 * Handles TikTok OAuth authentication and video upload
 * Requires: TikTok Developer account + App with Content Posting API enabled
 */
class TikTokService {
  constructor() {
    this.clientKey = process.env.TIKTOK_CLIENT_KEY;
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    this.redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/auth/tiktok/callback';
    
    // Multi-account support (similar to YouTube and Instagram)
    this.accounts = new Map(); // accountId -> { accessToken, refreshToken, openId, username, expiresAt }
    this.currentAccountId = null;
    this.accountsDataPath = path.join(__dirname, '..', 'temp', 'tiktok_accounts.json');
    
    // TikTok API base URLs
    this.authApiBase = 'https://www.tiktok.com/v1';
    this.contentApiBase = 'https://open.tiktokapis.com/v1.3';
    
    this.initializeAuth();
  }

  initializeAuth() {
    if (!this.clientKey || !this.clientSecret) {
      console.warn('⚠️  TikTok credentials not configured');
      console.log('Please set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in your .env file');
      console.log('Get credentials from: https://developers.tiktok.com/');
      return;
    }

    try {
      this.loadSavedAccounts();
      console.log('✅ TikTok service initialized');
      console.log(`📊 Loaded ${this.accounts.size} TikTok account(s)`);
    } catch (error) {
      console.error('❌ Failed to initialize TikTok service:', error.message);
    }
  }

  /**
   * Load saved TikTok accounts from file
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
      console.error('❌ Failed to load TikTok accounts:', error.message);
    }
  }

  /**
   * Save TikTok accounts to file
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
      console.error('❌ Failed to save TikTok accounts:', error.message);
    }
  }

  /**
   * Get authorization URL for TikTok OAuth
   */
  getAuthUrl() {
    const scopes = [
      'user.info.basic',
      'video.upload',
      'video.publish'
    ].join(',');
    
    const state = `tiktok_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return `https://www.tiktok.com/v1/oauth/authorize?` +
      `client_key=${this.clientKey}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&state=${state}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        `${this.authApiBase}/oauth/token/`,
        {
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token, expires_in, open_id, scope, token_type } = response.data.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }

      // Get user info
      const userInfo = await this.getUserInfo(access_token, open_id);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        openId: open_id,
        username: userInfo.display_name || userInfo.username || 'Unknown',
        expiresAt: Date.now() + (expires_in * 1000),
        scope: scope,
        userInfo: userInfo
      };
    } catch (error) {
      console.error('❌ Failed to exchange code for token:', error.message);
      if (error.response) {
        console.error('❌ TikTok API Error:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get user info from TikTok
   */
  async getUserInfo(accessToken, openId) {
    try {
      const response = await axios.get(
        `${this.contentApiBase}/user/info/`,
        {
          params: {
            fields: 'open_id,union_id,avatar_url,display_name,username'
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data.data.user;
    } catch (error) {
      console.error('❌ Failed to get user info:', error.message);
      return { open_id: openId, display_name: 'Unknown', username: 'Unknown' };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        `${this.authApiBase}/oauth/token/`,
        {
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data.data;
      
      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Use new refresh token if provided
        expiresAt: Date.now() + (expires_in * 1000)
      };
    } catch (error) {
      console.error('❌ Failed to refresh token:', error.message);
      throw error;
    }
  }

  /**
   * Check if token is expired and refresh if needed
   */
  async ensureValidToken(accountId = null) {
    const targetAccountId = accountId || this.currentAccountId;
    if (!targetAccountId) {
      throw new Error('No TikTok account selected');
    }

    const account = this.accounts.get(targetAccountId);
    if (!account) {
      throw new Error(`Account ${targetAccountId} not found`);
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresAt = account.expiresAt || 0;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt && (now + bufferTime) >= expiresAt) {
      console.log(`🔄 [TikTok] Token expired or expiring soon, refreshing...`);
      try {
        const refreshed = await this.refreshAccessToken(account.refreshToken);
        account.accessToken = refreshed.accessToken;
        account.refreshToken = refreshed.refreshToken;
        account.expiresAt = refreshed.expiresAt;
        this.saveAccounts();
        console.log(`✅ [TikTok] Token refreshed for account ${targetAccountId}`);
        return refreshed.accessToken;
      } catch (refreshError) {
        console.error(`❌ [TikTok] Failed to refresh token: ${refreshError.message}`);
        throw new Error('Token refresh failed. Please reconnect your TikTok account.');
      }
    }

    return account.accessToken;
  }

  /**
   * Add TikTok account
   */
  async addAccount(accessToken, refreshToken, openId, username, userInfo, expiresAt) {
    const accountId = `tt_${openId}`;
    
    this.accounts.set(accountId, {
      accessToken,
      refreshToken,
      openId,
      username,
      userInfo,
      expiresAt,
      addedAt: Date.now()
    });

    if (!this.currentAccountId) {
      this.currentAccountId = accountId;
    }

    this.saveAccounts();
    console.log(`✅ TikTok account added: ${username} (${accountId})`);
    
    return accountId;
  }

  /**
   * Get current TikTok account
   */
  getCurrentAccount() {
    if (!this.currentAccountId) {
      return null;
    }
    return this.accounts.get(this.currentAccountId) || null;
  }

  /**
   * Get all TikTok accounts
   */
  getAccounts() {
    return Array.from(this.accounts.entries()).map(([accountId, accountData]) => ({
      accountId,
      username: accountData.username,
      openId: accountData.openId,
      userInfo: accountData.userInfo,
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
   * Remove TikTok account
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
   * Upload video to TikTok
   * @param {Object} params - { videoPath, caption, privacyLevel?, accountId? }
   */
  async uploadVideo(params) {
    try {
      const { videoPath, caption, privacyLevel = 'PUBLIC_TO_EVERYONE', accountId } = params;
      
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Get account (use provided accountId or current account)
      const account = accountId ? this.accounts.get(accountId) : this.getCurrentAccount();
      if (!account) {
        throw new Error('No TikTok account selected');
      }

      // Ensure token is valid
      const accessToken = await this.ensureValidToken(accountId || this.currentAccountId);
      const { openId } = account;

      console.log(`📤 [TikTok] Uploading video to ${account.username}...`);

      // Step 1: Initialize upload
      const initResult = await this.initializeUpload(accessToken, openId);
      const uploadUrl = initResult.upload_url;
      const publishId = initResult.publish_id;

      console.log(`📦 [TikTok] Upload initialized: ${publishId}`);

      // Step 2: Upload video file
      await this.uploadVideoFile(uploadUrl, videoPath);

      console.log(`✅ [TikTok] Video file uploaded`);

      // Step 3: Publish video
      const videoId = await this.publishVideo(accessToken, openId, publishId, caption, privacyLevel);

      console.log(`✅ [TikTok] Video published successfully: ${videoId}`);
      console.log(`🔗 [TikTok] Video URL: https://www.tiktok.com/@${account.username}/video/${videoId}`);

      return {
        success: true,
        videoId,
        url: `https://www.tiktok.com/@${account.username}/video/${videoId}`,
        username: account.username
      };
    } catch (error) {
      console.error('❌ [TikTok] Failed to upload video:', error.message);
      if (error.response) {
        console.error('❌ [TikTok] API Error:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Initialize video upload (Step 1)
   * Returns upload_url and publish_id
   */
  async initializeUpload(accessToken, openId) {
    try {
      const response = await axios.post(
        `${this.contentApiBase}/video/init/`,
        {
          source_info: {
            source: 'FILE_UPLOAD'
          },
          post_info: {
            title: 'Generated Video',
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            open_id: openId
          }
        }
      );

      if (!response.data.data || !response.data.data.upload_url || !response.data.data.publish_id) {
        throw new Error('Invalid response from TikTok API');
      }

      return {
        upload_url: response.data.data.upload_url,
        publish_id: response.data.data.publish_id
      };
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error?.message || error.message;
      console.error(`❌ [TikTok] Failed to initialize upload: ${errorMessage}`);
      if (errorData?.error?.code) {
        console.error(`❌ [TikTok] Error code: ${errorData.error.code}`);
      }
      throw error;
    }
  }

  /**
   * Upload video file to TikTok (Step 2)
   */
  async uploadVideoFile(uploadUrl, videoPath) {
    try {
      const videoFile = fs.createReadStream(videoPath);
      const fileStats = fs.statSync(videoPath);
      
      const response = await axios.put(uploadUrl, videoFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': fileStats.size
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`❌ [TikTok] Failed to upload video file: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Publish video (Step 3)
   */
  async publishVideo(accessToken, openId, publishId, caption, privacyLevel = 'PUBLIC_TO_EVERYONE') {
    try {
      const response = await axios.post(
        `${this.contentApiBase}/video/publish/`,
        {
          post_info: {
            title: caption || 'Generated Video',
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          },
          source_info: {
            source: 'FILE_UPLOAD'
          },
          publish_id: publishId
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            open_id: openId
          }
        }
      );

      if (!response.data.data || !response.data.data.video_id) {
        throw new Error('Invalid response from TikTok API - no video_id');
      }

      return response.data.data.video_id;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error?.message || error.message;
      console.error(`❌ [TikTok] Failed to publish video: ${errorMessage}`);
      if (errorData?.error?.code) {
        console.error(`❌ [TikTok] Error code: ${errorData.error.code}`);
      }
      throw error;
    }
  }
}

module.exports = new TikTokService();

