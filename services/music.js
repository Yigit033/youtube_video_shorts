// music.js
// Profesyonel miksaj / ducking / ses optimizasyonu için revize edilmiş servis.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class MusicService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'audio');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    this.targetLUFS = -14; // YouTube Shorts friendly
    console.log('🎵 MusicService initialized (revized)');
  }

  // Get background music (wrapper) — can call IntelligentMusicService or local generators
  // Kept simple: expect intelligentMusicService to supply a path
  async getBackgroundMusic(options = {}) {
    // placeholder: this class assumes a music file path is provided by caller
    // For compatibility: return null so caller can use intelligentMusicService to provide music
    return null;
  }

  // Mix narration (voice) with music using sidechain ducking + normalization
  // audioPath: narration (voice) file
  // musicPath: bg music file
  // outputPath: target final file (wav or mp3)
  async mixAudioWithMusic(audioPath, musicPath, outputPath, opts = {}) {
    const finalFile = outputPath || path.join(this.outputDir, `mixed_${Date.now()}.wav`);
    // CRITICAL: Music volume set to 0.75 (previously 0.65) - background music is slightly louder
    // TTS voice should remain primary (1.25 gain), music supports narration but is more present
    const musicVol = (typeof opts.musicVolume !== 'undefined') ? opts.musicVolume : 0.85;
    const narrationGain = (typeof opts.narrationGain !== 'undefined') ? opts.narrationGain : 1.25;
    const duckThreshold = opts.duckThreshold || -30;
    const duckRatio = opts.duckRatio || 10;
    const attack = opts.attack || 3;
    const release = opts.release || 150;
    const targetLUFS = (typeof opts.targetLUFS !== 'undefined') ? opts.targetLUFS : this.targetLUFS;
    const fadeIn = opts.fadeIn || 1.0;
    const fadeOut = opts.fadeOut || 1.5;
    const targetDuration = opts.targetDuration || 45; // CRITICAL: Target duration for final audio

    try {
      // CRITICAL: Music must be looped/extended to match or exceed narration duration
      // This ensures final audio is long enough for the video
      const filterComplex = [
        // narration: highpass/lowpass, eq-ish, compressor, normalize gain, pad to target duration
        `[0:a]highpass=f=80,lowpass=f=12000,acompressor=threshold=-18dB:ratio=3:attack=5:release=50,volume=${narrationGain},apad=whole_dur=${targetDuration}[narr]`,
        // music: LOOP to target duration, then volume and fades
        `[1:a]aloop=loop=-1:size=2e+09,atrim=0:${targetDuration},volume=${musicVol},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${Math.max(0,targetDuration-fadeOut)}:d=${fadeOut}[music]`,
        // sidechain ducking: main = music, sidechain = narration (music volume reduces when narration plays)
        `[music][narr]sidechaincompress=threshold=${duckThreshold}dB:ratio=${duckRatio}:attack=${attack}:release=${release}[ducked]`,
        // MIX ducked music with narration - CRITICAL: This is where narration is added back!
        `[ducked][narr]amix=inputs=2:duration=longest:weights=${musicVol} ${1.0}[mixed]`,
        // final normalization
        `[mixed]loudnorm=I=${targetLUFS}:TP=-1.0:LRA=7[out]`
      ].join(';');

      const args = [
        '-y',
        '-i', audioPath,
        '-i', musicPath,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-c:a', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '1',
        finalFile
      ];

      await this._spawnFFmpeg(args);
      return finalFile;
    } catch (err) {
      console.error('❌ mixAudioWithMusic failed:', err.message);
      // fallback: return narration only (safe)
      return audioPath;
    }
  }

  _spawnFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', args, { windowsHide: true });
      let stderr = '';
      ff.stderr.on('data', (d) => stderr += d.toString());
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('ffmpeg error: ' + stderr.slice(-1000)));
      });
      ff.on('error', (e) => reject(e));
    });
  }
}

module.exports = new MusicService();
