const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CoquiTTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'audio');
    this.ensureOutputDir();
    
    // Check if Coqui TTS is installed
    this.isInstalled = this.checkInstallation();
    
    // Best models for English
    this.models = {
      fast: 'tts_models/en/ljspeech/tacotron2-DDC',
      quality: 'tts_models/en/ljspeech/glow-tts',
      natural: 'tts_models/en/vctk/vits'
    };
    
    this.defaultModel = process.env.COQUI_MODEL || this.models.fast;
    
    if (this.isInstalled) {
      console.log('✅ Coqui TTS installed and ready');
      console.log(`🎤 Using model: ${this.defaultModel}`);
    } else {
      console.log('⚠️  Coqui TTS not installed. Install with: pip install TTS');
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  checkInstallation() {
    try {
      const { execSync } = require('child_process');
      execSync('tts --help', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async generateSpeech(text, outputPath, options = {}) {
    if (!this.isInstalled) {
      throw new Error('Coqui TTS not installed');
    }

    return new Promise((resolve, reject) => {
      const model = options.model || this.defaultModel;
      const speaker = options.speaker || null;
      
      console.log(`🎤 [Coqui TTS] Generating speech with model: ${model}`);
      
      const args = [
        '--text', text,
        '--model_name', model,
        '--out_path', outputPath
      ];
      
      if (speaker) {
        args.push('--speaker_idx', speaker);
      }
      
      const tts = spawn('tts', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stderr = '';
      
      tts.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      tts.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          console.log('✅ [Coqui TTS] Speech generated successfully');
          resolve(outputPath);
        } else {
          console.error('❌ [Coqui TTS] Generation failed:', stderr);
          reject(new Error(`Coqui TTS failed with code ${code}`));
        }
      });
      
      tts.on('error', (error) => {
        reject(new Error(`Coqui TTS error: ${error.message}`));
      });
    });
  }

  async generateLongSpeech(text, outputPath, options = {}) {
    // Split long text into chunks
    const maxChunkLength = 500;
    const chunks = this.splitTextIntoChunks(text, maxChunkLength);
    
    console.log(`📝 [Coqui TTS] Splitting text into ${chunks.length} chunks`);
    
    const chunkPaths = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = outputPath.replace('.wav', `_chunk_${i}.wav`);
      await this.generateSpeech(chunks[i], chunkPath, options);
      chunkPaths.push(chunkPath);
    }
    
    // Concatenate chunks
    console.log('🔗 [Coqui TTS] Concatenating audio chunks...');
    await this.concatenateAudioFiles(chunkPaths, outputPath);
    
    // Clean up chunks
    chunkPaths.forEach(chunkPath => {
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    });
    
    console.log('✅ [Coqui TTS] Long speech generated successfully');
    return outputPath;
  }

  splitTextIntoChunks(text, maxLength) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  async concatenateAudioFiles(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        ...inputPaths.flatMap(p => ['-i', p]),
        '-filter_complex', `concat=n=${inputPaths.length}:v=0:a=1[out]`,
        '-map', '[out]',
        '-y',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg concatenation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  // List available models
  async listModels() {
    return new Promise((resolve, reject) => {
      const tts = spawn('tts', ['--list_models']);
      
      let stdout = '';
      tts.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      tts.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error('Failed to list models'));
        }
      });
    });
  }
}

module.exports = new CoquiTTSService();
