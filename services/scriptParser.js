const fs = require('fs');

/**
 * Professional Script Parser
 * Supports two formats:
 * 1. Scene-based: [1] Text... [2] Text... (for image-script synchronization)
 * 2. Paragraph-based: Normal text (existing behavior)
 */
class ScriptParser {
  /**
   * Parse script into scenes or sentences
   * @param {string} scriptText - The script text
   * @returns {Object} { format: 'scene'|'paragraph', scenes: [...], text: '...' }
   */
  static parseScript(scriptText) {
    if (!scriptText || typeof scriptText !== 'string') {
      return { format: 'paragraph', scenes: [], text: scriptText || '' };
    }

    // Check if script is in scene-based format [1], [2], etc.
    const scenePattern = /\[(\d+)\]\s*(.+?)(?=\[(\d+)\]|$)/gs;
    const sceneMatches = [...scriptText.matchAll(scenePattern)];

    if (sceneMatches.length > 0) {
      // Scene-based format detected
      const scenes = sceneMatches.map((match, index) => {
        const sceneNumber = parseInt(match[1]);
        const sceneText = match[2].trim();
        return {
          number: sceneNumber,
          text: sceneText,
          index: index
        };
      });

      // Extract clean text (without scene markers) for TTS
      const cleanText = scenes.map(s => s.text).join(' ');

      console.log(`📝 [Script Parser] Scene-based format detected: ${scenes.length} scenes`);
      return {
        format: 'scene',
        scenes: scenes,
        text: cleanText,
        sceneCount: scenes.length
      };
    } else {
      // Paragraph-based format (existing behavior)
      const sentences = scriptText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      console.log(`📝 [Script Parser] Paragraph-based format detected: ${sentences.length} sentences`);
      return {
        format: 'paragraph',
        scenes: [],
        text: scriptText,
        sentenceCount: sentences.length
      };
    }
  }

