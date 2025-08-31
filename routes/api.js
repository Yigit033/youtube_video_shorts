const express = require('express');
const router = express.Router();

// Import services for testing
const aiService = require('../services/ai');
const ttsService = require('../services/tts');
const videoService = require('../services/video');
const pexelsService = require('../services/pexels');

// Test endpoints for system status
router.get('/test/ai', async (req, res) => {
  try {
    const result = await aiService.testConnection();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/test/tts', async (req, res) => {
  try {
    const result = await ttsService.testTTS();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/test/pexels', async (req, res) => {
  try {
    const result = await pexelsService.testConnection();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/test/ffmpeg', async (req, res) => {
  try {
    const result = await videoService.testFFmpeg();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;