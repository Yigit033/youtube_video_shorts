const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagram');
const instagramMetadataService = require('../services/instagramMetadata');
const videoWatermarkService = require('../services/videoWatermark');
const videoStorageService = require('../services/videoStorage');
const fs = require('fs');
const path = require('path');

/**
 * Instagram Routes
 * Handles Instagram authentication, upload, and analytics
 */

// Get Instagram auth URL
router.get('/auth-url', (req, res) => {
  try {
    const authUrl = instagramService.getAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('❌ Failed to get Instagram auth URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      console.error('❌ Instagram OAuth error:', error);
      return res.redirect(`/?auth=error&message=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      return res.redirect('/?auth=error&message=No authorization code received');
    }
    
    // Exchange code for token
    const accountData = await instagramService.exchangeCodeForToken(code);
    
    // Add account
    const accountId = await instagramService.addAccount(
      accountData.accessToken,
      accountData.instagramAccountId,
      accountData.username,
      accountData.accountInfo
    );
    
    console.log(`✅ Instagram account connected: ${accountData.username}`);
    
    // Redirect to success page
    res.redirect(`/?auth=success&platform=instagram&accountId=${accountId}&username=${encodeURIComponent(accountData.username)}`);
  } catch (error) {
    console.error('❌ Instagram OAuth callback failed:', error);
    res.redirect(`/?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Get Instagram accounts
router.get('/accounts', (req, res) => {
  try {
    const accounts = instagramService.getAccounts();
    const currentAccount = instagramService.getCurrentAccount();
    
    res.json({
      success: true,
      accounts,
      currentAccount: currentAccount ? {
        accountId: instagramService.currentAccountId,
        username: currentAccount.username,
        instagramAccountId: currentAccount.instagramAccountId
      } : null,
      accountsCount: accounts.length
    });
  } catch (error) {
    console.error('❌ Failed to get Instagram accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current Instagram account
router.get('/current-account', (req, res) => {
  try {
    const currentAccount = instagramService.getCurrentAccount();
    
    if (!currentAccount) {
      return res.json({ success: true, authenticated: false });
    }
    
    res.json({
      success: true,
      authenticated: true,
      account: {
        accountId: instagramService.currentAccountId,
        username: currentAccount.username,
        instagramAccountId: currentAccount.instagramAccountId,
        accountInfo: currentAccount.accountInfo
      }
    });
  } catch (error) {
    console.error('❌ Failed to get current Instagram account:', error);
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
    
    const success = instagramService.setCurrentAccount(accountId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    res.json({ success: true, message: 'Account selected successfully' });
  } catch (error) {
    console.error('❌ Failed to select Instagram account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove Instagram account
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const success = instagramService.removeAccount(accountId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    res.json({ success: true, message: 'Account removed successfully' });
  } catch (error) {
    console.error('❌ Failed to remove Instagram account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Add Instagram account with manual access token (for testing)
router.post('/add-token', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'accessToken is required' });
    }
    
    console.log('🔑 [Instagram] Adding account with manual token...');
    
    // Get long-lived token if it's short-lived
    let longLivedToken = accessToken;
    try {
      longLivedToken = await instagramService.getLongLivedToken(accessToken);
      if (longLivedToken !== accessToken) {
        console.log('✅ [Instagram] Converted short-lived token to long-lived token');
      }
    } catch (tokenError) {
      console.warn('⚠️ [Instagram] Could not convert to long-lived token, using provided token:', tokenError.message);
    }
    
    // Get Instagram Business Account info
    const instagramAccount = await instagramService.getInstagramAccount(longLivedToken);
    
    // Add account
    const accountId = await instagramService.addAccount(
      longLivedToken,
      instagramAccount.id,
      instagramAccount.username,
      instagramAccount
    );
    
    console.log(`✅ [Instagram] Account added with manual token: @${instagramAccount.username}`);
    
    res.json({
      success: true,
      message: 'Account added successfully',
      account: {
        accountId,
        username: instagramAccount.username,
        instagramAccountId: instagramAccount.id
      }
    });
  } catch (error) {
    console.error('❌ Failed to add account with manual token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload Reel to Instagram
router.post('/upload-reel', async (req, res) => {
  try {
    const { videoPath, title, description, tags, topic, youtubeUrl, youtubeChannelUrl, channelName, accountId, addWatermark = true } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: 'videoPath is required' });
    }
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    
    let finalVideoPath = videoPath;
    
    // Add watermark if requested
    if (addWatermark && (youtubeChannelUrl || channelName)) {
      try {
        console.log('🎨 [Instagram] Adding YouTube watermark...');
        finalVideoPath = await videoWatermarkService.addSimpleWatermark(
          videoPath,
          '📺 Full video on YouTube',
          'bottom-right'
        );
        console.log('✅ [Instagram] Watermark added successfully');
      } catch (watermarkError) {
        console.warn('⚠️ [Instagram] Watermark failed, using original video:', watermarkError.message);
        // Continue with original video if watermark fails
      }
    }
    
    // Generate Instagram caption
    const caption = instagramMetadataService.generateCompleteCaption({
      title,
      description,
      tags,
      topic,
      youtubeUrl,
      videoFormat: 'shorts'
    });
    
    console.log('📝 [Instagram] Generated caption:', caption.substring(0, 100) + '...');
    
    // Upload to Instagram
    const result = await instagramService.uploadReel({
      videoPath: finalVideoPath,
      caption,
      accountId
    });
    
    // Clean up watermarked video if it was created
    if (finalVideoPath !== videoPath && fs.existsSync(finalVideoPath)) {
      setTimeout(() => {
        try {
          fs.unlinkSync(finalVideoPath);
          console.log('🧹 [Instagram] Cleaned up watermarked video');
        } catch (cleanupError) {
          console.warn('⚠️ [Instagram] Failed to cleanup watermarked video:', cleanupError.message);
        }
      }, 5000); // Wait 5 seconds before cleanup
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Failed to upload Reel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload saved video to Instagram (re-upload feature)
router.post('/upload-saved-video', async (req, res) => {
  try {
    const { videoId, accountId, addWatermark = true, customCaption } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }
    
    // Get saved video
    const savedVideo = videoStorageService.getSavedVideo(videoId);
    if (!savedVideo) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    // CRITICAL: Only allow Shorts format for Instagram Reels (90 second limit)
    if (savedVideo.metadata.videoFormat !== 'shorts') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only YouTube Shorts format can be uploaded to Instagram Reels (Instagram limit: 90 seconds)' 
      });
    }
    
    if (!fs.existsSync(savedVideo.videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    
    let finalVideoPath = savedVideo.videoPath;
    
    // Add watermark if requested
    if (addWatermark) {
      try {
        console.log('🎨 [Instagram] Adding YouTube watermark...');
        finalVideoPath = await videoWatermarkService.addSimpleWatermark(
          savedVideo.videoPath,
          '📺 Full video on YouTube',
          'bottom-right'
        );
        console.log('✅ [Instagram] Watermark added successfully');
      } catch (watermarkError) {
        console.warn('⚠️ [Instagram] Watermark failed, using original video:', watermarkError.message);
      }
    }
    
    // Generate or use custom caption
    const caption = customCaption || instagramMetadataService.generateCompleteCaption({
      title: savedVideo.metadata.title,
      description: savedVideo.metadata.description,
      tags: savedVideo.metadata.tags,
      topic: savedVideo.metadata.topic,
      videoFormat: savedVideo.metadata.videoFormat
    });
    
    // Upload to Instagram
    const result = await instagramService.uploadReel({
      videoPath: finalVideoPath,
      caption,
      accountId
    });
    
    // Add upload history to videoStorage
    try {
      const currentAccount = instagramService.getCurrentAccount();
      await videoStorageService.addUploadHistory(videoId, {
        platform: 'instagram',
        accountId: accountId || instagramService.currentAccountId,
        username: currentAccount?.username || 'Unknown',
        reelId: result.reelId,
        reelUrl: result.url
      });
    } catch (historyError) {
      console.warn('⚠️ [Instagram] Failed to add upload history:', historyError.message);
    }
    
    // Clean up watermarked video if it was created
    if (finalVideoPath !== savedVideo.videoPath && fs.existsSync(finalVideoPath)) {
      setTimeout(() => {
        try {
          fs.unlinkSync(finalVideoPath);
        } catch (cleanupError) {
          console.warn('⚠️ [Instagram] Failed to cleanup watermarked video:', cleanupError.message);
        }
      }, 5000);
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Failed to upload saved video to Instagram:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Instagram account insights
router.get('/insights', async (req, res) => {
  try {
    const { accountId } = req.query;
    
    const insights = await instagramService.getAccountInsights(accountId);
    
    if (!insights) {
      return res.status(404).json({ success: false, error: 'Failed to get insights' });
    }
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('❌ Failed to get Instagram insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Reel insights
router.get('/reel-insights/:reelId', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { accountId } = req.query;
    
    const insights = await instagramService.getReelInsights(reelId, accountId);
    
    if (!insights) {
      return res.status(404).json({ success: false, error: 'Failed to get Reel insights' });
    }
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('❌ Failed to get Reel insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate Instagram caption (for preview)
router.post('/generate-caption', (req, res) => {
  try {
    const { title, description, tags, topic, youtubeUrl, videoFormat } = req.body;
    
    const caption = instagramMetadataService.generateCompleteCaption({
      title,
      description,
      tags,
      topic,
      youtubeUrl,
      videoFormat: videoFormat || 'shorts'
    });
    
    res.json({
      success: true,
      caption
    });
  } catch (error) {
    console.error('❌ Failed to generate caption:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

