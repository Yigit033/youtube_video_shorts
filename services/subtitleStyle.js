const fs = require('fs');
const path = require('path');

/**
 * Professional Subtitle Style Service
 * Creates styled subtitles for YouTube (cinematic) and Shorts (viral) formats
 */
class SubtitleStyleService {
  constructor() {
    this.subsDir = path.join(__dirname, '..', 'temp', 'subtitles');
    this.ensureSubsDir();
  }

  ensureSubsDir() {
    if (!fs.existsSync(this.subsDir)) {
      fs.mkdirSync(this.subsDir, { recursive: true });
    }
  }

  /**
   * Convert SRT to ASS format with YouTube cinematic style (16:9 format)
   * Professional documentary-style subtitles with typewriter effect
   * @param {string} srtPath - Path to SRT file
   * @param {string} outputPath - Path to save ASS file
   * @returns {string} Path to ASS file
   */
  convertSRTToASS_YouTube(srtPath, outputPath) {
    if (!fs.existsSync(srtPath)) {
      throw new Error(`SRT file not found: ${srtPath}`);
    }

    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const subtitles = this.parseSRT(srtContent);

    // ASS Header with YouTube cinematic style (16:9 format)
    // Font: Bold sans-serif (Montserrat, Bebas Neue, or Lato Heavy)
    // Color: White with soft black shadow
    // Background: Translucent black (30-40% opacity)
    // Position: Bottom center, 10% above lower margin
    // White color = RGB(255, 255, 255) = &H00FFFFFF
    // Gold/Yellow highlight = RGB(255, 215, 0) = &H0000D7FF
    // Background: Black with 35% opacity = &H59000000
    // CRITICAL: Alignment=2 (bottom center), MarginV=90 (10% above lower margin for 1080p)
    let assContent = `[Script Info]
Title: YouTube Cinematic Subtitles (16:9)
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: YouTubeCinematic,Montserrat,24,&H00FFFFFF,&H000000FF,&H00000000,&H59000000,1,0,0,0,100,100,0,0,1,2,3,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Convert each subtitle to ASS format with typewriter effect and fade
    // CRITICAL: Ensure no overlap between subtitles
    let previousEndTime = 0;
    
    subtitles.forEach((sub, index) => {
      // Ensure subtitle doesn't start before previous one ends
      const safeStartTime = Math.max(sub.startTime, previousEndTime);
      const startTime = this.srtTimeToASSTime(safeStartTime);
      
      // CRITICAL: Subtitle visible 1.5x longer than speech duration for readability
      const speechDuration = sub.endTime - sub.startTime;
      const extendedEndTime = sub.endTime + (speechDuration * 0.5);
      const endTime = this.srtTimeToASSTime(extendedEndTime);
      
      // Update previousEndTime for next subtitle
      previousEndTime = extendedEndTime;
      
      // Fade timing: fade-in 0.2s, fade-out 0.3s
      const fadeIn = 0.2;
      const fadeOut = 0.3;
      const fadeInEnd = safeStartTime + fadeIn;
      const fadeOutStart = extendedEndTime - fadeOut;
      
      // CRITICAL: Clean text first, then apply effects in correct order
      // 1. Clean text (remove any existing ASS tags that might be corrupted)
      const cleanText = sub.text.replace(/\{[^}]*\}/g, '').trim();
      
      // 2. Apply typewriter effect FIRST (before highlighting, to avoid tag conflicts)
      // Typewriter effect uses \K tags which reveal text character by character
      const typewriterText = this.generateTypewriterEffectSafe(cleanText, safeStartTime, sub.endTime);
      
      // 3. Highlight 1-2 keywords AFTER typewriter completes (applies color tags with proper timing)
      // CRITICAL: Pass startTime and endTime for proper synchronization
      const styledText = this.highlightKeywordsYouTubeWithTypewriter(typewriterText, safeStartTime, sub.endTime);
      
      // 4. Escape ASS special characters properly
      // CRITICAL: Only escape text content, NOT ASS formatting tags
      // ASS tags use { } brackets, so we need to escape text between tags
      let escapedText = '';
      let inTag = false;
      let currentTag = '';
      let currentText = '';
      
      for (let i = 0; i < styledText.length; i++) {
        const char = styledText[i];
        
        if (char === '{') {
          // Start of ASS tag - escape accumulated text first
          if (currentText) {
            escapedText += currentText
              .replace(/\\/g, '\\\\')  // Escape backslashes (only if they exist)
              .replace(/\n/g, '\\N');  // Escape newlines
            // CRITICAL: Do NOT escape commas - they are safe in ASS text content
            // Commas are only special in Dialogue field separators, not in text
            currentText = '';
          }
          inTag = true;
          currentTag = '{';
        } else if (char === '}' && inTag) {
          // End of ASS tag - add tag as-is (no escaping)
          currentTag += '}';
          escapedText += currentTag;
          currentTag = '';
          inTag = false;
        } else if (inTag) {
          // Inside ASS tag - keep as-is
          currentTag += char;
        } else {
          // Regular text - accumulate for escaping
          currentText += char;
        }
      }
      
      // Escape any remaining text
      if (currentText) {
        escapedText += currentText
          .replace(/\\/g, '\\\\')  // Escape backslashes (only if they exist)
          .replace(/\n/g, '\\N');  // Escape newlines
        // CRITICAL: Do NOT escape commas - they cause visible backslashes in subtitles
      }
      
      // 5. Add fade effect
      assContent += `Dialogue: 0,${startTime},${endTime},YouTubeCinematic,,0,0,0,,{${this.generateFadeEffect(safeStartTime, fadeInEnd, fadeOutStart, extendedEndTime)}}${escapedText}\n`;
    });

    fs.writeFileSync(outputPath, assContent, 'utf-8');
    console.log(`✅ [Subtitle Style] Created YouTube cinematic ASS file (16:9, font size 34, bottom center position, typewriter effect, perfect sync): ${path.basename(outputPath)}`);
    return outputPath;
  }

  /**
   * Convert SRT to ASS format with YouTube Shorts viral style (9:16 format)
   * Dynamic typewriter with bounce/pop-in, perfect sync with anticipation
   * @param {string} srtPath - Path to SRT file
   * @param {string} outputPath - Path to save ASS file
   * @returns {string} Path to ASS file
   */
  convertSRTToASS_Shorts(srtPath, outputPath) {
    if (!fs.existsSync(srtPath)) {
      throw new Error(`SRT file not found: ${srtPath}`);
    }

    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const subtitles = this.parseSRT(srtContent);

    // ASS Header with Shorts viral style (9:16 format)
    // Font: Extra bold sans-serif (Anton, Poppins ExtraBold)
    // Color: White for main text, Yellow/Cyan/Light Blue for keywords
    // Outline: Black stroke (2-3px) or subtle shadow
    // Position: Lower third (moved down to avoid covering screen center)
    // White color = RGB(255, 255, 255) = &H00FFFFFF
    // Yellow highlight = RGB(255, 212, 59) = &H003BD4FF
    // Cyan highlight = RGB(0, 255, 255) = &H00FFFF00
    // Light Blue highlight = RGB(135, 206, 235) = &H00EBCE87
    // CRITICAL: Alignment=2 (bottom center), MarginV=20 (moved even further down, very close to bottom edge)
    // Font size reduced to 20 for more compact, less intrusive, professional appearance
    let assContent = `[Script Info]
Title: YouTube Shorts Viral Subtitles (9:16)
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ShortsViral,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Convert each subtitle to ASS format with dynamic typewriter and bounce/pop-in
    // CRITICAL: Ensure no overlap between subtitles
    let previousEndTime = 0;
    
    subtitles.forEach((sub, index) => {
      // Ensure subtitle doesn't start before previous one ends
      const safeStartTime = Math.max(sub.startTime, previousEndTime);
      const startTime = this.srtTimeToASSTime(safeStartTime);
      
      // CRITICAL: Extended time for readability (1.5x like YouTube)
      const speechDuration = sub.endTime - sub.startTime;
      const extendedEndTime = sub.endTime + (speechDuration * 0.5);
      const endTime = this.srtTimeToASSTime(extendedEndTime);
      
      // Update previousEndTime for next subtitle
      previousEndTime = extendedEndTime;
      
      // Fade timing: quick fade-in (0.1s), quick fade-out (0.2s)
      const fadeIn = 0.1;
      const fadeOut = 0.2;
      const fadeInEnd = safeStartTime + fadeIn;
      const fadeOutStart = extendedEndTime - fadeOut;
      
      // CRITICAL: Clean text first, then apply effects
      const cleanText = sub.text.replace(/\{[^}]*\}/g, '').trim();
      
      // Apply dynamic typewriter effect with anticipation (0.1s before word starts)
      const typewriterText = this.generateTypewriterEffectSafe(cleanText, safeStartTime - 0.1, sub.endTime);
      
      // Highlight important words in Yellow/Cyan/Light Blue AFTER typewriter completes
      // CRITICAL: Pass startTime and endTime for proper synchronization
      const styledText = this.highlightKeywordsShorts(typewriterText, safeStartTime - 0.1, sub.endTime);
      
      // Escape ASS special characters properly (same logic as YouTube)
      let escapedText = '';
      let inTag = false;
      let currentTag = '';
      let currentText = '';
      
      for (let i = 0; i < styledText.length; i++) {
        const char = styledText[i];
        
        if (char === '{') {
          if (currentText) {
            escapedText += currentText
              .replace(/\\/g, '\\\\')  // Escape backslashes (only if they exist)
              .replace(/\n/g, '\\N');  // Escape newlines
            // CRITICAL: Do NOT escape commas - they are safe in ASS text content
            // Commas are only special in Dialogue field separators, not in text
            currentText = '';
          }
          inTag = true;
          currentTag = '{';
        } else if (char === '}' && inTag) {
          currentTag += '}';
          escapedText += currentTag;
          currentTag = '';
          inTag = false;
        } else if (inTag) {
          currentTag += char;
        } else {
          currentText += char;
        }
      }
      
      if (currentText) {
        escapedText += currentText
          .replace(/\\/g, '\\\\')  // Escape backslashes (only if they exist)
          .replace(/\n/g, '\\N');  // Escape newlines
        // CRITICAL: Do NOT escape commas - they cause visible backslashes in subtitles
      }
      
      // Add fade effect only (bounce effect removed to avoid "flowing" animation)
      // CRITICAL: Removed \t tags from bounce effect as they cause red "flowing" animation
      assContent += `Dialogue: 0,${startTime},${endTime},ShortsViral,,0,0,0,,{${this.generateFadeEffect(safeStartTime, fadeInEnd, fadeOutStart, extendedEndTime)}}${escapedText}\n`;
    });

