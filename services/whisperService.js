const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class WhisperService {
  constructor() {
    this.whisperPath = process.env.WHISPER_PATH || 'whisper';
    this.modelPath = process.env.WHISPER_MODEL_PATH || './models/whisper-base.en';
  }

  async transcribeAudio(audioPath, baseName, scriptText = null) {
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

      return new Promise((resolve, reject) => {
        // Use actual script text for subtitles
        const srtContent = this.generateSRTFromScript(scriptText, audioPath);
        
        fs.writeFileSync(srtPath, srtContent);
        console.log('✅ [Whisper] SRT generated from script:', srtPath);
        resolve(srtPath);
      });

    } catch (error) {
      console.error('❌ [Whisper] Transcription failed:', error);
      return null;
    }
  }

  generateSRTFromScript(scriptText, audioPath) {
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
    
    // Split into words for TikTok-style word-by-word subtitles
    const words = cleanScript.split(/\s+/).filter(w => w.length > 0);
    
    // DYNAMIC TIMING: Get actual audio duration and calculate words per second
    let audioDuration = 10; // default fallback
    try {
      if (fs.existsSync(audioPath)) {
        const stats = fs.statSync(audioPath);
        // Estimate: WAV files are ~176KB per second (44.1kHz, 16-bit, stereo)
        audioDuration = Math.max(5, stats.size / 176000);
      }
    } catch (err) {
      console.warn('⚠️ Could not get audio duration, using default');
    }
    
    const wordsPerSecond = words.length / audioDuration;
    const wordDuration = 1 / wordsPerSecond;
    
    let srtContent = '';
    let currentTime = 0;
    
    // Group words into 2 word chunks for VIRAL TikTok/Shorts style
    const chunkSize = 2;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      const startTime = currentTime;
      const endTime = currentTime + (wordDuration * Math.min(chunkSize, words.length - i));
      
      srtContent += `${Math.floor(i / chunkSize) + 1}\n`;
      srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srtContent += `${chunk}\n\n`;
      
      currentTime = endTime;
    }
    
    return srtContent;
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