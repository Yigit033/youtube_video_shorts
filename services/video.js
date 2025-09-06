const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class VideoService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'output');
    this.subsDir = path.join(__dirname, '..', 'temp', 'subtitles');
    this.ensureOutputDir();
    if (!fs.existsSync(this.subsDir)) fs.mkdirSync(this.subsDir, { recursive: true });
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
        
        // Filter out any invalid video files and sort by quality
        const validClips = videoClips
          .filter(clip => {
            if (!fs.existsSync(clip.path)) {
              console.warn(`⚠️  Video file not found: ${clip.path}`);
              return false;
            }
            return true;
          })
          .sort((a, b) => (b.quality || 0) - (a.quality || 0)); // Sort by quality
        
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
        
        // Process each video clip with advanced effects and fixed durations
        const perClipDuration = 6; // seconds
        validClips.forEach((_, index) => {
          // Scale and crop to 1080x1920 with quality enhancement
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
          
          // Add color enhancement and stabilization
          filterComplex.push({
            filter: 'eq',
            options: { brightness: 0.05, contrast: 1.1, saturation: 1.2 },
            inputs: `cropped${index}`,
            outputs: `enhanced${index}`
          });
          
          // Add subtle zoom effect (Ken Burns)
          filterComplex.push({
            filter: 'zoompan',
            options: { 
              z: 'min(zoom+0.0015,1.5)', 
              d: 300,
              x: 'iw/2-(iw/zoom/2)',
              y: 'ih/2-(ih/zoom/2)'
            },
            inputs: `enhanced${index}`,
            outputs: `zoomed${index}`
          });
          
          // Force duration per clip
          filterComplex.push({
            filter: 'tpad',
            options: { stop_duration: perClipDuration },
            inputs: `zoomed${index}`,
            outputs: `dur${index}`
          });

          filterComplex.push({
            filter: 'setpts',
            options: 'PTS-STARTPTS',
            inputs: `dur${index}`,
            outputs: `v${index}`
          });
          
          filterInputs.push(`[v${index}]`);
        });
        // Crossfade between consecutive clips
        // Apply xfade (0.5s) chain: v0, v1 -> xf0, then xf0 with v2 -> xf1, ...
        let lastLabel = `v0`;
        for (let idx = 1; idx < validClips.length; idx++) {
          const outLabel = idx === validClips.length - 1 ? 'outv' : `xf${idx}`;
          filterComplex.push({
            filter: 'xfade',
            options: { transition: 'fade', duration: 0.5, offset: idx * perClipDuration - 0.5 },
            inputs: [lastLabel, `v${idx}`],
            outputs: outLabel
          });
          lastLabel = outLabel;
        }
        if (validClips.length === 1) {
          // If only one clip, map directly
          filterComplex.push({ filter: 'null', inputs: 'v0', outputs: 'outv' });
        }
        
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
            '-t', String(Math.min(60, validClips.length * perClipDuration)),
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
    const duration = 60; // 60 seconds
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

  // Generate subtitles with whisper.cpp if configured
  async generateSubtitlesFromAudio(audioPath, baseName) {
    try {
      const whisperService = require('./whisperService');
      return await whisperService.transcribeAudio(audioPath, baseName);
    } catch (e) {
      console.warn('⚠️ Subtitle generation failed:', e.message);
      return null;
    }
  }

  async addAudioAndSubtitles(videoPath, audioPath, script, outputPath) {
    return new Promise(async (resolve, reject) => {
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

        // Optional subtitles via whisper.cpp
        let srtPath = null;
        if (normalizedAudioPath) {
          const baseName = path.basename(normalizedOutputPath, path.extname(normalizedOutputPath));
          srtPath = await this.generateSubtitlesFromAudio(normalizedAudioPath, baseName);
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
            '-y',
            '-preset fast',
            '-crf 23',
            '-r 30',
            '-t 60'
          ]);

        // Build filters
        const vfChain = [];
        // Scale and pad video first
        vfChain.push('scale=w=1080:h=1920:force_original_aspect_ratio=decrease');
        vfChain.push('pad=w=1080:h=1920:x=(ow-iw)/2:y=(oh-ih)/2');
        // Burn subtitles if available
        if (srtPath && fs.existsSync(srtPath)) {
          // escape backslashes for Windows paths and use TikTok-style subtitles
          const escapedSrt = srtPath.replace(/\\/g, '\\\\');
          vfChain.push(`subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=48,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=100'`);
        } else if (script && script.script) {
          // fallback: simple one-line drawtext preview
          const text = (script.script || '').replace(/\n/g, ' ').slice(0, 100).replace(/'/g, "\\'");
          vfChain.push(`drawtext=text='${text}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.7:boxborderw=8:x=(w-text_w)/2:y=h-150`);
        }

        // Apply video filters
        command.videoFilters(vfChain);

        // Add audio if available and mix volume (narration + bg already mixed upstream)
        if (normalizedAudioPath && fs.existsSync(normalizedAudioPath)) {
          command.input(normalizedAudioPath);
          command.outputOptions(['-map 0:v:0', '-map 1:a:0']);
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
    const duration = 60; // Total video duration
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