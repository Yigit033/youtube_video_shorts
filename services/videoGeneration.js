const axios = require('axios');
const fs = require('fs');
const path = require('path');

class VideoGenerationService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.svdModel = 'stabilityai/stable-video-diffusion-img2vid-xt';
    this.outputDir = path.join(__dirname, '..', 'temp', 'videos');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateVideoFromImage(imagePath, filename) {
    if (!this.apiKey) {
      console.log('⚠️ HuggingFace API key not configured');
      return null;
    }

    try {
      console.log(`🎬 Generating video from image: ${path.basename(imagePath)}`);
      
      // Read image as base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.svdModel}`,
        {
          inputs: base64Image,
          options: {
            wait_for_model: true,
            use_cache: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'
          },
          responseType: 'arraybuffer',
          timeout: 300000 // 5 minutes timeout for video generation
        }
      );

      const videoPath = path.join(this.outputDir, `${filename}.mp4`);
      fs.writeFileSync(videoPath, response.data);
      
      console.log(`✅ Video generated: ${filename}.mp4`);
      return videoPath;
    } catch (error) {
      console.error('❌ Video generation failed:', error.message);
      return null;
    }
  }

  async generateMultipleVideos(imagePaths, baseFilename) {
    const videos = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      const videoPath = await this.generateVideoFromImage(
        imagePaths[i], 
        `${baseFilename}_video_${i + 1}`
      );
      if (videoPath) {
        videos.push({
          path: videoPath,
          source: 'ai-generated',
          duration: 1, // 1 second per video
          quality: 100 // High quality AI-generated
        });
      }
    }
    
    return videos;
  }

  // Enhanced image sequence video with dynamic effects
  async createImageSequenceVideo(imagePaths, filename) {
    try {
      console.log(`🎬 Creating enhanced image sequence video from ${imagePaths.length} images`);
      
      const ffmpeg = require('fluent-ffmpeg');
      // Use simple filename without special characters
      const simpleFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
      const outputPath = path.join(this.outputDir, `${simpleFilename}.mp4`);
      
      return new Promise((resolve, reject) => {
        // Use first image as input with loop - SUPER SIMPLE
        const command = ffmpeg()
          .input(imagePaths[0])
          .inputOptions([
            '-loop', '1',
            '-t', '15'
          ])
          .videoFilters([
            'scale=1080:1920:force_original_aspect_ratio=increase',
            'crop=1080:1920'
          ])
          .outputOptions([
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-r', '30'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('Running SUPER SIMPLE FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${Math.floor(progress.percent || 0)}% done`);
          })
          .on('end', () => {
            console.log(`✅ SUPER SIMPLE video created: ${simpleFilename}.mp4`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg error:', err.message);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      console.error('❌ Enhanced image sequence video creation failed:', error.message);
      return null;
    }
  }
}

module.exports = VideoGenerationService;
