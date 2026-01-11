const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ScriptParser = require('./scriptParser');

class WhisperService {
  constructor() {
    this.whisperPath = process.env.WHISPER_PATH || 'whisper';
    this.modelPath = process.env.WHISPER_MODEL_PATH || './models/whisper-base.en';
    // Cache availability check to avoid repeated slow checks
    this._whisperAvailableCache = null;
    this._whisperAvailableCacheTime = 0;
  }

  /**
   * Script içeriğinden otomatik dil tespiti
   * Desteklenen diller: Türkçe (tr), İngilizce (en), İspanyolca (es), Almanca (de), Fransızca (fr)
   * Dil tespiti yapılamazsa null döner (Whisper auto-detect kullanır)
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return null; // Auto-detect
    }
    
    // Türkçe karakterler: ç, ğ, ı, ö, ş, ü, İ
    const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
    if (turkishChars.test(text)) {
      return 'tr';
    }
    
    // İspanyolca karakterler: ñ, ¿, ¡, á, é, í, ó, ú
    const spanishChars = /[ñ¿¡áéíóúÑÁÉÍÓÚ]/;
    if (spanishChars.test(text)) {
      return 'es';
    }
    
    // Almanca karakterler: ä, ö, ü, ß
    const germanChars = /[äöüßÄÖÜ]/;
    if (germanChars.test(text)) {
      return 'de';
    }
    
    // Fransızca karakterler: é, è, ê, ë, à, â, ù, û, ç, œ, æ
    const frenchChars = /[éèêëàâùûœæÉÈÊËÀÂÙÛŒÆ]/;
    if (frenchChars.test(text)) {
      return 'fr';
    }
    
    // İngilizce için: Yaygın İngilizce kelimeler kontrolü
    // Bu, ASCII-only metinlerde İngilizce tespiti için yardımcı olur
    const englishCommonWords = /\b(the|is|are|was|were|have|has|had|will|would|could|should|can|may|might|must|shall|do|does|did|been|being|be|a|an|and|or|but|if|then|else|when|where|what|which|who|whom|whose|why|how|this|that|these|those|it|its|you|your|we|our|they|their|he|his|she|her|I|my|me)\b/gi;
    const matches = text.match(englishCommonWords);
    const wordCount = text.split(/\s+/).length;
    
    // Eğer metnin %15'inden fazlası yaygın İngilizce kelimelerden oluşuyorsa
    if (matches && matches.length / wordCount > 0.15) {
      return 'en';
    }
    
    // Dil tespit edilemezse Whisper'ın auto-detect özelliğini kullan
    return null;
  }

  async transcribeAudio(audioPath, baseName, scriptText = null, imageCount = null, audioDuration = null, videoFormat = 'shorts') {
    try {
      console.log('🎤 [Whisper] Starting audio transcription...');
      
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Save SRT in temp/audio directory (same as audio files)
      const audioDir = path.join(process.cwd(), 'temp', 'audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      const srtPath = path.join(audioDir, `${baseName}.srt`);

      // CRITICAL: Use actual script text for subtitles with precise audio duration
      // Pass audioDuration and videoFormat for perfect TTS synchronization and format-specific styling
      const srtContent = await this.generateSRTFromScript(scriptText, audioPath, imageCount, audioDuration, videoFormat);
        
        fs.writeFileSync(srtPath, srtContent);
      console.log('✅ [Whisper] SRT generated from script with perfect sync:', srtPath);
      return srtPath;

    } catch (error) {
      console.error('❌ [Whisper] Transcription failed:', error);
      return null;
    }
  }

  /**
   * HYBRID APPROACH: Try Whisper word-level timing first, fallback to punctuation-based timing
   * This ensures perfect synchronization with TTS audio including natural pauses
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  async generateSRTFromScript(scriptText, audioPath, imageCount = null, providedAudioDuration = null, videoFormat = 'shorts') {
    if (!scriptText) {
      scriptText = "Amazing content you need to see!";
    }
    
    // Clean script text - remove JSON artifacts
    let cleanScript = scriptText;
    if (typeof scriptText === 'object') {
      cleanScript = scriptText.script || JSON.stringify(scriptText);
    }
    
    // Remove JSON formatting if present
    cleanScript = cleanScript
      .replace(/^\{[\s\S]*"script":\s*"/m, '')
      .replace(/"[\s\S]*\}$/m, '')
      .replace(/\\n/g, ' ')
      .replace(/#\w+/g, '') // Remove hashtags from captions
      .trim();
    
    // CRITICAL: TTS already read the full script (scene markers removed)
    // So we should use the full text for subtitles to ensure perfect sync
    // Parse script to detect format, but use full text for subtitle generation
    const parsedScript = ScriptParser.parseScript(cleanScript);
    
    // CRITICAL: Use provided audio duration (from TTS) for perfect synchronization
    // If not provided, fallback to ffprobe detection
    let audioDuration = providedAudioDuration;
    
    if (!audioDuration || audioDuration <= 0) {
      // Fallback: Get audio duration using ffprobe
    try {
      if (fs.existsSync(audioPath)) {
          const ffmpeg = require('fluent-ffmpeg');
          await new Promise((resolve) => {
            ffmpeg.ffprobe(audioPath, (err, metadata) => {
              if (!err && metadata && metadata.format && metadata.format.duration) {
                audioDuration = parseFloat(metadata.format.duration);
                console.log(`📊 [Subtitles] Detected audio duration: ${audioDuration.toFixed(2)}s`);
              } else {
                try {
        const stats = fs.statSync(audioPath);
        audioDuration = Math.max(5, stats.size / 176000);
                  console.log(`📊 [Subtitles] Estimated audio duration: ${audioDuration.toFixed(2)}s`);
                } catch (statErr) {
                  console.warn('⚠️ [Subtitles] Could not get audio duration, using default 10s');
                  audioDuration = 10;
                }
              }
              resolve();
            });
          });
        }
      } catch (err) {
        console.warn('⚠️ [Subtitles] Error getting audio duration:', err.message);
        audioDuration = audioDuration || 10; // Use provided or default
      }
    } else {
      console.log(`🎯 [Subtitles] Using provided TTS audio duration: ${audioDuration.toFixed(2)}s (PERFECT SYNC)`);
    }
    
    // HYBRID APPROACH: Try Whisper word-level timing first (most accurate)
    console.log('🎯 [Subtitles] Attempting Whisper word-level timing (most accurate)...');
    let srtContent = await this.transcribeAudioWithWordTiming(audioPath, cleanScript, audioDuration, videoFormat);
    
    // Fallback to punctuation-based timing if Whisper fails
    if (!srtContent) {
      console.log('⚠️ [Subtitles] Whisper failed, using punctuation-based timing fallback...');
      srtContent = await this.punctuationBasedTiming(cleanScript, audioDuration, parsedScript, videoFormat);
    }
    
    // Final fallback to original method if both fail
    if (!srtContent) {
      console.log('⚠️ [Subtitles] All methods failed, using original word-based timing...');
      srtContent = this.generateOriginalWordBasedTiming(parsedScript, audioDuration, imageCount, videoFormat);
    }
    
    // Ensure last subtitle ends at audio duration
    if (srtContent && !srtContent.includes(this.formatSRTTime(audioDuration))) {
      // Find last subtitle and adjust end time
      const lines = srtContent.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('-->')) {
          const timeMatch = lines[i].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
          if (timeMatch) {
            lines[i] = lines[i].replace(timeMatch[2], this.formatSRTTime(audioDuration));
            srtContent = lines.join('\n');
            break;
          }
        }
      }
    }
    
    return srtContent;
  }

  /**
   * ORIGINAL FALLBACK: Word-based timing (legacy method)
   * Used when both Whisper and punctuation-based methods fail
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  generateOriginalWordBasedTiming(parsedScript, audioDuration, imageCount, videoFormat = 'shorts') {
    let srtContent = '';
    
    // SCENE-BASED FORMAT: Perfect synchronization with images
    if (parsedScript.format === 'scene' && parsedScript.scenes.length > 0) {
      console.log(`🎬 [Subtitles] Scene-based format: ${parsedScript.scenes.length} scenes`);
      
      // CRITICAL: Use parsedScript.text (full text that TTS read) for subtitles
      // parsedScript.text contains ALL scene texts joined together (scene markers removed)
      // This ensures ALL text from TTS appears in subtitles, perfectly synchronized
      const fullTextForSubtitles = parsedScript.text || cleanScript;
      
      // Split full text into sentences for better subtitle distribution
      const sentences = fullTextForSubtitles.split(/[.!?]+/).filter(s => s.trim().length > 3);
      const totalSentences = sentences.length;
      const sceneCount = parsedScript.scenes.length;
      
      // CRITICAL: Calculate timing for each scene based on ACTUAL audio duration
      // This ensures perfect synchronization with TTS audio
      const scenesWithTiming = ScriptParser.calculateSceneTiming(
        parsedScript.scenes,
        audioDuration, // Use actual TTS audio duration for perfect sync
        imageCount || sceneCount
      );
      
      console.log(`🎯 [Subtitles] Scene timing calculated for ${audioDuration.toFixed(2)}s audio (PERFECT SYNC)`);
      
      // Distribute sentences across scenes proportionally based on scene timing
      const updatedScenesWithTiming = scenesWithTiming.map((scene, sceneIndex) => {
        // Calculate how many sentences belong to this scene based on scene duration
        const sceneDuration = scene.endTime - scene.startTime;
        const totalDuration = scenesWithTiming[scenesWithTiming.length - 1].endTime;
        const sceneProgress = scene.startTime / totalDuration;
        const sceneEndProgress = scene.endTime / totalDuration;
        
        const startSentence = Math.floor(sceneProgress * totalSentences);
        const endSentence = Math.min(Math.ceil(sceneEndProgress * totalSentences), totalSentences);
        
        // Get sentences for this scene
        const sceneSentences = sentences.slice(startSentence, endSentence);
        const sceneText = sceneSentences.join('. ').trim() + (sceneSentences.length > 0 ? '.' : '');
        
        return {
          ...scene,
          text: sceneText || scene.text // Use distributed text or fallback to original
        };
      });
    
      // Generate SRT from updated scenes with full text and perfect timing
      srtContent = ScriptParser.generateSRTFromScenes(updatedScenesWithTiming);
      
      console.log(`✅ [Subtitles] Generated scene-based SRT with full TTS text (${totalSentences} sentences across ${sceneCount} scenes) - PERFECTLY SYNCED to ${audioDuration.toFixed(2)}s audio`);
    } else {
      // PARAGRAPH-BASED FORMAT: Existing behavior (sentence-based timing)
      const sentences = parsedScript.text.split(/[.!?]+/).filter(s => s.trim().length > 5);
      const words = parsedScript.text.split(/\s+/).filter(w => w.length > 0);
      
      console.log(`📝 [Subtitles] Paragraph-based format: ${sentences.length} sentences`);
      
      if (sentences.length > 0 && sentences.length <= 20) {
        // CRITICAL: Use sentence-based timing with perfect audio sync
        // Calculate timing based on actual audio duration for perfect TTS synchronization
        // Use word count per sentence for more accurate timing distribution
        const totalWords = parsedScript.text.split(/\s+/).filter(w => w.length > 0).length;
        const wordsPerSentence = sentences.map(s => s.trim().split(/\s+/).filter(w => w.length > 0).length);
        const totalWordsInSentences = wordsPerSentence.reduce((a, b) => a + b, 0);
        
        console.log(`🔤 [Subtitles] Using word-weighted sentence timing: ${totalWords} total words (PERFECT SYNC)`);
        
        let subtitleIndex = 1;
        let accumulatedTime = 0;
        
        sentences.forEach((sentence, index) => {
          const cleanSentence = sentence.trim();
          if (!cleanSentence) return;
          
          // CRITICAL: Calculate timing based on word count (more accurate than equal distribution)
          // This ensures perfect synchronization with TTS audio which reads at consistent word rate
          const sentenceWordCount = wordsPerSentence[index] || 1;
          const sentenceWeight = sentenceWordCount / totalWordsInSentences;
          const sentenceDuration = audioDuration * sentenceWeight;
          
          const startTime = accumulatedTime;
          const endTime = Math.min(accumulatedTime + sentenceDuration, audioDuration);
          accumulatedTime = endTime;
          
          // Split long sentences into smaller chunks if needed
          // CRITICAL: Different limits for YouTube (longer lines) vs Shorts (shorter lines)
          const sentenceWords = cleanSentence.split(/\s+/);
          const maxWordsPerLine = videoFormat === 'youtube' ? 15 : 8; // YouTube: 15, Shorts: 8
          const minChunkSize = videoFormat === 'youtube' ? 5 : 2; // YouTube: 5-8, Shorts: 2-4
          const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
          
          if (sentenceWords.length <= maxWordsPerLine) {
            // Short sentence - show as one subtitle
            srtContent += `${subtitleIndex}\n`;
            srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
            srtContent += `${cleanSentence}\n\n`;
            subtitleIndex++;
          } else {
            // Long sentence - split into chunks for better readability
            const chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, Math.ceil(sentenceWords.length / 3)));
            const wordsPerSecond = sentenceWordCount / sentenceDuration;
            const wordDuration = 1 / wordsPerSecond;
            
            let chunkAccumulatedTime = startTime;
            for (let i = 0; i < sentenceWords.length; i += chunkSize) {
              const chunk = sentenceWords.slice(i, i + chunkSize).join(' ');
              const chunkWordCount = Math.min(chunkSize, sentenceWords.length - i);
              
              // CRITICAL: Calculate chunk timing based on word count (more accurate)
              const chunkDuration = wordDuration * chunkWordCount;
              const chunkStart = chunkAccumulatedTime;
              const chunkEnd = Math.min(chunkAccumulatedTime + chunkDuration, endTime);
              chunkAccumulatedTime = chunkEnd;
              
              if (chunkStart < chunkEnd && chunk.trim()) {
                srtContent += `${subtitleIndex}\n`;
                srtContent += `${this.formatSRTTime(chunkStart)} --> ${this.formatSRTTime(chunkEnd)}\n`;
                srtContent += `${chunk}\n\n`;
                subtitleIndex++;
              }
            }
          }
        });
        
        console.log(`✅ [Subtitles] Generated ${subtitleIndex - 1} sentence-based subtitles perfectly synced to ${audioDuration.toFixed(2)}s audio`);
      } else {
        // CRITICAL: Use intelligent word-based timing with perfect audio sync
        // Calculate timing based on actual audio duration for perfect TTS synchronization
        const totalWords = words.length;
        const wordsPerSecond = totalWords / audioDuration;
        const wordDuration = 1 / wordsPerSecond;
        console.log(`🔤 [Subtitles] Using intelligent word-based timing: ${wordsPerSecond.toFixed(2)} words/sec (PERFECT SYNC)`);
        
        // Group words into optimal chunks - YouTube: 5-8 words, Shorts: 2-4 words
        const minChunkSize = videoFormat === 'youtube' ? 5 : 2;
        const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
        const chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, Math.ceil(wordsPerSecond * 1.5))); // 1.5 seconds per chunk
        
        let subtitleIndex = 1;
        let accumulatedTime = 0;
        
        // Distribute words evenly across audio duration for perfect sync
        for (let i = 0; i < totalWords; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ');
          const chunkWordCount = Math.min(chunkSize, totalWords - i);
          
          // CRITICAL: Calculate timing based on word count (more accurate)
          // Each word takes wordDuration seconds, so chunk takes chunkWordCount * wordDuration
          const chunkDuration = wordDuration * chunkWordCount;
          const startTime = accumulatedTime;
          const endTime = Math.min(accumulatedTime + chunkDuration, audioDuration);
          accumulatedTime = endTime;
          
          if (startTime < endTime && chunk.trim()) {
            srtContent += `${subtitleIndex}\n`;
      srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srtContent += `${chunk}\n\n`;
      
            subtitleIndex++;
          }
          
          // Ensure we don't exceed audio duration
          if (endTime >= audioDuration) break;
        }
        
        console.log(`✅ [Subtitles] Generated ${subtitleIndex - 1} word-based subtitles perfectly synced to ${audioDuration.toFixed(2)}s audio`);
      }
    }
    
    return srtContent;
  }

  /**
   * PRIMARY METHOD: Whisper word-level timing (most accurate)
   * Uses Whisper CLI to transcribe audio and extract word-level timestamps
   * This captures natural pauses at punctuation marks perfectly
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  async transcribeAudioWithWordTiming(audioPath, scriptText, audioDuration, videoFormat = 'shorts') {
    try {
      // Check if Faster-Whisper is available
      if (!this.isWhisperAvailable()) {
        console.log('⚠️ [Whisper] Faster-Whisper not available, skipping word-level timing');
        return null;
      }

      if (!fs.existsSync(audioPath)) {
        console.warn('⚠️ [Whisper] Audio file not found:', audioPath);
        return null;
      }

      console.log('🎤 [Faster-Whisper] Starting word-level transcription...');
      
      // Get Faster-Whisper Python script path
      const fasterWhisperScript = path.join(__dirname, 'faster_whisper_transcribe.py');
      if (!fs.existsSync(fasterWhisperScript)) {
        console.warn('⚠️ [Faster-Whisper] Script not found:', fasterWhisperScript);
        return null;
      }

      // Determine Python command (try venv first, then system Python)
      let pythonCmd = 'python';
      const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
      if (fs.existsSync(venvPython)) {
        pythonCmd = `"${venvPython}"`;
      } else {
        // Try to find Python in PATH
        try {
          const { execSync } = require('child_process');
          execSync('python --version', { stdio: 'ignore', timeout: 2000 });
        } catch (e) {
          console.warn('⚠️ [Faster-Whisper] Python not found in PATH');
          return null;
        }
      }

      // Get model size from env or use default
      // QUALITY UPGRADE: Use 'small' model for better non-English accuracy (was 'base')
      // 'small' model is 4x more accurate for Turkish, Arabic, etc.
      const modelSize = process.env.WHISPER_MODEL_SIZE || 'small';
      // PERFORMANCE: Use CUDA if available (RTX 4060 detected in system)
      const device = process.env.WHISPER_DEVICE || 'cuda';
      // QUALITY: Use float16 for GPU, int8 for CPU
      const computeType = process.env.WHISPER_COMPUTE_TYPE || (device === 'cuda' ? 'float16' : 'int8');
      
      // AUTOMATIC LANGUAGE DETECTION: Detect from script text for better timing accuracy
      const detectedLanguage = this.detectLanguage(scriptText);
      const whisperLanguage = detectedLanguage || 'None'; // 'None' = auto-detect
      
      // Language name mapping for better logging
      const languageNames = {
        'tr': 'Turkish',
        'en': 'English',
        'es': 'Spanish',
        'de': 'German',
        'fr': 'French'
      };
      
      if (detectedLanguage) {
        const langName = languageNames[detectedLanguage] || detectedLanguage;
        console.log(`🌍 [Faster-Whisper] Auto-detected language: ${langName} (${detectedLanguage}) from script content`);
      } else {
        console.log(`🌍 [Faster-Whisper] Using Whisper auto-detection (no specific language markers found)`);
      }
      
      return new Promise((resolve) => {
        // Run Faster-Whisper Python script
        const args = [
          fasterWhisperScript,
          audioPath,
          modelSize,
          device,
          computeType,
          whisperLanguage // Pass language parameter (None = auto-detect)
        ];

        const whisperProcess = spawn(pythonCmd, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: this.isWindows(),
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        whisperProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // CRITICAL FIX: Dynamic timeout based on audio duration
        // Long scripts can take 5-10 minutes! Use 10 minutes (600s) max timeout
        const timeoutMs = 600000; // 10 minutes - enough for ANY script length
        const timeoutHandle = setTimeout(() => {
          whisperProcess.kill();
          console.warn(`⚠️ [Faster-Whisper] Transcription timeout (${timeoutMs/1000}s)`);
          resolve(null);
        }, timeoutMs);

        whisperProcess.on('close', (code) => {
          // CRITICAL: Clear timeout when process completes
          clearTimeout(timeoutHandle);
          
          if (code !== 0) {
            console.warn(`⚠️ [Faster-Whisper] Process exited with code ${code}`);
            console.warn(`⚠️ [Faster-Whisper] stderr: ${stderr.substring(0, 500)}`);
            resolve(null);
            return;
          }

          try {
            // Parse JSON output from Faster-Whisper
            const result = JSON.parse(stdout);
            
            if (!result.success || !result.words || result.words.length === 0) {
              console.warn('⚠️ [Faster-Whisper] No words extracted:', result.error || 'Unknown error');
              resolve(null);
              return;
            }

            // Convert Faster-Whisper word-level timestamps to SRT
            const srtContent = this.convertFasterWhisperToSRT(result.words, scriptText, audioDuration, videoFormat);

            if (srtContent) {
              console.log(`✅ [Faster-Whisper] Generated ${srtContent.split('\n\n').length} subtitle entries from ${result.words.length} words`);
              resolve(srtContent);
            } else {
              console.warn('⚠️ [Faster-Whisper] Failed to convert output to SRT');
              resolve(null);
            }
          } catch (parseError) {
            console.error('❌ [Faster-Whisper] Error parsing output:', parseError.message);
            console.error('❌ [Faster-Whisper] stdout:', stdout.substring(0, 500));
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('❌ [Faster-Whisper] Word-level timing failed:', error.message);
      return null;
    }
  }

  /**
   * Convert Faster-Whisper word array to SRT format with word-level timing
   * CRITICAL: Uses script text for subtitle content, Whisper words only for timing
   * This ensures Turkish (or any language) script appears correctly in subtitles
   * @param {Array} words - Array of word objects with {word, start, end, probability} (from Whisper - used only for timing)
   * @param {string} scriptText - Original script text (used for subtitle content)
   * @param {number} audioDuration - Total audio duration
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  convertFasterWhisperToSRT(words, scriptText, audioDuration, videoFormat = 'shorts') {
    try {
      if (!words || words.length === 0) {
        return null;
      }

      // CRITICAL: Use script text for subtitle content, not Whisper words
      // This ensures Turkish script appears correctly in subtitles
      if (!scriptText || typeof scriptText !== 'string') {
        console.warn('⚠️ [Faster-Whisper] No script text provided, falling back to Whisper words');
        // Fallback to old method if no script text
        return this.convertFasterWhisperToSRT_Fallback(words, audioDuration, videoFormat);
      }

      // Split script text into words (preserve original text)
      const scriptWords = scriptText.split(/\s+/).filter(w => w.length > 0);
      
      if (scriptWords.length === 0) {
        console.warn('⚠️ [Faster-Whisper] Script text is empty, falling back to Whisper words');
        return this.convertFasterWhisperToSRT_Fallback(words, audioDuration, videoFormat);
      }

      console.log(`📝 [Faster-Whisper] Using script text for subtitles: ${scriptWords.length} words (Whisper timing: ${words.length} words)`);

      // SMART TIMING MAPPING: Handle word count differences between script and Whisper
      // This ensures perfect synchronization even when Whisper detects different word count
      const wordTimings = [];
      
      // Calculate the ratio between script words and Whisper words
      const ratio = scriptWords.length / words.length;
      
      if (ratio <= 1.5 && ratio >= 0.67) {
        // Similar word counts - use direct 1:1 mapping (best quality)
        console.log(`✅ [Faster-Whisper] Direct mapping (ratio: ${ratio.toFixed(2)}) - HIGH QUALITY`);
        for (let i = 0; i < scriptWords.length && i < words.length; i++) {
          wordTimings.push({
            word: scriptWords[i], // Use script word, not Whisper word
            start: words[i].start,
            end: words[i].end
          });
        }
        
        // Handle remaining script words if any
        if (scriptWords.length > words.length) {
          const lastTiming = words[words.length - 1];
          const remainingWords = scriptWords.length - words.length;
          const timePerWord = (audioDuration - lastTiming.end) / remainingWords;
          
          for (let i = words.length; i < scriptWords.length; i++) {
            const offset = i - words.length;
            wordTimings.push({
              word: scriptWords[i],
              start: lastTiming.end + (offset * timePerWord),
              end: lastTiming.end + ((offset + 1) * timePerWord)
            });
          }
        }
      } else {
        // Significant word count difference - use proportional mapping
        console.log(`⚠️ [Faster-Whisper] Proportional mapping (ratio: ${ratio.toFixed(2)}) - ADJUSTED`);
        
        // Map each script word to the closest Whisper timing proportionally
        for (let i = 0; i < scriptWords.length; i++) {
          // Calculate which Whisper word this script word corresponds to
          const whisperIndex = Math.min(
            Math.floor((i / scriptWords.length) * words.length),
            words.length - 1
          );
          
          // Calculate proportional timing within the audio duration
          const proportionalStart = (i / scriptWords.length) * audioDuration;
          const proportionalEnd = ((i + 1) / scriptWords.length) * audioDuration;
          
          // Use Whisper timing as base, but adjust proportionally
          const whisperTiming = words[whisperIndex];
          const blendFactor = 0.7; // 70% Whisper timing, 30% proportional
          
          wordTimings.push({
            word: scriptWords[i],
            start: (whisperTiming.start * blendFactor) + (proportionalStart * (1 - blendFactor)),
            end: (whisperTiming.end * blendFactor) + (proportionalEnd * (1 - blendFactor))
          });
        }
      }

      // Group script words into readable chunks with Whisper timing
      let srtContent = '';
      let subtitleIndex = 1;
      const minChunkSize = videoFormat === 'youtube' ? 5 : 2;
      const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
      const targetChunkDuration = videoFormat === 'youtube' ? 2.0 : 1.5; // seconds per chunk
      
      let currentChunk = [];
      let chunkStartTime = wordTimings[0]?.start || 0;
      let chunkEndTime = wordTimings[0]?.end || 0;

      for (let i = 0; i < wordTimings.length; i++) {
        const wordTiming = wordTimings[i];
        
        // Add script word to current chunk
        currentChunk.push(wordTiming.word);
        chunkEndTime = wordTiming.end;

        // Check if we should finalize this chunk
        const chunkDuration = chunkEndTime - chunkStartTime;
        const shouldFinalize = 
          currentChunk.length >= maxChunkSize || // Max words reached
          (chunkDuration >= targetChunkDuration && currentChunk.length >= minChunkSize) || // Duration reached with min words
          (i === wordTimings.length - 1); // Last word

        if (shouldFinalize) {
          const chunkText = currentChunk.join(' ');
          
          // Ensure chunk times don't exceed audio duration
          const startTime = Math.max(0, Math.min(chunkStartTime, audioDuration));
          const endTime = Math.max(startTime, Math.min(chunkEndTime, audioDuration));

          if (startTime < endTime && chunkText.trim()) {
            srtContent += `${subtitleIndex}\n`;
            srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
            srtContent += `${chunkText}\n\n`;
            subtitleIndex++;
          }

          // Reset for next chunk
          currentChunk = [];
          if (i < wordTimings.length - 1) {
            chunkStartTime = wordTimings[i + 1].start;
          }
        }
      }

      // Handle any remaining words in chunk
      if (currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        const startTime = Math.max(0, Math.min(chunkStartTime, audioDuration));
        const endTime = Math.max(startTime, Math.min(chunkEndTime, audioDuration));

        if (startTime < endTime && chunkText.trim()) {
          srtContent += `${subtitleIndex}\n`;
          srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
          srtContent += `${chunkText}\n\n`;
        }
      }

      console.log(`✅ [Faster-Whisper] Generated ${subtitleIndex - 1} subtitle entries from script text (${scriptWords.length} words)`);
      return srtContent;
    } catch (error) {
      console.error('❌ [Faster-Whisper] Error converting to SRT:', error.message);
      return null;
    }
  }

  /**
   * Fallback method: Use Whisper words directly (old behavior)
   * Used when script text is not available
   */
  convertFasterWhisperToSRT_Fallback(words, audioDuration, videoFormat = 'shorts') {
    try {
      let srtContent = '';
      let subtitleIndex = 1;

      const minChunkSize = videoFormat === 'youtube' ? 5 : 2;
      const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
      const targetChunkDuration = videoFormat === 'youtube' ? 2.0 : 1.5;
      
      let currentChunk = [];
      let chunkStartTime = words[0].start;
      let chunkEndTime = words[0].end;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordText = word.word.trim();
        
        if (!wordText) continue;

        currentChunk.push(wordText);
        chunkEndTime = word.end;

        const chunkDuration = chunkEndTime - chunkStartTime;
        const shouldFinalize = 
          currentChunk.length >= maxChunkSize ||
          (chunkDuration >= targetChunkDuration && currentChunk.length >= minChunkSize) ||
          (i === words.length - 1);

        if (shouldFinalize) {
          const chunkText = currentChunk.join(' ');
          const startTime = Math.max(0, Math.min(chunkStartTime, audioDuration));
          const endTime = Math.max(startTime, Math.min(chunkEndTime, audioDuration));

          if (startTime < endTime && chunkText.trim()) {
            srtContent += `${subtitleIndex}\n`;
            srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
            srtContent += `${chunkText}\n\n`;
            subtitleIndex++;
          }

          currentChunk = [];
          if (i < words.length - 1) {
            chunkStartTime = words[i + 1].start;
          }
        }
      }

      if (currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        const startTime = Math.max(0, Math.min(chunkStartTime, audioDuration));
        const endTime = Math.max(startTime, Math.min(chunkEndTime, audioDuration));

        if (startTime < endTime && chunkText.trim()) {
          srtContent += `${subtitleIndex}\n`;
          srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
          srtContent += `${chunkText}\n\n`;
        }
      }

      return srtContent;
    } catch (error) {
      console.error('❌ [Faster-Whisper] Error in fallback conversion:', error.message);
      return null;
    }
  }

  /**
   * Convert Whisper JSON output to SRT format with word-level timing (legacy - for OpenAI Whisper CLI)
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  convertWhisperToSRT(whisperData, scriptText, audioDuration, videoFormat = 'shorts') {
    try {
      if (!whisperData || !whisperData.segments || whisperData.segments.length === 0) {
        return null;
      }

      let srtContent = '';
      let subtitleIndex = 1;

      // Group words into readable chunks - YouTube: 5-8 words, Shorts: 2-4 words
      const minChunkSize = videoFormat === 'youtube' ? 5 : 2;
      const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
      
      for (const segment of whisperData.segments) {
        if (!segment.words || segment.words.length === 0) continue;

        const words = segment.words;
        const chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, Math.ceil(words.length / 3)));

        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize);
          const startTime = chunk[0].start;
          const endTime = chunk[chunk.length - 1].end;
          const text = chunk.map(w => w.word.trim()).join(' ');

          if (startTime < endTime && text.trim()) {
            srtContent += `${subtitleIndex}\n`;
            srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
            srtContent += `${text}\n\n`;
            subtitleIndex++;
          }
        }
      }

      // Ensure last subtitle ends at audio duration
      if (srtContent && whisperData.segments.length > 0) {
        const lastSegment = whisperData.segments[whisperData.segments.length - 1];
        if (lastSegment.words && lastSegment.words.length > 0) {
          const lastWord = lastSegment.words[lastSegment.words.length - 1];
          const lastEndTime = Math.min(lastWord.end, audioDuration);
          
          // Update last subtitle end time
          const lines = srtContent.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('-->')) {
              const timeMatch = lines[i].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
              if (timeMatch) {
                lines[i] = lines[i].replace(timeMatch[2], this.formatSRTTime(lastEndTime));
                srtContent = lines.join('\n');
                break;
              }
            }
          }
        }
      }

      return srtContent || null;
    } catch (error) {
      console.error('❌ [Whisper] Error converting to SRT:', error.message);
      return null;
    }
  }

  /**
   * FALLBACK METHOD: Punctuation-based timing (70-80% accuracy)
   * Analyzes punctuation marks and adds natural pauses
   * This method doesn't require Whisper but is less accurate
   * @param {string} videoFormat - 'youtube' or 'shorts' - affects subtitle line length
   */
  async punctuationBasedTiming(scriptText, audioDuration, parsedScript, videoFormat = 'shorts') {
    try {
      const text = parsedScript?.text || scriptText;
      const words = text.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length === 0) {
        return null;
      }

      // Punctuation pause durations (in seconds)
      const punctuationPauses = {
        '.': 0.8,  // Full stop - longer pause
        '!': 0.6,  // Exclamation - medium pause
        '?': 0.6,  // Question - medium pause
        ',': 0.4,  // Comma - short pause
        ';': 0.5,  // Semicolon - medium pause
        ':': 0.4   // Colon - short pause
      };

      // Calculate base word duration (without pauses)
      let totalPauseTime = 0;
      const wordTimings = [];

      // First pass: identify punctuation and calculate pause times
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let pauseAfter = 0;

        // Check for punctuation at end of word
        for (const [punct, pause] of Object.entries(punctuationPauses)) {
          if (word.endsWith(punct)) {
            pauseAfter = pause;
            break;
          }
        }

        wordTimings.push({
          word: word.replace(/[.,!?;:]/g, ''), // Remove punctuation for display
          pauseAfter: pauseAfter
        });

        totalPauseTime += pauseAfter;
      }

      // Calculate base word duration (excluding pauses)
      const baseDuration = audioDuration - totalPauseTime;
      const baseWordDuration = baseDuration / words.length;

      // Generate SRT with punctuation-aware timing
      // YouTube: 5-8 words per chunk, Shorts: 2-4 words per chunk
      let srtContent = '';
      let subtitleIndex = 1;
      let accumulatedTime = 0;
      const minChunkSize = videoFormat === 'youtube' ? 5 : 2;
      const maxChunkSize = videoFormat === 'youtube' ? 8 : 4;
      const chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, Math.ceil(words.length / (audioDuration / 2)))); // ~2 seconds per chunk

      for (let i = 0; i < wordTimings.length; i += chunkSize) {
        const chunk = wordTimings.slice(i, i + chunkSize);
        const chunkWords = chunk.map(w => w.word).join(' ');
        
        // Calculate chunk duration
        let chunkDuration = baseWordDuration * chunk.length;
        
        // Add pause time from punctuation in this chunk
        chunk.forEach(w => {
          chunkDuration += w.pauseAfter;
        });

        const startTime = accumulatedTime;
        const endTime = Math.min(accumulatedTime + chunkDuration, audioDuration);
        accumulatedTime = endTime;

        if (startTime < endTime && chunkWords.trim()) {
          srtContent += `${subtitleIndex}\n`;
          srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
          srtContent += `${chunkWords}\n\n`;
          subtitleIndex++;
        }

        if (endTime >= audioDuration) break;
      }

      // Ensure last subtitle ends at audio duration
      if (srtContent) {
        const lines = srtContent.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('-->')) {
            const timeMatch = lines[i].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
            if (timeMatch) {
              lines[i] = lines[i].replace(timeMatch[2], this.formatSRTTime(audioDuration));
              srtContent = lines.join('\n');
              break;
            }
          }
        }
      }

      console.log(`✅ [Punctuation] Generated ${subtitleIndex - 1} subtitles with punctuation-aware timing`);
      return srtContent || null;
    } catch (error) {
      console.error('❌ [Punctuation] Timing generation failed:', error.message);
      return null;
    }
  }

  /**
   * Get word-level timing from audio (for scene-based clip duration synchronization)
   * Returns raw word timing array instead of SRT content
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Array|null>} Array of {word, start, end, probability} or null if failed
   */
  async getWordTimings(audioPath) {
    try {
      if (!fs.existsSync(audioPath)) {
        console.warn('⚠️ [Whisper] Audio file not found:', audioPath);
        return null;
      }

      console.log('🎤 [Whisper] Extracting word-level timings for scene synchronization...');
      
      // Get Faster-Whisper Python script path
      const fasterWhisperScript = path.join(__dirname, 'faster_whisper_transcribe.py');
      if (!fs.existsSync(fasterWhisperScript)) {
        console.warn('⚠️ [Faster-Whisper] Script not found:', fasterWhisperScript);
        return null;
      }

      // CRITICAL: ALWAYS try venv Python first (where faster-whisper IS installed)
      let pythonCmd = 'python';
      const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
      if (fs.existsSync(venvPython)) {
        pythonCmd = `"${venvPython}"`;
        console.log('✅ [Whisper] Using venv Python for word timing');
      } else {
        console.warn('⚠️ [Whisper] Venv not found, using system Python');
      }

      // Get model size from env or use default
      // QUALITY UPGRADE: Use 'small' model for better non-English accuracy (was 'base')
      const modelSize = process.env.WHISPER_MODEL_SIZE || 'small';
      // PERFORMANCE: Use CUDA if available
      const device = process.env.WHISPER_DEVICE || 'cuda';
      // QUALITY: Use float16 for GPU, int8 for CPU
      const computeType = process.env.WHISPER_COMPUTE_TYPE || (device === 'cuda' ? 'float16' : 'int8');

      return new Promise((resolve) => {
        // Run Faster-Whisper Python script
        const args = [
          fasterWhisperScript,
          audioPath,
          modelSize,
          device,
          computeType
        ];

        const whisperProcess = spawn(pythonCmd, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: this.isWindows(),
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        whisperProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // CRITICAL FIX: Dynamic timeout - 10 minutes for long scripts
        const timeoutMs = 600000; // 10 minutes
        const timeoutHandle = setTimeout(() => {
          whisperProcess.kill();
          console.warn(`⚠️ [Faster-Whisper] Word timing timeout (${timeoutMs/1000}s)`);
          resolve(null);
        }, timeoutMs);

        whisperProcess.on('close', (code) => {
          // CRITICAL: Clear timeout when process completes
          clearTimeout(timeoutHandle);
          
          if (code !== 0) {
            console.warn(`⚠️ [Faster-Whisper] Process exited with code ${code}`);
            resolve(null);
            return;
          }

          try {
            // Parse JSON output from Faster-Whisper
            const result = JSON.parse(stdout);
            
            if (!result.success || !result.words || result.words.length === 0) {
              console.warn('⚠️ [Faster-Whisper] No words extracted:', result.error || 'Unknown error');
              resolve(null);
              return;
            }

            console.log(`✅ [Faster-Whisper] Extracted ${result.words.length} word timings`);
            resolve(result.words); // Return raw word array
          } catch (parseError) {
            console.error('❌ [Faster-Whisper] Error parsing output:', parseError.message);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('❌ [Faster-Whisper] Word timing extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Check if Whisper is available (Faster-Whisper via Python)
   * CRITICAL FIX: Prioritize venv Python (where faster-whisper is installed)
   * PERFORMANCE: Cache result for 60 seconds to avoid repeated slow checks
   */
  isWhisperAvailable() {
    try {
      // Check cache (60 second TTL)
      const now = Date.now();
      if (this._whisperAvailableCache !== null && (now - this._whisperAvailableCacheTime) < 60000) {
        return this._whisperAvailableCache;
      }
      
      // Check if Faster-Whisper Python script exists
      const { execSync } = require('child_process');
      const fasterWhisperScript = path.join(__dirname, 'faster_whisper_transcribe.py');
      
      if (!fs.existsSync(fasterWhisperScript)) {
        console.log('⚠️ [Whisper] Script not found:', fasterWhisperScript);
        this._whisperAvailableCache = false;
        this._whisperAvailableCacheTime = now;
        return false;
      }
      
      // CRITICAL FIX: Try venv Python FIRST (where faster-whisper is installed)
      const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
      if (fs.existsSync(venvPython)) {
        try {
          // CRITICAL: Use longer timeout for slow imports on first run
          const result = execSync(`"${venvPython}" -c "import sys; import faster_whisper; sys.exit(0)"`, { 
            stdio: 'pipe',
            timeout: 15000, // 15 seconds - enough for first-time import
            windowsHide: true,
            encoding: 'utf8'
          });
          console.log('✅ [Whisper] Faster-Whisper available (venv) - CACHED');
          this._whisperAvailableCache = true;
          this._whisperAvailableCacheTime = now;
          return true;
        } catch (e) {
          // ONLY log if it's a real import error, not timeout
          if (e.code === 'ETIMEDOUT') {
            console.warn('⚠️ [Whisper] Venv check timed out, assuming available');
            // CRITICAL: Assume it's available if timeout (slow first import)
            this._whisperAvailableCache = true;
            this._whisperAvailableCacheTime = now;
            return true;
          }
          console.log('⚠️ [Whisper] Venv Python found but faster-whisper import failed');
          this._whisperAvailableCache = false;
          this._whisperAvailableCacheTime = now;
          return false;
        }
      }
      
      // Fallback: Try system Python
      try {
        execSync(`python -c "import faster_whisper"`, { 
          stdio: 'ignore', 
          timeout: 5000,
          windowsHide: true 
        });
        console.log('✅ [Whisper] Faster-Whisper available (system Python)');
        this._whisperAvailableCache = true;
        this._whisperAvailableCacheTime = now;
        return true;
      } catch (e) {
        console.log('⚠️ [Whisper] Faster-Whisper not available');
        this._whisperAvailableCache = false;
        this._whisperAvailableCacheTime = now;
        return false;
      }
    } catch (error) {
      console.error('❌ [Whisper] Error checking availability:', error.message);
      this._whisperAvailableCache = false;
      this._whisperAvailableCacheTime = Date.now();
      return false;
    }
  }

  /**
   * Check if running on Windows
   */
  isWindows() {
    return process.platform === 'win32';
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}

module.exports = new WhisperService();