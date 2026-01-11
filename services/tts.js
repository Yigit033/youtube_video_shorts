const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'audio');
    this.ensureOutputDir();
    
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isWindows = process.platform === 'win32';
    
    // Default to gTTS (best free option)
    this.ttsProvider = process.env.TTS_PROVIDER || 'gtts';
    this.ttsVoice = process.env.TTS_VOICE || 'Microsoft David Desktop';
    
    this.huggingfaceTtsUrl = 'https://api-inference.huggingface.co/models/facebook/mms-tts-eng';
    
    console.log('🎤 TTS Service Initialized');
    console.log(`📍 Platform: ${process.platform}`);
    console.log(`🌍 Environment: ${this.isProduction ? 'Production' : 'Development'}`);
    console.log(`🎙️  TTS Provider: ${this.ttsProvider}`);
    console.log(`📁 Output Directory: ${this.outputDir}`);
    
    if (this.ttsProvider === 'gtts') {
      console.log('✅ Using gTTS (Google TTS) - FREE, UNLIMITED, HIGH QUALITY');
    } else if (this.ttsProvider === 'piper') {
      console.log('✅ Using Piper TTS - FREE, OFFLINE, HIGH QUALITY');
    } else if (this.ttsProvider === 'windows') {
      console.log('✅ Using Windows TTS - FREE, BUILT-IN');
    } else {
      console.log('⚠️  Unknown TTS provider, will use fallback chain');
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateSpeech(text, filename, options = {}) {
    if (!text || typeof text !== 'string') {
      console.warn('⚠️  TTS Service: Invalid text parameter, using fallback text');
      text = 'This is a fallback text for text to speech generation.';
    }
    
    // Store selected Piper voice if provided
    this.selectedPiperVoice = options.piperVoice || null;
    // Store selected Coqui speaker if provided
    this.selectedCoquiSpeaker = options.coquiSpeaker || null;
    // Store selected XTTS voice if provided
    this.selectedXTTSVoice = options.xttsVoice || null;
    // Store TTS provider preference if provided
    this.preferredProvider = options.provider || null;
    
    console.log(`\n[TTS Service] Generating speech for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    if (this.preferredProvider && this.preferredProvider !== 'auto') {
      console.log(`🎯 [TTS] Preferred TTS provider: ${this.preferredProvider}`);
    }
    if (this.selectedPiperVoice && this.selectedPiperVoice !== 'auto') {
      console.log(`🎤 [TTS] Using selected Piper voice: ${this.selectedPiperVoice}`);
    }
    if (this.selectedCoquiSpeaker && this.selectedCoquiSpeaker !== 'auto') {
      console.log(`🎤 [TTS] Using selected Coqui speaker: ${this.selectedCoquiSpeaker}`);
    }
    if (this.selectedXTTSVoice && this.selectedXTTSVoice !== 'auto') {
      console.log(`🎭 [TTS] Using selected XTTS voice: ${this.selectedXTTSVoice}`);
    }
    const outputPath = path.join(this.outputDir, `${filename}.wav`);
    
    const methods = this.getTTSMethods();
    
    for (const method of methods) {
      try {
        if (method.skip && method.skip()) {
          console.log(`[TTS] Skipping ${method.name} (${method.skipReason || 'condition not met'})`);
          continue;
        }
        if (method.condition && !method.condition()) {
          console.log(`[TTS] Skipping ${method.name} (condition not met)`);
          continue;
        }
        console.log(`[TTS] Trying ${method.name}...`);
        const result = await method.func(text, outputPath);
        if (result && fs.existsSync(result)) {
          console.log(`✅ ${method.name} successful`);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️  ${method.name} failed: ${error.message}`);
        continue;
      }
    }
    
    console.log('[TTS] All TTS methods failed, creating silent audio...');
    return await this.createSilentAudio(outputPath, text);
  }

  getTTSMethods() {
    // PRIORITY LOGIC:
    // 1. Frontend selection (this.preferredProvider) - ALWAYS has highest priority
    // 2. Environment variable (process.env.TTS_PROVIDER) - Only used if no frontend selection
    // 3. Auto mode - Default fallback order
    
    const preferredProvider = this.preferredProvider || process.env.TTS_PROVIDER || 'auto';
    const isFrontendSelection = !!this.preferredProvider; // Check if user explicitly selected from UI
    
    if (isFrontendSelection && preferredProvider !== 'auto') {
      console.log(`🎯 [TTS Priority] Using FRONTEND selection: ${preferredProvider.toUpperCase()} (overriding .env)`);
    } else if (process.env.TTS_PROVIDER && process.env.TTS_PROVIDER !== 'auto') {
      console.log(`📋 [TTS Priority] Using .env default: ${process.env.TTS_PROVIDER.toUpperCase()}`);
    } else {
      console.log(`🤖 [TTS Priority] Using AUTO mode (best available)`);
    }
    
    const allMethods = {
      'xtts': {
        name: 'XTTS-v2 (Voice Cloning)',
        func: async (text, outputPath) => this.generateWithXTTS(text, outputPath),
        description: '✅ VOICE CLONING, MULTILINGUAL, PROFESSIONAL',
        skip: () => !this.isXTTSInstalled(),
        skipReason: 'XTTS-v2 not installed'
      },
      'coqui': {
        name: 'Coqui TTS (Professional)',
        func: async (text, outputPath) => this.generateWithCoqui(text, outputPath),
        description: '✅ BEST QUALITY, FREE, UNLIMITED',
        skip: () => !this.isCoquiInstalled(),
        skipReason: 'Not installed (pip install TTS)'
      },
      'piper': {
        name: 'Piper TTS (Local)',
        func: async (text, outputPath) => this.generateWithPiper(text, outputPath),
        description: '✅ FREE, OFFLINE, HIGH QUALITY',
        skip: () => !this.isPiperInstalled(),
        skipReason: 'Not installed (see PIPER_KURULUM_REHBERI.md)'
      },
      'gtts': {
        name: 'Google Translate TTS (gTTS)',
        func: async (text, outputPath) => this.generateWithGTTS(text, outputPath),
        description: '✅ FREE, UNLIMITED, HIGH QUALITY'
      },
      'windows': {
        name: 'Windows TTS (SAPI)',
        condition: () => this.isWindows,
        func: async (text, outputPath) => this.generateWithWindowsTTS(text, outputPath),
        description: '✅ FREE, BUILT-IN (Windows only)'
      },
      'huggingface': {
        name: 'HuggingFace TTS (Cloud)',
        func: async (text, outputPath) => {
          const audioData = await this.generateWithHuggingFace(text);
          fs.writeFileSync(outputPath, audioData);
          return outputPath;
        },
        description: '⚠️  FREE with rate limits'
      },
      'espeak': {
        name: 'eSpeak (Fallback)',
        condition: () => this.isEspeakAvailable(),
        func: async (text, outputPath) => this.generateWithEspeak(text, outputPath),
        description: '⚠️  FREE but robotic voice'
      },
      'silent': {
        name: 'Silent Audio (Last Resort)',
        func: async (text, outputPath) => this.createSilentAudio(outputPath, text),
        description: '❌ No audio - emergency fallback'
      }
    };
    
    // Build priority list: preferred provider first, then fallbacks
    let priorityOrder;
    const provider = preferredProvider.toLowerCase();
    
    if (provider === 'xtts') {
      priorityOrder = ['xtts', 'coqui', 'piper', 'gtts', 'windows', 'huggingface', 'espeak', 'silent'];
    } else if (provider === 'coqui') {
      priorityOrder = ['coqui', 'xtts', 'piper', 'gtts', 'windows', 'huggingface', 'espeak', 'silent'];
    } else if (provider === 'piper') {
      priorityOrder = ['piper', 'coqui', 'xtts', 'gtts', 'windows', 'huggingface', 'espeak', 'silent'];
    } else if (provider === 'gtts') {
      priorityOrder = ['gtts', 'coqui', 'xtts', 'piper', 'windows', 'huggingface', 'espeak', 'silent'];
    } else if (provider === 'windows') {
      priorityOrder = ['windows', 'gtts', 'coqui', 'xtts', 'piper', 'huggingface', 'espeak', 'silent'];
    } else if (provider === 'huggingface') {
      priorityOrder = ['huggingface', 'gtts', 'coqui', 'xtts', 'piper', 'windows', 'espeak', 'silent'];
    } else {
      // Default/Auto: Try best available (XTTS-v2 first if installed, then Coqui)
      priorityOrder = ['xtts', 'coqui', 'piper', 'gtts', 'windows', 'huggingface', 'espeak', 'silent'];
    }
    
    // Build final list
    return priorityOrder
      .map(key => allMethods[key])
      .filter(method => method); // Remove undefined
  }

  async generateWithGTTS(text, outputPath) {
    try {
      console.log('🎤 [gTTS] Generating speech with Google Translate TTS...');
      const gtts = require('gtts');
      
      // CRITICAL: Preprocess text for natural pauses (punctuation-aware)
      const preprocessedText = this.preprocessTextForNaturalPauses(text);
      
      // Split long text into chunks (gTTS has 200 char limit per request)
      const maxChunkLength = 200;
      if (preprocessedText.length <= maxChunkLength) {
        // CRITICAL: Changed slow: false → true for slower, more natural speech
        // slow: true makes speech ~25% slower, more human-like pacing
        const gttsInstance = new gtts(preprocessedText, 'en', { slow: true });
        const mp3Path = outputPath.replace('.wav', '.mp3');
        return new Promise((resolve, reject) => {
          gttsInstance.save(mp3Path, async (err) => {
            if (err) {
              console.error('❌ [gTTS] Error:', err.message);
              reject(err);
            } else {
              // Convert MP3 to WAV with better quality settings
              await this.convertToWAV(mp3Path, outputPath);
              try { fs.unlinkSync(mp3Path); } catch (e) {}
              console.log('✅ [gTTS] Speech generated successfully!');
              resolve(outputPath);
            }
          });
        });
      } else {
        // Handle long text by splitting into sentences
        console.log(`📝 [gTTS] Text is long (${preprocessedText.length} chars), splitting into chunks...`);
        const sentences = preprocessedText.match(/[^.!?]+[.!?]+/g) || [preprocessedText];
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChunkLength) {
            currentChunk += sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        console.log(`📦 [gTTS] Split into ${chunks.length} chunks`);
        
        // Generate audio for each chunk with improved quality
        const chunkPaths = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkPath = outputPath.replace('.wav', `_chunk${i}.mp3`);
          // CRITICAL: Changed slow: false → true for slower, more natural speech
          const gttsInstance = new gtts(chunks[i], 'en', { slow: true }); // Slower, more natural speed
          await new Promise((resolve, reject) => {
            gttsInstance.save(chunkPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          chunkPaths.push(chunkPath);
        }
        
        // Concatenate chunks using FFmpeg
        console.log('🔗 [gTTS] Concatenating audio chunks...');
        await this.concatenateAudioFiles(chunkPaths, outputPath);
        
        // Clean up chunk files
        chunkPaths.forEach(p => {
          try { fs.unlinkSync(p); } catch (e) {}
        });
        
        console.log('✅ [gTTS] Long speech generated successfully!');
        return outputPath;
      }
    } catch (error) {
      console.error('❌ [gTTS] Error:', error.message);
      throw error;
    }
  }
  
  async concatenateAudioFiles(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const listFile = outputPath.replace('.wav', '_list.txt');
      
      // Create concat list file
      const listContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(listFile, listContent);
      
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        '-y',
        outputPath
      ], { windowsHide: true });
      
      ffmpeg.on('close', (code) => {
        try { fs.unlinkSync(listFile); } catch (e) {}
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg concat failed with code ${code}`));
      });
      
      ffmpeg.on('error', reject);
    });
  }

  isXTTSInstalled() {
    try {
      const xttsTTS = require('./xttsTTS');
      return fs.existsSync(xttsTTS.apiScriptPath);
    } catch (error) {
      return false;
    }
  }

  isCoquiInstalled() {
    try {
      const { execSync} = require('child_process');
      execSync('tts --help', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  isPiperInstalled() {
    try {
      const piperPath = process.env.PIPER_PATH || 'piper';
      const piperModel = process.env.PIPER_MODEL;
      
      // Check if piper executable exists
      if (piperPath !== 'piper' && !fs.existsSync(piperPath)) {
        console.log(`⚠️ Piper executable not found at: ${piperPath}`);
        return false;
      }
      
      // Check if model exists
      if (!piperModel || !fs.existsSync(piperModel)) {
        console.log(`⚠️ Piper model not found at: ${piperModel}`);
        return false;
      }
      
      console.log(`✅ Piper TTS found: ${piperPath} with model ${piperModel}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Piper check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Script içeriğinden otomatik dil tespiti
   * Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ) varsa 'tr', yoksa 'en' döner
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return 'en'; // Varsayılan
    }
    // Türkçe karakterler: ç, ğ, ı, ö, ş, ü, İ
    const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
    if (turkishChars.test(text)) {
      return 'tr';
    }
    return 'en'; // Varsayılan
  }

  async generateWithXTTS(text, outputPath) {
    try {
      const xttsTTS = require('./xttsTTS');
      // Get selected XTTS voice from options (if provided), otherwise use env variable or default
      const selectedVoice = this.selectedXTTSVoice || process.env.XTTS_VOICE || 'narrator_sample_2.wav';
      // AUTOMATIC LANGUAGE DETECTION: Detect from text if not set in env
      const language = process.env.XTTS_LANGUAGE || this.detectLanguage(text);
      
      if (language === 'tr') {
        console.log(`🌍 [XTTS-v2] Auto-detected language: Turkish (from script content)`);
      } else {
        console.log(`🌍 [XTTS-v2] Using language: ${language} (${process.env.XTTS_LANGUAGE ? 'from env' : 'auto-detected'})`);
      }
      
      const options = {
        speakerWav: path.join(xttsTTS.voiceSamplesDir, selectedVoice),
        language: language
      };
      
      if (this.selectedXTTSVoice) {
        console.log(`🎭 [XTTS-v2] Using voice: ${selectedVoice}`);
      }
      
      if (text.length > 500) {
        return await xttsTTS.generateLongSpeech(text, outputPath, options);
      } else {
        return await xttsTTS.generateSpeech(text, outputPath, options);
      }
    } catch (error) {
      throw new Error(`XTTS-v2 failed: ${error.message}`);
    }
  }

  async generateWithCoqui(text, outputPath) {
    try {
      const coquiTTS = require('./coquiTTS');
      // Get selected Coqui speaker from options (if provided), otherwise use env variable or default
      const selectedCoquiSpeaker = this.selectedCoquiSpeaker || process.env.COQUI_SPEAKER || undefined;
      const options = {
        model: process.env.COQUI_MODEL || undefined,
        vocoder: process.env.COQUI_VOCODER || undefined,
        speaker: selectedCoquiSpeaker, // Use selected speaker if available
        lengthScale: process.env.COQUI_LENGTH_SCALE || undefined,
        noiseScale: process.env.COQUI_NOISE_SCALE || undefined,
        useCuda: ((process.env.USE_CUDA || '').toString().toLowerCase() === 'true')
      };
      
      if (selectedCoquiSpeaker) {
        console.log(`🎤 [Coqui TTS] Using speaker: ${selectedCoquiSpeaker}`);
      }
      
      if (text.length > 500) {
        return await coquiTTS.generateLongSpeech(text, outputPath, options);
      } else {
        return await coquiTTS.generateSpeech(text, outputPath, options);
      }
    } catch (error) {
      throw new Error(`Coqui TTS failed: ${error.message}`);
    }
  }

  async generateWithHuggingFace(text) {
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error('HuggingFace API key not configured');
    }
    try {
      const response = await axios.post(
        this.huggingfaceTtsUrl,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );
      if (!response.data || response.data.length === 0) {
        throw new Error('Empty response from TTS service');
      }
      return response.data;
    } catch (error) {
      console.error('[TTS] HuggingFace TTS Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
      throw error;
    }
  }

  isEspeakAvailable() {
    if (this.isWindows) {
      try {
        const espeakPath = 'C:\\Program Files\\eSpeak\\command_line\\espeak.exe';
        if (fs.existsSync(espeakPath)) {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    } else {
      try {
        require('child_process').execSync('espeak --version');
        return true;
      } catch {
        return false;
      }
    }
  }

  async generateWithEspeak(text, outputPath) {
    return new Promise((resolve, reject) => {
      const espeakCmd = this.isWindows 
        ? 'C:\\Program Files\\eSpeak\\command_line\\espeak.exe'
        : 'espeak';
      const args = ['-v', 'en-us', '-s', '170', '-w', outputPath, text];
      console.log(`[TTS] Running eSpeak: ${espeakCmd} ${args.join(' ')}`);
      const espeak = spawn(espeakCmd, args, { windowsHide: true });
      espeak.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          console.log(`✅ TTS generated with eSpeak: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`eSpeak failed with code ${code}`));
        }
      });
      espeak.on('error', (error) => {
        console.error('eSpeak error:', error);
        reject(error);
      });
    });
  }

  async generateWithWindowsTTS(text, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const { exec } = require('child_process');
        const escapedPath = outputPath.replace(/'/g, "''").replace(/[&$<>()|]/g, '^$&');
        const escapedText = text
          .replace(/['"`$]/g, '')
          .replace(/[&<>|^]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const tempScript = path.join(this.outputDir, `tts_${Date.now()}.ps1`);
        const psScript = `
          try {
            Add-Type -AssemblyName System.Speech;
            $synthesizer = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer;
            $synthesizer.SetOutputToWaveFile('${escapedPath}');
            $synthesizer.Speak('${escapedText}');
            $synthesizer.Dispose();
            exit 0;
          } catch {
            Write-Error $_;
            exit 1;
          }
        `;
        fs.writeFileSync(tempScript, psScript, 'utf8');
        const command = `powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${tempScript.replace(/\\/g, '\\\\')}"`;
        exec(command, (error, stdout, stderr) => {
          try { if (fs.existsSync(tempScript)) { fs.unlinkSync(tempScript); } } catch {}
          if (error) {
            console.error('Windows TTS error:', { error, stderr });
            reject(new Error(`Windows TTS failed: ${stderr || error.message}`));
          } else if (fs.existsSync(outputPath)) {
            console.log(`✅ Windows TTS generated: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error('Windows TTS failed to create output file'));
          }
        });
      } catch (error) {
        console.error('Windows TTS setup error:', error);
        reject(error);
      }
    });
  }

  async generateWithCrossPlatformTTS(text, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        let command;
        if (this.isWindows) {
          const psScript = `
            Add-Type -AssemblyName System.Speech
            $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
            $synthesizer.SetOutputToWaveFile("${outputPath}")
            $synthesizer.Speak("${text.replace(/"/g, '\\"')}")
            $synthesizer.Dispose()
          `;
          const tempScript = path.join(__dirname, '..', 'temp', `tts_${Date.now()}.ps1`);
          fs.writeFileSync(tempScript, psScript, 'utf8');
          command = `powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${tempScript.replace(/\\/g, '\\\\')}"`;
          const { exec } = require('child_process');
          exec(command, (error, stdout, stderr) => {
            try { if (fs.existsSync(tempScript)) { fs.unlinkSync(tempScript); } } catch {}
            if (error) {
              console.error('Windows TTS error:', { error, stderr });
              reject(new Error(`Windows TTS failed: ${stderr || error.message}`));
            } else if (fs.existsSync(outputPath)) {
              console.log(`✅ Windows TTS generated: ${outputPath}`);
              resolve(outputPath);
            } else {
              reject(new Error('Windows TTS failed to create output file'));
            }
          });
        } else {
          command = `echo "${text.replace(/"/g, '\\"')}" | festival --tts --output ${outputPath}`;
          const { exec } = require('child_process');
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error('Festival TTS error:', { error, stderr });
              reject(new Error(`Festival TTS failed: ${stderr || error.message}`));
            } else if (fs.existsSync(outputPath)) {
              console.log(`✅ Festival TTS generated: ${outputPath}`);
              resolve(outputPath);
            } else {
              reject(new Error('Festival TTS failed to create output file'));
            }
          });
        }
      } catch (error) {
        console.error('Cross-Platform TTS setup error:', error);
        reject(error);
      }
    });
  }

  // Piper TTS via CLI
  async generateWithPiper(text, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Use PIPER_PATH (correct) or fallback to PIPER_BIN (legacy)
        const piperBin = process.env.PIPER_PATH || process.env.PIPER_BIN || 'piper';
        
        // CRITICAL: Use selected voice if provided, otherwise use env variable or default
        // User selection ALWAYS takes priority over env variable
        let modelPath = null;
        if (this.selectedPiperVoice && this.selectedPiperVoice !== 'auto') {
          modelPath = this.selectedPiperVoice;
          console.log(`🎤 [Piper] ✅ USER-SELECTED VOICE: ${path.basename(modelPath)} (ignoring PIPER_MODEL env variable)`);
        } else {
          modelPath = process.env.PIPER_MODEL || process.env.PIPER_VOICE_PATH;
          console.log(`🎤 [Piper] Using default voice from env: ${modelPath ? path.basename(modelPath) : 'not set'}`);
        }
        
        // Check if Piper executable exists
        if (!fs.existsSync(piperBin)) {
          return reject(new Error(`Piper executable not found at: ${piperBin}. Please install Piper (see PIPER_KURULUM_REHBERI.md)`));
        }
        
        // Check if model exists
        if (!modelPath || !fs.existsSync(modelPath)) {
          return reject(new Error(`Piper model not found at: ${modelPath}. Please download model (see PIPER_KURULUM_REHBERI.md)`));
        }

        // Optional config JSON
        let configPath = process.env.PIPER_VOICE_CONFIG || '';
        if (!configPath) {
          const inferred = `${modelPath}.json`;
          if (fs.existsSync(inferred)) configPath = inferred;
        }

        // Optional espeak-ng data directory (fixes phontab not found errors)
        const espeakData = process.env.PIPER_ESPEAK_DATA; // e.g., C:\piper\espeak-ng-data

        const args = ['--model', modelPath, '--output_file', outputPath];
        if (configPath) args.push('--config', configPath);
        // Prefer setting working dir and env; also pass --data-dir to be safe
        if (espeakData && fs.existsSync(espeakData)) {
          // point data-dir to parent folder so piper can discover voices and espeak dir
          const dataDir = path.dirname(espeakData);
          args.push('--data-dir', dataDir);
        }
        // CRITICAL: Add length_scale parameter for slower, more natural speech
        // Higher length_scale = slower, more human-like pacing (default: 1.0, improved: 1.25)
        const piperLengthScale = process.env.PIPER_LENGTH_SCALE || '1.25';
        args.push('--length_scale', piperLengthScale);
        args.push('--debug');
        // CRITICAL: Preprocess text for natural pauses (punctuation-aware)
        // Add extra spaces after punctuation marks for TTS to interpret as pauses
        const preprocessedText = this.preprocessTextForNaturalPauses(text);
        
        const piper = spawn(
          piperBin,
          args,
          {
            stdio: ['pipe', 'inherit', 'inherit'],
            windowsHide: true,
            cwd: espeakData && fs.existsSync(espeakData) ? espeakData : undefined,
            env: {
              ...process.env,
              // Try multiple env vars used by espeak-ng across platforms
              ESPEAK_NG_DATA_PATH: espeakData || process.env.ESPEAK_NG_DATA_PATH,
              ESPEAK_DATA_PATH: espeakData || process.env.ESPEAK_DATA_PATH,
              ESPEAK_NG_DATA: espeakData || process.env.ESPEAK_NG_DATA,
            },
          }
        );
        piper.stdin.write(preprocessedText);
        piper.stdin.end();
        piper.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            console.log(`✅ Piper TTS generated: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`Piper TTS failed with code ${code}`));
          }
        });
        piper.on('error', (err) => reject(err));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Preprocess text for natural pauses (punctuation-aware)
   * Similar to Coqui TTS preprocessing but optimized for Piper TTS and gTTS
   * Adds extra spaces after punctuation marks for TTS to interpret as pauses
   * 
   * PROFESSIONAL: Noktalama işaretlerinden sonra daha fazla boşluk ekleniyor
   * TTS motorları boşlukları doğal duraklamalar olarak yorumlar
   * Hedef süreler (ARTIRILMIŞ DURAKLAMALAR - DAHA ANLAŞILIR):
   * - Nokta (.) : 6 boşluk (uzun duraklama ~1.2s)
   * - Ünlem (!) : 5 boşluk (orta-uzun duraklama ~1.0s)
   * - Soru (?) : 5 boşluk (orta-uzun duraklama ~1.0s)
   * - Virgül (,) : 3 boşluk (kısa duraklama ~0.5s)
   * - Noktalı virgül (;) : 4 boşluk (orta duraklama ~0.7s)
   * - İki nokta (:) : 3 boşluk (kısa duraklama ~0.5s)
   * - Em dash (—) : 6 boşluk (uzun duraklama ~1.2s)
   */
  preprocessTextForNaturalPauses(text) {
    if (!text || typeof text !== 'string') return text;
    
    let processedText = text;
    
    // CRITICAL: Ellipsis'leri em dash (—) ile değiştir
    // PROFESSIONAL: Em dash'ten sonra 6 boşluk ekle (uzun duraklama ~1.2s)
    processedText = processedText.replace(/…/g, ' —      ');
    processedText = processedText.replace(/\.\.\./g, ' —      ');
    
    // PROFESSIONAL: Mevcut em dash'lerden sonra 6 boşluk ekle (uzun duraklama ~1.2s)
    processedText = processedText.replace(/—([^\s\n])/g, '—      $1');
    processedText = processedText.replace(/—\s([^\s\n])/g, '—      $1');
    processedText = processedText.replace(/—\s{2}([^\s\n])/g, '—      $1');
    processedText = processedText.replace(/—\s{3}([^\s\n])/g, '—      $1');
    processedText = processedText.replace(/—\s{4}([^\s\n])/g, '—      $1');
    processedText = processedText.replace(/—\s{5}([^\s\n])/g, '—      $1');
    
    // PROFESSIONAL: Noktadan sonra 6 boşluk ekle (uzun duraklama ~1.2s)
    processedText = processedText.replace(/\.([^\s\n])/g, '.      $1');
    processedText = processedText.replace(/\.\s([^\s\n])/g, '.      $1');
    processedText = processedText.replace(/\.\s{2}([^\s\n])/g, '.      $1');
    processedText = processedText.replace(/\.\s{3}([^\s\n])/g, '.      $1');
    processedText = processedText.replace(/\.\s{4}([^\s\n])/g, '.      $1');
    processedText = processedText.replace(/\.\s{5}([^\s\n])/g, '.      $1');
    
    // PROFESSIONAL: Soru işareti ve ünlem işaretinden sonra 5 boşluk ekle (orta-uzun duraklama ~1.0s)
    processedText = processedText.replace(/([!?])([^\s\n])/g, '$1     $2');
    processedText = processedText.replace(/([!?])\s([^\s\n])/g, '$1     $2');
    processedText = processedText.replace(/([!?])\s{2}([^\s\n])/g, '$1     $2');
    processedText = processedText.replace(/([!?])\s{3}([^\s\n])/g, '$1     $2');
    processedText = processedText.replace(/([!?])\s{4}([^\s\n])/g, '$1     $2');
    
    // PROFESSIONAL: Virgülden sonra 3 boşluk ekle (kısa duraklama ~0.5s)
    processedText = processedText.replace(/,([^\s\n])/g, ',   $1');
    processedText = processedText.replace(/,\s([^\s\n])/g, ',   $1');
    processedText = processedText.replace(/,\s{2}([^\s\n])/g, ',   $1');
    
    // PROFESSIONAL: Noktalı virgülden sonra 4 boşluk ekle (orta duraklama ~0.7s)
    processedText = processedText.replace(/;([^\s\n])/g, ';    $1');
    processedText = processedText.replace(/;\s([^\s\n])/g, ';    $1');
    processedText = processedText.replace(/;\s{2}([^\s\n])/g, ';    $1');
    processedText = processedText.replace(/;\s{3}([^\s\n])/g, ';    $1');
    
    // PROFESSIONAL: İki nokta üst üsteden sonra 3 boşluk ekle (kısa duraklama ~0.5s)
    processedText = processedText.replace(/:([^\s\n])/g, ':   $1');
    processedText = processedText.replace(/:\s([^\s\n])/g, ':   $1');
    processedText = processedText.replace(/:\s{2}([^\s\n])/g, ':   $1');
    
    // Fazla boşlukları temizle (8+ boşluk → 6 boşluk, 7 boşluk → 6 boşluk)
    processedText = processedText.replace(/\s{8,}/g, '      ');
    processedText = processedText.replace(/\s{7}/g, '      ');
    
    return processedText.trim();
  }

  async convertToWAV(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      // Convert to high-quality WAV with audio enhancement
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '48000',        // 48kHz sample rate (professional quality)
        '-ac', '1',            // Mono
        '-c:a', 'pcm_s16le',   // PCM 16-bit
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,highpass=f=80,lowpass=f=12000', // Audio normalization and cleanup
        '-y',
        outputPath
      ], { windowsHide: true });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg conversion failed with code ${code}`));
      });
      
      ffmpeg.on('error', reject);
    });
  }

  createSilentAudio(outputPath, text) {
    return new Promise((resolve, reject) => {
      try {
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(16000, 24);
        header.writeUInt32LE(32000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(0, 40);
        fs.writeFileSync(outputPath, header);
        console.log(`⚠️  Created silent audio (TTS unavailable): ${outputPath}`);
        console.log(`📝 Text that would be spoken: "${text}"`);
        resolve(outputPath);
      } catch (error) {
        console.error('Error creating silent audio:', error);
        reject(error);
      }
    });
  }

  async testTTS() {
    try {
      const testPath = await this.generateSpeech('This is a test of the text to speech system.', 'test');
      return { success: true, audioPath: testPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TTSService();
