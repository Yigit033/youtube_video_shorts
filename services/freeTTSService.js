const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const edgeTTS = require('edge-tts');
const os = require('os');

class FreeTTSService {
  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    this.isWindows = process.platform === 'win32';
    this.tempDir = path.join(process.cwd(), 'temp', 'tts');
    this.ensureTempDir();
    
    // Supported voices with better language coverage
    this.supportedVoices = {
      'en-US': 'en-US-Studio-O', // High quality voice
      'en-GB': 'en-GB-SoniaNeural',
      'es-ES': 'es-ES-ElviraNeural',
      'fr-FR': 'fr-FR-DeniseNeural',
      'de-DE': 'de-DE-KatjaNeural',
      'it-IT': 'it-IT-ElsaNeural',
      'pt-BR': 'pt-BR-FranciscaNeural',
      'ru-RU': 'ru-RU-SvetlanaNeural',
      'ja-JP': 'ja-JP-NanamiNeural',
      'ko-KR': 'ko-KR-SunHiNeural',
      'zh-CN': 'zh-CN-XiaoxiaoNeural',
      'hi-IN': 'hi-IN-SwaraNeural',
      'ar-SA': 'ar-SA-ZariyahNeural',
      'tr-TR': 'tr-TR-EmelNeural'
    };
    
