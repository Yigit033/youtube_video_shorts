const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Video Watermark Service
 * Adds YouTube CTA watermark to videos for Instagram cross-posting
 */
class VideoWatermarkService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'watermarked');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Add YouTube CTA watermark to video
   * @param {Object} params - { videoPath, youtubeChannelUrl, channelName, position }
   * @returns {Promise<string>} Path to watermarked video
   */
  async addWatermark(params) {
    const { videoPath, youtubeChannelUrl, channelName, position = 'bottom-right' } = params;
    
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const outputPath = path.join(
      this.outputDir,
      `watermarked_${Date.now()}_${path.basename(videoPath)}`
    );

    return new Promise((resolve, reject) => {
      try {
        // Get video dimensions
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            reject(new Error(`Failed to probe video: ${err.message}`));
            return;
          }

          const width = metadata.streams[0].width;
          const height = metadata.streams[0].height;
          
          // Calculate watermark position
          const positionConfig = this.calculatePosition(position, width, height);
          
          // Build watermark text
          const watermarkText = this.buildWatermarkText(channelName, youtubeChannelUrl);
          
          // Create FFmpeg command
          const command = ffmpeg(videoPath)
            .videoCodec('libx264')
            .audioCodec('copy')
            .outputOptions([
              '-pix_fmt yuv420p',
              '-preset fast',
              '-crf 23'
            ]);

          // Add text overlay (watermark)
          command.complexFilter([
            {
              filter: 'drawtext',
              options: {
                text: watermarkText,
                fontfile: this.findFontFile(),
                fontsize: this.calculateFontSize(width, height),
                fontcolor: 'white',
                x: positionConfig.x,
                y: positionConfig.y,
                box: 1,
                boxcolor: 'black@0.7',
                boxborderw: 3,
                shadowx: 2,
                shadowy: 2
              }
            }
          ]);

          command
            .on('start', (cmdLine) => {
              console.log(`🎨 [Watermark] Adding watermark: ${cmdLine}`);
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`🎨 [Watermark] Progress: ${Math.round(progress.percent)}%`);
              }
            })
            .on('end', () => {
              console.log(`✅ [Watermark] Watermark added successfully: ${path.basename(outputPath)}`);
              resolve(outputPath);
            })
            .on('error', (err) => {
              console.error('❌ [Watermark] Failed to add watermark:', err.message);
              reject(err);
            })
            .save(outputPath);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Calculate watermark position based on video dimensions
   */
  calculatePosition(position, width, height) {
    const margin = 20; // Margin from edges
    
    switch (position) {
      case 'bottom-right':
        return {
          x: `w-text_w-${margin}`,
          y: `h-text_h-${margin}`
        };
      case 'bottom-left':
        return {
          x: margin.toString(),
          y: `h-text_h-${margin}`
        };
      case 'top-right':
        return {
          x: `w-text_w-${margin}`,
          y: margin.toString()
        };
      case 'top-left':
        return {
          x: margin.toString(),
          y: margin.toString()
        };
      default:
        return {
          x: `w-text_w-${margin}`,
          y: `h-text_h-${margin}`
        };
    }
  }

  /**
   * Build watermark text
   */
  buildWatermarkText(channelName, youtubeChannelUrl) {
    // Short, catchy watermark text
    if (channelName) {
      return `📺 Full video: ${channelName}`;
    }
    
    if (youtubeChannelUrl) {
      // Extract channel name from URL if possible
      const channelMatch = youtubeChannelUrl.match(/youtube\.com\/(?:c|channel|user)\/([^\/]+)/);
      if (channelMatch) {
        return `📺 Full video: ${channelMatch[1]}`;
      }
      return '📺 Full video on YouTube';
    }
    
    return '📺 Full video on YouTube';
  }

  /**
   * Calculate font size based on video dimensions
   */
  calculateFontSize(width, height) {
    // Use smaller dimension as base
    const baseSize = Math.min(width, height);
    
    // Font size should be ~3-4% of video height for readability
    const fontSize = Math.round(baseSize * 0.035);
    
    // Clamp between 24 and 48
    return Math.max(24, Math.min(48, fontSize));
  }

  /**
   * Find system font file (Arial or similar)
   */
  findFontFile() {
    const os = require('os');
    const platform = os.platform();
    
    if (platform === 'win32') {
      const fontPaths = [
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/ARIAL.TTF',
        'C:/Windows/Fonts/arialbd.ttf'
      ];
      
      for (const fontPath of fontPaths) {
        if (fs.existsSync(fontPath)) {
          return fontPath;
        }
      }
    } else if (platform === 'darwin') {
      const fontPaths = [
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/Helvetica.ttc'
      ];
      
      for (const fontPath of fontPaths) {
        if (fs.existsSync(fontPath)) {
          return fontPath;
        }
      }
    } else {
      // Linux
      const fontPaths = [
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
      ];
      
      for (const fontPath of fontPaths) {
        if (fs.existsSync(fontPath)) {
          return fontPath;
        }
      }
    }
    
    // Return empty string if no font found (FFmpeg will use default)
    return '';
  }

  /**
   * Add simple text overlay (alternative method - faster)
   * Uses drawtext filter directly
   */
  async addSimpleWatermark(videoPath, text, position = 'bottom-right') {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    // Ensure output directory exists
    this.ensureOutputDir();

    // Shorten filename to avoid Windows path length issues
    const originalName = path.basename(videoPath, path.extname(videoPath));
    const shortName = originalName.length > 20 ? originalName.substring(0, 20) : originalName;
    const ext = path.extname(videoPath);
    
    // Create output path with normalized absolute path
    const outputFileName = `wm_${Date.now()}_${shortName}${ext}`;
    const outputPath = path.normalize(path.resolve(this.outputDir, outputFileName));
    
    // CRITICAL: Check Windows path length limit (260 characters)
    if (outputPath.length > 250) {
      // Use even shorter filename if path is too long
      const veryShortName = originalName.length > 10 ? originalName.substring(0, 10) : originalName;
      const shortOutputFileName = `wm_${Date.now()}_${veryShortName}${ext}`;
      const shortOutputPath = path.normalize(path.resolve(this.outputDir, shortOutputFileName));
      console.log(`⚠️ [Watermark] Path too long (${outputPath.length} chars), using shorter path: ${shortOutputPath.length} chars`);
      return this.addSimpleWatermarkWithPath(videoPath, text, position, shortOutputPath);
    }

    return this.addSimpleWatermarkWithPath(videoPath, text, position, outputPath);
  }

  /**
   * Internal method to add watermark with specific output path
   */
  async addSimpleWatermarkWithPath(videoPath, text, position, outputPath) {
    // Ensure output directory exists
    this.ensureOutputDir();
    
    // Use absolute paths for FFmpeg
    const absoluteVideoPath = path.resolve(videoPath);
    const absoluteOutputPath = path.resolve(outputPath);

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absoluteVideoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const width = metadata.streams[0].width;
        const height = metadata.streams[0].height;
        const fontSize = this.calculateFontSize(width, height);
        const positionConfig = this.calculatePosition(position, width, height);
        
        const fontFile = this.findFontFile();
        let fontParam = '';
        if (fontFile) {
          const normalizedFontPath = path.resolve(fontFile).replace(/\\/g, '/').replace(/:/g, '\\\\:');
          fontParam = `:fontfile=${normalizedFontPath}`;
        }

        // Escape text for FFmpeg drawtext filter
        const escapedText = text.replace(/'/g, "\\'").replace(/:/g, "\\:");

        ffmpeg(absoluteVideoPath)
          .videoCodec('libx264')
          .audioCodec('copy')
          .videoFilters([
            `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:x=${positionConfig.x}:y=${positionConfig.y}:box=1:boxcolor=black@0.7:boxborderw=3:shadowx=2:shadowy=2${fontParam}`
          ])
          .outputOptions([
            '-pix_fmt yuv420p',
            '-preset fast',
            '-crf 23',
            '-y' // Overwrite output file if exists
          ])
          .on('start', (commandLine) => {
            console.log(`🎨 [Watermark] Adding simple watermark...`);
            console.log(`📁 [Watermark] Output: ${absoluteOutputPath}`);
          })
          .on('end', () => {
            if (fs.existsSync(absoluteOutputPath)) {
              console.log(`✅ [Watermark] Simple watermark added: ${path.basename(absoluteOutputPath)}`);
              resolve(absoluteOutputPath);
            } else {
              reject(new Error(`Watermarked video file was not created: ${absoluteOutputPath}`));
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('❌ [Watermark] Failed:', err.message);
            if (stderr) {
              console.error('FFmpeg stderr:', stderr);
            }
            reject(new Error(`Watermark failed: ${err.message}`));
          })
          .save(absoluteOutputPath);
      });
    });
  }

  /**
   * Clean up old watermarked videos (older than 24 hours)
   */
  cleanup() {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 [Watermark] Cleaned up ${deletedCount} old watermarked videos`);
      }
    } catch (error) {
      console.warn('⚠️ [Watermark] Cleanup failed:', error.message);
    }
  }
}

module.exports = new VideoWatermarkService();

