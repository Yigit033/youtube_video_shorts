const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PexelsService {
  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY;
    this.baseUrl = 'https://api.pexels.com/v1';
    this.videoDir = path.join(__dirname, '..', 'temp', 'videos');
  }

  async ensureVideoDir() {
    try {
      await fs.mkdir(this.videoDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  optimizeSearchQuery(topic) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    return topic.toLowerCase()
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 3)
      .join(' ');
  }

  getVideoQualityScore(videoFile) {
    const qualityWeights = {
      'hd': { base: 100, portrait: 20, resolution: 10 },
      'sd': { base: 50, portrait: 20, resolution: 5 }
    };
    
    const weight = qualityWeights[videoFile.quality] || { base: 10 };
    let score = weight.base;
    
    // Portrait bonus
    if (videoFile.width === 1080 && videoFile.height === 1920) score += weight.portrait;
    // Resolution bonus
    if (videoFile.width >= 720) score += weight.resolution;
    
    return score;
  }

  selectBestVideoFile(videoFiles) {
    return videoFiles.reduce((best, current) => {
      const currentScore = this.getVideoQualityScore(current);
      const bestScore = best ? this.getVideoQualityScore(best) : -1;
      return currentScore > bestScore ? current : best;
    }, null);
  }

  async searchWithRetry(query, attempt = 1) {
    const maxAttempts = 3;
    
    try {
      const response = await axios.get(`${this.baseUrl}/videos/search`, {
        params: {
          query: query,
          per_page: 15,
          orientation: 'portrait',
          size: 'large',
          min_duration: 5,
          max_duration: 30 // Daha kısa videolar daha iyi
        },
        headers: { 'Authorization': this.apiKey },
        timeout: 10000
      });
      
      return response.data.videos || [];
    } catch (error) {
      if (attempt < maxAttempts && error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return this.searchWithRetry(query, attempt + 1);
      }
      throw error;
    }
  }

  async fetchVideos(topic, count = 3) {
    if (!this.apiKey) {
      console.warn('⚠️ Pexels API key not configured');
      return [];
    }

    await this.ensureVideoDir();
    
    try {
      console.log(`🎬 [Pexels] Searching for: "${topic}"`);
      
      const searchQuery = this.optimizeSearchQuery(topic);
      console.log(`🔍 [Pexels] Optimized query: "${searchQuery}"`);

      // Paralel arama stratejileri
      const searchStrategies = [
        searchQuery,
        searchQuery.split(' ')[0],
        `${searchQuery} people`,
        `${searchQuery} lifestyle`
      ];

      const searchPromises = searchStrategies.map(query => 
        this.searchWithRetry(query).catch(error => {
          console.warn(`⚠️ [Pexels] Search failed for "${query}":`, error.message);
          return [];
        })
      );

      const results = await Promise.all(searchPromises);
      let allVideos = results.flat();

      // Fallback search if no results
      if (allVideos.length === 0) {
        console.log('ℹ️ [Pexels] Trying generic fallback search');
        allVideos = await this.searchWithRetry('people lifestyle').catch(() => []);
      }

      if (allVideos.length === 0) {
        console.log(`ℹ️ [Pexels] No videos found for: "${searchQuery}"`);
        return [];
      }

      // Remove duplicates and prioritize
      const uniqueVideos = [...new Map(allVideos.map(v => [v.id, v])).values()]
        .sort((a, b) => {
          const aBest = this.selectBestVideoFile(a.video_files);
          const bBest = this.selectBestVideoFile(b.video_files);
          return (bBest ? this.getVideoQualityScore(bBest) : 0) - 
                 (aBest ? this.getVideoQualityScore(aBest) : 0);
        })
        .slice(0, count * 2); // Backup için 2x

      // Paralel indirme
      const downloadPromises = uniqueVideos.slice(0, count).map(async (video, index) => {
        const bestFile = this.selectBestVideoFile(video.video_files);
        if (!bestFile) return null;

        try {
          const filename = `pexels_${video.id}_${index}`;
          const downloadPath = await this.downloadVideo(bestFile.link, filename);
          
          return {
            path: downloadPath,
            duration: Math.min(video.duration || 10, 30), // Max 30 saniye
            quality: this.getVideoQualityScore(bestFile),
            source: 'pexels',
            url: video.url,
            width: bestFile.width,
            height: bestFile.height
          };
        } catch (error) {
          console.warn(`⚠️ [Pexels] Download failed for video ${index}:`, error.message);
          return null;
        }
      });

      const downloadedVideos = (await Promise.all(downloadPromises)).filter(Boolean);
      
      console.log(`✅ [Pexels] Success: ${downloadedVideos.length}/${count} videos`);
      
      return downloadedVideos;

    } catch (error) {
      console.error('❌ [Pexels] Error:', error.message);
      return [];
    }
  }

  async downloadVideo(url, filename) {
    const videoPath = path.join(this.videoDir, `${filename}.mp4`);
    
    try {
      await fs.access(videoPath);
      return videoPath; // Already exists
    } catch {
      // File doesn't exist, proceed with download
    }

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = require('fs').createWriteStream(videoPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(videoPath));
      writer.on('error', reject);
    });
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/videos/search`, {
        params: { query: 'test', per_page: 1 },
        headers: { 'Authorization': this.apiKey },
        timeout: 5000
      });
      
      return { 
        success: true, 
        videosFound: response.data.total_results,
        rateLimit: response.headers['x-ratelimit-remaining']
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status 
      };
    }
  }
}

module.exports = new PexelsService();
