const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PixabayService {
  constructor() {
    this.apiKey = process.env.PIXABAY_API_KEY;
    this.baseUrl = 'https://pixabay.com/api/';
    this.outputDir = path.join(__dirname, '..', 'temp', 'videos');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async fetchVideos(query, count = 3) {
    if (!this.apiKey) {
      console.log('⚠️ Pixabay API key not configured, skipping Pixabay videos');
      console.log('💡 Add PIXABAY_API_KEY to your .env file');
      return [];
    }
    
    console.log(`🔑 [Pixabay] Using API key: ${this.apiKey.substring(0, 8)}...`);

    // Improve search queries for better results
    let searchQuery = query;
    if (query.includes('cafe') || query.includes('coffee') || query.includes('tea')) {
      searchQuery = 'family cafe people drinking coffee';
    }

    try {
      console.log(`🎬 [Pixabay] Searching for videos: "${searchQuery}"`);
      
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          q: searchQuery,
          video_type: 'film',
          orientation: 'vertical',
          min_width: 1920, // Full HD minimum
          min_height: 1080,
          per_page: count * 4, // Çok daha fazla video al
          order: 'popular',
          min_duration: 10, // En az 10 saniye
          max_duration: 60 // En fazla 60 saniye
        },
        timeout: 10000
      });

      if (response.data.hits && response.data.hits.length > 0) {
        console.log(`✅ [Pixabay] Found ${response.data.hits.length} videos`);
        
        // Filter and sort by quality
        const qualityVideos = this.filterByQuality(response.data.hits, count);
        
        // Download videos
        const downloadedVideos = [];
        for (const video of qualityVideos) {
          try {
            const videoPath = await this.downloadVideo(video, query);
            if (videoPath) {
              downloadedVideos.push({
                path: videoPath,
                source: 'pixabay',
                quality: this.calculateQualityScore(video),
                duration: video.duration,
                resolution: `${video.imageWidth}x${video.imageHeight}`
              });
            }
          } catch (error) {
            console.warn(`⚠️ [Pixabay] Failed to download video: ${error.message}`);
          }
        }
        
        console.log(`✅ [Pixabay] Downloaded ${downloadedVideos.length} videos`);
        return downloadedVideos;
      } else {
        console.log(`ℹ️ [Pixabay] No videos found for query: "${query}"`);
        return [];
      }
    } catch (error) {
      console.error(`❌ [Pixabay] Error fetching videos: ${error.message}`);
      return [];
    }
  }

  filterByQuality(videos, count) {
    // Sort by quality score (likes, downloads, resolution)
    const scoredVideos = videos.map(video => ({
      ...video,
      qualityScore: this.calculateQualityScore(video)
    }));

    // Sort by quality score (highest first)
    scoredVideos.sort((a, b) => b.qualityScore - a.qualityScore);

    // Return top quality videos
    return scoredVideos.slice(0, count);
  }

  calculateQualityScore(video) {
    let score = 0;
    
    // Resolution score (higher is better)
    const resolution = video.imageWidth * video.imageHeight;
    if (resolution >= 1920 * 1080) score += 50; // Full HD
    else if (resolution >= 1280 * 720) score += 30; // HD
    else if (resolution >= 854 * 480) score += 10; // SD
    
    // Duration score (prefer 10-30 seconds)
    if (video.duration >= 10 && video.duration <= 30) score += 20;
    else if (video.duration >= 5 && video.duration <= 60) score += 10;
    
    // Popularity score (likes, downloads)
    score += Math.min(video.likes || 0, 100) / 10;
    score += Math.min(video.downloads || 0, 1000) / 100;
    
    return score;
  }

  async downloadVideo(video, query) {
    try {
      const videoUrl = video.videos?.large?.url || video.videos?.medium?.url || video.videos?.small?.url || video.videoURL || video.webformatURL;
      if (!videoUrl) {
        throw new Error('No video URL available');
      }

      const filename = `${query}_pixabay_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, filename);

      console.log(`📥 [Pixabay] Downloading: ${filename}`);
      
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        timeout: 30000
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ [Pixabay] Downloaded: ${filename}`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`❌ [Pixabay] Download failed: ${error.message}`);
      return null;
    }
  }
}

module.exports = PixabayService;
