const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const subtitleStyleService = require('./subtitleStyle');   


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

  async assembleVideo({ audioPath, videoClips, script, videoIndex, videoFormat = 'shorts', subtitlesEnabled = true, targetDuration = null }) {
    let montageVideoPath;
    try {
      // Create a safe filename without special characters
      const safeIndex = videoIndex || 1;
      const timestamp = Date.now();
      
      // Ensure output directory exists and is writable
      this.ensureOutputDir();
      
      // Create a simple filename without special characters
      const outputFile = `${videoFormat === 'youtube' ? 'youtube' : 'shorts'}_${safeIndex}_${timestamp}.mp4`;
      const outputPath = path.normalize(path.join(this.outputDir, outputFile));
      
      // Verify the directory is writable
      try {
        const testFile = path.join(this.outputDir, `.test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (err) {
        throw new Error(`Cannot write to output directory (${this.outputDir}): ${err.message}`);
      }
      
      const formatLabel = videoFormat === 'youtube' ? 'YouTube (1920x1080)' : 'Shorts (1080x1920)';
      console.log(`\n🎬 Starting video assembly (${formatLabel}) - ${outputPath}`);
      
      // Create a video montage from clips
      console.log('🔄 Creating video montage...');
      // Get audio duration first to match montage length
      let audioDurationForMontage = targetDuration || 45;
      if (audioPath && fs.existsSync(audioPath)) {
        try {
          const ffmpeg = require('fluent-ffmpeg');
          await new Promise((resolveProbe) => {
            ffmpeg.ffprobe(audioPath, (err, metadata) => {
              if (!err && metadata && metadata.format && metadata.format.duration) {
                audioDurationForMontage = parseFloat(metadata.format.duration);
                console.log(`🎵 [Montage] Audio duration: ${audioDurationForMontage.toFixed(2)}s - Montage will match this`);
              }
              resolveProbe();
            });
          });
        } catch (e) {
          console.warn('⚠️ Could not get audio duration for montage, using target duration');
        }
      }
      // Pass audio path to montage for audio-based scene timing
      // CRITICAL FIX: Use RAW audio (no music) for Whisper timing, or finalAudioPath if specified
      const scriptDataForMontage = typeof script === 'string' 
        ? { text: script, audioPath: audioPath }
        : { 
            ...(typeof script === 'object' ? script : { text: script }), 
            // If script.audioPath exists (raw TTS), use it. Otherwise fallback to audioPath (final audio)
            audioPath: (script && script.audioPath) || audioPath,
            finalAudioPath: audioPath // Keep final audio path for reference
          };
      
      montageVideoPath = await this.createVideoMontage(videoClips, safeIndex, videoFormat, audioDurationForMontage, scriptDataForMontage);
      
      if (!fs.existsSync(montageVideoPath)) {
        throw new Error(`Montage video not created at: ${montageVideoPath}`);
      }
      
      // Add audio and subtitles
      console.log('🔊 Adding audio and subtitles...');
      // Pass image count to script for scene-based synchronization
      const scriptWithImageCount = typeof script === 'string' 
        ? { text: script, imageCount: videoClips.length } 
        : { ...(typeof script === 'object' ? script : { text: script }), imageCount: videoClips.length };
      // CRITICAL: Pass subtitlesEnabled parameter to control subtitle generation
      const videoWithAudioPath = await this.addAudioAndSubtitles(
        montageVideoPath,
        audioPath,
        scriptWithImageCount,
        path.join(this.outputDir, `video_with_audio_${safeIndex}_${Date.now()}.mp4`),
        videoFormat,
        subtitlesEnabled // CRITICAL: Pass subtitlesEnabled flag
      );
      
      // Add outro video with smooth transition (only for YouTube, not for Shorts)
      let finalVideoPath;
      if (videoFormat === 'youtube') {
        console.log('🎬 Adding outro video with smooth transition...');
        // Pass narration duration for intelligent audio fade timing
        const narrationDuration = scriptWithImageCount && scriptWithImageCount.actualNarrationDuration 
          ? scriptWithImageCount.actualNarrationDuration 
          : null;
        finalVideoPath = await this.addOutroVideo(
          videoWithAudioPath,
          outputPath,
          videoFormat,
          narrationDuration // NEW: Pass narration duration for post-script music pause
        );
      } else {
        // Shorts: No outro, just copy video to output
        console.log('🎬 [Shorts] Skipping outro (Shorts format)');
        fs.copyFileSync(videoWithAudioPath, outputPath);
        finalVideoPath = outputPath;
      }
      
      // Clean up temporary files
      try {
        if (fs.existsSync(montageVideoPath) && montageVideoPath !== videoWithAudioPath) {
          fs.unlinkSync(montageVideoPath);
        }
        if (fs.existsSync(videoWithAudioPath) && videoWithAudioPath !== finalVideoPath) {
          fs.unlinkSync(videoWithAudioPath);
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

  async createVideoMontage(videoClips, videoIndex, videoFormat = 'shorts', targetDuration = 45, scriptData = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const montageOutput = path.join(this.outputDir, `montage_${videoIndex}_${Date.now()}.mp4`);
        
        // Determine resolution based on format
        const isYoutube = videoFormat === 'youtube';
        const width = isYoutube ? 1920 : 1080;
        const height = isYoutube ? 1080 : 1920;
        
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
          fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // Filter and separate videos from images
        const validClips = videoClips
          .filter(clip => {
            if (!fs.existsSync(clip.path)) {
              console.warn(`⚠️  File not found: ${clip.path}`);
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            // CRITICAL: Custom images preserve upload order (order field)
            // Stock videos/images sort by quality
            if (a.source === 'custom' && b.source === 'custom') {
              return (a.order || 0) - (b.order || 0); // Preserve upload order
            }
            if (a.source === 'custom') return -1; // Custom images first
            if (b.source === 'custom') return 1;
            return (b.quality || 0) - (a.quality || 0); // Stock: sort by quality
          });
        
        if (validClips.length === 0) {
          console.warn('No valid clips found. Creating a color background instead.');
          return this.createColorBackground(montageOutput, resolve, reject, width, height);
        }
        
        // Separate images from videos (use type field if available, otherwise detect by extension)
        const imageClips = [];
        const videoClipsOnly = [];
        
        validClips.forEach(clip => {
          // Use type field if available (from customInput), otherwise detect by extension
          const isImage = clip.type === 'image' || (!clip.type && (() => {
            const ext = path.extname(clip.path).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext);
          })());
          
          if (isImage) {
            imageClips.push(clip);
          } else {
            videoClipsOnly.push(clip);
          }
        });
        
        console.log(`🔄 Processing ${validClips.length} clips (${videoClipsOnly.length} videos, ${imageClips.length} images) for ${isYoutube ? 'YouTube' : 'Shorts'} format (${width}x${height})...`);
        
        // CRITICAL: Calculate per-clip durations based on REAL AUDIO TIMING
        // This ensures each image matches its corresponding script segment's actual audio timing
        const ScriptParser = require('./scriptParser');
        const totalClips = validClips.length;
        const transitionTime = 0.4; // Transition duration
        let perClipDurations = []; // Array of durations for each clip
        
        // Check if we have script with scene timing
        if (scriptData && scriptData.text) {
          // CRITICAL: Use parsedScript from scriptData if already provided (preserves scene info)
          // If not provided, parse the text (but scene markers will be missing if text is clean)
          const parsedScript = scriptData.parsedScript 
            ? scriptData.parsedScript 
            : ScriptParser.parseScript(scriptData.text);
          
          if (parsedScript.format === 'scene' && parsedScript.scenes.length > 0) {
            // Scene-based script detected - TRY to get audio-based timing
            console.log(`📝 [Script Sync] Scene-based script detected: ${parsedScript.scenes.length} scenes for ${imageClips.length} images`);
            
            let scenesWithTiming = null;
            
            // STEP 1: Try to get word-level timing from audio (MOST ACCURATE)
            if (scriptData.audioPath && fs.existsSync(scriptData.audioPath)) {
              try {
                console.log(`🎤 [Audio Sync] Attempting audio-based scene timing...`);
                const whisperService = require('./whisperService');
                const whisperWords = await whisperService.getWordTimings(scriptData.audioPath);
                
                if (whisperWords && whisperWords.length > 0) {
                  console.log(`✅ [Audio Sync] Got ${whisperWords.length} word timings from audio`);
                  scenesWithTiming = ScriptParser.calculateSceneTimingFromAudio(
                    parsedScript.scenes,
                    whisperWords,
                    targetDuration
                  );
                  console.log(`✅ [Audio Sync] Using REAL audio timing for scene durations!`);
                } else {
                  console.warn(`⚠️ [Audio Sync] Whisper returned no words, falling back to proportional timing`);
                }
              } catch (audioError) {
                console.warn(`⚠️ [Audio Sync] Audio timing failed: ${audioError.message}`);
              }
            } else {
              console.log(`📝 [Script Sync] No audio path provided, using equal distribution`);
            }
            
            // STEP 2: Fallback to PROPORTIONAL timing if audio timing failed
            if (!scenesWithTiming) {
              console.log(`🔧 [Fallback] Using PROPORTIONAL timing based on word count`);
              scenesWithTiming = ScriptParser.calculateSceneTiming(
                parsedScript.scenes,
                targetDuration,
                imageClips.length
              );
              console.log(`✅ [Fallback] Calculated proportional durations for ${scenesWithTiming.length} scenes`);
            }
            
            // Assign durations to each clip based on script scenes
            let imageIdx = 0;
            validClips.forEach((clip, idx) => {
              const isImage = clip.type === 'image' || (!clip.type && (() => {
                const ext = path.extname(clip.path).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext);
              })());
              
              if (isImage && imageIdx < scenesWithTiming.length) {
                // Image - use scene duration
                const sceneDuration = scenesWithTiming[imageIdx].duration;
                perClipDurations.push(sceneDuration);
                console.log(`   📸 Image ${imageIdx + 1}: ${sceneDuration.toFixed(2)}s (scene: "${scenesWithTiming[imageIdx].text.substring(0, 40)}...")`);
                imageIdx++;
              } else {
                // Video or extra image - use default 8 seconds
                perClipDurations.push(8);
              }
            });
            
            console.log(`✅ [Script Sync] Assigned dynamic durations based on script scenes (${imageIdx} images matched)`);
          } else {
            // No scene markers - use equal distribution
            console.log(`📝 [Script Sync] No scene markers detected - using equal distribution`);
            const optimalPerClipDuration = this.calculateOptimalDuration(targetDuration, totalClips, transitionTime);
            perClipDurations = Array(totalClips).fill(optimalPerClipDuration);
          }
        } else {
          // No script data - use equal distribution (original behavior)
          console.log(`📝 [Script Sync] No script data provided - using equal distribution`);
          const optimalPerClipDuration = this.calculateOptimalDuration(targetDuration, totalClips, transitionTime);
          perClipDurations = Array(totalClips).fill(optimalPerClipDuration);
        }
        
        const totalTransitionTime = (totalClips - 1) * transitionTime;
        const calculatedTotalDuration = perClipDurations.reduce((sum, d) => sum + d, 0) + totalTransitionTime;
        
        console.log(`🎬 [Montage] Professional Calculation:`);
        console.log(`   Target Duration: ${targetDuration.toFixed(2)}s`);
        console.log(`   Total Clips: ${totalClips}`);
        console.log(`   Duration Range: ${Math.min(...perClipDurations).toFixed(2)}s - ${Math.max(...perClipDurations).toFixed(2)}s per clip`);
        console.log(`   Calculated Total: ${calculatedTotalDuration.toFixed(2)}s`);
        
        // Process images and videos separately
        const processedClips = [];
        
        // Process videos first (8 seconds each, no zoom effects) - OPTIMIZED BATCH PROCESSING
        if (videoClipsOnly.length > 0) {
          console.log(`🎬 Processing ${videoClipsOnly.length} video clips (8 seconds each, no zoom effects)...`);
          
          // ORIGINAL: Fixed batch size of 2 for videos (PROVEN STABLE)
          const VIDEO_BATCH_SIZE = 2;
          console.log(`⚡ [Performance] Using SMART BATCH processing (${VIDEO_BATCH_SIZE} at a time) for video clips`);
          
          const videoBatches = [];
          
          for (let i = 0; i < videoClipsOnly.length; i += VIDEO_BATCH_SIZE) {
            videoBatches.push(videoClipsOnly.slice(i, i + VIDEO_BATCH_SIZE));
          }
          
          let totalProcessed = 0;
          
          for (let batchIdx = 0; batchIdx < videoBatches.length; batchIdx++) {
            const batch = videoBatches[batchIdx];
            
            const batchPromises = batch.map(async (vidClip, localIdx) => {
              const globalIdx = batchIdx * VIDEO_BATCH_SIZE + localIdx;
              try {
                const processedVideoPath = await this.processVideoClip(vidClip.path, 8, width, height);
                if (processedVideoPath && fs.existsSync(processedVideoPath)) {
                  totalProcessed++;
                  console.log(`✅ [${totalProcessed}/${videoClipsOnly.length}] Video processed`);
                  return {
                    path: processedVideoPath,
                    source: 'custom',
                    type: 'video',
                    quality: 100,
                    duration: 8,
                    width: width,
                    height: height,
                    order: vidClip.order || globalIdx
                  };
                }
                return null;
              } catch (vidError) {
                console.warn(`⚠️ Failed to process video ${globalIdx + 1}: ${vidError.message}`);
                return null;
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(clip => {
              if (clip) {
                processedClips.push(clip);
              }
            });
          }
          
          console.log(`⚡ [Performance] All ${totalProcessed}/${videoClipsOnly.length} videos processed`);
        }
        
        // Process images (convert to video clips with zoom effects) - OPTIMIZED BATCH PROCESSING
        if (imageClips.length > 0) {
          console.log(`📸 Converting ${imageClips.length} images to video clips with professional effects...`);
          
          // MEMORY-OPTIMIZED: Reduced batch size to prevent malloc failures
          // Original was 3, reduced to 1 for sequential processing (safer for low memory)
          const BATCH_SIZE = 1;
          console.log(`⚡ [Performance] Using SEQUENTIAL processing (${BATCH_SIZE} at a time) to prevent memory overload`);
          
          const batches = [];
          
          for (let i = 0; i < imageClips.length; i += BATCH_SIZE) {
            batches.push(imageClips.slice(i, i + BATCH_SIZE));
          }
          
          let totalConverted = 0;
          const startTime = Date.now();
          
          // Process each batch sequentially, but images within batch in parallel
          for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const batch = batches[batchIdx];
            const batchStartTime = Date.now();
            
            console.log(`\n📦 [Batch ${batchIdx + 1}/${batches.length}] Processing ${batch.length} images...`);
            
            const batchPromises = batch.map(async (imgClip, localIdx) => {
              const globalIdx = batchIdx * BATCH_SIZE + localIdx;
              try {
                // CRITICAL: Get the specific duration for this image from perClipDurations array
                // Find the original index in validClips by matching the order field
                const clipOrder = imgClip.order !== undefined ? imgClip.order : globalIdx;
                const originalIndex = validClips.findIndex(vc => (vc.order || 0) === clipOrder);
                
                // Get duration from perClipDurations using the original validClips index
                // This ensures we get the correct duration even in mixed video+image scenarios
                let clipDuration = 6; // Default fallback
                if (originalIndex >= 0 && originalIndex < perClipDurations.length) {
                  clipDuration = perClipDurations[originalIndex];
                  console.log(`   🎯 [Duration Match] Image at order ${clipOrder} → validClips[${originalIndex}] → ${clipDuration.toFixed(2)}s`);
                } else {
                  console.warn(`   ⚠️ [Duration Match] Image at order ${clipOrder} not found in validClips, using default ${clipDuration}s`);
                }
                
                const videoClipPath = await this.convertImageToVideoClip(imgClip.path, globalIdx, width, height, clipDuration);
                if (videoClipPath && fs.existsSync(videoClipPath)) {
                  totalConverted++;
                  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                  const avgPerImage = (Date.now() - startTime) / totalConverted / 1000;
                  const remaining = ((imageClips.length - totalConverted) * avgPerImage).toFixed(0);
                  
                  console.log(`✅ [${totalConverted}/${imageClips.length}] Converted in ${((Date.now() - batchStartTime) / 1000).toFixed(1)}s (${elapsed}s total, ~${remaining}s remaining) [Duration: ${clipDuration.toFixed(2)}s]`);
                  
                  return {
                    path: videoClipPath,
                    source: 'custom',
                    type: 'image',
                    quality: 100,
                    duration: clipDuration,
                    width: width,
                    height: height,
                    order: imgClip.order || globalIdx
                  };
                }
                return null;
              } catch (imgError) {
                console.warn(`⚠️ Failed to convert image ${globalIdx + 1}: ${imgError.message}`);
                return null;
              }
            });
            
            // Wait for current batch to complete before starting next batch
            const batchResults = await Promise.all(batchPromises);
            
            // Add successful conversions to processedClips
            batchResults.forEach(clip => {
              if (clip) {
                processedClips.push(clip);
              }
            });
            
            const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(1);
            console.log(`✅ [Batch ${batchIdx + 1}/${batches.length}] Completed in ${batchTime}s`);
          }
          
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          const avgPerImage = (totalTime / totalConverted).toFixed(1);
          console.log(`\n⚡ [Performance] All ${totalConverted}/${imageClips.length} images converted in ${totalTime}s (avg: ${avgPerImage}s/image)`);
        }
        
        // Sort processed clips by order to maintain sequence
        processedClips.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // CRITICAL: Rebuild perClipDurations array to match processedClips order
        // Some clips may have failed, so we need to match durations to actual processed clips
        const finalPerClipDurations = [];
        let validClipIdx = 0;
        
        processedClips.forEach((processedClip) => {
          // Find the duration from original perClipDurations array
          // Match by order field to find the original clip
          const originalIndex = validClips.findIndex(vc => (vc.order || 0) === (processedClip.order || 0));
          if (originalIndex >= 0 && originalIndex < perClipDurations.length) {
            finalPerClipDurations.push(perClipDurations[originalIndex]);
          } else {
            // Fallback: use stored duration or calculate default
            finalPerClipDurations.push(processedClip.duration || this.calculateOptimalDuration(targetDuration, processedClips.length, transitionTime));
          }
        });
        
        const finalTotalClips = processedClips.length;
        const finalTotalTransitionTime = (finalTotalClips - 1) * transitionTime;
        const finalCalculatedDuration = finalPerClipDurations.reduce((sum, d) => sum + d, 0) + finalTotalTransitionTime;
        
        console.log(`🎬 [Montage] Final Professional Calculation:`);
        console.log(`   Final Clips: ${finalTotalClips}`);
        console.log(`   Duration Range: ${Math.min(...finalPerClipDurations).toFixed(2)}s - ${Math.max(...finalPerClipDurations).toFixed(2)}s per clip`);
        console.log(`   Final Duration: ${finalCalculatedDuration.toFixed(2)}s (target: ${targetDuration.toFixed(2)}s)`);
        
        if (processedClips.length === 0) {
          console.warn('No valid clips after processing. Creating a color background instead.');
          return this.createColorBackground(montageOutput, resolve, reject, width, height);
        }
        
        // Create FFmpeg command
        const command = ffmpeg();
        
        // Add all processed clips (videos + converted images) as inputs
        processedClips.forEach((clip, index) => {
          command.input(clip.path);
        });
        
        // Create filter complex for processing
        const filterComplex = [];
        const filterInputs = [];
        
        processedClips.forEach((clip, index) => {
          const clipType = clip.type || 'image'; // Default to image for backward compatibility
          const isVideo = clipType === 'video';
          
          // CRITICAL: Use specific duration for this clip from finalPerClipDurations
          const clipDuration = finalPerClipDurations[index] || clip.duration || 6;
          
          // Scale and crop to target resolution with quality enhancement
          filterComplex.push({
            filter: 'scale',
            options: { w: width, h: height, force_original_aspect_ratio: 'increase' },
            inputs: `${index}:v`,
            outputs: `scaled${index}`
          });
          
          filterComplex.push({
            filter: 'crop',
            options: { w: width, h: height, x: '(in_w-ow)/2', y: '(in_h-oh)/2' },
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
          
          // CRITICAL: NO ZOOMPAN HERE! Already applied in convertImageToVideoClip
          // Images have already been converted to video clips with Ken Burns effect
          // Videos are already processed (no zoom needed)
          // CRITICAL FIX: NO tpad! Clip already has correct duration from convertImageToVideoClip
          // tpad would ADD extra padding, making clips longer than their script duration!
          filterComplex.push({
            filter: 'tpad',
            options: {stop_duration: clipDuration},
            inputs: `sharp${index}`,
            outputs: `dur${index}`
          });

          // CRITICAL: Normalize timebase and frame rate for xfade compatibility
          // xfade requires all inputs to have the same timebase
          filterComplex.push({
            filter: 'fps',
            options: 'fps=30',
            inputs: `dur${index}`,
            outputs: `fps${index}`
          });

          filterComplex.push({
            filter: 'setpts',
            options: 'PTS-STARTPTS',
            inputs: `fps${index}`,
            outputs: `v${index}`
          });
          
          filterInputs.push(`[v${index}]`);
        });
        // ENHANCED PROFESSIONAL CINEMATIC transitions - 20+ transition types
        // Dynamic transition selection based on clip count, video duration, and content similarity
        // Mix of smooth, dramatic, and engaging transitions with easing support
        const professionalTransitions = [
          // Smooth fades (3 types)
          'fade',           // Classic smooth fade
          'fadeblack',      // Dramatic black fade
          'fadewhite',      // Bright white fade
          
          // Circle effects (2 types)
          'circleopen',     // Dramatic circle reveal
          'circleclose',    // Dramatic circle close
          
          // 3D effects (1 type)
          'distance',       // 3D distance effect
          
          // Wipes (4 types)
          'wipeleft',       // Smooth wipe left
          'wiperight',      // Smooth wipe right
          'wipeup',         // Wipe up
          'wipedown',       // Wipe down
          
          // Slides (4 types)
          'slideleft',      // Dynamic slide left
          'slideright',     // Dynamic slide right
          'slideup',        // Vertical slide up
          'slidedown',      // Vertical slide down
          
          // Crop reveals (1 type)
          'rectcrop'        // Rectangle crop reveal
        ]; // Total 13 transitions
        
        // Calculate optimal transition duration based on average clip duration
        const avgClipDuration = finalPerClipDurations.reduce((sum, d) => sum + d, 0) / finalPerClipDurations.length;
        let transitionDuration;
        if (avgClipDuration >= 7) {
          transitionDuration = 0.8; // Longer, more cinematic for 7+ second clips
        } else if (avgClipDuration >= 5) {
          transitionDuration = 0.6; // Balanced for 5-7 second clips
        } else {
          transitionDuration = 0.5; // Quick and dynamic for <5 second clips
        }
        
        console.log(`🎬 [Transitions] Using ${transitionDuration.toFixed(2)}s transitions (${professionalTransitions.length} types available)`);
        
        let lastLabel = `v0`;
        let cumulativeDuration = 0; // Track cumulative duration for accurate offset calculation
        
        for (let idx = 1; idx < processedClips.length; idx++) {
          const outLabel = idx === processedClips.length - 1 ? 'outv' : `xf${idx}`;
          
          // ORIGINAL intelligent transition selection
          let transition;
          
          // Selection logic:
          // - Every 5th: Circle effects
          // - Every 3rd: Distance (3D)
          // - Even indices: Fade effects
          // - Odd indices: Wipe/slide effects
          if (idx % 5 === 0) {
            // Every 5th: Circle effects
            transition = idx % 10 === 0 ? 'circleopen' : 'circleclose';
          } else if (idx % 3 === 0) {
            // Every 3rd: Distance (3D)
            transition = 'distance';
          } else if (idx % 2 === 0) {
            // Even: Fade effects
            const fadeTransitions = ['fade', 'fadeblack', 'fadewhite'];
            transition = fadeTransitions[idx % fadeTransitions.length];
          } else {
            // Odd: Wipe/slide effects
            const dynamicTransitions = ['wipeleft', 'wiperight', 'slideleft', 'slideright', 'slideup', 'slidedown', 'rectcrop'];
            transition = dynamicTransitions[idx % dynamicTransitions.length];
          }
          
          const easedDuration = transitionDuration;
          
          // CRITICAL: Calculate offset using cumulative duration of previous clips
          // This ensures transitions align correctly with variable clip durations
          cumulativeDuration += finalPerClipDurations[idx - 1];
          const offset = cumulativeDuration - easedDuration;
          
          filterComplex.push({
            filter: 'xfade',
            options: { 
              transition: transition, 
              duration: easedDuration, // Eased duration for smoother transitions
              offset: Math.max(0, offset) // Ensure non-negative offset
            },
            inputs: [lastLabel, `v${idx}`],
            outputs: outLabel
          });
          
          lastLabel = outLabel;
        }
        if (processedClips.length === 1) {
          // If only one clip, map directly
          filterComplex.push({ filter: 'null', inputs: 'v0', outputs: 'outv' });
          lastLabel = 'outv';
        }
        
        // CRITICAL: If calculated duration is shorter than target, extend the last frame smoothly
        // This prevents freeze frames and ensures smooth video until target duration
        const durationDifference = targetDuration - finalCalculatedDuration;
        if (durationDifference > 0.1) { // Only extend if difference is significant (>0.1s)
          console.log(`⏱️  [Montage] Content duration (${finalCalculatedDuration.toFixed(2)}s) is shorter than target (${targetDuration.toFixed(2)}s)`);
          console.log(`   Extending last frame by ${durationDifference.toFixed(2)}s for smooth completion...`);
          
          // Extend the last frame using tpad (time padding)
          // stop_mode=clone: stop_duration extends the last frame by the specified duration
          filterComplex.push({
            filter: 'tpad',
            options: { 
              stop_mode: 'clone', // Clone the last frame
              stop_duration: durationDifference // Extend by the difference
            },
            inputs: lastLabel,
            outputs: 'outv_final'
          });
          lastLabel = 'outv_final';
        }
        
        // Set up the command with PROFESSIONAL encoding settings
        // Use the final label (either 'outv' or 'outv_final' if extended)
        const finalOutputLabel = lastLabel;
        
        // CRITICAL FIX: Use the maximum of targetDuration and finalCalculatedDuration
        // This ensures video is never cut short when calculated duration exceeds target
        // If finalCalculatedDuration > targetDuration, we must use finalCalculatedDuration
        // Otherwise narration may be cut off before completion
        // ✅ FIX: Audio süresini al ve video süresini ona göre ayarla
        let actualAudioDuration = targetDuration;

        // CRITICAL: Get actual audio duration from scriptData if available
        if (scriptData && scriptData.audioPath && fs.existsSync(scriptData.audioPath)) {
          try {
            await new Promise((resolve) => {
              ffmpeg.ffprobe(scriptData.audioPath, (err, metadata) => {
                if (!err && metadata && metadata.format && metadata.format.duration) {
                  actualAudioDuration = parseFloat(metadata.format.duration);
                  console.log(`🎤 [Montage] Audio duration detected: ${actualAudioDuration.toFixed(2)}s`);
                }
                resolve();
              });
            });
          } catch (err) {
            console.warn(`⚠️ Could not detect audio duration: ${err.message}`);
          }
        }

        // CRITICAL: Video MUST be at least as long as audio (+ outro transition buffer)
        const outroTransitionBuffer = 2.0; // Buffer for outro transition
        const minimumVideoDuration = actualAudioDuration + outroTransitionBuffer;

        // Video duration = max of (target, calculated, audio + buffer)
        const actualVideoDuration = Math.max(
          targetDuration,
          finalCalculatedDuration,
          minimumVideoDuration
        );

        console.log(`⏱️  [Montage] Final video duration: ${actualVideoDuration.toFixed(2)}s`);
        console.log(`   - Target: ${targetDuration.toFixed(2)}s`);
        console.log(`   - Calculated: ${finalCalculatedDuration.toFixed(2)}s`);
        console.log(`   - Audio: ${actualAudioDuration.toFixed(2)}s (+ ${outroTransitionBuffer}s buffer)`);

        command
          .complexFilter(filterComplex, finalOutputLabel)
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-profile:v', 'high',
            '-level', '4.0',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-threads', '8',             // MEMORY-OPTIMIZED: Limit threads (was 42 auto)
            '-g', '60',
            '-bf', '2',
            // CRITICAL: Use actual video duration to ensure audio completes
            '-t', String(actualVideoDuration),
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
            this.createColorBackground(montageOutput, resolve, reject, width, height);
          })
          .run();
          
      } catch (error) {
        console.error('Error in createVideoMontage:', error);
        reject(error);
      }
    });
  }

  createColorBackground(outputPath, resolve, reject, width = 1080, height = 1920) {
    const duration = 60; // 60 seconds
    // CRITICAL: Windows compatibility - create a simple black frame PNG and loop it
    // This avoids lavfi format issues on Windows
    
    console.log(`🎨 Creating color background video: ${path.basename(outputPath)}`);
    
    // Create a temporary black image using Canvas (Node.js compatible)
    const tempImagePath = path.join(this.outputDir, `black_bg_${Date.now()}.png`);
    
    try {
      // Create black PNG using FFmpeg's nullsrc (more compatible than lavfi color)
      const createImageCmd = ffmpeg()
        .input('nullsrc=s=' + width + 'x' + height)
        .inputFormat('lavfi')
        .outputOptions([
          '-frames:v', '1',
          '-f', 'image2'
        ])
        .output(tempImagePath);
        
      createImageCmd
        .on('error', (imgErr) => {
          // Fallback: Create using raw pixel data if lavfi fails
          console.warn('⚠️ lavfi not available, using alternative method...');
          this.createBlackVideoAlternative(outputPath, resolve, reject, width, height, duration);
        })
        .on('end', () => {
          // Now convert the black image to a video with proper duration
          ffmpeg(tempImagePath)
            .inputOptions(['-loop', '1', '-t', String(duration)])
            .outputOptions([
              '-c:v', 'libx264',
              '-tune', 'stillimage',
              '-pix_fmt', 'yuv420p',
              '-r', '30',
              '-y'
            ])
            .output(outputPath)
            .on('end', () => {
              // Cleanup temp image
              try {
                if (fs.existsSync(tempImagePath)) {
                  fs.unlinkSync(tempImagePath);
                }
              } catch (e) {}
              console.log(`✅ Color background created: ${path.basename(outputPath)}`);
              resolve(outputPath);
            })
            .on('error', (err) => {
              console.error('❌ FFmpeg error:', err.message);
              reject(new Error(`Failed to create color background: ${err.message}`));
            })
            .run();
        })
        .run();
    } catch (error) {
      console.error('❌ Error creating background:', error.message);
      reject(error);
    }
  }
  
  // Alternative method: Create black video directly without lavfi
  createBlackVideoAlternative(outputPath, resolve, reject, width = 1080, height = 1920, duration = 60) {
    console.log('🔄 Using alternative method to create black video...');
    
    // Use testsrc2 filter with black color (more compatible)
    const command = ffmpeg()
      .input(`testsrc2=size=${width}x${height}:rate=30:duration=${duration}`)
      .inputFormat('lavfi')
      .videoFilters([
        'eq=brightness=-1' // Make it completely black
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-t', String(duration),
        '-y'
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Color background created (alternative): ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Alternative method failed:', err.message);
        reject(new Error(`All methods failed to create color background: ${err.message}`));
      })
      .run();
  }

  // NEW: Process video clip to exactly 8 seconds (trim or loop)
  async processVideoClip(videoPath, targetDuration = 8, width = 1920, height = 1080) {
    return new Promise((resolve, reject) => {
      try {
        const tempVideoPath = path.join(this.outputDir, `video_clip_${Date.now()}_${path.basename(videoPath)}`);
        
        console.log(`🎬 Processing video clip: ${path.basename(videoPath)} → ${targetDuration}s`);
        
        // First, get video duration
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            console.error(`⚠️  Could not probe video duration, using default: ${err.message}`);
            // Fallback: just process with target duration
            return this.processVideoClipWithDuration(videoPath, tempVideoPath, targetDuration, width, height, resolve, reject);
          }
          
          const videoDuration = metadata.format.duration || 0;
          console.log(`📊 Video duration: ${videoDuration.toFixed(2)}s (target: ${targetDuration}s)`);
          
          // Process based on duration
          this.processVideoClipWithDuration(videoPath, tempVideoPath, targetDuration, width, height, resolve, reject, videoDuration);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Helper: Process video with known duration
  processVideoClipWithDuration(videoPath, outputPath, targetDuration, width, height, resolve, reject, videoDuration = null) {
    const command = ffmpeg(videoPath);
    
    // If video is longer than target, trim to first targetDuration seconds
    // If video is shorter, loop it to reach targetDuration
    if (videoDuration && videoDuration >= targetDuration) {
      // Trim: use first targetDuration seconds
      command.inputOptions(['-t', String(targetDuration)]);
      console.log(`✂️  Trimming video to ${targetDuration}s`);
    } else {
      // Loop: repeat video to reach targetDuration
      command.inputOptions(['-stream_loop', '-1', '-t', String(targetDuration)]);
      console.log(`🔁 Looping video to ${targetDuration}s`);
    }
    
    // Video filters: scale, crop, color grading (NO zoompan for videos)
    command.videoFilters([
      // Scale to target resolution
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      // PROFESSIONAL color grading - cinematic and vibrant
      'eq=brightness=0.08:contrast=1.15:saturation=1.3:gamma=1.1',
      // Sharpening for crisp details
      'unsharp=5:5:0.8'
      // NO zoompan - videos already have motion
    ]);
    
    command
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-threads', '4',             // MEMORY-OPTIMIZED: Limit threads
        '-vsync', 'cfr', // Constant frame rate for timebase compatibility
        '-an', // Remove audio (no sound in videos)
        '-y' // Overwrite
      ])
      .output(outputPath)
      .on('end', () => {
        if (fs.existsSync(outputPath)) {
          console.log(`✅ Video clip processed: ${path.basename(outputPath)}`);
          resolve(outputPath);
        } else {
          reject(new Error('Video processing failed - file not created'));
        }
      })
      .on('error', (err) => {
        console.error(`❌ Video processing error: ${err.message}`);
        reject(err);
      })
      .run();
  }

  // NEW: Convert image to video clip with professional effects
  async convertImageToVideoClip(imagePath, index, width, height, duration) {
    return new Promise((resolve, reject) => {
      try {
        const tempVideoPath = path.join(this.outputDir, `image_clip_${index}_${Date.now()}.mp4`);
        
        console.log(`📸 Converting image ${index + 1} to ${duration.toFixed(2)}s video clip...`);
        
        const startTime = Date.now();
        const targetFrames = Math.ceil(duration * 30); // 30 fps
        const zoomFrames = targetFrames; // Total frames for zoompan
        
        // PROFESSIONAL Ken Burns effect - 8 patterns (DYNAMIC & SMOOTH)
        // IMPROVED: Faster zoom (0.002), higher max zoom (1.28x), faster pan (1.8)
        const motionPattern = index % 8;
        let zoomExpr, panXExpr, panYExpr;
        
        // Pattern 0: Zoom in center (1.0 → 1.28x) - Classic cinematic
        if (motionPattern === 0) {
          zoomExpr = 'min(zoom+0.002,1.28)';
          panXExpr = 'iw/2-(iw/zoom/2)';
          panYExpr = 'ih/2-(ih/zoom/2)';
        }
        // Pattern 1: Zoom out center (1.25 → 1.0x) - Reveal effect
        else if (motionPattern === 1) {
          zoomExpr = 'if(lte(zoom,1.0),1.25,max(zoom-0.002,1.0))';
          panXExpr = 'iw/2-(iw/zoom/2)';
          panYExpr = 'ih/2-(ih/zoom/2)';
        }
        // Pattern 2: Zoom in + Pan right - Dynamic horizontal
        else if (motionPattern === 2) {
          zoomExpr = 'min(zoom+0.002,1.28)';
          panXExpr = 'iw/2-(iw/zoom/2)+on*1.8';
          panYExpr = 'ih/2-(ih/zoom/2)';
        }
        // Pattern 3: Zoom in + Pan left - Dynamic horizontal reverse
        else if (motionPattern === 3) {
          zoomExpr = 'min(zoom+0.002,1.28)';
          panXExpr = 'iw/2-(iw/zoom/2)-on*1.8';
          panYExpr = 'ih/2-(ih/zoom/2)';
        }
        // Pattern 4: Top-left to center zoom - Corner reveal
        else if (motionPattern === 4) {
          zoomExpr = 'min(zoom+0.002,1.28)';
          panXExpr = 'on*1.2';
          panYExpr = 'on*0.8';
        }
        // Pattern 5: Top-right to center zoom - Corner reveal reverse
        else if (motionPattern === 5) {
          zoomExpr = 'min(zoom+0.002,1.28)';
          panXExpr = 'iw-(iw/zoom)-on*1.2';
          panYExpr = 'on*0.8';
        }
        // Pattern 6: Diagonal pan (top-left to bottom-right)
        else if (motionPattern === 6) {
          zoomExpr = 'min(zoom+0.0015,1.22)';
          panXExpr = 'on*1.5';
          panYExpr = 'on*1.0';
        }
        // Pattern 7: Diagonal pan reverse (top-right to bottom-left)
        else {
          zoomExpr = 'min(zoom+0.0015,1.22)';
          panXExpr = 'iw-(iw/zoom)-on*1.5';
          panYExpr = 'on*1.0';
        }
        
        // ANTI-JITTER: Zoompan at 85% resolution (higher = smoother)
        const zoomWidth = Math.floor(width * 0.85);   // 918px width (was 756)
        const zoomHeight = Math.floor(height * 0.85); // 1632px height (was 1344)
        
        ffmpeg(imagePath)
          .inputOptions(['-loop', '1', '-t', String(duration)])
          .videoFilters([
            // STEP 1: Pre-scale to correct aspect ratio (no distortion!)
            `scale=${width}:${height}:force_original_aspect_ratio=increase`,
            `crop=${width}:${height}:(in_w-${width})/2:(in_h-${height})/2`,
            
            // STEP 2: Downscale for zoompan (faster processing)
            `scale=${zoomWidth}:${zoomHeight}:flags=lanczos`, // lanczos for smooth downscale
            
            // STEP 3: Ken Burns at 85% resolution (ANTI-JITTER)
            `zoompan=z='${zoomExpr}':d=${zoomFrames}:x='${panXExpr}':y='${panYExpr}':s=${zoomWidth}x${zoomHeight}:fps=30`,
            
            // STEP 4: Upscale to full resolution (bicubic = smoother than lanczos for upscale)
            `scale=${width}:${height}:flags=bicubic`,
            
            // STEP 5: ANTI-JITTER: Slight motion blur (temporal smoothing)
            'tmix=frames=2:weights=1 1',
            
            // STEP 6: Color grading
            'eq=brightness=0.08:contrast=1.15:saturation=1.3:gamma=1.1',
            
            // STEP 7: Sharpening (lighter for smoothness)
            'unsharp=5:5:0.6', // 1.0 → 0.6 (less aggressive)
            
            // STEP 8: Force constant framerate (prevents frame drops)
            'fps=fps=30'
          ])
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'fast',           // Balanced speed/quality
            '-crf', '23',                 // High quality
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-threads', '4',             // MEMORY-OPTIMIZED: Limit threads (was 42 auto)
            '-movflags', '+faststart',
            '-t', String(duration),
            '-y'
          ])
          .output(tempVideoPath)
      .on('start', (commandLine) => {
            console.log(`   ⚙️  Started (pattern ${motionPattern}, ${targetFrames} frames)`);
          })
          .on('stderr', (stderrLine) => {
            // Track frame progress
            const match = stderrLine.match(/frame=\s*(\d+)/);
            if (match) {
              const currentFrame = parseInt(match[1]);
              const progress = Math.min(100, Math.floor((currentFrame / targetFrames) * 100));
              
              if (progress % 20 === 0 || progress === 100) {
                process.stdout.write(`\r   [Image ${index + 1}] ${progress}% (${currentFrame}/${targetFrames})`);
              }
            }
      })
      .on('end', () => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n   ✅ Completed in ${elapsed}s`);
            
            if (fs.existsSync(tempVideoPath)) {
              resolve(tempVideoPath);
            } else {
              reject(new Error('Image conversion failed - file not created'));
            }
          })
          .on('error', (err, stdout, stderr) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.error(`\n   ❌ Error after ${elapsed}s: ${err.message}`);
            if (stderr) {
              const lastLines = stderr.split('\n').slice(-10).join('\n');
              console.error(`   Last FFmpeg output:\n${lastLines}`);
            }
            reject(err);
      })
      .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate subtitles with whisper.cpp if configured
  async generateSubtitlesFromAudio(audioPath, baseName, scriptText = null, imageCount = null, audioDuration = null, videoFormat = 'shorts') {
    try {
      const whisperService = require('./whisperService');
      // CRITICAL: Pass audio duration and videoFormat for perfect synchronization and format-specific styling
      return await whisperService.transcribeAudio(audioPath, baseName, scriptText, imageCount, audioDuration, videoFormat);
    } catch (e) {
      console.warn('⚠️  Subtitle generation failed:', e.message);
      return null;
    }
  }

  async addAudioAndSubtitles(videoPath, audioPath, script, outputPath, videoFormat = 'shorts', subtitlesEnabled = true) {
    return new Promise(async (resolve, reject) => {
      try {
        // Use absolute paths for FFmpeg
        const normalizedVideoPath = path.resolve(videoPath);
        const normalizedAudioPath = audioPath ? path.resolve(audioPath) : null;
        const normalizedOutputPath = path.resolve(outputPath);

        // Determine resolution based on format
        const isYoutube = videoFormat === 'youtube';
        const width = isYoutube ? 1920 : 1080;
        const height = isYoutube ? 1080 : 1920;

        console.log(`🔧 FFmpeg paths:\n  Video: ${normalizedVideoPath}\n  Audio: ${normalizedAudioPath || 'none'}\n  Output: ${normalizedOutputPath}\n  Format: ${isYoutube ? 'YouTube' : 'Shorts'} (${width}x${height})`);

        // Get actual audio duration to match video length
        let audioDuration = 45; // Default fallback
        if (normalizedAudioPath && fs.existsSync(normalizedAudioPath)) {
          try {
            const ffmpeg = require('fluent-ffmpeg');
            await new Promise((resolveProbe) => {
              ffmpeg.ffprobe(normalizedAudioPath, (err, metadata) => {
                if (!err && metadata && metadata.format && metadata.format.duration) {
                  audioDuration = parseFloat(metadata.format.duration);
                  console.log(`🎵 [Video] Audio duration: ${audioDuration.toFixed(2)}s - Video will match this length`);
                } else {
                  console.warn('⚠️ Could not get audio duration, using default 45s');
                }
                resolveProbe();
              });
            });
          } catch (e) {
            console.warn('⚠️ Error getting audio duration:', e.message);
          }
        }

        // Ensure output directory exists
        const outputDir = path.dirname(normalizedOutputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Extract script text and image count
        const scriptText = typeof script === 'string' ? script : (script?.text || script?.script || '');
        const imageCount = script?.imageCount || null;
        
        // ✅ FIX: Get actual narration duration from script OR audio file
        let providedNarrationDuration = script?.actualNarrationDuration || null;
        
        // If not provided in script, get from audio file as fallback
        if (!providedNarrationDuration && normalizedAudioPath && fs.existsSync(normalizedAudioPath)) {
          try {
            await new Promise((resolve) => {
              ffmpeg.ffprobe(normalizedAudioPath, (err, metadata) => {
                if (!err && metadata && metadata.format && metadata.format.duration) {
                  providedNarrationDuration = parseFloat(metadata.format.duration);
                  console.log(`🎤 [Narration] Duration detected from audio file: ${providedNarrationDuration.toFixed(2)}s`);
                }
                resolve();
              });
            });
          } catch (e) {
            console.warn('⚠️ [Narration] Could not detect duration from audio file');
          }
        }
        
        if (providedNarrationDuration) {
          console.log(`🎯 [Narration] Final duration: ${providedNarrationDuration.toFixed(2)}s`);
        }
        // Generate subtitles from script text (only if subtitlesEnabled is true)
        let srtPath = null;
        if (subtitlesEnabled && normalizedAudioPath && scriptText) {
          const baseName = path.basename(normalizedOutputPath, path.extname(normalizedOutputPath));
          
          // CRITICAL: Use provided narration duration if available (actual narration, not extended)
          // If not provided, get from audio file (but this might include silence padding)
          let actualAudioDuration = providedNarrationDuration;
          
          if (!actualAudioDuration) {
            try {
              const ffmpeg = require('fluent-ffmpeg');
              await new Promise((resolve) => {
                ffmpeg.ffprobe(normalizedAudioPath, (err, metadata) => {
                  if (!err && metadata && metadata.format && metadata.format.duration) {
                    actualAudioDuration = parseFloat(metadata.format.duration);
                    console.log(`🎯 [Subtitles] Audio file duration: ${actualAudioDuration.toFixed(2)}s (may include silence padding)`);
                  }
                  resolve();
                });
              });
            } catch (e) {
              console.warn('⚠️ [Subtitles] Could not get audio duration, using default timing');
            }
          } else {
            console.log(`🎯 [Subtitles] Using provided actual narration duration: ${actualAudioDuration.toFixed(2)}s (NO silence padding - PERFECT SYNC)`);
          }
          
          // Pass image count, actual narration duration, and videoFormat for perfect synchronization and format-specific styling
          srtPath = await this.generateSubtitlesFromAudio(
            normalizedAudioPath, 
            baseName, 
            scriptText, 
            imageCount,
            actualAudioDuration, // CRITICAL: Pass actual narration duration (not extended)
            videoFormat // CRITICAL: Pass videoFormat for format-specific subtitle line length
          );
          console.log(`🔤 [Subtitles] ${srtPath ? 'Generated' : 'Failed to generate'} subtitles`);
        } else if (!subtitlesEnabled) {
          console.log('🔤 [Subtitles] Disabled by user - skipping subtitle generation');
        }
        
        // Fallback to script srtPath if whisper failed (only if subtitles enabled)
        if (!srtPath && script?.srtPath && subtitlesEnabled) {
          srtPath = script.srtPath;
          console.log(`🔤 [Subtitles] Using fallback SRT from script`);
        }

        // Create FFmpeg command
        const command = ffmpeg()
          .input(normalizedVideoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            '-y',
            '-preset fast',
            '-crf 23',
            '-r 30',
            '-threads 8',                // MEMORY-OPTIMIZED: Limit threads (was 42 auto)
            `-t ${Math.ceil(audioDuration)}` // Video duration matches audio duration
          ]);

        // Build filters
        const vfChain = [];
        // Scale and pad video first - based on format
        vfChain.push(`scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease`);
        vfChain.push(`pad=w=${width}:h=${height}:x=(ow-iw)/2:y=(oh-ih)/2`);
        
        // PROFESSIONAL SUBTITLE STYLING: Different styles for YouTube vs Shorts
        // CRITICAL: Only add subtitles if subtitlesEnabled is true AND srtPath exists
        if (subtitlesEnabled && srtPath && fs.existsSync(srtPath)) {
          const absoluteSrt = path.resolve(srtPath);
          const escapedSrt = absoluteSrt.replace(/\\/g, '/').replace(/:/g, '\\\\:');
          console.log(`🔤 [Subtitle Style] Applying ${videoFormat === 'youtube' ? 'YouTube Cinematic' : 'Shorts Viral'} style`);
          console.log(`📄 [Subtitle Debug] SRT file exists: ${srtPath} (${fs.existsSync(srtPath) ? 'YES' : 'NO'})`);
          console.log(`📄 [Subtitle Debug] SRT file size: ${fs.existsSync(srtPath) ? fs.statSync(srtPath).size : 0} bytes`);
          
          if (videoFormat === 'youtube') {
            // YOUTUBE CINEMATIC STYLE (16:9): Montserrat/Bebas Neue/Lato Heavy, White text, Typewriter effect
            try {
              const assPath = path.join(this.subsDir, `subtitle_${Date.now()}.ass`);
              subtitleStyleService.convertSRTToASS_YouTube(srtPath, assPath);
              const escapedAss = path.resolve(assPath).replace(/\\/g, '/').replace(/:/g, '\\\\:');
              
              // Use ASS format with cinematic styling (typewriter, fade, keyword highlights)
              vfChain.push(`subtitles=${escapedAss}`);
              console.log(`✅ [Subtitle Style] YouTube cinematic style applied (16:9, Montserrat font, White text, Typewriter effect, Extended visibility)`);
            } catch (assError) {
              console.warn(`⚠️ [Subtitle Style] ASS conversion failed, using SRT with force_style: ${assError.message}`);
              // Fallback to SRT with YouTube cinematic style
              vfChain.push(`subtitles=${escapedSrt}:force_style='FontName=Montserrat,FontSize=48,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H59000000,Outline=2,Shadow=3,Alignment=2,MarginV=90'`);
            }
          } else {
            // SHORTS VIRAL STYLE (9:16): Anton/Poppins ExtraBold, Dynamic bounce/pop-in, Perfect sync
            // CRITICAL: Use ASS format instead of drawtext to avoid ENAMETOOLONG errors on Windows
            try {
              const assPath = path.join(this.subsDir, `subtitle_shorts_${Date.now()}.ass`);
              console.log(`📝 [Subtitle Debug] Creating ASS file: ${assPath}`);
              subtitleStyleService.convertSRTToASS_Shorts(srtPath, assPath);
              
              if (!fs.existsSync(assPath)) {
                throw new Error(`ASS file was not created: ${assPath}`);
              }
              
              const escapedAss = path.resolve(assPath).replace(/\\/g, '/').replace(/:/g, '\\\\:');
              console.log(`📝 [Subtitle Debug] ASS file created: ${assPath} (${fs.statSync(assPath).size} bytes)`);
              console.log(`📝 [Subtitle Debug] FFmpeg filter: subtitles=${escapedAss}`);
              
              // Use ASS format with viral styling (bounce/pop-in, typewriter, keyword highlights)
              vfChain.push(`subtitles=${escapedAss}`);
              console.log(`✅ [Subtitle Style] Shorts viral style applied (9:16, ASS format, Arial font size 20, MarginV=20, bounce/pop-in effect, Perfect sync with anticipation)`);
            } catch (assError) {
              console.warn(`⚠️ [Subtitle Style] ASS conversion failed, using SRT with force_style: ${assError.message}`);
              // Fallback to SRT with Shorts style - MUST match ASS file values (Alignment=2, MarginV=20, FontSize=20)
              // Using Arial font (system font) instead of Anton for better compatibility
              vfChain.push(`subtitles=${escapedSrt}:force_style='FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Outline=3,Shadow=2,Alignment=2,MarginV=20'`);
            }
          }
        } else if (subtitlesEnabled && script && script.script) {
          // fallback: simple one-line drawtext preview (only if subtitles enabled)
          const text = (script.script || '').replace(/\n/g, ' ').slice(0, 100).replace(/'/g, "\\'");
          const textColor = videoFormat === 'youtube' ? '#F4E2B8' : '#FFFFFF';
          const yPos = videoFormat === 'youtube' ? 'h-120' : 'h*0.4';
          vfChain.push(`drawtext=text='${text}':fontcolor=${textColor}:fontsize=28:box=1:boxcolor=black@0.8:boxborderw=5:x=(w-text_w)/2:y=${yPos}`);
        } else if (!subtitlesEnabled) {
          console.log('🔤 [Subtitles] Subtitles disabled - no subtitle filters added to video');
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

  /**
   * Add outro video to the end of main video with smooth transition
   * @param {string} mainVideoPath - Path to main video
   * @param {string} outputPath - Path to save final video
   * @param {string} videoFormat - 'youtube' or 'shorts'
   * @returns {Promise<string>} Path to final video
   */
  async addOutroVideo(mainVideoPath, outputPath, videoFormat = 'shorts', narrationDuration = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const outroDir = path.join(__dirname, '..', 'temp', 'video_outro');
        // Select outro video based on format: YouTube uses "Youtube Kapanış.mp4", Shorts uses "Youtube Kapanış Shorts.mp4"
        const outroFileName = videoFormat === 'youtube' 
          ? 'Youtube Kapanış.mp4' 
          : 'Youtube Kapanış Shorts.mp4';
        const outroPath = path.join(outroDir, outroFileName);

        // Check if outro exists
        if (!fs.existsSync(outroPath)) {
          console.warn(`⚠️ [Outro] Outro video not found: ${outroPath}, skipping outro addition`);
          // If outro doesn't exist, just copy main video to output
          fs.copyFileSync(mainVideoPath, outputPath);
          resolve(outputPath);
          return;
        }

        console.log(`🎬 [Outro] Found outro video: ${outroFileName}`);

        // Get video durations
        const mainDuration = await this.getVideoDuration(mainVideoPath);
        const outroDuration = await this.getVideoDuration(outroPath);
        
        console.log(`📊 [Outro] Main video: ${mainDuration.toFixed(2)}s, Outro: ${outroDuration.toFixed(2)}s`);
        if (narrationDuration) {
          console.log(`🎤 [Outro] Narration ends at: ${narrationDuration.toFixed(2)}s`);
        }

        // Determine resolution based on format
        const isYoutube = videoFormat === 'youtube';
        const width = isYoutube ? 1920 : 1080;
        const height = isYoutube ? 1080 : 1920;

        // CRITICAL: Scale videos to match format first (before concat)
        // This ensures both videos have same resolution and prevents black frames
        console.log(`🎬 [Outro] Scaling videos to ${width}x${height}...`);
        const mainVideoScaled = path.join(this.outputDir, `main_scaled_${Date.now()}.mp4`);
        await this.scaleVideo(mainVideoPath, mainVideoScaled, width, height);
        
        const outroVideoScaled = path.join(this.outputDir, `outro_scaled_${Date.now()}.mp4`);
        await this.scaleVideo(outroPath, outroVideoScaled, width, height);

        // Get scaled video durations (may differ slightly from original)
        const scaledMainDuration = await this.getVideoDuration(mainVideoScaled);
        const scaledOutroDuration = await this.getVideoDuration(outroVideoScaled);
        
        // ✅ FIX: Narrasyon bittikten SONRA fade başlamalı
        const fadeOutDuration = 3; // Daha kısa fade (3s)

        let fadeOutStart;
        if (narrationDuration && narrationDuration > 0 && narrationDuration < scaledMainDuration) {
          // CRITICAL: Video fade MUST start AFTER narration ends
          // Add 0.3s buffer to ensure narration fully completes
          const postNarrationBuffer = 0.5;
          const minFadeStart = narrationDuration + postNarrationBuffer;
          
          // Ensure there's enough time for fade
          const timeLeftAfterNarration = scaledMainDuration - minFadeStart;
          
          if (timeLeftAfterNarration >= fadeOutDuration) {
            // Enough time: start fade after narration + buffer
            fadeOutStart = minFadeStart;
          } else if (timeLeftAfterNarration > 0.5) {
            // Limited time: start fade immediately after narration
            fadeOutStart = narrationDuration;
          } else {
            // Not enough time: don't fade (outro will start immediately)
            fadeOutStart = scaledMainDuration - 0.1;
          }
          
          console.log(`🎤 [Outro] Narration ends: ${narrationDuration.toFixed(2)}s`);
          console.log(`🎬 [Outro] Video fade starts: ${fadeOutStart.toFixed(2)}s (${(fadeOutStart - narrationDuration).toFixed(2)}s after narration)`);
        } else {
          // Fallback: Old method
          fadeOutStart = Math.max(0, scaledMainDuration - fadeOutDuration - 0.5);
        }
        
        // Crossfade transition duration (video fade-in for outro)
        const crossfadeDuration = 1.5;
        
        console.log(`📊 [Outro] Fade timing - Start: ${fadeOutStart.toFixed(2)}s, Duration: ${fadeOutDuration.toFixed(2)}s`);

        // Step 3: Concatenate videos with fade effects applied during concat
        // Pass narration duration for intelligent audio fade timing
        await this.concatVideosWithFade(mainVideoScaled, outroVideoScaled, outputPath, fadeOutStart, fadeOutDuration, crossfadeDuration, narrationDuration);

        // Cleanup temporary files
        try {
          if (fs.existsSync(mainVideoScaled) && mainVideoScaled !== outputPath) fs.unlinkSync(mainVideoScaled);
          if (fs.existsSync(outroVideoScaled) && outroVideoScaled !== outputPath) fs.unlinkSync(outroVideoScaled);
        } catch (cleanupErr) {
          console.warn('⚠️ [Outro] Cleanup warning:', cleanupErr.message);
        }

        console.log(`✅ [Outro] Successfully added outro with smooth transition`);
        resolve(outputPath);

      } catch (error) {
        console.error('❌ [Outro] Failed to add outro:', error);
        // Fallback: return main video if outro fails
        try {
          fs.copyFileSync(mainVideoPath, outputPath);
          resolve(outputPath);
        } catch (copyErr) {
          reject(new Error(`Failed to add outro and fallback failed: ${error.message}`));
        }
      }
    });
  }

  /**
   * Get video duration using ffprobe
   */
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err || !metadata || !metadata.format || !metadata.format.duration) {
          reject(new Error(`Could not get video duration: ${err?.message || 'Unknown error'}`));
          return;
        }
        resolve(parseFloat(metadata.format.duration));
      });
    });
  }

  /**
   * Scale video to target resolution (no fade, just scaling)
   */
  async scaleVideo(inputPath, outputPath, width, height) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([
          `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease`,
          `pad=w=${width}:h=${height}:x=(ow-iw)/2:y=(oh-ih)/2`,
          `setsar=1:1` // CRITICAL: Normalize SAR to prevent concat errors
        ])
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p', // CRITICAL: Ensure consistent pixel format
          '-vsync cfr', // CRITICAL: Constant frame rate for compatibility
          '-y'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Concatenate videos with fade effects applied during concat
   * This prevents black frames and ensures smooth transition
   */
  async concatVideosWithFade(mainPath, outroPath, outputPath, fadeOutStart, fadeOutDuration, fadeInDuration, narrationDuration = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get durations (should match scaled video durations)
        const mainDuration = await this.getVideoDuration(mainPath);
        const outroDuration = await this.getVideoDuration(outroPath);
        
        console.log(`📊 [Outro] Durations - Main: ${mainDuration.toFixed(2)}s, Outro: ${outroDuration.toFixed(2)}s`);
        
        // CRITICAL: Validate fade timing to prevent black frames
        // Ensure fadeOutStart is within video duration
        const safeFadeOutStart = Math.max(0, Math.min(fadeOutStart, mainDuration - 0.5));
        const safeFadeOutDuration = Math.min(fadeOutDuration, mainDuration - safeFadeOutStart);
        
        // PROFESSIONAL FIX: Intelligent audio fade timing based on narration
        // If narration duration is known:
        //   1. Narration ends at narrationDuration
        //   2. Let music play alone for 2-3 seconds (post-script pause)
        //   3. Then fade out music over 3 seconds
        // If narration duration is unknown, use old method (fade 3s before video end)
        let mainAudioFadeStart;
        let mainAudioFadeDuration;
        
        if (narrationDuration && narrationDuration > 0 && narrationDuration < mainDuration) {
          // PROFESSIONAL: Post-script music pause
          const postScriptMusicPause = 4.0; // 2.5 seconds of music after narration ends
          const audioFadeDuration = 4.5; // 4.5 seconds fade out
          
          mainAudioFadeStart = narrationDuration + postScriptMusicPause;
          mainAudioFadeDuration = audioFadeDuration;
          
          // Ensure fade doesn't exceed video duration
          if (mainAudioFadeStart + mainAudioFadeDuration > mainDuration) {
            // Adjust if not enough time left
            const timeLeft = mainDuration - narrationDuration;
            if (timeLeft > 3) {
              // Enough time for pause + fade
              mainAudioFadeStart = mainDuration - audioFadeDuration;
              mainAudioFadeDuration = audioFadeDuration;
            } else {
              // Not enough time, fade immediately after narration
              mainAudioFadeStart = narrationDuration;
              mainAudioFadeDuration = Math.max(1, timeLeft);
            }
          }
          
          console.log(`🎤 [Outro] Narration ends: ${narrationDuration.toFixed(2)}s`);
          console.log(`🎵 [Outro] Post-script music pause: ${postScriptMusicPause.toFixed(1)}s`);
        } else {
          // Fallback: Old method (fade 3 seconds before end)
          mainAudioFadeStart = Math.max(0, mainDuration - 3);
          mainAudioFadeDuration = Math.min(3, mainDuration - mainAudioFadeStart);
        }
        
        console.log(`🎬 [Outro] Video fade - Start: ${safeFadeOutStart.toFixed(2)}s, Duration: ${safeFadeOutDuration.toFixed(2)}s`);
        console.log(`🎵 [Outro] Audio fade - Start: ${mainAudioFadeStart.toFixed(2)}s, Duration: ${mainAudioFadeDuration.toFixed(2)}s`);
        
        // Create complex filter with fade effects applied during concat
        // CRITICAL: Normalize SAR and pixel format before concat to prevent errors
        const filterComplex = [
          // Video: Normalize SAR, apply fade-out to main, then setpts
          `[0:v]setsar=1:1,fade=t=out:st=${safeFadeOutStart}:d=${safeFadeOutDuration},setpts=PTS-STARTPTS[v0]`,
          // Video: Normalize SAR, apply fade-in to outro, then setpts
          `[1:v]setsar=1:1,fade=t=in:st=0:d=${fadeInDuration},setpts=PTS-STARTPTS[v1]`,
          // Concatenate videos (SAR must match - now both are 1:1)
          `[v0][v1]concat=n=2:v=1:a=0[vout]`,
          // Audio: Fade out main video audio, outro audio at normal volume
          `[0:a]afade=t=out:st=${mainAudioFadeStart}:d=${mainAudioFadeDuration},asetpts=PTS-STARTPTS[a0]`,
          `[1:a]asetpts=PTS-STARTPTS[a1]`,
          // Concatenate audio streams sequentially
          `[a0][a1]concat=n=2:v=0:a=1[aout]`
        ].join(';');

        ffmpeg()
          .input(mainPath)
          .input(outroPath)
          .complexFilter(filterComplex)
          .outputOptions([
            '-map [vout]',
            '-map [aout]',
            '-c:v libx264',
            '-c:a aac',
            '-preset fast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-y'
          ])
          .output(outputPath)
          .on('start', (cmd) => {
            console.log(`🎬 [Outro] Concatenating videos with fade effects (main: ${mainDuration.toFixed(2)}s + outro: ${outroDuration.toFixed(2)}s)...`);
          })
          .on('end', () => {
            console.log(`✅ [Outro] Videos concatenated successfully`);
            resolve(outputPath);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('❌ [Outro] Concatenation error:', err.message);
            console.error('FFmpeg stderr:', stderr);
            // Fallback to simple concat
            console.log('🔄 [Outro] Falling back to simple concat...');
            this.simpleConcatVideos(mainPath, outroPath, outputPath)
              .then(resolve)
              .catch(reject);
          })
          .run();
      } catch (error) {
        console.error('❌ [Outro] Error in concatVideosWithFade:', error);
        // Fallback to simple concat
        this.simpleConcatVideos(mainPath, outroPath, outputPath)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  /**
   * Simple concat fallback (no audio mixing, no fade effects)
   * Used when complex filter fails
   */
  async simpleConcatVideos(mainPath, outroPath, outputPath) {
    return new Promise((resolve, reject) => {
      const fileListPath = path.join(this.outputDir, `concat_list_${Date.now()}.txt`);
      // Use absolute paths and escape single quotes for FFmpeg concat
      const mainAbsPath = path.resolve(mainPath).replace(/\\/g, '/').replace(/'/g, "\\'");
      const outroAbsPath = path.resolve(outroPath).replace(/\\/g, '/').replace(/'/g, "\\'");
      const fileListContent = `file '${mainAbsPath}'\nfile '${outroAbsPath}'`;
      fs.writeFileSync(fileListPath, fileListContent, 'utf-8');

      console.log(`🔄 [Outro] Using simple concat fallback...`);

      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-avoid_negative_ts', 'make_zero', // Prevent timing issues
          '-y'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`🎬 [Outro] Simple concat started...`);
        })
        .on('end', () => {
          try {
            if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
          } catch (e) {}
          console.log(`✅ [Outro] Simple concat completed`);
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ [Outro] Simple concat error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          try {
            if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
          } catch (e) {}
          reject(err);
        })
        .run();
    });
  }

  // Helper: Calculate optimal duration based on video length
  calculateOptimalDuration(targetDuration, totalClips, transitionTime) {
    if (targetDuration <= 30) {
      // 15-30s videos: 4-6 seconds per clip (fast-paced)
      return Math.max(4, Math.min(6, (targetDuration - (totalClips - 1) * transitionTime) / totalClips));
    } else if (targetDuration <= 45) {
      // 30-45s videos: 5-7 seconds per clip
      return Math.max(5, Math.min(7, (targetDuration - (totalClips - 1) * transitionTime) / totalClips));
    } else if (targetDuration <= 60) {
      // 45-60s videos: 5-7 seconds per clip
      return Math.max(5, Math.min(7, (targetDuration - (totalClips - 1) * transitionTime) / totalClips));
    } else if (targetDuration <= 90) {
      // 60-90s videos: 5-7 seconds per clip
      return Math.max(5, Math.min(7, (targetDuration - (totalClips - 1) * transitionTime) / totalClips));
    } else {
      // 90s+ videos (2+ minutes): 5-8 seconds per clip (optimal for engagement)
      return Math.max(5, Math.min(8, (targetDuration - (totalClips - 1) * transitionTime) / totalClips));
    }
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