const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class VideoService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'output');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async assembleVideo({ audioPath, videoClips, script, videoIndex }) {
    let montageVideoPath;
    try {
      // Create a safe filename without special characters
      const safeIndex = videoIndex || 1;
      const timestamp = Date.now();
      
      // Ensure output directory exists and is writable
      this.ensureOutputDir();
      
      // Create a simple filename without special characters
      const outputFile = `shorts_${safeIndex}_${timestamp}.mp4`;
      const outputPath = path.normalize(path.join(this.outputDir, outputFile));
      
      // Verify the directory is writable
      try {
        const testFile = path.join(this.outputDir, `.test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (err) {
        throw new Error(`Cannot write to output directory (${this.outputDir}): ${err.message}`);
      }
      
      console.log(`\n🎬 Starting video assembly (${outputPath})`);
      
      // Create a video montage from clips
      console.log('🔄 Creating video montage...');
      montageVideoPath = await this.createVideoMontage(videoClips, safeIndex);
      
      if (!fs.existsSync(montageVideoPath)) {
        throw new Error(`Montage video not created at: ${montageVideoPath}`);
      }
      
      // Add audio and subtitles
      console.log('🔊 Adding audio and subtitles...');
      const finalVideoPath = await this.addAudioAndSubtitles(
        montageVideoPath,
        audioPath,
        script,
        outputPath
      );
      
      // Clean up temporary files
      try {
        if (fs.existsSync(montageVideoPath) && montageVideoPath !== finalVideoPath) {
          fs.unlinkSync(montageVideoPath);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temporary file:', cleanupError.message);
      }
      
      if (!fs.existsSync(finalVideoPath)) {
        throw new Error(`Final video not created at: ${finalVideoPath}`);
      }
      
      console.log(`✅ Video assembly complete: ${path.basename(finalVideoPath)}`);
      return finalVideoPath;
      
    } catch (error) {
      console.error('❌ Video assembly failed:', error);
      throw new Error(`Failed to assemble video: ${error.message}`);
    }
  }

  async createVideoMontage(videoClips, videoIndex) {
    return new Promise((resolve, reject) => {
      try {
        const montageOutput = path.join(this.outputDir, `montage_${videoIndex}_${Date.now()}.mp4`);
        
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
          fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // Filter out any invalid video files
        const validClips = videoClips.filter(clip => {
          if (!fs.existsSync(clip.path)) {
            console.warn(`⚠️  Video file not found: ${clip.path}`);
            return false;
          }
          return true;
        });
        
        if (validClips.length === 0) {
          console.warn('No valid video clips found. Creating a color background instead.');
          return this.createColorBackground(montageOutput, resolve, reject);
        }
        
        console.log(`🔄 Processing ${validClips.length} video clips...`);
        
        // Create FFmpeg command
        const command = ffmpeg();
        
        // Add all video clips as inputs
        validClips.forEach((clip, index) => {
          command.input(clip.path);
        });
        
        // Create filter complex for processing
        const filterComplex = [];
        const filterInputs = [];
        
        // Process each video clip
        validClips.forEach((_, index) => {
          // Scale and crop to 1080x1920
          filterComplex.push({
            filter: 'scale',
            options: { w: 1080, h: 1920, force_original_aspect_ratio: 'increase' },
            inputs: `${index}:v`,
            outputs: `scaled${index}`
          });
          
          filterComplex.push({
            filter: 'crop',
            options: { w: 1080, h: 1920, x: '(in_w-ow)/2', y: '(in_h-oh)/2' },
            inputs: `scaled${index}`,
            outputs: `cropped${index}`
          });
          
          filterComplex.push({
            filter: 'setpts',
            options: 'PTS-STARTPTS',
            inputs: `cropped${index}`,
            outputs: `v${index}`
          });
          
          filterInputs.push(`[v${index}]`);
        });
        
        // Add concat filter
        filterComplex.push({
          filter: 'concat',
          options: { n: validClips.length, v: 1, a: 0 },
          inputs: filterInputs,
          outputs: ['outv']
        });
        
        // Set up the command
        command
          .complexFilter(filterComplex, 'outv')
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-t', '30',
            '-y'
          ])
          .output(montageOutput)
          .on('start', (commandLine) => {
            console.log('Running FFmpeg montage command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Montage progress: ${Math.floor(progress.percent || 0)}%`);
          })
          .on('end', () => {
            if (fs.existsSync(montageOutput)) {
              console.log(`✅ Video montage created: ${path.basename(montageOutput)}`);
              resolve(montageOutput);
            } else {
              throw new Error('Montage file was not created');
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('❌ FFmpeg montage error:', err.message);
            console.error('FFmpeg stderr:', stderr);
            console.log('Falling back to color background...');
            this.createColorBackground(montageOutput, resolve, reject);
          })
          .run();
          
      } catch (error) {
        console.error('Error in createVideoMontage:', error);
        reject(error);
      }
    });
  }

  createColorBackground(outputPath, resolve, reject) {
    const duration = 30; // 30 seconds
    const command = ffmpeg()
      .input('color=color=black:s=1080x1920')
      .inputOptions([
        '-f lavfi',
        `-t ${duration}`
      ])
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-pix_fmt yuv420p',
        '-y' // Overwrite output file if it exists
      ])
      .output(outputPath);
      
    console.log(`🎨 Creating color background video: ${path.basename(outputPath)}`);
    
    command
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${Math.round(progress.percent)}% done`);
      })
      .on('end', () => {
        console.log(`✅ Color background created: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message);
        reject(new Error(`Failed to create color background: ${err.message}`));
      })
      .run();
  }

  async addAudioAndSubtitles(videoPath, audioPath, script, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Normalize all paths
        const normalizedVideoPath = path.normalize(videoPath);
        const normalizedAudioPath = audioPath ? path.normalize(audioPath) : null;
        const normalizedOutputPath = path.normalize(outputPath);
        
        console.log(`🔧 FFmpeg paths:\n  Video: ${normalizedVideoPath}\n  Audio: ${normalizedAudioPath || 'none'}\n  Output: ${normalizedOutputPath}`);
        
        // Ensure output directory exists
        const outputDir = path.dirname(normalizedOutputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create FFmpeg command
        const command = ffmpeg()
          .input(normalizedVideoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            '-shortest',
            '-y', // Overwrite output file if it exists
            '-preset fast',
            '-crf 23',
            '-r 30',
            '-t 30' // Limit to 30 seconds for Shorts
          ]);

        // Add audio if available
        if (normalizedAudioPath && fs.existsSync(normalizedAudioPath)) {
          command.input(normalizedAudioPath);
          
          // Set up complex filter for audio mixing
          command.complexFilter([
            // Scale and pad the video
            {
              filter: 'scale',
              options: { w: 1080, h: 1920, force_original_aspect_ratio: 'decrease' },
              inputs: '0:v',
              outputs: 'scaled'
            },
            {
              filter: 'pad',
              options: { w: 1080, h: 1920, x: '(ow-iw)/2', y: '(oh-ih)/2' },
              inputs: 'scaled',
              outputs: 'padded'
            },
            // Process audio
            {
              filter: 'volume',
              options: '1.0',
              inputs: '1:a',
              outputs: 'audio_out'
            }
          ]);
          
          // Map the outputs
          command.outputOptions([
            '-map', '[padded]',
            '-map', '[audio_out]',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-shortest',
            '-y',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-preset', 'fast',
            '-crf', '23',
            '-r', '30',
            '-t', '30'
          ]);
        } else {
          // No audio available, just process video
          command.complexFilter([
            {
              filter: 'scale',
              options: { w: 1080, h: 1920, force_original_aspect_ratio: 'decrease' },
              inputs: '0:v',
              outputs: 'scaled'
            },
            {
              filter: 'pad',
              options: { w: 1080, h: 1920, x: '(ow-iw)/2', y: '(oh-ih)/2' },
              inputs: 'scaled',
              outputs: 'padded'
            }
          ]);
          
          command.outputOptions([
            '-map', '[padded]',
            '-c:v', 'libx264',
            '-y',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-preset', 'fast',
            '-crf', '23',
            '-r', '30',
            '-t', '30'
          ]);
        }

        // Add subtitles if script is provided
        if (script && script.script) {
          // Simple subtitles at the bottom of the video
          command.videoFilters({
            filter: 'drawtext',
            options: {
              text: script.script.substring(0, 100) + (script.script.length > 100 ? '...' : ''),
              fontfile: 'Arial',
              fontsize: 48,
              fontcolor: 'white',
              x: '(w-text_w)/2',
              y: 'h-th-40', // 40px from bottom
              shadowcolor: 'black',
              shadowx: 2,
              shadowy: 2
            }
          });
        }

        // Set output path and run the command
        command.output(normalizedOutputPath)
          .on('start', (commandLine) => {
            console.log('Running FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${Math.floor(progress.percent || 0)}% done`);
          })
          .on('end', () => {
            console.log(`✅ Video processing complete: ${normalizedOutputPath}`);
            resolve(normalizedOutputPath);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('❌ FFmpeg error:', err.message);
            console.error('FFmpeg stderr:', stderr);
            reject(new Error(`FFmpeg error: ${err.message}\n${stderr}`));
          })
          .run();
      } catch (error) {
        console.error('Error in addAudioAndSubtitles:', error);
        reject(error);
      }
    });
  }

  createSubtitleFilter(script) {
    if (!script || script.length === 0) return null;

    // Split script into sentences for better subtitle timing
    const sentences = script.match(/[^\.!?]+[\.!?]+/g) || [script];
    const duration = 30; // Total video duration
    const timePerSentence = duration / sentences.length;
    
    let subtitleFilter = '';
    
    sentences.forEach((sentence, index) => {
      const startTime = index * timePerSentence;
      const endTime = (index + 1) * timePerSentence;
      
      // Clean up sentence text for FFmpeg
      const cleanText = sentence.trim()
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/:/g, '\\:')
        .substring(0, 50); // Limit length for readability

      if (index === 0) {
        subtitleFilter = `drawtext=text='${cleanText}':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-150:enable='between(t,${startTime},${endTime})'`;
      } else {
        subtitleFilter += `,drawtext=text='${cleanText}':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-150:enable='between(t,${startTime},${endTime})'`;
      }
    });

    return subtitleFilter;
  }

  async testFFmpeg() {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, formatsAvailable: Object.keys(formats).length });
        }
      });
    });
  }

  // Clean up temporary files
  cleanup(filePaths) {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Cleaned up: ${path.basename(filePath)}`);
        } catch (error) {
          console.error(`Failed to cleanup ${filePath}:`, error.message);
        }
      }
    });
  }
}

module.exports = new VideoService();