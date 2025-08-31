const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Initiate YouTube OAuth flow
router.get('/youtube', (req, res) => {
  try {
    const authUrl = youtubeService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// OAuth callback URL
router.get('/youtube/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Authorization code is required');
    }

    // Handle the OAuth callback with the authorization code
    await youtubeService.handleCallback(code);
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// Check authentication status
router.get('/status', (req, res) => {
  try {
    const isAuthenticated = youtubeService.isAuthenticated();
    res.json({ authenticated: isAuthenticated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
