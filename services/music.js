const axios = require('axios');
const fs = require('fs');
const path = require('path');

class MusicService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'audio');
    this.ensureOutputDir();
    
    // Free royalty-free music URLs (Creative Commons)
    this.musicTracks = [
      {
        name: 'upbeat_inspiration',
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        mood: 'upbeat',
        duration: 30
      },
      {
        name: 'romantic_ambient',
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        mood: 'romantic',
        duration: 30
      },
      {
        name: 'calm_peaceful',
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        mood: 'calm',
        duration: 30
      }
    ];
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async getBackgroundMusic(mood = 'upbeat', duration = 30) {
    try {
      console.log(`🎵 [Music] Getting background music for mood: ${mood}`);
      
      // Select appropriate track based on mood
      const track = this.musicTracks.find(t => t.mood === mood) || this.musicTracks[0];
      
      const filename = `bg_music_${mood}_${Date.now()}.mp3`;
      const outputPath = path.join(this.outputDir, filename);
      
      // For now, create a simple tone (in production, you'd use real royalty-free music)
      const musicPath = await this.createSimpleTone(outputPath, duration);
      
      console.log(`✅ [Music] Background music created: ${filename}`);
      return musicPath;
      
    } catch (error) {
      console.error(`❌ [Music] Error getting background music: ${error.message}`);
      return null;
    }
  }

  async createSimpleTone(outputPath, duration) {
    // Create a simple sine wave tone using FFmpeg
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', `sine=frequency=440:duration=${duration}`,
        '-af', 'volume=0.1', // Very low volume for background
        '-y',
        outputPath
      ], { windowsHide: true });
      
      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg tone generation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg tone generation error: ${error.message}`));
      });
    });
  }

  async mixAudioWithMusic(audioPath, musicPath, outputPath) {
    try {
      console.log(`🎵 [Music] Mixing audio with background music (normalized)`);
      
      return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        
        // Normalize narration to -16 LUFS, mix BG at -6 dB with fades
        const ffmpeg = spawn('ffmpeg', [
          '-i', audioPath,
          '-i', musicPath,
          '-filter_complex', [
            '[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[narration]',
            '[1:a]volume=-6dB,afade=t=in:st=0:d=2,afade=t=out:st=58:d=2[music]',
            '[narration]volume=+2dB[narration_up]',
            '[narration_up][music]amix=inputs=2:duration=first:dropout_transition=2[mixed]'
          ].join(';'),
          '-map', '[mixed]',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '48000',
          '-y',
          outputPath
        ], { windowsHide: true });
        
        ffmpeg.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            console.log(`✅ [Music] Audio mixed successfully (normalized)`);
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg mixing failed with code ${code}`));
          }
        });
        
        ffmpeg.on('error', (error) => {
          reject(new Error(`FFmpeg mixing error: ${error.message}`));
        });
      });
      
    } catch (error) {
      console.error(`❌ [Music] Error mixing audio: ${error.message}`);
      return audioPath; // Return original audio if mixing fails
    }
  }
}

module.exports = MusicService;
