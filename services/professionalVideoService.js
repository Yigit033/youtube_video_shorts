const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const advancedTTS = require('./advancedTTS');
const motionGraphics = require('./motionGraphicsService');
const intelligentMusic = require('./intelligentMusicService');
const lutColorGrading = require('./lutColorGradingService');
const batchExport = require('./batchExportService');

class ProfessionalVideoService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'professional');
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.outputDir, this.templatesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Analyze video content and generate script suggestions
  async analyzeVideoContent(videoPath, userBrief) {
    try {
      console.log('🎬 [Professional] Analyzing video content...');
      
      // Extract keyframes for analysis
      const keyframes = await this.extractKeyframes(videoPath);
      
      // Generate multiple script versions based on content type
      const scriptVersions = await this.generateScriptVersions(userBrief, keyframes);
      
      return {
        keyframes,
        scriptVersions,
        recommendations: this.generateRecommendations(keyframes, userBrief)
      };
    } catch (error) {
      console.error('❌ [Professional] Video analysis failed:', error);
      throw error;
    }
  }

  // Extract keyframes for content analysis
  async extractKeyframes(videoPath) {
    return new Promise((resolve, reject) => {
      const keyframesDir = path.join(this.outputDir, 'keyframes');
      if (!fs.existsSync(keyframesDir)) {
        fs.mkdirSync(keyframesDir, { recursive: true });
      }

      const baseName = path.basename(videoPath, path.extname(videoPath));
      
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['10%', '25%', '50%', '75%', '90%'],
          filename: `${baseName}_frame_%s.png`,
          folder: keyframesDir,
          size: '320x180'
        })
        .on('end', () => {
          const keyframeFiles = fs.readdirSync(keyframesDir)
            .filter(f => f.startsWith(baseName))
            .map(f => path.join(keyframesDir, f));
          
          resolve(keyframeFiles);
        })
        .on('error', reject);
    });
  }

  // Generate multiple script versions
  async generateScriptVersions(userBrief, keyframes) {
    const aiService = require('./ai');
    
    const versions = {
      casual: {
        name: "Casual & Fun",
        description: "Eğlenceli, samimi ton",
        prompt: `Create a casual, fun script for this video. Brief: ${userBrief}. Make it engaging and relatable.`
      },
      professional: {
        name: "Professional",
        description: "Kurumsal, resmi ton",
        prompt: `Create a professional, corporate-style script for this video. Brief: ${userBrief}. Make it authoritative and credible.`
      },
      social: {
        name: "Social Media",
        description: "Trend sosyal medya tarzı",
        prompt: `Create a trendy, social media style script for this video. Brief: ${userBrief}. Use modern language and hooks.`
      },
      educational: {
        name: "Educational",
        description: "Eğitici, açıklayıcı ton",
        prompt: `Create an educational, informative script for this video. Brief: ${userBrief}. Make it clear and instructional.`
      }
    };

    const scripts = {};
    
    for (const [key, version] of Object.entries(versions)) {
      try {
        const scriptData = await aiService.generateScript(version.prompt);
        scripts[key] = {
          ...version,
          script: scriptData.script,
          title: scriptData.title,
          hashtags: scriptData.hashtags
        };
      } catch (error) {
        console.warn(`⚠️ Failed to generate ${key} script:`, error.message);
        scripts[key] = {
          ...version,
          script: `Script generation failed for ${version.name}`,
          title: "Script Error",
          hashtags: []
        };
      }
    }

    return scripts;
  }

  // Generate content recommendations
  generateRecommendations(keyframes, userBrief) {
    return {
      videoLength: "Optimal length: 30-60 seconds for Shorts",
      musicStyle: this.suggestMusicStyle(userBrief),
      subtitleStyle: this.suggestSubtitleStyle(userBrief),
      colorGrading: this.suggestColorGrading(userBrief),
      effects: this.suggestEffects(userBrief)
    };
  }

  suggestMusicStyle(brief) {
    const lowerBrief = brief.toLowerCase();
    if (lowerBrief.includes('enerjik') || lowerBrief.includes('motivasyon')) return 'upbeat';
    if (lowerBrief.includes('sakin') || lowerBrief.includes('meditasyon')) return 'calm';
    if (lowerBrief.includes('dramatik') || lowerBrief.includes('hikaye')) return 'dramatic';
    return 'upbeat';
  }

  suggestSubtitleStyle(brief) {
    const lowerBrief = brief.toLowerCase();
    if (lowerBrief.includes('tiktok') || lowerBrief.includes('genç')) return 'tiktok';
    if (lowerBrief.includes('profesyonel') || lowerBrief.includes('kurumsal')) return 'professional';
    if (lowerBrief.includes('eğitim') || lowerBrief.includes('öğretici')) return 'educational';
    return 'modern';
  }

  suggestColorGrading(brief) {
    const lowerBrief = brief.toLowerCase();
    if (lowerBrief.includes('cinematic') || lowerBrief.includes('sinematik')) return 'cinematic';
    if (lowerBrief.includes('vibrant') || lowerBrief.includes('renkli')) return 'vibrant';
    if (lowerBrief.includes('minimal') || lowerBrief.includes('temiz')) return 'clean';
    return 'balanced';
  }

  suggestEffects(brief) {
    const lowerBrief = brief.toLowerCase();
    const effects = [];
    
    if (lowerBrief.includes('dramatik')) effects.push('slow_motion', 'fade_transitions');
    if (lowerBrief.includes('enerjik')) effects.push('fast_cuts', 'zoom_effects');
    if (lowerBrief.includes('eğitim')) effects.push('highlight_text', 'focus_effects');
    
    return effects.length > 0 ? effects : ['smooth_transitions'];
  }

  // Process video with professional effects
  async processVideo(inputPath, options) {
    try {
      console.log('🎬 [Professional] Processing video with effects...');
      console.log('📋 [Professional] Options received:', JSON.stringify(options, null, 2));
      console.log('🔍 [Professional] Checkbox values:');
      console.log('  - addSubtitles:', options.addSubtitles, 'type:', typeof options.addSubtitles);
      console.log('  - addMusic:', options.addMusic, 'type:', typeof options.addMusic);
      console.log('  - batchExport:', options.batchExport, 'type:', typeof options.batchExport);
      
      let processedPath = inputPath;
      const processingSteps = [];
      
      // 1. Apply color grading
      if (options.colorGrading && options.colorGrading !== 'auto') {
        console.log(`🎨 [Professional] Applying color grading: ${options.colorGrading}`);
        try {
          const colorGradedPath = await lutColorGrading.applyColorGrading(processedPath, options.colorGrading, {
            intensity: 1.0
          });
          if (colorGradedPath && fs.existsSync(colorGradedPath)) {
            processedPath = colorGradedPath;
            processingSteps.push('✅ Color grading applied');
            console.log('✅ Color grading successful');
          } else {
            console.warn('⚠️ Color grading failed, continuing without it');
            processingSteps.push('⚠️ Color grading failed');
          }
        } catch (error) {
          console.warn('⚠️ Color grading error:', error.message);
          processingSteps.push('⚠️ Color grading error');
        }
      } else {
        console.log('⏭️ Skipping color grading (auto or not selected)');
        processingSteps.push('⏭️ Color grading skipped');
      }
      
      // 2. Apply motion graphics and subtitles
      if (options.addSubtitles === true || options.addSubtitles === 'true' || options.addSubtitles === 1) {
        console.log('🎭 [Professional] Adding motion graphics...');
        try {
          // Skip SRT generation, go directly to simple text overlay
          console.log('🎭 [Professional] Adding simple text overlay...');
          const simpleSubtitlePath = await this.addSimpleSubtitles(processedPath, options.subtitleStyle || 'tiktok');
          if (simpleSubtitlePath && fs.existsSync(simpleSubtitlePath)) {
            processedPath = simpleSubtitlePath;
            processingSteps.push('✅ Simple subtitles applied');
            console.log('✅ Simple subtitles successful');
          } else {
            console.warn('⚠️ Simple subtitles failed, continuing without them');
            processingSteps.push('⚠️ Simple subtitles failed');
          }
        } catch (error) {
          console.warn('⚠️ Motion graphics error:', error.message);
          processingSteps.push('⚠️ Motion graphics error');
        }
      } else {
        console.log('⏭️ Skipping motion graphics (not selected)');
        processingSteps.push('⏭️ Motion graphics skipped');
      }
      
      // 3. Add intelligent music
      if (options.addMusic === true || options.addMusic === 'true' || options.addMusic === 1) {
        console.log('🎵 [Professional] Adding intelligent music...');
        console.log(`🎵 [Professional] Music selection: ${options.musicSelection || 'auto'}`);
        
        // Check if user selected "none" for music
        if (options.musicSelection === 'none') {
          console.log('⏭️ Skipping background music (user selected none)');
          processingSteps.push('⏭️ Background music skipped (user choice)');
        } else {
          try {
            const musicPath = await this.addIntelligentMusic(processedPath, options);
            if (musicPath && fs.existsSync(musicPath)) {
              const musicMixedPath = await this.mixAudioWithMusic(processedPath, musicPath);
              if (musicMixedPath && fs.existsSync(musicMixedPath)) {
                processedPath = musicMixedPath;
                processingSteps.push('✅ Background music added');
                console.log('✅ Background music successful');
              } else {
                console.warn('⚠️ Music mixing failed, continuing without it');
                processingSteps.push('⚠️ Music mixing failed');
              }
            } else {
              console.warn('⚠️ Music generation failed, continuing without it');
              processingSteps.push('⚠️ Music generation failed');
            }
          } catch (error) {
            console.warn('⚠️ Music error:', error.message);
            processingSteps.push('⚠️ Music error');
          }
        }
      } else {
        console.log('⏭️ Skipping background music (not selected)');
        processingSteps.push('⏭️ Background music skipped');
      }
      
      // 4. Apply final professional effects
      const outputPath = path.join(this.outputDir, `processed_${Date.now()}.mp4`);
      console.log(`🎬 [Professional] Final processing to: ${outputPath}`);
      
      const command = this.buildProfessionalCommand(processedPath, outputPath, options);
      
      return new Promise((resolve, reject) => {
        command
          .on('start', (cmd) => {
            console.log('🎬 [Professional] FFmpeg command:', cmd);
          })
          .on('progress', (progress) => {
            console.log(`📊 [Professional] Progress: ${Math.floor(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log('✅ [Professional] Video processing complete');
            console.log('📋 [Professional] Processing steps:', processingSteps.join(', '));
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ [Professional] Processing failed:', err);
            reject(err);
          })
          .run();
      });
      
    } catch (error) {
      console.error('❌ [Professional] Video processing error:', error);
      throw error;
    }
  }

  // Build professional FFmpeg command
  buildProfessionalCommand(inputPath, outputPath, options) {
    const command = ffmpeg(inputPath);
    
    // Video filters
    const videoFilters = [];
    
    // Scale to target resolution
    if (options.targetFormat === 'shorts') {
      videoFilters.push('scale=1080:1920:force_original_aspect_ratio=increase');
      videoFilters.push('crop=1080:1920');
    } else if (options.targetFormat === 'youtube') {
      videoFilters.push('scale=1920:1080:force_original_aspect_ratio=increase');
      videoFilters.push('crop=1920:1080');
    }
    
    // Color grading
    if (options.colorGrading) {
      videoFilters.push(this.getColorGradingFilter(options.colorGrading));
    }
    
    // Effects
    if (options.effects && options.effects.length > 0) {
      options.effects.forEach(effect => {
        const filter = this.getEffectFilter(effect);
        if (filter) videoFilters.push(filter);
      });
    }
    
    // Apply filters
    if (videoFilters.length > 0) {
      command.videoFilters(videoFilters);
    }
    
    // Output options
    command
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-r', '30'
      ])
      .output(outputPath);
    
    return command;
  }

  // Get color grading filter
  getColorGradingFilter(style) {
    const styles = {
      cinematic: 'eq=contrast=1.2:brightness=0.05:saturation=1.1',
      vibrant: 'eq=contrast=1.3:brightness=0.1:saturation=1.4',
      clean: 'eq=contrast=1.1:brightness=0.02:saturation=1.0',
      balanced: 'eq=contrast=1.15:brightness=0.03:saturation=1.2'
    };
    return styles[style] || styles.balanced;
  }

  // Get effect filter
  getEffectFilter(effect) {
    const effects = {
      slow_motion: 'setpts=0.5*PTS',
      fast_cuts: 'setpts=1.5*PTS',
      zoom_effects: 'zoompan=z=1.1:d=60:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)',
      highlight_text: 'drawbox=x=0:y=0:w=iw:h=ih:color=black@0.3:t=fill'
    };
    return effects[effect];
  }

  // Export to different formats using batch export service
  async exportToFormats(inputPath, formats = ['shorts', 'youtube', 'instagram']) {
    console.log('📦 [Professional] Starting batch export...');
    
    const exportOptions = {
      includeShorts: formats.includes('shorts'),
      includeYouTube: formats.includes('youtube'),
      includeInstagram: formats.includes('instagram'),
      includeTikTok: formats.includes('tiktok'),
      includeFacebook: formats.includes('facebook'),
      includeTwitter: formats.includes('twitter'),
      quality: 'high',
      addWatermark: true,
      watermarkText: 'Created with AI'
    };
    
    return await batchExport.exportToAllFormats(inputPath, exportOptions);
  }

  // Generate subtitles using Whisper
  async generateSubtitles(videoPath) {
    try {
      const whisperService = require('./whisperService');
      const baseName = path.basename(videoPath, path.extname(videoPath));
      
      // Extract audio first
      const audioPath = path.join(this.outputDir, `${baseName}_audio.wav`);
      await this.extractAudio(videoPath, audioPath);
      
      // Generate subtitles
      return await whisperService.transcribeAudio(audioPath, baseName);
    } catch (error) {
      console.warn('⚠️ Subtitle generation failed:', error.message);
      return null;
    }
  }

  // Add simple text overlay as fallback
  async addSimpleSubtitles(videoPath, style = 'tiktok') {
    try {
      const outputPath = path.join(this.outputDir, `simple_subtitles_${Date.now()}.mp4`);
      
      const text = "Professional Video Enhancement";
      const fontSize = 36; // Smaller font size
      const fontColor = style === 'tiktok' ? '#FF0050' : '#FFFFFF';
      
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .videoFilters([
            `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.5:boxborderw=2`
          ])
          .outputOptions([
            '-c:v', 'libx264', 
            '-preset', 'fast', 
            '-crf', '23',
            '-pix_fmt', 'yuv420p'
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Simple subtitles added: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Simple subtitles failed:', err);
            // Return original video if subtitle fails
            resolve(videoPath);
          })
          .run();
      });
    } catch (error) {
      console.error('❌ Simple subtitles error:', error);
      return videoPath; // Return original video if error
    }
  }

  // Extract audio from video
  async extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .outputOptions(['-f', 'wav'])
        .output(audioPath)
        .on('end', () => {
          console.log(`✅ Audio extracted: ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('❌ Audio extraction failed:', err);
          reject(err);
        })
        .run();
    });
  }

  // Add intelligent music
  async addIntelligentMusic(videoPath, options) {
    try {
      const analysis = { content: options.contentBrief || '' };
      
      // Determine mood based on music selection
      let mood = options.musicStyle || 'auto';
      if (options.musicSelection && options.musicSelection !== 'auto') {
        const moodMap = {
          'ambient': 'calm',
          'upbeat': 'energetic', 
          'dramatic': 'dramatic',
          'professional': 'professional',
          'fun': 'fun'
        };
        mood = moodMap[options.musicSelection] || options.musicStyle || 'professional';
      }
      
      console.log(`🎵 [Music] Using mood: ${mood} (from selection: ${options.musicSelection})`);
      console.log(`🎵 [Music] Selected music ID: ${options.selectedMusicId || 'none'}`);
      
      // If user selected a specific music, use that
      if (options.selectedMusicId && options.selectedMusicId !== 'auto') {
        console.log(`🎵 [Music] Using selected music: ${options.selectedMusicId}`);
        return await this.getSelectedMusic(options.selectedMusicId, mood, options.duration || 60);
      }
      
      const musicRecommendation = await intelligentMusic.recommendMusic(analysis, {
        duration: options.duration || 60,
        mood: mood
      });
      
      if (musicRecommendation.selected) {
        return await intelligentMusic.downloadMusic(musicRecommendation.selected, options.duration || 60);
      } else {
        // Fallback to synthetic music
        return await intelligentMusic.generateSyntheticMusic(musicRecommendation.selected || { mood: mood }, options.duration || 60);
      }
    } catch (error) {
      console.warn('⚠️ Music addition failed:', error.message);
      return null;
    }
  }

  // Get selected music based on ID
  async getSelectedMusic(musicId, mood, duration) {
    try {
      console.log(`🎵 [Music] Getting selected music: ${musicId} for mood: ${mood}`);
      
      // For now, we'll use the intelligent music service to generate music
      // In a real implementation, you would fetch the actual music file based on the ID
      const musicItem = { 
        id: musicId, 
        mood: mood,
        title: `Selected Music ${musicId}`,
        source: 'User Selection'
      };
      
      // Try to get the music from free sources first
      const freeMusic = await intelligentMusic.fetchFreeMusic(musicItem, duration);
      if (freeMusic) {
        return freeMusic;
      }
      
      // Fallback to synthetic music
      return await intelligentMusic.generateSyntheticMusic(musicItem, duration);
    } catch (error) {
      console.warn('⚠️ Selected music failed:', error.message);
      return null;
    }
  }

  // Mix audio with music
  async mixAudioWithMusic(videoPath, musicPath) {
    const outputPath = path.join(this.outputDir, `mixed_${Date.now()}.mp4`);
    
    return new Promise((resolve, reject) => {
      // Check if music file exists and is valid
      if (!fs.existsSync(musicPath)) {
        console.warn('⚠️ Music file does not exist, skipping music addition');
        resolve(videoPath);
        return;
      }

      const command = ffmpeg()
        .input(videoPath)
        .input(musicPath);

      // Check if video has audio
      command
        .complexFilter([
          '[0:a?]volume=0.8[voice]', // Optional audio from video (reduced)
          '[1:a]volume=0.65[music]',  // Background music (increased from 0.55 to 0.65 - more prominent)
          '[voice][music]amix=inputs=2:duration=first[audio]' // Mix both
        ])
        .outputOptions([
          '-map', '0:v',
          '-map', '[audio]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Audio mixed: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.warn('⚠️ Audio mixing failed, trying simple overlay...', err.message);
          // Fallback: just add music without mixing
          this.addMusicOnly(videoPath, musicPath)
            .then(resolve)
            .catch(() => {
              console.warn('⚠️ All music methods failed, continuing without music');
              resolve(videoPath);
            });
        })
        .run();
    });
  }

  async addMusicOnly(videoPath, musicPath) {
    const outputPath = path.join(this.outputDir, `music_only_${Date.now()}.mp4`);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(musicPath)
        .complexFilter([
          '[1:a]volume=0.65[music]'  // Background music (increased from 0.55 to 0.65 - more prominent) 
        ])
        .outputOptions([
          '-map', '0:v',
          '-map', '[music]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Music added: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Music addition failed:', err);
          reject(err);
        })
        .run();
    });
  }

  // Export to specific format
  async exportToFormat(inputPath, format) {
    const outputPath = path.join(this.outputDir, `export_${format}_${Date.now()}.mp4`);
    
    const command = ffmpeg(inputPath);
    
    // Format-specific settings
    switch (format) {
      case 'shorts':
        command
          .size('1080x1920')
          .aspect('9:16');
        break;
      case 'youtube':
        command
          .size('1920x1080')
          .aspect('16:9');
        break;
      case 'instagram':
        command
          .size('1080x1350')
          .aspect('4:5');
        break;
    }
    
    return new Promise((resolve, reject) => {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset', 'fast', '-crf', '23'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }
}

module.exports = new ProfessionalVideoService();