  /**
   * Calculate timing for each scene based on ACTUAL AUDIO TIMING from Whisper
   * This is the PRIMARY method - uses real word-level timestamps from TTS audio
   * @param {Array} scenes - Array of scene objects  
   * @param {Array} whisperWords - Word-level timestamps from Faster-Whisper
   * @param {number} audioDuration - Total audio duration
   * @returns {Array} Scenes with REAL timing information from audio
   */
  static calculateSceneTimingFromAudio(scenes, whisperWords, audioDuration) {
    if (!scenes || scenes.length === 0) {
      console.warn('⚠️ [Script Parser] No scenes provided');
      return [];
    }

    if (!whisperWords || whisperWords.length === 0) {
      console.warn('⚠️ [Script Parser] No Whisper word timing available, falling back to equal distribution');
      return this.calculateSceneTiming(scenes, audioDuration, scenes.length);
    }

    console.log(`\n🎤 [Audio-Based Scene Timing]:`);
    console.log(`   Total scenes: ${scenes.length}`);
    console.log(`   Whisper words: ${whisperWords.length}`);
    console.log(`   Audio duration: ${audioDuration.toFixed(2)}s`);

    const transitionTime = 0.4;
    const scenesWithTiming = [];

    // CRITICAL FIX: Calculate expected word positions for each scene
    // This prevents scene word matching from "jumping" across the audio
    const totalScriptWords = scenes.reduce((sum, s) => {
      return sum + s.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    }, 0);
    
    console.log(`\n🎯 [Word Matching] Total script words: ${totalScriptWords}, Whisper words: ${whisperWords.length}`);
    
    // For each scene, find its words in the Whisper timing data
    let cumulativeScriptWords = 0;

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene = scenes[sceneIdx];
      
      // Clean and normalize scene text for matching
      const sceneWords = scene.text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(w => w.length > 0);

      console.log(`\n📝 Scene ${sceneIdx + 1}: "${scene.text.substring(0, 50)}..."`);
      console.log(`   Looking for ${sceneWords.length} words...`);

      // CRITICAL: Calculate expected search region in Whisper data
      // This prevents scenes from matching words from OTHER scenes
      const expectedStartRatio = cumulativeScriptWords / totalScriptWords;
      const expectedEndRatio = (cumulativeScriptWords + sceneWords.length) / totalScriptWords;
      
      const searchWindowStart = Math.floor(expectedStartRatio * whisperWords.length);
      // CRITICAL FIX: Tighter tolerance - only +5 words (not +20) to prevent overlap
      // This ensures Scene 9 doesn't steal words from Scene 10!
      const searchWindowEnd = Math.min(
        Math.ceil(expectedEndRatio * whisperWords.length) + 5, // +5 tolerance (was +20)
        whisperWords.length
      );
      
      console.log(`   🎯 Search window: ${searchWindowStart} → ${searchWindowEnd} (${searchWindowEnd - searchWindowStart} words)`);

      // Find matching words in Whisper data WITHIN the expected window
      const matchedWords = [];
      let searchStart = searchWindowStart;

      for (let i = 0; i < sceneWords.length && searchStart < searchWindowEnd; i++) {
        const targetWord = sceneWords[i];
        
        // Search forward in Whisper data for this word (WITHIN WINDOW)
        for (let j = searchStart; j < searchWindowEnd; j++) {
          const whisperWord = whisperWords[j].word.toLowerCase().replace(/[^\w]/g, '');
          
          if (whisperWord === targetWord || whisperWord.includes(targetWord) || targetWord.includes(whisperWord)) {
            matchedWords.push(whisperWords[j]);
            searchStart = j + 1;
            break;
          }
        }
      }
      
      // Update cumulative word count for next scene
      cumulativeScriptWords += sceneWords.length;

      if (matchedWords.length > 0) {
        // Calculate scene duration from first to last matched word
        let startTime = matchedWords[0].start;
        let endTime = matchedWords[matchedWords.length - 1].end;
        let audioDurationForScene = endTime - startTime;
        
        const matchQuality = matchedWords.length / sceneWords.length;
        
        // CRITICAL FIX: If match quality is poor (< 70%), use PROPORTIONAL estimate
        if (matchQuality < 0.7) {
          console.warn(`   ⚠️  LOW MATCH QUALITY: ${(matchQuality * 100).toFixed(0)}% (${matchedWords.length}/${sceneWords.length})`);
          
          // CRITICAL: Use proportional duration based on word count, NOT window end!
          // Calculate expected duration for this scene based on total audio
          const totalWords = scenes.reduce((sum, s) => {
            const words = s.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
            return sum + words.length;
          }, 0);
          
          const sceneProportion = sceneWords.length / totalWords;
          const expectedDuration = sceneProportion * audioDuration;
          
          // Start from previous scene's end (if exists) OR use matched start time
          startTime = scenesWithTiming.length > 0 
            ? Math.max(matchedWords[0].start, scenesWithTiming[scenesWithTiming.length - 1].endTime + 0.1)
            : matchedWords[0].start;
          
          endTime = startTime + expectedDuration;
          audioDurationForScene = expectedDuration;
          
          console.log(`   🔧 USING PROPORTIONAL ESTIMATE: ${sceneWords.length}/${totalWords} words = ${expectedDuration.toFixed(2)}s`);
          console.log(`   🔧 New timing: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s`);
        } else {
          // GOOD MATCH: Use Whisper timings BUT enforce sequential constraint
          if (scenesWithTiming.length > 0) {
            const prevScene = scenesWithTiming[scenesWithTiming.length - 1];
            const minStartTime = prevScene.endTime + 0.1;
            
            if (startTime < minStartTime) {
              // CRITICAL: Whisper timing overlaps with previous scene!
              // Shift startTime forward and preserve duration
              console.warn(`   ⚠️  OVERLAP: Whisper says ${startTime.toFixed(2)}s but prev ends at ${prevScene.endTime.toFixed(2)}s`);
              startTime = minStartTime;
              endTime = startTime + Math.max(audioDurationForScene, 2.0); // Keep original duration, min 2s
              audioDurationForScene = endTime - startTime;
              console.log(`   🔧 CORRECTED: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s (duration: ${audioDurationForScene.toFixed(2)}s)`);
            }
          }
        }
        
        // Ensure minimum duration
        audioDurationForScene = Math.max(audioDurationForScene, 2.0);
        
        // CRITICAL FIX: Add transition time to duration (except for last scene)
        // This ensures the image stays on screen during the transition to the next image
        // Example: If scene audio is 7.2s and transition is 0.4s, image should be 7.6s
        // So that when next image starts fading in at 7.2s, current image is still fully visible
        const isLastScene = sceneIdx === scenes.length - 1;
        const duration = isLastScene ? audioDurationForScene : audioDurationForScene + transitionTime;

        scenesWithTiming.push({
          ...scene,
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          audioDuration: audioDurationForScene, // Store original audio duration for reference
          matchedWords: matchedWords.length,
          matchQuality: matchQuality
        });

        console.log(`   ✅ Matched ${matchedWords.length}/${sceneWords.length} words (${(matchQuality * 100).toFixed(0)}%)`);
        console.log(`   ⏱️  Audio: ${audioDurationForScene.toFixed(2)}s (${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s)`);
        console.log(`   🎬 Image Duration: ${duration.toFixed(2)}s ${isLastScene ? '(last scene)' : `(+${transitionTime}s transition)`}`);
      } else {
        console.warn(`   ⚠️ No words matched for scene ${sceneIdx + 1}, using PROPORTIONAL fallback`);
        
        // CRITICAL: Use proportional duration based on word count
        const totalWords = scenes.reduce((sum, s) => {
          const words = s.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
          return sum + words.length;
        }, 0);
        
        const sceneProportion = sceneWords.length / totalWords;
        const estimatedAudioDuration = Math.max(sceneProportion * audioDuration, 2.0); // Min 2s
        
        // Start from previous scene's end (if exists)
        const startTime = scenesWithTiming.length > 0 
          ? scenesWithTiming[scenesWithTiming.length - 1].endTime + 0.1
          : 0;
        
        const endTime = startTime + estimatedAudioDuration;
        
        // CRITICAL FIX: Add transition time for non-last scenes
        const isLastScene = sceneIdx === scenes.length - 1;
        const duration = isLastScene ? estimatedAudioDuration : estimatedAudioDuration + transitionTime;
        
        scenesWithTiming.push({
          ...scene,
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          audioDuration: estimatedAudioDuration,
          matchedWords: 0,
          matchQuality: 0
        });
        
        console.log(`   🔧 PROPORTIONAL FALLBACK: ${sceneWords.length}/${totalWords} words = ${estimatedAudioDuration.toFixed(2)}s`);
        console.log(`   ⏱️  Audio: ${estimatedAudioDuration.toFixed(2)}s (${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s)`);
        console.log(`   🎬 Image: ${duration.toFixed(2)}s ${isLastScene ? '(last)' : `(+${transitionTime}s)`}`);
      }
    }

