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
        
        // Process each video clip with CINEMATIC effects and fixed durations
        const perClipDuration = 4.5; // seconds - FASTER for viral shorts (30-45s total)
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
          
          // PROFESSIONAL color grading - more vibrant and cinematic
          filterComplex.push({
            filter: 'eq',
            options: { brightness: 0.08, contrast: 1.15, saturation: 1.3, gamma: 1.1 },
            inputs: `cropped${index}`,
            outputs: `graded${index}`
          });
          
          // Add sharpening for crisp details
          filterComplex.push({
            filter: 'unsharp',
            options: { luma_msize_x: 5, luma_msize_y: 5, luma_amount: 0.8 },
            inputs: `graded${index}`,
            outputs: `sharp${index}`
          });
          
          // Add subtle zoom effect (Ken Burns) - more dynamic
          const zoomDirection = index % 2 === 0 ? 'in' : 'out'; // Alternate zoom in/out
          filterComplex.push({
            filter: 'zoompan',
            options: { 
              z: zoomDirection === 'in' ? 'min(zoom+0.003,1.25)' : 'if(lte(zoom,1.0),1.25,max(zoom-0.003,1.0))',
              d: 225, // 4.5 seconds * 50fps
              x: 'iw/2-(iw/zoom/2)',
              y: 'ih/2-(ih/zoom/2)',
              s: '1080x1920'
            },
            inputs: `sharp${index}`,
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
        // FAST VIRAL transitions between consecutive clips
        // Quick, snappy transitions for TikTok/Shorts style
        const transitions = ['fade', 'wipeleft', 'wiperight', 'slideleft', 'slideright'];
        let lastLabel = `v0`;
        for (let idx = 1; idx < validClips.length; idx++) {
          const outLabel = idx === validClips.length - 1 ? 'outv' : `xf${idx}`;
          const transition = transitions[idx % transitions.length]; // Cycle through transitions
          filterComplex.push({
            filter: 'xfade',
            options: { transition: transition, duration: 0.4, offset: idx * perClipDuration - 0.4 },
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
            '-t', String(Math.min(45, validClips.length * perClipDuration)), // MAX 45 seconds for viral shorts
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
  async generateSubtitlesFromAudio(audioPath, baseName, scriptText = null) {
    try {
      const whisperService = require('./whisperService');
      return await whisperService.transcribeAudio(audioPath, baseName, scriptText);
    } catch (e) {
      console.warn('⚠️  Subtitle generation failed:', e.message);
      return null;
    }
  }

  async addAudioAndSubtitles(videoPath, audioPath, script, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        // Use absolute paths for FFmpeg
        const normalizedVideoPath = path.resolve(videoPath);
        const normalizedAudioPath = audioPath ? path.resolve(audioPath) : null;
        const normalizedOutputPath = path.resolve(outputPath);

        console.log(`🔧 FFmpeg paths:\n  Video: ${normalizedVideoPath}\n  Audio: ${normalizedAudioPath || 'none'}\n  Output: ${normalizedOutputPath}`);

        // Ensure output directory exists
        const outputDir = path.dirname(normalizedOutputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate subtitles from script text
        let srtPath = null;
        if (normalizedAudioPath && script) {
          const baseName = path.basename(normalizedOutputPath, path.extname(normalizedOutputPath));
          const scriptText = typeof script === 'string' ? script : script.script;
          srtPath = await this.generateSubtitlesFromAudio(normalizedAudioPath, baseName, scriptText);
        }
        
        // Fallback to script srtPath if whisper failed
        if (!srtPath && script?.srtPath) {
          srtPath = script.srtPath;
        }

        // Create FFmpeg command
        const command = ffmpeg()
          .input(normalizedVideoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            // REMOVED '-shortest' - was causing video to be cut to shortest stream (audio)
            '-y',
            '-preset fast',
            '-crf 23',
            '-r 30',
            '-t 45' // MAX 45 seconds for viral shorts
          ]);

        // Build filters
        const vfChain = [];
        // Scale and pad video first
        vfChain.push('scale=w=1080:h=1920:force_original_aspect_ratio=decrease');
        vfChain.push('pad=w=1080:h=1920:x=(ow-iw)/2:y=(oh-ih)/2');
        // Burn subtitles if available - MODERN TIKTOK/SHORTS STYLE
        if (srtPath && fs.existsSync(srtPath)) {
          // Windows path: convert to absolute path with forward slashes, escape colons
          const absoluteSrt = path.resolve(srtPath);
          const escapedSrt = absoluteSrt.replace(/\\/g, '/').replace(/:/g, '\\\\:');
          console.log(`🔤 Subtitle path: ${srtPath} -> ${escapedSrt}`);
          // VIRAL TikTok/Shorts style: BIGGER, BOLDER, MORE VISIBLE
          // White text with thick black outline, centered, very readable
          vfChain.push(`subtitles=${escapedSrt}:force_style='FontName=Arial Black,FontSize=38,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H000000,Outline=4,Shadow=3,Alignment=2,MarginV=120'`);
        } else if (script && script.script) {
          // fallback: simple one-line drawtext preview
          const text = (script.script || '').replace(/\n/g, ' ').slice(0, 100).replace(/'/g, "\\'");
          vfChain.push(`drawtext=text='${text}':fontcolor=yellow:fontsize=28:box=1:boxcolor=black@0.8:boxborderw=5:x=(w-text_w)/2:y=h-120`);
        }

        // Apply video filters
        command.videoFilters(vfChain);

        // Add audio if available
        if (normalizedAudioPath && fs.existsSync(normalizedAudioPath)) {
          console.log(`🎵 Adding audio: ${path.basename(normalizedAudioPath)}`);
          command.input(normalizedAudioPath);
          command.outputOptions(['-map', '0:v:0', '-map', '1:a:0']);
        } else {
          console.warn('⚠️  No audio file found, creating silent video');
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