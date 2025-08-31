// Example usage of the enhanced YouTube uploader with SEO optimization and translations
require('dotenv').config();
const path = require('path');
const youtube = require('../services/youtubeEnhanced');

async function runExample() {
  try {
    // Check authentication
    if (!youtube.isAuthenticated()) {
      console.log('❌ Please authenticate first by visiting /auth/youtube');
      return;
    }

    // Example video path (replace with actual video file)
    const videoPath = path.join(__dirname, '..', 'temp', 'output', 'my_video.mp4');
    
    // Upload with all features enabled
    const result = await youtube.uploadVideo({
      videoPath,
      topic: '5 Amazing Facts About Space', // Used for SEO if title/description not provided
      enableABTest: true,                  // Generate A/B test variations
      translateTo: ['es', 'fr', 'de'],     // Translate to these languages
      publishAt: new Date(Date.now() + 3600000) // Schedule for 1 hour from now
    });

    console.log('\n🎉 Upload Results:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

runExample();
