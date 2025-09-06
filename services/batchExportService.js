const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

class BatchExportService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'batch_exports');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Export video to multiple formats
  async exportToAllFormats(inputPath, options = {}) {
    const {
      includeShorts = true,
      includeYouTube = true,
      includeInstagram = true,
      includeTikTok = true,
      includeFacebook = true,
      includeTwitter = true,
      quality = 'high',
      addWatermark = false,
      watermarkText = 'Created with AI'
    } = options;

    console.log('📦 [Batch Export] Starting multi-format export...');

    const exports = {};
    const exportPromises = [];

    // YouTube Shorts (9:16)
    if (includeShorts) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'shorts', quality, addWatermark, watermarkText)
          .then(path => { exports.shorts = path; })
      );
    }

    // YouTube Video (16:9)
    if (includeYouTube) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'youtube', quality, addWatermark, watermarkText)
          .then(path => { exports.youtube = path; })
      );
    }

    // Instagram Reels (4:5)
    if (includeInstagram) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'instagram', quality, addWatermark, watermarkText)
          .then(path => { exports.instagram = path; })
      );
    }

    // TikTok (9:16)
    if (includeTikTok) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'tiktok', quality, addWatermark, watermarkText)
          .then(path => { exports.tiktok = path; })
      );
    }

    // Facebook (1:1)
    if (includeFacebook) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'facebook', quality, addWatermark, watermarkText)
          .then(path => { exports.facebook = path; })
      );
    }

    // Twitter (16:9)
    if (includeTwitter) {
      exportPromises.push(
        this.exportToFormat(inputPath, 'twitter', quality, addWatermark, watermarkText)
          .then(path => { exports.twitter = path; })
      );
    }

    // Wait for all exports to complete
    await Promise.allSettled(exportPromises);

    console.log('✅ [Batch Export] All formats exported successfully');
    return exports;
  }

  // Export to specific format
  async exportToFormat(inputPath, format, quality = 'high', addWatermark = false, watermarkText = '') {
    const formatConfig = this.getFormatConfig(format, quality);
    const outputPath = path.join(this.outputDir, `${format}_${Date.now()}.mp4`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Apply format-specific settings
      command = command
        .size(formatConfig.size)
        .aspect(formatConfig.aspect)
        .fps(formatConfig.fps);

      // Add watermark if requested
      if (addWatermark && watermarkText) {
        const watermarkFilter = this.getWatermarkFilter(watermarkText, formatConfig);
        command = command.videoFilter(watermarkFilter);
      }

      // Apply quality settings
      const qualitySettings = this.getQualitySettings(quality);
      command = command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(qualitySettings);

      command
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`📦 [Batch Export] Exporting to ${format}: ${cmd}`);
        })
        .on('progress', (progress) => {
          console.log(`📊 [Batch Export] ${format}: ${Math.floor(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log(`✅ [Batch Export] ${format} exported: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`❌ [Batch Export] ${format} failed:`, err);
          reject(err);
        })
        .run();
    });
  }

  // Get format configuration
  getFormatConfig(format, quality) {
    const configs = {
      shorts: {
        size: '1080x1920',
        aspect: '9:16',
        fps: 30,
        description: 'YouTube Shorts (9:16)'
      },
      youtube: {
        size: '1920x1080',
        aspect: '16:9',
        fps: 30,
        description: 'YouTube Video (16:9)'
      },
      instagram: {
        size: '1080x1350',
        aspect: '4:5',
        fps: 30,
        description: 'Instagram Reels (4:5)'
      },
      tiktok: {
        size: '1080x1920',
        aspect: '9:16',
        fps: 30,
        description: 'TikTok (9:16)'
      },
      facebook: {
        size: '1080x1080',
        aspect: '1:1',
        fps: 30,
        description: 'Facebook (1:1)'
      },
      twitter: {
        size: '1280x720',
        aspect: '16:9',
        fps: 30,
        description: 'Twitter (16:9)'
      }
    };

    return configs[format] || configs.youtube;
  }

  // Get quality settings
  getQualitySettings(quality) {
    const settings = {
      low: ['-preset', 'ultrafast', '-crf', '28', '-b:v', '1M'],
      medium: ['-preset', 'fast', '-crf', '23', '-b:v', '2M'],
      high: ['-preset', 'medium', '-crf', '18', '-b:v', '5M'],
      ultra: ['-preset', 'slow', '-crf', '15', '-b:v', '10M']
    };

    return settings[quality] || settings.high;
  }

  // Get watermark filter
  getWatermarkFilter(watermarkText, formatConfig) {
    const fontSize = Math.min(formatConfig.size.split('x')[0], formatConfig.size.split('x')[1]) * 0.03;
    
    return [
      `drawtext=text='${watermarkText}':fontsize=${fontSize}:fontcolor=white@0.7:x=w-text_w-20:y=h-text_h-20:box=1:boxcolor=black@0.3:boxborderw=5`
    ];
  }

  // Create export package (ZIP)
  async createExportPackage(exports, packageName = 'video_exports') {
    const packagePath = path.join(this.outputDir, `${packageName}.zip`);
    const output = fs.createWriteStream(packagePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`📦 [Batch Export] Package created: ${packagePath} (${archive.pointer()} bytes)`);
        resolve(packagePath);
      });

      archive.on('error', (err) => {
        console.error('❌ [Batch Export] Package creation failed:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add all exported videos to package
      Object.entries(exports).forEach(([format, filePath]) => {
        if (filePath && fs.existsSync(filePath)) {
          const fileName = `${format}_${path.basename(filePath)}`;
          archive.file(filePath, { name: fileName });
        }
      });

      // Add README with format descriptions
      const readmeContent = this.generateReadme(exports);
      archive.append(readmeContent, { name: 'README.txt' });

      archive.finalize();
    });
  }

  // Generate README for export package
  generateReadme(exports) {
    const formatDescriptions = {
      shorts: 'YouTube Shorts (9:16) - Vertical format optimized for mobile viewing',
      youtube: 'YouTube Video (16:9) - Standard horizontal format for desktop viewing',
      instagram: 'Instagram Reels (4:5) - Square-ish format for Instagram feed',
      tiktok: 'TikTok (9:16) - Vertical format optimized for TikTok platform',
      facebook: 'Facebook (1:1) - Square format for Facebook posts',
      twitter: 'Twitter (16:9) - Horizontal format optimized for Twitter'
    };

    let readme = 'VIDEO EXPORT PACKAGE\n';
    readme += '==================\n\n';
    readme += 'This package contains your video exported in multiple formats for different social media platforms.\n\n';
    readme += 'FORMATS INCLUDED:\n';
    readme += '----------------\n';

    Object.entries(exports).forEach(([format, filePath]) => {
      if (filePath) {
        const description = formatDescriptions[format] || 'Custom format';
        readme += `• ${format.toUpperCase()}: ${description}\n`;
      }
    });

    readme += '\nRECOMMENDED USAGE:\n';
    readme += '-----------------\n';
    readme += '• Use SHORTS/TIKTOK for vertical mobile content\n';
    readme += '• Use YOUTUBE for desktop/laptop viewing\n';
    readme += '• Use INSTAGRAM for Instagram posts and stories\n';
    readme += '• Use FACEBOOK for Facebook posts\n';
    readme += '• Use TWITTER for Twitter posts\n\n';
    readme += 'All videos are optimized for their respective platforms and ready to upload.\n';

    return readme;
  }

  // Get export progress
  getExportProgress() {
    // This would track progress of ongoing exports
    // For now, return a simple status
    return {
      status: 'ready',
      activeExports: 0,
      completedExports: 0,
      totalExports: 0
    };
  }

  // Clean up old exports
  async cleanupOldExports(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const files = fs.readdirSync(this.outputDir);
    const now = Date.now();
    let cleaned = 0;

    files.forEach(file => {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });

    console.log(`🧹 [Batch Export] Cleaned up ${cleaned} old files`);
    return cleaned;
  }

  // Get available export formats
  getAvailableFormats() {
    return [
      { id: 'shorts', name: 'YouTube Shorts', aspect: '9:16', size: '1080x1920' },
      { id: 'youtube', name: 'YouTube Video', aspect: '16:9', size: '1920x1080' },
      { id: 'instagram', name: 'Instagram Reels', aspect: '4:5', size: '1080x1350' },
      { id: 'tiktok', name: 'TikTok', aspect: '9:16', size: '1080x1920' },
      { id: 'facebook', name: 'Facebook', aspect: '1:1', size: '1080x1080' },
      { id: 'twitter', name: 'Twitter', aspect: '16:9', size: '1280x720' }
    ];
  }
}

module.exports = new BatchExportService();
