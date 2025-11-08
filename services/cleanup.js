const fs = require('fs');
const path = require('path');

class CleanupService {
  constructor() {
    this.tempDir = path.join(__dirname, '..', 'temp');
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxSize = 1024 * 1024 * 1024; // 1GB in bytes
    
    console.log('🧹 Cleanup Service Initialized');
    console.log(`📁 Temp directory: ${this.tempDir}`);
    console.log(`⏰ Max file age: 24 hours`);
    console.log(`💾 Max total size: 1GB`);
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles() {
    try {
      console.log('\n🧹 [Cleanup] Starting cleanup of old files...');
      
      const now = Date.now();
      let deletedCount = 0;
      let freedSpace = 0;
      
      const subdirs = ['audio', 'videos', 'output', 'uploads', 'professional', 'batch_exports'];
      
      for (const subdir of subdirs) {
        const dirPath = path.join(this.tempDir, subdir);
        
        if (!fs.existsSync(dirPath)) {
          continue;
        }
        
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          
          try {
            const stats = fs.statSync(filePath);
            
            // Skip directories
            if (stats.isDirectory()) {
              continue;
            }
            
            // Check if file is older than maxAge
            const fileAge = now - stats.mtimeMs;
            
            if (fileAge > this.maxAge) {
              const fileSize = stats.size;
              fs.unlinkSync(filePath);
              deletedCount++;
              freedSpace += fileSize;
              console.log(`🗑️  Deleted old file: ${file} (${this.formatBytes(fileSize)})`);
            }
          } catch (error) {
            console.warn(`⚠️  Could not process file ${file}:`, error.message);
          }
        }
      }
      
      console.log(`✅ [Cleanup] Completed: ${deletedCount} files deleted, ${this.formatBytes(freedSpace)} freed`);
      
      return {
        deletedCount,
        freedSpace
      };
      
    } catch (error) {
      console.error('❌ [Cleanup] Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up files after video processing
   */
  async cleanupAfterProcessing(filePaths) {
    try {
      console.log('🧹 [Cleanup] Cleaning up processing files...');
      
      let deletedCount = 0;
      
      for (const filePath of filePaths) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🗑️  Deleted: ${path.basename(filePath)}`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not delete ${filePath}:`, error.message);
        }
      }
      
      console.log(`✅ [Cleanup] Deleted ${deletedCount} temporary files`);
      
      return deletedCount;
      
    } catch (error) {
      console.error('❌ [Cleanup] Error during processing cleanup:', error);
      throw error;
    }
  }

  /**
   * Check disk space and clean if necessary
   */
  async checkAndCleanIfNeeded() {
    try {
      const totalSize = await this.getTotalTempSize();
      
      console.log(`💾 [Cleanup] Current temp size: ${this.formatBytes(totalSize)}`);
      
      if (totalSize > this.maxSize) {
        console.log(`⚠️  [Cleanup] Temp directory exceeds ${this.formatBytes(this.maxSize)}, cleaning up...`);
        await this.cleanupOldFiles();
        
        // If still too large, clean more aggressively
        const newSize = await this.getTotalTempSize();
        if (newSize > this.maxSize) {
          console.log('⚠️  [Cleanup] Still too large, cleaning more aggressively...');
          await this.cleanupBySize();
        }
      } else {
        console.log('✅ [Cleanup] Temp directory size is within limits');
      }
      
    } catch (error) {
      console.error('❌ [Cleanup] Error checking disk space:', error);
    }
  }

  /**
   * Get total size of temp directory
   */
  async getTotalTempSize() {
    let totalSize = 0;
    
    const subdirs = ['audio', 'videos', 'output', 'uploads', 'professional', 'batch_exports'];
    
    for (const subdir of subdirs) {
      const dirPath = path.join(this.tempDir, subdir);
      
      if (!fs.existsSync(dirPath)) {
        continue;
      }
      
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch (error) {
          // Skip files we can't access
        }
      }
    }
    
    return totalSize;
  }

  /**
   * Clean up files by size (keep newest, delete oldest)
   */
  async cleanupBySize() {
    try {
      console.log('🧹 [Cleanup] Cleaning up by size...');
      
      const files = [];
      const subdirs = ['audio', 'videos', 'output', 'uploads', 'professional', 'batch_exports'];
      
      // Collect all files with their stats
      for (const subdir of subdirs) {
        const dirPath = path.join(this.tempDir, subdir);
        
        if (!fs.existsSync(dirPath)) {
          continue;
        }
        
        const dirFiles = fs.readdirSync(dirPath);
        
        for (const file of dirFiles) {
          const filePath = path.join(dirPath, file);
          
          try {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              files.push({
                path: filePath,
                size: stats.size,
                mtime: stats.mtimeMs
              });
            }
          } catch (error) {
            // Skip files we can't access
          }
        }
      }
      
      // Sort by modification time (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);
      
      // Delete oldest files until we're under the limit
      let currentSize = files.reduce((sum, f) => sum + f.size, 0);
      let deletedCount = 0;
      let freedSpace = 0;
      
      for (const file of files) {
        if (currentSize <= this.maxSize * 0.8) { // Keep 20% buffer
          break;
        }
        
        try {
          fs.unlinkSync(file.path);
          currentSize -= file.size;
          freedSpace += file.size;
          deletedCount++;
          console.log(`🗑️  Deleted: ${path.basename(file.path)} (${this.formatBytes(file.size)})`);
        } catch (error) {
          console.warn(`⚠️  Could not delete ${file.path}:`, error.message);
        }
      }
      
      console.log(`✅ [Cleanup] Deleted ${deletedCount} files, freed ${this.formatBytes(freedSpace)}`);
      
      return {
        deletedCount,
        freedSpace
      };
      
    } catch (error) {
      console.error('❌ [Cleanup] Error during size-based cleanup:', error);
      throw error;
    }
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Schedule automatic cleanup (call this on server start)
   */
  scheduleAutomaticCleanup() {
    // Clean up every 6 hours
    const interval = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    
    console.log('⏰ [Cleanup] Scheduling automatic cleanup every 6 hours');
    
    setInterval(async () => {
      console.log('\n⏰ [Cleanup] Running scheduled cleanup...');
      await this.cleanupOldFiles();
      await this.checkAndCleanIfNeeded();
    }, interval);
    
    // Run initial cleanup after 1 minute
    setTimeout(async () => {
      console.log('\n🚀 [Cleanup] Running initial cleanup...');
      await this.cleanupOldFiles();
      await this.checkAndCleanIfNeeded();
    }, 60000);
  }
}

module.exports = new CleanupService();
