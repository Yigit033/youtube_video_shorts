const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class WhisperService {
  constructor() {
    this.whisperPath = process.env.WHISPER_PATH || 'whisper';
    this.modelPath = process.env.WHISPER_MODEL_PATH || './models/whisper-base.en';
  }

  async transcribeAudio(audioPath, baseName) {
    try {
      console.log('🎤 [Whisper] Starting audio transcription...');
      
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const outputDir = path.dirname(audioPath);
      const srtPath = path.join(outputDir, `${baseName}.srt`);

      return new Promise((resolve, reject) => {
        // For now, create a simple SRT file with basic subtitles
        // In production, you would use actual Whisper.cpp here
        const srtContent = this.generateBasicSRT(audioPath, baseName);
        
        fs.writeFileSync(srtPath, srtContent);
        console.log('✅ [Whisper] Basic SRT generated:', srtPath);
        resolve(srtPath);
      });

    } catch (error) {
      console.error('❌ [Whisper] Transcription failed:', error);
      return null;
    }
  }

  generateBasicSRT(audioPath, baseName) {
    // Generate a basic SRT file with timing
    const duration = 30; // Assume 30 seconds for now
    const text = "This is a professional video with enhanced effects and quality improvements.";
    
    let srtContent = '';
    const segmentDuration = 5; // 5 second segments
    const segments = Math.ceil(duration / segmentDuration);
    
    for (let i = 0; i < segments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      
      srtContent += `${i + 1}\n`;
      srtContent += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srtContent += `${text}\n\n`;
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