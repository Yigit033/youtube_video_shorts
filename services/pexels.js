const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PexelsService {
  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY;
    this.baseUrl = 'https://api.pexels.com/v1';
    this.videoDir = path.join(__dirname, '..', 'temp', 'videos');
    this.ensureVideoDir();
  }

  ensureVideoDir() {
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
  }

  async fetchVideos(topic, count = 3) {
    if (!this.apiKey) {
      throw new Error('Pexels API key not configured');
    }

    try {
      console.log(`🎬 Searching for videos: "${topic}"`);
      
      // Smart search queries based on topic content
      let searchQueries = [topic];
      
      if (topic.includes('house') && topic.includes('wife') && topic.includes('tea')) {
        // Specific search for house/husband/wife scenarios
        searchQueries = [
          'couple working on house',
          'husband wife home renovation',
          'family construction project',
          'couple building home',
          'romantic home improvement'
        ];
      } else if (topic.includes('working') && topic.includes('house')) {
        searchQueries = [
          'home construction',
          'house renovation',
          'DIY home improvement',
          'building house',
          'home repair'
        ];
      } else if (topic.includes('cafe') || topic.includes('coffee') || topic.includes('tea')) {
        searchQueries = [
          'family cafe',
          'people drinking coffee',
          'cafe atmosphere',
          'family restaurant',
          'people eating together',
          'coffee shop',
          'tea time',
          'family dining'
        ];
      }
      
      // Try multiple search queries for better results
      let videos = [];
      for (const query of searchQueries) {
        try {
          const response = await axios.get(`${this.baseUrl}/videos/search`, {
            params: {
              query: query,
              per_page: count * 3, // Daha fazla video al
              orientation: 'portrait',
              size: 'large', // Daha yüksek kalite
              min_duration: 10, // En az 10 saniye
              max_duration: 60 // En fazla 60 saniye
            },
            headers: {
              'Authorization': this.apiKey
            }
          });
          
          if (response.data.videos && response.data.videos.length > 0) {
            videos = response.data.videos;
            console.log(`✅ Found ${videos.length} videos for query: "${query}"`);
            break;
          }
        } catch (queryError) {
          console.warn(`Query "${query}" failed, trying next...`);
          continue;
        }
      }

      if (videos.length === 0) {
        throw new Error(`No videos found for topic: ${topic}`);
      }

      // Download the first 'count' videos
      const downloadedVideos = [];
      
      for (let i = 0; i < Math.min(count, videos.length); i++) {
        const video = videos[i];
        const videoFile = video.video_files.find(file => 
          file.quality === 'hd' || file.quality === 'sd'
        );
        
        if (videoFile) {
          try {
            const downloadPath = await this.downloadVideo(videoFile.link, `${topic}_${i + 1}`);
            downloadedVideos.push({
              path: downloadPath,
              duration: video.duration || 10,
              url: video.url
            });
            console.log(`✅ Downloaded: ${path.basename(downloadPath)}`);
          } catch (downloadError) {
            console.error(`❌ Failed to download video ${i + 1}:`, downloadError.message);
          }
        }
      }

      if (downloadedVideos.length === 0) {
        throw new Error('Failed to download any videos');
      }

      return downloadedVideos;

    } catch (error) {
      console.error('Pexels API Error:', error.message);
      
      // Return placeholder video paths for development
      return this.createPlaceholderVideos(count);
    }
  }

  async downloadVideo(url, filename) {
    const videoPath = path.join(this.videoDir, `${filename}.mp4`);
    
    // Skip if already exists
    if (fs.existsSync(videoPath)) {
      return videoPath;
    }

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000 // 30 seconds timeout
    });

    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(videoPath));
      writer.on('error', reject);
    });
  }

  createPlaceholderVideos(count) {
    // Create placeholder entries when Pexels is unavailable
    const placeholders = [];
    
    for (let i = 0; i < count; i++) {
      placeholders.push({
        path: null, // Will be handled by video service
        duration: 10,
        url: `https://via.placeholder.com/1080x1920/000000/FFFFFF?text=Video+${i + 1}`,
        isPlaceholder: true
      });
    }
    
    return placeholders;
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/videos/search?query=nature&per_page=1`, {
        headers: { 'Authorization': this.apiKey }
      });
      
      return { success: true, videosFound: response.data.total_results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PexelsService();