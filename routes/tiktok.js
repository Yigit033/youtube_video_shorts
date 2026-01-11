const express = require('express');
const router = express.Router();
const tiktokService = require('../services/tiktok');
const videoStorageService = require('../services/videoStorage');
const fs = require('fs');
const path = require('path');

/**
 * TikTok Routes
 * Handles TikTok authentication and video upload
 */

// Get TikTok auth URL
router.get('/auth-url', (req, res) => {
  try {
    const authUrl = tiktokService.getAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('❌ Failed to get TikTok auth URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;
    
    if (error) {
      console.error('❌ TikTok OAuth error:', error);
      return res.redirect(`/?auth=error&message=${encodeURIComponent(error)}&platform=tiktok`);
    }
    
    if (!code) {
      return res.redirect('/?auth=error&message=No authorization code received&platform=tiktok');
    }
    
    // Exchange code for token
    const accountData = await tiktokService.exchangeCodeForToken(code);
    
    // Add account
    const accountId = await tiktokService.addAccount(
      accountData.accessToken,
      accountData.refreshToken,
      accountData.openId,
      accountData.username,
      accountData.userInfo,
      accountData.expiresAt
    );
    
    console.log(`✅ TikTok account connected: ${accountData.username}`);
    
    // Redirect to success page
    res.redirect(`/?auth=success&platform=tiktok&accountId=${accountId}&username=${encodeURIComponent(accountData.username)}`);
  } catch (error) {
    console.error('❌ TikTok OAuth callback failed:', error);
    res.redirect(`/?auth=error&message=${encodeURIComponent(error.message)}&platform=tiktok`);
  }
});

// Get TikTok accounts
router.get('/accounts', (req, res) => {
  try {
    const accounts = tiktokService.getAccounts();
    const currentAccount = tiktokService.getCurrentAccount();
    
    res.json({
      success: true,
      accounts,
      currentAccount: currentAccount ? {
        accountId: tiktokService.currentAccountId,
        username: currentAccount.username,
        openId: currentAccount.openId
      } : null,
      accountsCount: accounts.length
    });
  } catch (error) {
    console.error('❌ Failed to get TikTok accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current TikTok account
router.get('/current-account', (req, res) => {
  try {
    const currentAccount = tiktokService.getCurrentAccount();
    
    if (!currentAccount) {
      return res.json({ success: true, authenticated: false });
    }
    
    res.json({
      success: true,
      authenticated: true,
      account: {
        accountId: tiktokService.currentAccountId,
        username: currentAccount.username,
        openId: currentAccount.openId,
        userInfo: currentAccount.userInfo
      }
    });
  } catch (error) {
    console.error('❌ Failed to get current TikTok account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set current account
router.post('/accounts/select', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }
    
    const success = tiktokService.setCurrentAccount(accountId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    res.json({ success: true, message: 'Account selected successfully' });
  } catch (error) {
    console.error('❌ Failed to select TikTok account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove TikTok account
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const success = tiktokService.removeAccount(accountId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    res.json({ success: true, message: 'Account removed successfully' });
  } catch (error) {
    console.error('❌ Failed to remove TikTok account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload video to TikTok
router.post('/upload-video', async (req, res) => {
  try {
    const { videoPath, caption, privacyLevel, accountId } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: 'videoPath is required' });
    }
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    
    // Upload to TikTok
    const result = await tiktokService.uploadVideo({
      videoPath,
      caption: caption || 'Generated Video',
      privacyLevel: privacyLevel || 'PUBLIC_TO_EVERYONE',
      accountId
    });
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Failed to upload video to TikTok:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload saved video to TikTok (re-upload feature)
router.post('/upload-saved-video', async (req, res) => {
  try {
    const { videoId, accountId, customCaption, privacyLevel } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }
    
    // Get saved video
    const savedVideo = videoStorageService.getSavedVideo(videoId);
    if (!savedVideo) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    if (!fs.existsSync(savedVideo.videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    
    // Generate caption from video metadata
    const caption = customCaption || `${savedVideo.metadata.title || 'Generated Video'}\n\n${savedVideo.metadata.description || ''}`;
    
    // Upload to TikTok
    const result = await tiktokService.uploadVideo({
      videoPath: savedVideo.videoPath,
      caption,
      privacyLevel: privacyLevel || 'PUBLIC_TO_EVERYONE',
      accountId
    });
    
    // Add upload history to videoStorage
    try {
      const currentAccount = tiktokService.getCurrentAccount();
      await videoStorageService.addUploadHistory(videoId, {
        platform: 'tiktok',
        accountId: accountId || tiktokService.currentAccountId,
        username: currentAccount?.username || 'Unknown',
        videoId: result.videoId,
        videoUrl: result.url
      });
    } catch (historyError) {
      console.warn('⚠️ [TikTok] Failed to add upload history:', historyError.message);
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Failed to upload saved video to TikTok:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

