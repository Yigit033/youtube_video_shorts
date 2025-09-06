const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

class EnhancedVideoGenerationService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'videos');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Create high-quality video from images using FFmpeg
  async createEnhancedVideo(imagePaths, filename) {
    try {
      console.log(`🎬 [ENHANCED] Creating high-quality video from ${imagePaths.length} images`);
      
      const outputPath = path.join(this.outputDir, `${filename}.mp4`);
      
      // Create video with advanced FFmpeg effects
      return new Promise((resolve, reject) => {
        const command = ffmpeg();
        
        // Add all images as inputs
        imagePaths.forEach(imagePath => {
          command.input(imagePath);
        });
        
        // Advanced video filters for high quality
        const filterComplex = this.createAdvancedFilters(imagePaths.length);
        
        command
          .complexFilter(filterComplex)
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'slow',        // Higher quality
            '-crf', '18',            // Lower CRF = higher quality
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-movflags', '+faststart'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 [ENHANCED] Running advanced FFmpeg command...');
          })
          .on('progress', (progress) => {
            console.log(`📊 [ENHANCED] Progress: ${Math.floor(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log(`✅ [ENHANCED] High-quality video created: ${filename}.mp4`);
            resolve(outputPath);
          })
          .on('error', (error) => {
            console.error(`❌ [ENHANCED] FFmpeg error: ${error.message}`);
            reject(error);
          });
        
        command.run();
      });
      
    } catch (error) {
      console.error('❌ [ENHANCED] Video generation failed:', error.message);
      return null;
    }
  }

  // Create simple but effective FFmpeg filters
  createAdvancedFilters(imageCount) {
    const filters = [];
    
    for (let i = 0; i < imageCount; i++) {
      // Simple scale and crop
      filters.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[scaled${i}]`);
      
      // Simple zoom effect
      filters.push(`[scaled${i}]zoompan=z=1.1:d=90:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)[zoomed${i}]`);
      
      // Set duration
      filters.push(`[zoomed${i}]setpts=PTS-STARTPTS[v${i}]`);
    }
    
    // Concatenate all videos
    const concatInputs = Array.from({length: imageCount}, (_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${imageCount}:v=1:a=0[outv]`);
    
    return filters.join(';');
  }

  // Generate multiple enhanced videos with transitions
  async generateMultipleVideos(imagePaths, baseFilename) {
    const videos = [];
    
    // Prefer robust slideshow approach that guarantees multiple images
    const slideshowPath = await this.createSlideshow(
      imagePaths,
      `${baseFilename}_slideshow`
    );

    if (slideshowPath) {
      videos.push({
        path: slideshowPath,
        source: 'slideshow-ffmpeg',
        duration: 60, // Fixed 60 seconds for YouTube Shorts
        quality: 92
      });
      return videos;
    }

    // Fallback: try simple dynamic (may fail on some ffmpeg builds)
    try {
      const dynamicVideoPath = await this.createDynamicVideo(
        imagePaths.slice(0, 5), // limit to 5 to keep things fast
        `${baseFilename}_dynamic`
      );
      
      if (dynamicVideoPath) {
        videos.push({
          path: dynamicVideoPath,
          source: 'dynamic-ffmpeg',
          duration: Math.min(imagePaths.length, 5) * 2.5,
          quality: 90
        });
        return videos;
      }
    } catch (e) {}

    // Last resort: per-image simple clips
    for (let i = 0; i < Math.min(imagePaths.length, 4); i++) {
      const videoPath = await this.createSimpleAnimation(
        imagePaths[i], 
        `${baseFilename}_simple_${i + 1}`
      );
      if (videoPath) {
        videos.push({ path: videoPath, source: 'simple-ffmpeg', duration: 3, quality: 85 });
      }
    }

    return videos;
  }

  // Create dynamic video with multiple images and transitions
  async createDynamicVideo(imagePaths, filename) {
    try {
      console.log(`🎬 [DYNAMIC] Creating dynamic video with ${imagePaths.length} images`);
      
      const outputPath = path.join(this.outputDir, `${filename}.mp4`);
      
      return new Promise((resolve, reject) => {
        const command = ffmpeg();
        
        // Add all images as inputs
        imagePaths.forEach(imagePath => {
          command.input(imagePath);
        });
        
        // ULTRA SIMPLE filter - NO COMPLEX FILTERS
        command
          .videoFilters([
            'scale=1080:1920',
            'format=yuv420p'
          ])
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-t', '10' // 10 seconds total
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 [DYNAMIC] Creating simple dynamic video...');
          })
          .on('progress', (progress) => {
            console.log(`📊 [DYNAMIC] Progress: ${Math.floor(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log(`✅ [DYNAMIC] Dynamic video created: ${filename}.mp4`);
            resolve(outputPath);
          })
          .on('error', (error) => {
            console.error(`❌ [DYNAMIC] Error: ${error.message}`);
            reject(error);
          });
        
        command.run();
      });
      
    } catch (error) {
      console.error('❌ [DYNAMIC] Dynamic video failed:', error.message);
      return null;
    }
  }

  // Create ULTRA SIMPLE filters that work
  createDynamicFilters(imageCount) {
    const filters = [];
    
    for (let i = 0; i < imageCount; i++) {
      // ULTRA SIMPLE: Just scale to same size
      filters.push(`[${i}:v]scale=1080:1920[v${i}]`);
    }
    
    // ULTRA SIMPLE: Just concatenate
    const concatInputs = Array.from({length: imageCount}, (_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${imageCount}:v=1:a=0[outv]`);
    
    return filters.join(';');
  }

  // Create a robust slideshow: N images -> N short clips -> xfade chain
  async createSlideshow(imagePaths, filename) {
    const tmpDir = path.join(this.outputDir, 'slideshow');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const segmentDuration = 10; // seconds per image (longer for better viewing)
    const transitionDuration = 1.0; // seconds crossfade
    const clipPaths = [];

    // 1) Build per-image segments with identical params
    for (let index = 0; index < imagePaths.length; index++) {
      const imagePath = imagePaths[index];
      const clipPath = path.join(tmpDir, `${filename}_part_${index + 1}.mp4`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(imagePath)
          .inputOptions(['-loop', '1', '-t', String(segmentDuration)])
          .videoFilters([
            'scale=1080:1920:force_original_aspect_ratio=increase',
            'crop=1080:1920',
            // subtle motion
            `zoompan=z='min(zoom+0.0015,1.08)':d=${Math.floor(segmentDuration * 30)}:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)`
          ])
          .outputOptions([
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p'
          ])
          .output(clipPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
      clipPaths.push(clipPath);
    }

    if (clipPaths.length === 0) return null;
    if (clipPaths.length === 1) return clipPaths[0];

    // 2) Build xfade chain with filter_complex
    const outputPath = path.join(this.outputDir, `${filename}.mp4`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all clips
      clipPaths.forEach(p => command.input(p));

      // Build filter graph: scale/pad safety + xfade chain
      const inputs = clipPaths.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS[v${i}]`).join(';');

      const transitions = [];
      // xfade chain: out0 = xfade(v0,v1), out1 = xfade(out0,v2), ...
      transitions.push(inputs);
      let lastLabel = `[v0]`;
      let transIndex = 0;
      for (let i = 1; i < clipPaths.length; i++) {
        const inA = i === 1 ? '[v0]' : `[xf${transIndex - 1}]`;
        const inB = `[v${i}]`;
        const out = `[xf${transIndex}]`;
        // offset at (segmentDuration - transitionDuration)
        const offset = Math.max(0, segmentDuration - transitionDuration);
        transitions.push(`${inA}${inB}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${out}`);
        lastLabel = out;
        transIndex += 1;
      }

      const filter = transitions.join(';');

      command
        .complexFilter(filter)
        .outputOptions([
          '-map', lastLabel,
          '-r', '30',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '22',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('start', () => {
          console.log('🎬 [SLIDESHOW] Building xfade slideshow...');
        })
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  // Create simple animated video (fallback)
  async createSimpleAnimation(imagePath, filename) {
    try {
      console.log(`🎬 [SIMPLE] Creating simple animation from: ${path.basename(imagePath)}`);
      
      const outputPath = path.join(this.outputDir, `${filename}.mp4`);
      
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(imagePath)
          .inputOptions(['-loop', '1', '-t', '5'])
          .videoFilters([
            'scale=1080:1920:force_original_aspect_ratio=increase',
            'crop=1080:1920',
            'zoompan=z=1.1:d=150:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)'
          ])
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-r', '30'
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ [SIMPLE] Animation created: ${filename}.mp4`);
            resolve(outputPath);
          })
          .on('error', (error) => {
            console.error(`❌ [SIMPLE] Error: ${error.message}`);
            reject(error);
          })
          .run();
      });
      
    } catch (error) {
      console.error('❌ [SIMPLE] Animation failed:', error.message);
      return null;
    }
  }
}

module.exports = EnhancedVideoGenerationService;