    fs.writeFileSync(outputPath, assContent, 'utf-8');
    console.log(`✅ [Subtitle Style] Created Shorts viral ASS file (9:16, Arial font size 20, Alignment=2 bottom center, MarginV=20, typewriter effect, perfect sync): ${path.basename(outputPath)}`);
    console.log(`📊 [Subtitle Debug] ASS file contains ${subtitles.length} subtitle entries`);
    return outputPath;
  }

  /**
   * Highlight important words in Shorts style (Yellow/Cyan/Light Blue)
   * CRITICAL: Highlights are applied WITHOUT animation to avoid "flowing" effect
   * @param {string} typewriterText - Text with \K tags from typewriter effect
   * @param {number} startTime - Subtitle start time
   * @param {number} endTime - Subtitle end time
   * @returns {string} Text with synchronized highlights
   */
  highlightKeywordsShorts(typewriterText, startTime, endTime) {
    // Extract clean text for keyword detection
    const cleanText = typewriterText.replace(/\{[^}]*\}/g, '');
    const words = cleanText.split(/(\s+)/);
    let highlightedCount = 0;
    const maxHighlights = 3; // More highlights for viral style
    // CRITICAL: Correct color codes (NOT red!)
    // Yellow = RGB(255, 212, 59) = &H003BD4FF&
    // Cyan = RGB(0, 255, 255) = &H00FFFF00&
    // Light Blue = RGB(135, 206, 235) = &H00EBCE87&
    const highlightColors = ['&H003BD4FF&', '&H00FFFF00&', '&H00EBCE87&'];
    
    // Find keywords in clean text
    const keywordData = [];
    words.forEach((word, index) => {
      if (/^\s+$/.test(word)) return; // Skip spaces
      const cleanWord = word.replace(/[.,!?;:]/g, '').trim();
      if (this.isImportantWord(cleanWord) && highlightedCount < maxHighlights && cleanWord.length > 0) {
        keywordData.push({
          word: cleanWord,
          originalWord: word, // Keep original with punctuation
          color: highlightColors[highlightedCount % highlightColors.length]
        });
        highlightedCount++;
      }
    });
    
    // If no keywords, return original typewriter text
    if (keywordData.length === 0) {
      return typewriterText;
    }
    
    // Apply highlights by finding words in typewriter text
    // CRITICAL: Simple approach - build text without tags, find word, then map back
    let result = typewriterText;
    
    // Process in reverse order to maintain string indices
    keywordData.reverse().forEach(({ word, color }) => {
      // Build mapping: text position -> original position
      const textMap = [];
      let textWithoutTags = '';
      
      for (let i = 0; i < result.length; i++) {
        if (result[i] === '{') {
          const tagEnd = result.indexOf('}', i);
          if (tagEnd !== -1) {
            // Skip entire tag
            i = tagEnd;
            continue;
          }
        }
        textMap.push(i);
        textWithoutTags += result[i];
      }
      
      // Find word in text without tags (case-insensitive)
      const wordIndex = textWithoutTags.toLowerCase().indexOf(word.toLowerCase());
      
      if (wordIndex !== -1 && wordIndex + word.length <= textMap.length) {
        // Get actual positions from map
        const realStartIndex = textMap[wordIndex];
        const realEndIndex = textMap[wordIndex + word.length - 1] + 1;
        
        // Apply highlight
        const beforeWord = result.substring(0, realStartIndex);
        const wordWithTags = result.substring(realStartIndex, realEndIndex);
        const afterWord = result.substring(realEndIndex);
        
        result = beforeWord + `{\\c${color}}` + wordWithTags + `{\\r}` + afterWord;
      }
    });
    
    return result;
  }

  /**
   * Generate word-by-word animated subtitles for YouTube Shorts (9:16 vertical format)
   * Dynamic typewriter with bounce/pop-in, perfect sync with anticipation
   * @param {string} srtPath - Path to SRT file
   * @param {number} width - Video width (1080 for Shorts)
   * @param {number} height - Video height (1920 for Shorts)
   * @returns {Array} Array of drawtext filter strings
   * @deprecated Use convertSRTToASS_Shorts instead to avoid ENAMETOOLONG errors
   */
  generateShortsDrawtextFilters(srtPath, width, height) {
    if (!fs.existsSync(srtPath)) {
      return [];
    }

    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const subtitles = this.parseSRT(srtContent);
    const filters = [];

    subtitles.forEach((sub, subIndex) => {
      const words = sub.text.split(/\s+/).filter(w => w.trim().length > 0);
      const speechDuration = sub.endTime - sub.startTime;
      const wordDuration = speechDuration / words.length;
      
      words.forEach((word, wordIndex) => {
        // CRITICAL: Slight anticipation (0.1s before word starts) for perfect sync
        const anticipation = 0.1;
        const wordStart = sub.startTime + (wordIndex * wordDuration) - anticipation;
        const wordEnd = wordStart + wordDuration + anticipation;
        const popInStart = wordStart;
        const popInEnd = wordStart + 0.25; // 0.25 seconds pop-in animation
        
        // Determine if word should be highlighted (important words)
        const isImportant = this.isImportantWord(word);
        // Color: White for normal, Yellow/Cyan/Light Blue for important
        const highlightColors = ['#FFD43B', '#00FFFF', '#87CEEB']; // Yellow, Cyan, Light Blue
        const textColor = isImportant ? highlightColors[wordIndex % highlightColors.length] : '#FFFFFF';
        // CRITICAL: Smaller font size to avoid covering screen (40-44 instead of 50-56)
        const fontSize = isImportant ? 44 : 40; // Extra bold, but not too large
        
        // Position: Mid-lower third (not too low to avoid overlapping buttons)
        // For 9:16 format, mid-lower third is around 60-65% from top
        const x = `(w-text_w)/2`;
        const y = `h*0.62`; // 62% from top (mid-lower third)
        
        // Clean word for FFmpeg
        const cleanWord = word.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/:/g, '\\:').replace(/\\/g, '\\\\');
        
        // Find font file (Anton or Poppins ExtraBold)
        const fontFile = this.findFontFile('Anton') || this.findFontFile('Poppins') || this.findFontFile('Bebas Neue') || this.findFontFile('Arial') || '';
        const fontParam = fontFile ? `:fontfile=${fontFile}` : '';
        
        // Dynamic bounce/pop-in effect: scale from 0.2 to 1.1 then settle to 1.0
        const scaleStart = 0.2;
        const scalePeak = 1.1;
        const scaleExpr = `if(between(t,${popInStart},${popInEnd}), ${scaleStart} + (${scalePeak}-${scaleStart}) * sin((t-${popInStart})/${popInEnd - popInStart} * PI), if(between(t,${popInEnd},${popInEnd + 0.1}), ${scalePeak} - (${scalePeak}-1.0) * (t-${popInEnd})/0.1, 1.0))`;
        
        // Glow effect for important words (scale up slightly)
        const glowScale = isImportant ? `*1.15` : '';
        const finalScaleExpr = isImportant ? `(${scaleExpr})${glowScale}` : scaleExpr;
        
        // Quick fade/slide out at end (0.2s)
        const fadeOutStart = wordEnd - 0.2;
        const alphaExpr = `if(between(t,${popInStart},${popInEnd}), (t-${popInStart})/${popInEnd - popInStart}, if(between(t,${fadeOutStart},${wordEnd}), 1 - (t-${fadeOutStart})/0.2, 1))`;
        
        // Black stroke (2-3px) or shadow for visibility
        const borderWidth = 3;
        const shadowDistance = 2;
        
        // Drawtext filter with bounce/pop-in, glow, and perfect sync
        filters.push(
          `drawtext=text='${cleanWord}'${fontParam}:fontsize=${fontSize}:fontcolor=${textColor}:x='(${x})*${finalScaleExpr}':y='(${y})*${finalScaleExpr}':enable='between(t,${wordStart},${wordEnd})':borderw=${borderWidth}:bordercolor=black@0.9:shadowx=${shadowDistance}:shadowy=${shadowDistance}:shadowcolor=black@0.7:alpha='${alphaExpr}'`
        );
      });
    });

    return filters;
  }

  /**
   * Parse SRT content into subtitle objects
   * @param {string} srtContent - SRT file content
   * @returns {Array} Array of {index, startTime, endTime, text}
   */
  parseSRT(srtContent) {
    const subtitles = [];
    const blocks = srtContent.trim().split(/\n\s*\n/);

    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;

      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) return;

      const startTime = this.parseSRTTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.parseSRTTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
      const text = lines.slice(2).join(' ').trim();

      subtitles.push({ startTime, endTime, text });
    });

    return subtitles;
  }

  /**
   * Parse SRT time to seconds
   */
  parseSRTTime(hours, minutes, seconds, milliseconds) {
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }

  /**
   * Convert seconds to ASS time format (H:MM:SS.cc)
   */
  srtTimeToASSTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 60 - secs) * 100);
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }

  /**
   * Generate fade effect for ASS format
   */
  generateFadeEffect(startTime, fadeInEnd, fadeOutStart, endTime) {
    const fadeInDuration = fadeInEnd - startTime;
    const fadeOutDuration = endTime - fadeOutStart;
    
    // ASS fade format: \fad(fade_in_duration, fade_out_duration)
    return `\\fad(${Math.round(fadeInDuration * 100)},${Math.round(fadeOutDuration * 100)})`;
  }

  /**
   * Highlight 1-2 keywords in yellow/gold with glow/pulse effect (YouTube)
   * Returns text with ASS formatting tags properly embedded
   */
  highlightKeywordsYouTube(text) {
    // Find capitalized words, numbers, or emphasis words
    const words = text.split(/(\s+)/); // Split including spaces to preserve them
    let highlightedCount = 0;
    const maxHighlights = 2;
    
    return words.map(word => {
      // Skip pure whitespace
      if (/^\s+$/.test(word)) {
        return word;
      }
      
      const cleanWord = word.replace(/[.,!?;:]/g, '');
      const punctuation = word.replace(cleanWord, '');
      
      const isKeyword = (
        /^[A-Z][a-z]+$/.test(cleanWord) || // Capitalized
        /^\d+$/.test(cleanWord) || // Numbers
        /^(amazing|incredible|unbelievable|wow|yes|no|stop|go|now|here|there|this|that|important|key|secret|revealed|discovered)$/i.test(cleanWord)
      );
      
      if (isKeyword && highlightedCount < maxHighlights && cleanWord.length > 0) {
        highlightedCount++;
        // Gold color with subtle glow: &H0000D7FF (RGB 255, 215, 0)
        // Simple highlight without complex pulse (to avoid tag conflicts)
        return `{\\c&H0000D7FF&}${cleanWord}{\\r}${punctuation}`;
      }
      return word;
    }).join('');
  }

  /**
   * Generate typewriter effect SAFELY: reveal text character by character synced to voice
   * Uses ASS \K tag for karaoke/typewriter effect
   * CRITICAL: This version works BEFORE highlighting to avoid tag conflicts
   */
  generateTypewriterEffectSafe(text, startTime, endTime) {
    const duration = endTime - startTime;
    
    // Count characters (excluding spaces for timing calculation)
    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars === 0) return text;
    
    const charDuration = duration / totalChars;
    
    // Build typewriter effect with \K tags (karaoke timing in centiseconds)
    // \K reveals characters progressively, synced to voice
    let typewriterText = '';
    let charIndex = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (/\s/.test(char)) {
        // Spaces: add without timing (they appear instantly)
        typewriterText += char;
      } else {
        // Characters: add with \K timing (reveal progressively)
        const charTime = Math.max(3, Math.round(charDuration * 200)); // Min 3 centiseconds per char
        typewriterText += `{\\K${charTime}}${char}`;
        charIndex++;
      }
    }
    
    return typewriterText;
  }

  /**
   * Highlight keywords AFTER typewriter effect is applied (YouTube)
   * CRITICAL: Highlights are applied WITHOUT animation to avoid "flowing" effect
   * @param {string} typewriterText - Text with \K tags from typewriter effect
   * @param {number} startTime - Subtitle start time
   * @param {number} endTime - Subtitle end time
   * @returns {string} Text with synchronized highlights
   */
  highlightKeywordsYouTubeWithTypewriter(typewriterText, startTime, endTime) {
    // Extract clean text for keyword detection
    const cleanText = typewriterText.replace(/\{[^}]*\}/g, '');
    const words = cleanText.split(/(\s+)/);
    let highlightedCount = 0;
    const maxHighlights = 2;
    const highlightColor = '&H0000D7FF&'; // Gold/Yellow (NOT red!)
    
    // Find keywords in clean text
    const keywordWords = [];
    words.forEach((word, index) => {
      if (/^\s+$/.test(word)) return; // Skip spaces
      const cleanWord = word.replace(/[.,!?;:]/g, '').trim();
      if (this.isImportantWord(cleanWord) && highlightedCount < maxHighlights && cleanWord.length > 0) {
        keywordWords.push({
          word: cleanWord,
          originalWord: word // Keep original with punctuation
        });
        highlightedCount++;
      }
    });
    
    // If no keywords, return original typewriter text
    if (keywordWords.length === 0) {
      return typewriterText;
    }
    
    // Apply highlights by finding words in typewriter text
    // CRITICAL: Simple approach - build text without tags, find word, then map back
    let result = typewriterText;
    
    // Process in reverse order to maintain string indices
    keywordWords.reverse().forEach(({ word }) => {
      // Build mapping: text position -> original position
      const textMap = [];
      let textWithoutTags = '';
      
      for (let i = 0; i < result.length; i++) {
        if (result[i] === '{') {
          const tagEnd = result.indexOf('}', i);
          if (tagEnd !== -1) {
            // Skip entire tag
            i = tagEnd;
            continue;
          }
        }
        textMap.push(i);
        textWithoutTags += result[i];
      }
      
      // Find word in text without tags (case-insensitive)
      const wordIndex = textWithoutTags.toLowerCase().indexOf(word.toLowerCase());
      
      if (wordIndex !== -1 && wordIndex + word.length <= textMap.length) {
        // Get actual positions from map
        const realStartIndex = textMap[wordIndex];
        const realEndIndex = textMap[wordIndex + word.length - 1] + 1;
        
        // Apply highlight
        const beforeWord = result.substring(0, realStartIndex);
        const wordWithTags = result.substring(realStartIndex, realEndIndex);
        const afterWord = result.substring(realEndIndex);
        
        result = beforeWord + `{\\c${highlightColor}}` + wordWithTags + `{\\r}` + afterWord;
      }
    });
    
    return result;
  }

  /**
   * Parse typewriter text to extract words with their timing information
   * @param {string} typewriterText - Text with \K tags
   * @param {number} startTime - Subtitle start time
   * @param {number} endTime - Subtitle end time
   * @returns {Array} Array of {text, typewriterText, startTime, duration}
   */
  parseTypewriterWords(typewriterText, startTime, endTime) {
    const words = [];
    const duration = endTime - startTime;
    
    // Extract text without tags for word counting
    const textWithoutTags = typewriterText.replace(/\{[^}]*\}/g, '');
    const wordMatches = textWithoutTags.match(/\S+/g) || [];
    
    if (wordMatches.length === 0) {
      return words;
    }
    
    // Calculate average word duration
    const avgWordDuration = duration / wordMatches.length;
    
    // Parse typewriter text character by character to find word boundaries
    let currentWord = '';
    let currentTypewriterText = '';
    let currentWordIndex = 0;
    let inWord = false;
    let accumulatedCentiseconds = 0;
    
    // Parse \K tags to calculate actual timing
    const kTagRegex = /\{K(\d+)\}/g;
    let match;
    let charIndex = 0;
    
    while ((match = kTagRegex.exec(typewriterText)) !== null) {
      const kTime = parseInt(match[1]); // Centiseconds
      const tagStart = match.index;
      const tagEnd = tagStart + match[0].length;
      
      // Get character after \K tag
      if (tagEnd < typewriterText.length) {
        const char = typewriterText[tagEnd];
        
        if (/\s/.test(char)) {
          // Space - end current word
          if (inWord && currentWord.trim()) {
            words.push({
              text: currentWord.trim(),
              typewriterText: currentTypewriterText,
              startTime: startTime + (accumulatedCentiseconds - (kTime / 100)),
              duration: (kTime / 100)
            });
            currentWord = '';
            currentTypewriterText = '';
            currentWordIndex++;
            inWord = false;
          }
          currentTypewriterText += match[0] + char;
          accumulatedCentiseconds += kTime / 100;
        } else {
          // Character - part of word
          if (!inWord) {
            inWord = true;
          }
          currentWord += char;
          currentTypewriterText += match[0] + char;
          accumulatedCentiseconds += kTime / 100;
        }
      }
    }
    
    // Add last word if exists
    if (inWord && currentWord.trim()) {
      // Estimate duration for last word
      const lastWordDuration = avgWordDuration;
      words.push({
        text: currentWord.trim(),
        typewriterText: currentTypewriterText,
        startTime: startTime + (accumulatedCentiseconds - lastWordDuration),
        duration: lastWordDuration
      });
    }
    
    // Fallback: If parsing failed, use simple word-based timing
    if (words.length === 0) {
      const simpleWords = textWithoutTags.split(/\s+/).filter(w => w.trim());
      simpleWords.forEach((word, index) => {
        words.push({
          text: word,
          typewriterText: word,
          startTime: startTime + (index * avgWordDuration),
          duration: avgWordDuration
        });
      });
    }
    
    return words;
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if word is important (for Shorts highlighting)
   */
  isImportantWord(word) {
    // Important words: capitalized, numbers, or common emphasis words
    const importantPatterns = [
      /^[A-Z][a-z]+$/, // Capitalized words
      /^\d+$/, // Numbers
      /^(amazing|incredible|unbelievable|wow|yes|no|stop|go|now|here|there)$/i
    ];
    
    return importantPatterns.some(pattern => pattern.test(word));
  }

  /**
   * Find font file path (supports Montserrat, Bebas Neue, Lato, Anton, Poppins)
   */
  findFontFile(fontName) {
    const os = require('os');
    const platform = os.platform();
    
    // Font name variations
    const fontVariations = {
      'Montserrat': ['Montserrat-Bold', 'Montserrat', 'montserrat'],
      'Bebas Neue': ['BebasNeue-Regular', 'BebasNeue', 'bebasneue'],
      'Lato': ['Lato-Heavy', 'Lato-Bold', 'Lato', 'lato'],
      'Anton': ['Anton-Regular', 'Anton', 'anton'],
      'Poppins': ['Poppins-ExtraBold', 'Poppins-Bold', 'Poppins', 'poppins'],
      'Arial': ['arial', 'Arial']
    };
    
    const variations = fontVariations[fontName] || [fontName];
    
    if (platform === 'win32') {
      // Windows font locations
      for (const variation of variations) {
        const fontPaths = [
          `C:/Windows/Fonts/${variation}.ttf`,
          `C:/Windows/Fonts/${variation}.otf`,
          `C:/Windows/Fonts/${variation}.TTF`,
          `C:/Windows/Fonts/${variation}.OTF`,
        ];
        
        for (const fontPath of fontPaths) {
          if (fs.existsSync(fontPath)) {
            return fontPath.replace(/\\/g, '/');
          }
        }
      }
      // Fallback to Arial
      if (fontName !== 'Arial') {
        return this.findFontFile('Arial');
      }
    } else if (platform === 'darwin') {
      // macOS font locations
      for (const variation of variations) {
        const fontPaths = [
          `/Library/Fonts/${variation}.ttf`,
          `/Library/Fonts/${variation}.otf`,
          `/System/Library/Fonts/${variation}.ttf`,
          `~/Library/Fonts/${variation}.ttf`,
          `~/Library/Fonts/${variation}.otf`,
        ];
        
        for (const fontPath of fontPaths) {
          const expandedPath = fontPath.replace('~', os.homedir());
          if (fs.existsSync(expandedPath)) {
            return expandedPath;
          }
        }
      }
    } else {
      // Linux font locations
      for (const variation of variations) {
        const fontPaths = [
          `/usr/share/fonts/truetype/${variation.toLowerCase()}.ttf`,
          `/usr/share/fonts/truetype/liberation/${variation.toLowerCase()}.ttf`,
          `/usr/share/fonts/${variation}.ttf`,
          `~/.fonts/${variation}.ttf`,
        ];
        
        for (const fontPath of fontPaths) {
          const expandedPath = fontPath.replace('~', os.homedir());
          if (fs.existsSync(expandedPath)) {
            return expandedPath;
          }
        }
      }
    }
    
    return null;
  }
}

module.exports = new SubtitleStyleService();

