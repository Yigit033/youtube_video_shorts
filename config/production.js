// Production Configuration
// This file is loaded when NODE_ENV=production

module.exports = {
  // AI Configuration
  AI_PRIORITY: 'huggingface,template,fallback', // Ollama disabled in production
  USE_LOCAL_AI: false,
  
  // TTS Configuration  
  TTS_PRIORITY: 'huggingface,cross-platform,fallback',
  TTS_PROVIDER: 'huggingface',
  TTS_VOICE: 'auto',
  
  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // 100 requests per window
  
  // YouTube
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI,
  
  // Logging
  LOG_LEVEL: 'info',
  ENABLE_REQUEST_LOGGING: true
};