    // Print summary with overlap detection
    // CRITICAL: FINAL PASS - Fix ANY remaining overlaps (should be rare but ensure 100% sequential)
    console.log(`\n🔧 [Final Sequential Check] Ensuring perfect timing...`);
    for (let idx = 1; idx < scenesWithTiming.length; idx++) {
      const prevScene = scenesWithTiming[idx - 1];
      const currentScene = scenesWithTiming[idx];
      const minStartTime = prevScene.endTime + 0.1;
      
      if (currentScene.startTime < minStartTime) {
        console.warn(`   ⚠️  FINAL FIX: Scene ${idx + 1} starts at ${currentScene.startTime.toFixed(2)}s, but Scene ${idx} ends at ${prevScene.endTime.toFixed(2)}s`);
        
        // Preserve original duration if possible
        const originalDuration = currentScene.endTime - currentScene.startTime;
        currentScene.startTime = minStartTime;
        currentScene.endTime = minStartTime + Math.max(originalDuration, 2.0);
        currentScene.audioDuration = currentScene.endTime - currentScene.startTime;
        
        // Recalculate display duration with transition
        const isLastScene = idx === scenesWithTiming.length - 1;
        currentScene.duration = isLastScene ? currentScene.audioDuration : currentScene.audioDuration + transitionTime;
        
        console.log(`   ✅ CORRECTED: Scene ${idx + 1} now ${currentScene.startTime.toFixed(2)}s → ${currentScene.endTime.toFixed(2)}s (${currentScene.duration.toFixed(2)}s display)`);
      }
    }
    
    console.log(`\n📊 [Audio-Based Timing Summary]:`);
    scenesWithTiming.forEach((scene, idx) => {
      const matchRate = scene.matchedWords > 0 ? '✅' : '⚠️';
      const qualityIndicator = scene.matchQuality >= 0.8 ? '' : scene.matchQuality >= 0.5 ? ' (partial)' : ' (fallback)';
      console.log(`   ${matchRate} Scene ${idx + 1}: ${scene.duration.toFixed(2)}s (${scene.startTime.toFixed(2)}s → ${scene.endTime.toFixed(2)}s)${qualityIndicator}`);
    });

    const totalSceneDuration = scenesWithTiming.reduce((sum, s) => sum + s.duration, 0);
    const coverage = (totalSceneDuration / audioDuration) * 100;
    console.log(`   Total coverage: ${coverage.toFixed(1)}% of audio (${totalSceneDuration.toFixed(2)}s / ${audioDuration.toFixed(2)}s)`);
    console.log(`   ✅ GUARANTEED: All scenes are perfectly sequential (no overlaps possible)`);
    console.log('');

