const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class AdvancedTTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'advanced_tts');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Generate TTS with advanced phoneme control
  async generateAdvancedTTS(text, options = {}) {
    const {
      voice = 'en_US-norman-medium',
      speed = 1.0,        // 0.5 - 2.0
      pitch = 1.0,        // 0.5 - 2.0
      emphasis = 'normal', // 'low', 'normal', 'high'
      outputFormat = 'wav',
      sampleRate = 48000
    } = options;

    return new Promise((resolve, reject) => {
      try {
        const voicePath = process.env.PIPER_VOICE_PATH;
        if (!voicePath || !fs.existsSync(voicePath)) {
          return reject(new Error('Piper voice not configured'));
        }

        const outputPath = path.join(this.outputDir, `advanced_${Date.now()}.${outputFormat}`);
        const piperBin = process.env.PIPER_BIN || 'piper';
        
        // Advanced Piper arguments
        const args = [
          '--model', voicePath,
          '--output_file', outputPath,
          '--speaker', '0', // Default speaker
          '--length_scale', speed.toString(),
          '--noise_scale', this.getNoiseScale(emphasis),
          '--noise_w', '0.8'
        ];

        // Add config if available
        const configPath = process.env.PIPER_VOICE_CONFIG;
        if (configPath && fs.existsSync(configPath)) {
          args.push('--config', configPath);
        }

        // Set environment for espeak-ng
        const env = { ...process.env };
        const espeakData = process.env.PIPER_ESPEAK_DATA;
        if (espeakData) {
          env.ESPEAK_NG_DATA_PATH = espeakData;
        }

        console.log(`🎤 [Advanced TTS] Generating with speed: ${speed}, emphasis: ${emphasis}`);

        const piperProcess = spawn(piperBin, args, {
          stdio: ['pipe', 'inherit', 'inherit'],
          windowsHide: true,
          env: env
        });

        // Apply pitch and emphasis modifications to text
        const modifiedText = this.modifyTextForPhonemes(text, { pitch, emphasis });
        piperProcess.stdin.write(modifiedText);
        piperProcess.stdin.end();

        piperProcess.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            console.log(`✅ Advanced TTS generated: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`Advanced TTS failed with code ${code}`));
          }
        });

        piperProcess.on('error', (err) => reject(err));

      } catch (error) {
        reject(error);
      }
    });
  }

  // Modify text for phoneme-level control
  modifyTextForPhonemes(text, options) {
    const { pitch, emphasis } = options;
    let modifiedText = text;

    // Apply emphasis markers
    if (emphasis === 'high') {
      // Add SSML-like emphasis markers
      modifiedText = modifiedText.replace(/\b(\w+)\b/g, (match, word) => {
        if (word.length > 3) {
          return `<emphasis level="strong">${word}</emphasis>`;
        }
        return word;
      });
    } else if (emphasis === 'low') {
      // Soften emphasis
      modifiedText = modifiedText.replace(/\b(\w+)\b/g, (match, word) => {
        if (word.length > 4) {
          return `<emphasis level="reduced">${word}</emphasis>`;
        }
        return word;
      });
    }

    // Apply pitch modifications using phoneme notation
    if (pitch > 1.2) {
      // Higher pitch - add stress markers
      modifiedText = modifiedText.replace(/\b(\w+)\b/g, (match, word) => {
        if (word.length > 2) {
          return `'${word}`; // Primary stress
        }
        return word;
      });
    } else if (pitch < 0.8) {
      // Lower pitch - add unstressed markers
      modifiedText = modifiedText.replace(/\b(\w+)\b/g, (match, word) => {
        if (word.length > 2) {
          return `,${word}`; // Unstressed
        }
        return word;
      });
    }

    return modifiedText;
  }

  // Get noise scale based on emphasis
  getNoiseScale(emphasis) {
    const scales = {
      'low': '0.3',
      'normal': '0.5',
      'high': '0.8'
    };
    return scales[emphasis] || scales.normal;
  }

  // Generate multiple TTS versions for comparison
  async generateMultipleVersions(text) {
    const versions = [
      {
        name: 'Casual',
        options: { speed: 1.1, emphasis: 'normal', pitch: 1.0 }
      },
      {
        name: 'Professional',
        options: { speed: 0.9, emphasis: 'high', pitch: 0.95 }
      },
      {
        name: 'Energetic',
        options: { speed: 1.3, emphasis: 'high', pitch: 1.1 }
      },
      {
        name: 'Calm',
        options: { speed: 0.8, emphasis: 'low', pitch: 0.9 }
      }
    ];

    const results = [];
    
    for (const version of versions) {
      try {
        const audioPath = await this.generateAdvancedTTS(text, version.options);
        results.push({
          ...version,
          audioPath,
          duration: await this.getAudioDuration(audioPath)
        });
      } catch (error) {
        console.warn(`Failed to generate ${version.name} version:`, error.message);
        results.push({
          ...version,
          error: error.message
        });
      }
    }

    return results;
  }

  // Get audio duration
  async getAudioDuration(audioPath) {
    return new Promise((resolve) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          resolve(0);
        } else {
          resolve(parseFloat(metadata.format.duration) || 0);
        }
      });
    });
  }

  // Apply post-processing effects
  async applyAudioEffects(audioPath, effects = {}) {
    const {
      normalize = true,
      compress = false,
      reverb = false,
      fadeIn = 0.1,
      fadeOut = 0.1
    } = effects;

    const outputPath = path.join(this.outputDir, `processed_${Date.now()}.wav`);
    const ffmpeg = require('fluent-ffmpeg');

    return new Promise((resolve, reject) => {
      let command = ffmpeg(audioPath);

      // Build filter chain
      const filters = [];

      if (normalize) {
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
      }

      if (compress) {
        filters.push('acompressor=threshold=0.089:ratio=9:attack=200:release=1000');
      }

      if (reverb) {
        filters.push('aecho=0.8:0.9:1000:0.3');
      }

      if (fadeIn > 0) {
        filters.push(`afade=t=in:st=0:d=${fadeIn}`);
      }

      if (fadeOut > 0) {
        // Get duration first, then apply fade out
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }

          const duration = parseFloat(metadata.format.duration);
          const fadeStart = duration - fadeOut;
          
          if (fadeStart > 0) {
            filters.push(`afade=t=out:st=${fadeStart}:d=${fadeOut}`);
          }

          // Apply all filters
          if (filters.length > 0) {
            command = command.audioFilters(filters);
          }

          command
            .audioCodec('pcm_s16le')
            .audioFrequency(48000)
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
        });
      } else {
        // No fade out needed
        if (filters.length > 0) {
          command = command.audioFilters(filters);
        }

        command
          .audioCodec('pcm_s16le')
          .audioFrequency(48000)
          .output(outputPath)
          .on('end', () => resolve(outputPath))
          .on('error', reject)
          .run();
      }
    });
  }
}

module.exports = new AdvancedTTSService();
