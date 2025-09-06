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
    
    this.ttsProvider = process.env.TTS_PROVIDER || (this.isProduction ? 'huggingface' : 'windows');
    this.ttsVoice = process.env.TTS_VOICE || 'Microsoft David Desktop';
    
    this.huggingfaceTtsUrl = 'https://api-inference.huggingface.co/models/facebook/mms-tts-eng';
    
    console.log('TTS Service Initialized');
    console.log(`- Platform: ${process.platform}`);
    console.log(`- Environment: ${this.isProduction ? 'Production' : 'Development'}`);
    console.log(`- TTS Provider: ${this.ttsProvider}`);
    console.log(`- TTS Voice: ${this.ttsVoice}`);
    console.log(`- Output Directory: ${this.outputDir}`);
    console.log(`- Using TTS Model: ${this.huggingfaceTtsUrl}`);
    
    if (this.isProduction) {
      console.log('- Production Mode: Using Cross-Platform TTS as primary');
    } else if (this.isWindows) {
      console.log('- Development Mode: Using Cross-Platform TTS as primary');
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateSpeech(text, filename) {
    if (!text || typeof text !== 'string') {
      console.warn('⚠️  TTS Service: Invalid text parameter, using fallback text');
      text = 'This is a fallback text for text to speech generation.';
    }
    
    console.log(`\n[TTS Service] Generating speech for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
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
    if (this.isProduction) {
      // Production: Piper → gTTS → HuggingFace → Windows → eSpeak → Silent
      return [
        {
          name: 'Piper TTS (CLI)',
          func: async (text, outputPath) => this.generateWithPiper(text, outputPath),
        },
        {
          name: 'Google Translate TTS',
          func: async (text, outputPath) => this.generateWithGTTS(text, outputPath)
        },
        {
          name: 'HuggingFace TTS',
          func: async (text, outputPath) => this.generateWithHuggingFace(text, outputPath)
        },
        {
          name: 'Windows TTS',
          condition: () => this.isWindows,
          func: async (text, outputPath) => this.generateWithWindowsTTS(text, outputPath)
        },
        {
          name: 'eSpeak',
          condition: () => this.isEspeakAvailable(),
          func: async (text, outputPath) => this.generateWithEspeak(text, outputPath)
        },
        {
          name: 'Silent Audio',
          func: async (text, outputPath) => this.createSilentAudio(outputPath, text)
        }
      ];
    } else {
      // Development: Piper → gTTS → Windows → Cross-Platform → HuggingFace → eSpeak → Silent
      return [
        {
          name: 'Piper TTS (CLI)',
          func: async (text, outputPath) => this.generateWithPiper(text, outputPath),
        },
        {
          name: 'Google Translate TTS',
          func: async (text, outputPath) => this.generateWithGTTS(text, outputPath)
        },
        {
          name: 'Windows TTS',
          condition: () => this.isWindows,
          func: async (text, outputPath) => this.generateWithWindowsTTS(text, outputPath)
        },
        {
          name: 'Cross-Platform TTS',
          func: async (text, outputPath) => this.generateWithCrossPlatformTTS(text, outputPath)
        },
        {
          name: 'HuggingFace TTS',
          skip: () => process.env.NODE_ENV === 'production',
          func: async (text, outputPath) => {
            const audioData = await this.generateWithHuggingFace(text);
            fs.writeFileSync(outputPath, audioData);
            return outputPath;
          }
        },
        {
          name: 'eSpeak',
          condition: () => this.isEspeakAvailable(),
          func: async (text, outputPath) => this.generateWithEspeak(text, outputPath)
        },
        {
          name: 'Silent Audio',
          func: async (text, outputPath) => this.createSilentAudio(outputPath, text)
        }
      ];
    }
  }

  async generateWithGTTS(text, outputPath) {
    try {
      console.log('[TTS] Trying Google Translate TTS (High Quality)...');
      const gtts = require('gtts');
      const gttsInstance = new gtts(text, 'en');
      return new Promise((resolve, reject) => {
        gttsInstance.save(outputPath, (err) => {
          if (err) reject(err);
          else {
            console.log('✅ gTTS generated successfully');
            resolve(outputPath);
          }
        });
      });
    } catch (error) {
      console.error('gTTS Error:', error.message);
      throw error;
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
        const voicePath = process.env.PIPER_VOICE_PATH;
        if (!voicePath || !fs.existsSync(voicePath)) {
          return reject(new Error('Piper voice not configured (PIPER_VOICE_PATH missing)'));
        }
        const piperBin = process.env.PIPER_BIN || 'piper'; // allow full path to piper.exe

        // Optional config JSON
        let configPath = process.env.PIPER_VOICE_CONFIG || '';
        if (!configPath) {
          const inferred = `${voicePath}.json`;
          if (fs.existsSync(inferred)) configPath = inferred;
        }

        // Optional espeak-ng data directory (fixes phontab not found errors)
        const espeakData = process.env.PIPER_ESPEAK_DATA; // e.g., C:\piper\espeak-ng-data

        const args = ['--model', voicePath, '--output_file', outputPath];
        if (configPath) args.push('--config', configPath);
        // Prefer setting working dir and env; also pass --data-dir to be safe
        if (espeakData && fs.existsSync(espeakData)) {
          // point data-dir to parent folder so piper can discover voices and espeak dir
          const dataDir = path.dirname(espeakData);
          args.push('--data-dir', dataDir);
        }
        args.push('--debug');
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
        piper.stdin.write(text);
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