    this.defaultVoice = 'en-US';
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    
    // Initialize Web Speech API in browser
    if (this.isBrowser) {
      this.synth = window.speechSynthesis;
      this.voices = [];
      this.loadVoices();
    }
  }
  
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  // Load available voices for Web Speech API
  loadVoices() {
    if (this.isBrowser) {
      this.synth.onvoiceschanged = () => {
        this.voices = this.synth.getVoices();
        console.log('Voices loaded:', this.voices.length);
      };
      this.voices = this.synth.getVoices();
    }
  }
  
  // Get the best available voice for a language
  getVoiceForLanguage(lang = 'en-US') {
    if (this.isBrowser) {
      const langPrefix = lang.split('-')[0];
      const exactMatch = this.voices.find(v => v.lang === lang);
      if (exactMatch) return exactMatch;
      
      const langMatch = this.voices.find(v => v.lang.startsWith(langPrefix));
      if (langMatch) return langMatch;
      
      return this.voices[0] || null;
    }
    return this.supportedVoices[lang] || this.supportedVoices[this.defaultVoice];
  }

  /**
   * Generate speech using the best available method for the environment
   * @param {string} text - Text to convert to speech
   * @param {string} [language='en-US'] - Language code
   * @param {number} [rate=1] - Speech rate (0.5 to 2)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, language = 'en-US', rate = 1) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input');
    }
    
    // Validate rate
    rate = Math.min(2, Math.max(0.5, rate));
    
    const tempFile = path.join(this.tempDir, `tts_${Date.now()}.mp3`);
    
    try {
      // Use Web Speech API in browser
      if (this.isBrowser) {
        return await this.generateWithWebSpeech(text, language, rate);
      }
      
      // Try edge-tts first
      try {
        await this.generateWithEdgeTTS(text, language, rate, tempFile);
        return fs.readFileSync(tempFile);
      } catch (edgeError) {
        console.warn('Edge TTS failed, falling back to Windows TTS:', edgeError.message);
        
        // Fallback to Windows TTS on Windows
        if (this.isWindows) {
          try {
            await this.generateWithWindowsTTS(text, language, tempFile);
            return fs.readFileSync(tempFile);
          } catch (windowsError) {
            console.error('Windows TTS failed:', windowsError.message);
          }
        }
        
        throw new Error('All TTS methods failed');
      }
    } catch (error) {
      console.error('❌ Error in textToSpeech:', error.message);
      
      // Provide a helpful error message for common issues
      if (error.message.includes('ENOENT') && error.message.includes('ffmpeg')) {
        throw new Error('FFmpeg is required but not found. Please install FFmpeg and add it to your PATH.');
      }
      
      throw error;
    } finally {
      // Clean up temp file if it exists
      try { 
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        console.warn('Failed to clean up temp file:', e.message);
      }
    }
  }

  /**
   * Generate speech using Web Speech API (browser only)
   * @private
   */
  generateWithWebSpeech(text, language = 'en-US', rate = 1) {
    return new Promise((resolve, reject) => {
      if (!this.isBrowser) {
        reject(new Error('Web Speech API is only available in browser'));
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      utterance.voice = this.getVoiceForLanguage(language);
      utterance.rate = rate;
      utterance.onend = () => {
        const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => resolve(Buffer.from(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(audioBlob);
      };
      
      this.synth.speak(utterance);
    });
  }
  
  /**
   * Generate speech using Edge TTS
   * @private
   */
  async generateWithEdgeTTS(text, language = 'en-US', rate = 1, outputPath) {
    const voice = this.getVoiceForLanguage(language);
    await edgeTTS.synthesize({
      text: text,
      voice: voice,
      rate: `${Math.round(rate * 100)}%`,
      pitch: '0%',
      volume: '100%'
    }).then(audio => {
      return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(outputPath);
        audio.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    });
  }
  
  /**
   * Generate speech using Windows TTS (Windows only)
   * @private
   */
  async generateWithWindowsTTS(text, language = 'en-US', outputPath) {
    if (!this.isWindows) {
      throw new Error('Windows TTS is only available on Windows');
    }
    
    // Use PowerShell for TTS
    const psCommand = `Add-Type -AssemblyName System.speech; ` +
      `$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
      `$speak.SetOutputToWaveFile('${outputPath}'); ` +
      `$speak.Speak([string]'${text.replace(/'/g, "''")}'); ` +
      `$speak.Dispose()`;
    
    await execPromise(`powershell -Command "${psCommand}"`);
  }
  
  /**
   * Save speech to a file
   * @param {string} text - Text to convert to speech
   * @param {string} outputPath - Output file path
   * @param {string} [language='en-US'] - Language code
   * @param {number} [rate=1] - Speech rate (0.5 to 2)
   * @returns {Promise<string>} Path to the generated audio file
   */
  async saveToFile(text, outputPath, language = 'en-US', rate = 1) {
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Generate speech and save to file
      const audioBuffer = await this.textToSpeech(text, language, rate);
      fs.writeFileSync(outputPath, audioBuffer);
      
      console.log(`✅ Speech saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('❌ Error saving speech to file:', error.message);
      throw error;
    }
  }

  /**
   * Get list of supported languages
   * @returns {Array} List of supported language codes
   */
  getSupportedLanguages() {
    return Object.keys(this.supportedVoices);
  }

  /**
   * Get voice for a specific language
   * @param {string} language - Language code
   * @returns {string} Voice name
   */
  getVoiceForLanguage(language = 'en-US') {
    // Map language codes to voice names
    const voiceMap = {
      'en-US': 'en-US-AriaNeural',
      'en-GB': 'en-GB-SoniaNeural',
      'es-ES': 'es-ES-ElviraNeural',
      'fr-FR': 'fr-FR-DeniseNeural',
      'de-DE': 'de-DE-KatjaNeural',
      'it-IT': 'it-IT-ElsaNeural',
      'pt-BR': 'pt-BR-FranciscaNeural',
      'ru-RU': 'ru-RU-DariyaNeural',
      'ja-JP': 'ja-JP-NanamiNeural',
      'ko-KR': 'ko-KR-SunHiNeural',
      'zh-CN': 'zh-CN-XiaoxiaoNeural',
      'hi-IN': 'hi-IN-SwaraNeural',
      'ar-SA': 'ar-SA-ZariyahNeural'
    };
    
    return voiceMap[language] || voiceMap['en-US'];
  }
  
  /**
   * Get list of available voices for a language
   * @param {string} language - Language code
   * @returns {Array} List of available voices
   */
  getVoices(language = 'en-US') {
    return [this.getVoiceForLanguage(language)];
  }
}

module.exports = new FreeTTSService();
