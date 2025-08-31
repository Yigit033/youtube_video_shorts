const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'audio');
    this.ensureOutputDir();
    
    // Environment-based TTS priority
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isWindows = process.platform === 'win32';
    
    // TTS Configuration from environment
    this.ttsProvider = process.env.TTS_PROVIDER || (this.isProduction ? 'edge' : 'windows');
    this.ttsVoice = process.env.TTS_VOICE || 'en-US-Studio-O';
    
    // Using a more reliable TTS model
    this.huggingfaceTtsUrl = 'https://api-inference.huggingface.co/models/facebook/mms-tts-eng';
    
    console.log('TTS Service Initialized');
    console.log(`- Platform: ${process.platform}`);
    console.log(`- Environment: ${this.isProduction ? 'Production' : 'Development'}`);
    console.log(`- TTS Provider: ${this.ttsProvider}`);
    console.log(`- TTS Voice: ${this.ttsVoice}`);
    console.log(`- Output Directory: ${this.outputDir}`);
    console.log(`- Using TTS Model: ${this.huggingfaceTtsUrl}`);
    
    if (this.isProduction) {
      console.log('- Production Mode: Using Edge TTS as primary');
    } else if (this.isWindows) {
      console.log('- Development Mode: Using Windows TTS as primary');
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateSpeech(text, filename) {
    console.log(`\n[TTS Service] Generating speech for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    const outputPath = path.join(this.outputDir, `${filename}.wav`);
    
    // Environment-based TTS method priority
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
        if (method.name === 'Edge TTS (Microsoft)') {
          console.log('💡 Edge TTS failed, this might be due to network issues or rate limits');
        }
        continue; // Try next method
      }
    }
    
    // Final fallback: Silent audio
    console.log('[TTS] All TTS methods failed, creating silent audio...');
    return await this.createSilentAudio(outputPath, text);
  }

  getTTSMethods() {
    if (this.isProduction) {
      // Production: Edge TTS → Local → Fallback
      return [
        {
          name: 'Edge TTS (Microsoft)',
          skip: () => false,
          func: async (text, outputPath) => {
            return await this.generateWithEdgeTTS(text, outputPath);
          }
        },
        {
          name: 'Windows TTS',
          condition: () => this.isWindows,
          func: async (text, outputPath) => {
            return await this.generateWithWindowsTTS(text, outputPath);
          }
        },
        {
          name: 'eSpeak',
          condition: () => this.isEspeakAvailable(),
          func: async (text, outputPath) => {
            return await this.generateWithEspeak(text, outputPath);
          }
        },
        {
          name: 'Silent Audio',
          func: async (text, outputPath) => {
            return await this.createSilentAudio(outputPath, text);
          }
        }
      ];
    } else {
      // Development: Windows TTS → Edge TTS → eSpeak → Fallback
      return [
        {
          name: 'Windows TTS',
          condition: () => this.isWindows,
          func: async (text, outputPath) => {
            return await this.generateWithWindowsTTS(text, outputPath);
          }
        },
        {
          name: 'Edge TTS (Microsoft)',
          skip: () => false,
          func: async (text, outputPath) => {
            return await this.generateWithEdgeTTS(text, outputPath);
          }
        },
        {
          name: 'HuggingFace TTS',
          skip: () => process.env.NODE_ENV === 'production',
          func: async (text, outputPath) => {
            try {
              const audioData = await this.generateWithHuggingFace(text);
              fs.writeFileSync(outputPath, audioData);
              return outputPath;
            } catch (error) {
              if (error.response?.status === 404) {
                console.log('ℹ️  HuggingFace model not found. This is expected if you\'re using the free tier.');
                throw error;
              }
              throw error;
            }
          }
        },
        {
          name: 'eSpeak',
          condition: () => this.isEspeakAvailable(),
          func: async (text, outputPath) => {
            return await this.generateWithEspeak(text, outputPath);
          }
        },
        {
          name: 'Silent Audio',
          func: async (text, outputPath) => {
            return await this.createSilentAudio(outputPath, text);
          }
        }
      ];
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
        // Check if eSpeak is installed in Program Files
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
      
      const args = [
        '-v', 'en-us',
        '-s', '170',
        '-w', outputPath,
        text
      ];
      
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

  // Windows TTS using the built-in speech API
  async generateWithWindowsTTS(text, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const { exec } = require('child_process');
        
        // Escape single quotes and special characters in file path and text
        const escapedPath = outputPath.replace(/'/g, "''").replace(/[&$<>()|]/g, '^$&');
        const escapedText = text
          .replace(/['"`$]/g, '')  // Remove quotes and backticks that could break the command
          .replace(/[&<>|^]/g, '')  // Remove other problematic characters
          .replace(/\s+/g, ' ')     // Normalize whitespace
          .trim();
        
        // Create a temporary file for the PowerShell script
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
        
        // Execute the PowerShell script
        const command = `powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${tempScript.replace(/\\/g, '\\\\')}"`;
        
        exec(command, (error, stdout, stderr) => {
          // Clean up the temporary script
          try { 
            if (fs.existsSync(tempScript)) {
              fs.unlinkSync(tempScript);
            }
          } catch (e) {
            console.warn('Could not clean up temporary script:', e.message);
          }
          
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

  // Edge TTS Implementation (Microsoft'ın Ücretsiz Servisi)
  async generateWithEdgeTTS(text, outputPath) {
    try {
      const edgeTTS = require('edge-tts');
      const voice = this.ttsVoice || 'en-US-Studio-O'; // Environment'dan al veya default kullan
      
      await edgeTTS.edgeTTS(text, voice, outputPath);
      console.log(`🎯 Edge TTS generated successfully with voice: ${voice}`);
      return outputPath;
    } catch (error) {
      console.error('Edge TTS Error:', error.message);
      throw error;
    }
  }

  createSilentAudio(outputPath, text) {
    return new Promise((resolve, reject) => {
      try {
        // Create a simple WAV file with silence
        const fs = require('fs');
        const header = Buffer.alloc(44);
        
        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(36, 4); // File size - 8
        header.write('WAVE', 8);
        
        // fmt subchunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk1Size
        header.writeUInt16LE(1, 20);  // AudioFormat (PCM)
        header.writeUInt16LE(1, 22);  // NumChannels
        header.writeUInt32LE(16000, 24); // SampleRate
        header.writeUInt32LE(32000, 28); // ByteRate
        header.writeUInt16LE(2, 32);    // BlockAlign
        header.writeUInt16LE(16, 34);   // BitsPerSample
        
        // data subchunk
        header.write('data', 36);
        header.writeUInt32LE(0, 40);    // Data size (0 for silence)
        
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