    return scenesWithTiming;
  }

  /**
   * Calculate timing for each scene based on word count (PROPORTIONAL)
   * FALLBACK method when Whisper timing is not available
   * @param {Array} scenes - Array of scene objects
   * @param {number} totalDuration - Total video duration in seconds
   * @param {number} imageCount - Number of images (should match scene count)
   * @returns {Array} Scenes with timing information
   */
  static calculateSceneTiming(scenes, totalDuration, imageCount) {
    if (!scenes || scenes.length === 0) {
      return [];
    }

    const transitionTime = 0.4; // Transition between scenes
    const totalTransitionTime = (scenes.length - 1) * transitionTime;
    const availableTime = totalDuration - totalTransitionTime;
    
    // CRITICAL: Calculate PROPORTIONAL durations based on word count
    // Count words in each scene
    const sceneWordCounts = scenes.map(scene => {
      const words = scene.text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0);
      return words.length;
    });
    
    const totalWords = sceneWordCounts.reduce((sum, count) => sum + count, 0);
    
    console.log(`📊 [Proportional Timing] Total words: ${totalWords}, Available time: ${availableTime.toFixed(2)}s`);
    
    // Calculate duration for each scene based on word proportion
    let cumulativeTime = 0;
    const scenesWithTiming = scenes.map((scene, index) => {
      const wordCount = sceneWordCounts[index];
      const proportion = wordCount / totalWords;
      
      // CRITICAL: Calculate raw proportional duration
      let audioDuration = proportion * availableTime;
      
      // CRITICAL: Ensure minimum duration of 2 seconds, but check if we have enough time
      const remainingTime = totalDuration - cumulativeTime;
      const minDuration = 2.0;
      const maxDuration = 12.0;
      
      // If this is the last scene, use all remaining time (minus a small buffer)
      const isLastScene = index === scenes.length - 1;
      if (isLastScene) {
        audioDuration = Math.max(minDuration, Math.min(remainingTime - 0.5, maxDuration));
      } else {
        // For other scenes, respect min/max but ensure we don't overshoot
        audioDuration = Math.max(minDuration, Math.min(audioDuration, maxDuration, remainingTime - minDuration));
      }
      
      const startTime = cumulativeTime;
      const endTime = startTime + audioDuration;
      
      // Add transition time for display duration (except last scene)
      const displayDuration = isLastScene ? audioDuration : audioDuration + transitionTime;
      
      // Update cumulative time (including transition for non-last scenes)
      cumulativeTime = endTime + (isLastScene ? 0 : transitionTime);
      
      console.log(`   📸 Scene ${index + 1}: ${wordCount} words (${(proportion * 100).toFixed(1)}%) → ${audioDuration.toFixed(2)}s audio, ${displayDuration.toFixed(2)}s display`);
      
      return {
        ...scene,
        startTime: startTime,
        endTime: endTime,
        audioDuration: audioDuration,
        duration: displayDuration, // This is what gets used for image clip duration
        wordCount: wordCount,
        proportion: proportion
      };
    });

    console.log(`\n⏱️  [Script Parser] PROPORTIONAL scene timing calculated:`);
    console.log(`   Total scenes: ${scenesWithTiming.length}`);
    console.log(`   Total words: ${totalWords}`);
    console.log(`   Available time: ${availableTime.toFixed(2)}s`);
    console.log(`   Total calculated: ${cumulativeTime.toFixed(2)}s`);
    console.log(`   Duration range: ${Math.min(...scenesWithTiming.map(s => s.duration)).toFixed(2)}s - ${Math.max(...scenesWithTiming.map(s => s.duration)).toFixed(2)}s`);
    
    return scenesWithTiming;
  }

  /**
   * Generate SRT content from scenes with timing
   * @param {Array} scenesWithTiming - Scenes with timing information
   * @returns {string} SRT content
   */
  static generateSRTFromScenes(scenesWithTiming) {
    let srtContent = '';
    
    scenesWithTiming.forEach((scene, index) => {
      const subtitleIndex = index + 1;
      const startTime = this.formatSRTTime(scene.startTime);
      const endTime = this.formatSRTTime(scene.endTime);
      
      // Split long scene text into smaller chunks if needed
      const words = scene.text.split(/\s+/);
      if (words.length <= 8) {
        // Short scene - show as one subtitle
        srtContent += `${subtitleIndex}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${scene.text}\n\n`;
      } else {
        // Long scene - split into 2-3 word chunks
        const chunkSize = 3;
        const chunkDuration = scene.duration / Math.ceil(words.length / chunkSize);
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ');
          const chunkStart = scene.startTime + (i / words.length) * scene.duration;
          const chunkEnd = Math.min(chunkStart + chunkDuration, scene.endTime);
          
          srtContent += `${subtitleIndex * 10 + Math.floor(i / chunkSize) + 1}\n`;
          srtContent += `${this.formatSRTTime(chunkStart)} --> ${this.formatSRTTime(chunkEnd)}\n`;
          srtContent += `${chunk}\n\n`;
        }
      }
    });

    return srtContent;
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  static formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 60 - secs) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }
}

module.exports = ScriptParser;

