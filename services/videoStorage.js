const fs = require('fs');
const path = require('path');

class VideoStorageService {
  constructor() {
    // Kalıcı video saklama klasörü
    this.savedVideosDir = path.join(__dirname, '..', 'temp', 'saved_videos');
    this.metadataDir = path.join(__dirname, '..', 'temp', 'saved_videos', 'metadata');
    
    // Klasörleri oluştur
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.savedVideosDir)) {
      fs.mkdirSync(this.savedVideosDir, { recursive: true });
    }
    if (!fs.existsSync(this.metadataDir)) {
      fs.mkdirSync(this.metadataDir, { recursive: true });
    }
  }

  /**
   * Video'yu kalıcı klasöre kaydet ve metadata'yı sakla
   * @param {string} videoPath - Kaynak video dosyası yolu
   * @param {Object} metadata - Video metadata'sı
   * @returns {Promise<Object>} Kaydedilen video bilgileri
   */
  async saveVideo(videoPath, metadata) {
    try {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Unique video ID oluştur
      const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Yeni dosya yolları
      const savedVideoPath = path.join(this.savedVideosDir, `${videoId}.mp4`);
      const metadataPath = path.join(this.metadataDir, `${videoId}.json`);

      // Video'yu kalıcı klasöre kopyala
      console.log(`💾 [VideoStorage] Saving video: ${path.basename(videoPath)} → ${videoId}.mp4`);
      fs.copyFileSync(videoPath, savedVideoPath);

      // Metadata'yı hazırla
      const videoMetadata = {
        videoId,
        videoPath: savedVideoPath,
        originalPath: videoPath,
        metadata: {
          title: metadata.title || '',
          description: metadata.description || '',
          tags: metadata.tags || [],
          topic: metadata.topic || '',
          script: metadata.script || '',
          videoFormat: metadata.videoFormat || 'shorts',
          thumbnailPath: metadata.thumbnailPath || null,
          createdAt: new Date().toISOString()
        },
        uploadHistory: []
      };

      // Metadata'yı kaydet
      fs.writeFileSync(metadataPath, JSON.stringify(videoMetadata, null, 2), 'utf8');

      console.log(`✅ [VideoStorage] Video saved successfully: ${videoId}`);
      
      return {
        videoId,
        videoPath: savedVideoPath,
        metadata: videoMetadata
      };
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to save video:', error);
      throw error;
    }
  }

  /**
   * Upload geçmişini ekle
   * @param {string} videoId - Video ID
   * @param {Object} uploadInfo - Upload bilgileri
   */
  async addUploadHistory(videoId, uploadInfo) {
    try {
      const metadataPath = path.join(this.metadataDir, `${videoId}.json`);
      
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Video metadata not found: ${videoId}`);
      }

      const videoData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Support both YouTube and Instagram upload history
      const historyEntry = {
        platform: uploadInfo.platform || 'youtube', // 'youtube' or 'instagram'
        accountId: uploadInfo.accountId || null,
        uploadedAt: new Date().toISOString()
      };
      
      // YouTube-specific fields
      if (uploadInfo.platform === 'youtube' || !uploadInfo.platform) {
        historyEntry.channelName = uploadInfo.channelName || 'Unknown Channel';
        historyEntry.channelId = uploadInfo.channelId || null;
        historyEntry.youtubeVideoId = uploadInfo.youtubeVideoId || null;
        historyEntry.youtubeUrl = uploadInfo.youtubeUrl || null;
      }
      
      // Instagram-specific fields
      if (uploadInfo.platform === 'instagram') {
        historyEntry.username = uploadInfo.username || 'Unknown';
        historyEntry.reelId = uploadInfo.reelId || null;
        historyEntry.reelUrl = uploadInfo.reelUrl || null;
      }
      
      videoData.uploadHistory.push(historyEntry);

      fs.writeFileSync(metadataPath, JSON.stringify(videoData, null, 2), 'utf8');
      console.log(`✅ [VideoStorage] Upload history added for ${videoId}`);
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to add upload history:', error);
      throw error;
    }
  }

  /**
   * Kaydedilmiş video'yu getir
   * @param {string} videoId - Video ID
   * @returns {Object|null} Video bilgileri
   */
  getSavedVideo(videoId) {
    try {
      const metadataPath = path.join(this.metadataDir, `${videoId}.json`);
      
      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      const videoData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Video dosyasının hala var olup olmadığını kontrol et
      if (!fs.existsSync(videoData.videoPath)) {
        // Video dosyası yoksa metadata'yı sil
        console.warn(`⚠️ [VideoStorage] Video file not found for ${videoId}, removing metadata`);
        try {
          fs.unlinkSync(metadataPath);
        } catch (unlinkError) {
          console.warn(`⚠️ [VideoStorage] Failed to remove metadata file: ${unlinkError.message}`);
        }
        return null;
      }

      // Video dosyası varsa metadata'yı döndür
      return videoData;
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to get saved video:', error);
      return null;
    }
  }

  /**
   * Tüm kaydedilmiş videoları listele
   * @returns {Array} Video listesi
   */
  getAllSavedVideos() {
    try {
      const videos = [];
      
      if (!fs.existsSync(this.metadataDir)) {
        return videos;
      }

      const metadataFiles = fs.readdirSync(this.metadataDir)
        .filter(file => file.endsWith('.json'));

      for (const file of metadataFiles) {
        try {
          const videoId = path.basename(file, '.json');
          const videoData = this.getSavedVideo(videoId);
          
          if (videoData) {
            videos.push({
              videoId: videoData.videoId,
              title: videoData.metadata.title,
              topic: videoData.metadata.topic,
              videoFormat: videoData.metadata.videoFormat,
              createdAt: videoData.metadata.createdAt,
              uploadCount: videoData.uploadHistory.length,
              uploadHistory: videoData.uploadHistory
            });
          }
        } catch (error) {
          console.warn(`⚠️ [VideoStorage] Failed to load video metadata from ${file}:`, error.message);
        }
      }

      // En yeni videolar önce gelsin
      videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return videos;
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to get all saved videos:', error);
      return [];
    }
  }

  /**
   * Video'yu sil
   * @param {string} videoId - Video ID
   * @returns {boolean} Başarılı mı?
   */
  async deleteVideo(videoId) {
    try {
      const metadataPath = path.join(this.metadataDir, `${videoId}.json`);
      const videoPath = path.join(this.savedVideosDir, `${videoId}.mp4`);

      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }

      console.log(`✅ [VideoStorage] Video deleted: ${videoId}`);
      return true;
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to delete video:', error);
      return false;
    }
  }

  /**
   * Eski videoları temizle (30 günden eski)
   * @param {number} daysOld - Kaç gün eski videolar silinecek (default: 30)
   */
  async cleanupOldVideos(daysOld = 30) {
    try {
      const videos = this.getAllSavedVideos();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      for (const video of videos) {
        const videoDate = new Date(video.createdAt);
        if (videoDate < cutoffDate) {
          await this.deleteVideo(video.videoId);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 [VideoStorage] Cleaned up ${deletedCount} old video(s)`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ [VideoStorage] Failed to cleanup old videos:', error);
      return 0;
    }
  }
}

module.exports = new VideoStorageService();

