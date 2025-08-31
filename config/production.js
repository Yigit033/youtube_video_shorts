module.exports = {
  // Production Environment Configuration
  NODE_ENV: 'production',
  PORT: process.env.PORT || 3000,

  // YouTube API Configuration
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI,

  // Pexels API
  PEXELS_API_KEY: process.env.PEXELS_API_KEY,

  // HuggingFace (Optional)
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,

  // TTS Priority (Production)
  TTS_PRIORITY: 'edge,local,fallback',

  // AI Priority (Production)
  AI_PRIORITY: 'template,edge,fallback',

  // TTS Configuration
  TTS_PROVIDER: 'edge',
  TTS_VOICE: 'en-US-Studio-O',

  // Security
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://yourdomain.com',

  // Logging
  LOG_LEVEL: 'info',
  LOG_FILE: 'logs/app.log',

  // Performance
  MAX_FILE_SIZE: 52428800, // 50MB
  REQUEST_TIMEOUT: 30000,

  // Health Check
  HEALTH_CHECK_INTERVAL: 30000,
  HEALTH_CHECK_TIMEOUT: 3000,
  HEALTH_CHECK_RETRIES: 3
};
