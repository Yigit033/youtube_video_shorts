const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require('fluent-ffmpeg');

class XTTSTTS {
  constructor() {
    this.outputDir = path.join(__dirname, "..", "temp", "audio");
    this.ensureOutputDir();
    
    // Python sanal ortam yolu (venv) - Coqui TTS ile aynı
    this.pythonPath =
      process.platform === "win32"
        ? path.join(__dirname, "..", "venv", "Scripts", "python.exe")
        : path.join(__dirname, "..", "venv", "bin", "python3");

    this.apiScriptPath = path.join(__dirname, "xtts_v2_runner.py");
    this.model = "tts_models/multilingual/multi-dataset/xtts_v2";
    
    // Voice samples klasörü
    this.voiceSamplesDir = path.join(__dirname, "..", "voice_samples");
    
    console.log('🎭 [XTTS-v2] Service initialized');
    console.log(`📁 Voice samples directory: ${this.voiceSamplesDir}`);
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Belgesel tarzı dramatik duraklamalar ekle
   * Coqui TTS'deki ile aynı mantık ama XTTS-v2 için optimize edilmiş
   * 
   * @param {string} text - İşlenecek metin
   * @param {object} options - Ayarlar
   * @param {number} options.pauseInterval - Her kaç cümlede bir durak (1 = her cümle, 2 = her 2 cümle)
   * @param {number} options.pauseDuration - Duraklama süresi (milisaniye, default: 2000 = 2 saniye)
   * @returns {string} - Duraklamalar eklenmiş metin
   */
  insertDocumentaryBreaks(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    
    const pauseInterval = options.pauseInterval || 1;
    const pauseDuration = options.pauseDuration || 2000;
    
    const sentencePattern = /(\[[0-9]+\]\s*)?[^.!?]+[.!?]+/g;
    const sentences = text.match(sentencePattern) || [];
    
    if (sentences.length === 0) {
      return text;
    }
    
    const result = [];
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;
      
      result.push(trimmedSentence);
      
      // Her N cümleden sonra durak ekle (son cümleden önce değil)
      // XTTS-v2 için noktalama işaretlerinden sonra ekstra boşluklar ekleyeceğiz
      if ((index + 1) % pauseInterval === 0 && index < sentences.length - 1) {
        // XTTS-v2 SSML desteği sınırlı, bu yüzden uzun boşluklar kullanıyoruz
        // Her 200ms için 1 boşluk ekle (2000ms = 10 boşluk)
        const spaceCount = Math.floor(pauseDuration / 200);
        result.push(' '.repeat(spaceCount));
      }
    });
    
    return result.join(' ');
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

  /**
   * Metni TTS için ön işleme: Noktalama işaretlerini doğal duraklamalara dönüştürür
   * XTTS-v2 boşlukları duraklama olarak yorumlar
   * 
   * OPTIMIZED: Doğal konuşma akışı için DENGELENMIŞ duraklamalar
   * - Nokta (.) : 2 boşluk (doğal duraklama ~0.4s)
   * - Ünlem (!) : 2 boşluk (doğal duraklama ~0.4s)
   * - Soru (?) : 2 boşluk (doğal duraklama ~0.4s)
   * - Virgül (,) : 1 boşluk (kısa duraklama ~0.2s)
   * - Em dash (—) : 2 boşluk (doğal duraklama ~0.4s)
   */
  preprocessTextForDramaticPauses(text) {
    if (!text || typeof text !== 'string') return text;
    
    let processedText = text;
    
    // CRITICAL: Ellipsis'leri em dash (—) ile değiştir
    processedText = processedText.replace(/…/g, ' — ');
    processedText = processedText.replace(/\.\.\./g, ' — ');
    
    // OPTIMIZED: Em dash'lerden sonra 2 boşluk (doğal)
    processedText = processedText.replace(/—([^\s\n])/g, '—  $1');
    processedText = processedText.replace(/—\s([^\s\n])/g, '—  $1');
    
    // OPTIMIZED: Noktadan sonra 2 boşluk (doğal)
    processedText = processedText.replace(/\.([^\s\n])/g, '.  $1');
    processedText = processedText.replace(/\.\s([^\s\n])/g, '.  $1');
    
    // OPTIMIZED: Soru işareti ve ünlem işaretinden sonra 2 boşluk (doğal)
    processedText = processedText.replace(/([!?])([^\s\n])/g, '$1  $2');
    processedText = processedText.replace(/([!?])\s([^\s\n])/g, '$1  $2');
    
    // OPTIMIZED: Virgülden sonra 1 boşluk (minimal)
    processedText = processedText.replace(/,([^\s\n])/g, ', $1');
    
    // Fazla boşlukları temizle (max 2 boşluk)
    processedText = processedText.replace(/\s{3,}/g, '  ');
    
    // REMOVED: Documentary breaks - fazla beklemelere sebep oluyor
    // XTTS-v2 zaten doğal duraklamalar yapıyor
    
    return processedText.trim();
  }

  /**
   * XTTS-v2 ile ses klonlama
   * @param {string} text - Konuşulacak metin
   * @param {string} outputPath - Çıktı dosyası
   * @param {object} options - Seçenekler
   * @param {string} options.speakerWav - Klonlanacak ses dosyası (narrator_sample_2.wav gibi)
   * @param {string} options.language - Dil (en, tr, es, fr, de, it, pt, pl, ar, cs, ru, nl, zh-cn, ja, ko, hu)
   * @param {boolean} options.skipPreprocessing - Ön işlemeyi atla (chunk'larda kullanılır)
   * @returns {Promise<string>} - Oluşturulan dosya yolu
   */
  async generateSpeech(text, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const speakerWav = options.speakerWav || path.join(this.voiceSamplesDir, "narrator_sample_2.wav");
      // AUTOMATIC LANGUAGE DETECTION: Detect from text if not provided
      const language = options.language || process.env.XTTS_LANGUAGE || this.detectLanguage(text);
      
      // CRITICAL: Metni TTS için ön işleme (dramatik duraklamalar için)
      const processedText = options.skipPreprocessing ? text : this.preprocessTextForDramaticPauses(text);
      
      // Speaker WAV dosyasının varlığını kontrol et
      if (!fs.existsSync(speakerWav)) {
        reject(new Error(`Speaker WAV file not found: ${speakerWav}`));
        return;
      }
      
      console.log(`🎭 [XTTS-v2] Generating speech with voice cloning...`);
      console.log(`   📁 Speaker WAV: ${path.basename(speakerWav)}`);
      console.log(`   🌍 Language: ${language}`);
      console.log(`   📝 Text: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
      
      if (!options.skipPreprocessing) {
        console.log(`🎬 [XTTS-v2] Text preprocessed for dramatic pauses (natural speech flow)`);
      }

      const args = [
        this.apiScriptPath,
        processedText,
        outputPath,
        speakerWav,
        language
      ];

      const pythonProcess = spawn(this.pythonPath, args);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        console.log(`[XTTS-v2:PYTHON] ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        console.error(`[XTTS-v2:ERROR] ${data.toString().trim()}`);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`XTTS-v2 failed with code ${code}: ${stderr}`));
        } else if (fs.existsSync(outputPath)) {
          console.log(`✅ [XTTS-v2] Speech generated: ${path.basename(outputPath)}`);
          resolve(outputPath);
        } else {
          reject(new Error("XTTS-v2 completed but output file not found"));
        }
      });
    });
  }

  /**
   * Uzun metni chunk'lara böl
   * CRITICAL FIX: Tek başına sayıları (10., 9., 8.) bir sonraki cümleyle birleştir
   * CRITICAL LIMIT: XTTS-v2 max 400 tokens (~250 chars), güvenli limit: 200 chars
   * ⚠️ WARNING: XTTS shows warning at 250+ chars and truncates at 400 tokens
   * SMART SPLITTING: Uzun cümleleri virgüllerden böl (doğal duraklama noktaları)
   */
  splitTextIntoChunks(text, maxLength = 200) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = "";

    for (let i = 0; i < sentences.length; i++) {
      let sentence = sentences[i];
      
      // CRITICAL FIX: Tek başına sayı mı kontrol et (örn: "10.", "9.", "8.")
      // Bu tür cümleleri bir sonraki cümleyle birleştir
      const isStandaloneNumber = /^\s*\d+\.\s*$/.test(sentence);
      
      if (isStandaloneNumber && i < sentences.length - 1) {
        // Sayıyı bir sonraki cümleyle birleştir
        sentence = sentence.trim() + ' ' + sentences[i + 1];
        i++; // Bir sonraki cümleyi atla (zaten birleştirdik)
        console.log(`🔧 [XTTS-v2] Merged standalone number with next sentence: "${sentence.substring(0, 60)}..."`);
      }
      
      // SMART FIX: Eğer tek bir cümle maxLength'ten uzunsa, virgüllerden böl
      if (sentence.trim().length > maxLength) {
        console.log(`⚠️ [XTTS-v2] Long sentence detected (${sentence.trim().length} chars), splitting at commas...`);
        
        // Flush current chunk first
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        
        // Split long sentence at commas (natural pause points)
        const parts = sentence.split(',');
        let tempChunk = "";
        
        for (let j = 0; j < parts.length; j++) {
          const part = parts[j] + (j < parts.length - 1 ? ',' : ''); // Re-add comma
          
          if ((tempChunk + ' ' + part).length > maxLength) {
            if (tempChunk) chunks.push(tempChunk.trim());
            tempChunk = part;
          } else {
            tempChunk += (tempChunk ? ' ' : '') + part;
          }
        }
        
        if (tempChunk.trim()) chunks.push(tempChunk.trim());
        continue;
      }
      
      // Normal chunking logic
      if ((currentChunk + " " + sentence).length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    return chunks;
  }

  /**
   * Uzun metinler için chunk'lara böl ve birleştir
   * CRITICAL LIMIT: XTTS-v2 max 400 tokens (~250 chars), güvenli chunk size: 200 chars
   * PERFORMANCE: Batch processing - model loads ONCE for all chunks (4x faster!)
   */
  async generateLongSpeech(text, outputPath, options = {}) {
    // CRITICAL: Önce metni ön işleme (ellipsis → duraklamalar)
    const preprocessedText = this.preprocessTextForDramaticPauses(text);
    const chunks = this.splitTextIntoChunks(preprocessedText, 200);
    
    console.log(`📝 [XTTS-v2] Splitting long text into ${chunks.length} chunks...`);
    console.log(`🎬 [XTTS-v2] Text preprocessed for natural speech flow (optimized pauses)`);

    // PERFORMANCE OPTIMIZATION: Use batch processing for multiple chunks
    // This loads the model ONCE instead of per-chunk (4x faster!)
    if (chunks.length > 1) {
      console.log(`🚀 [XTTS-v2] Using BATCH processing (model loads once for ${chunks.length} chunks)`);
      return await this.generateBatchSpeech(chunks, outputPath, options);
    } else {
      // Single chunk - use regular method
      console.log(`   📦 [Chunk 1/1] Length: ${chunks[0].length} chars`);
      return await this.generateSpeech(chunks[0], outputPath, { ...options, skipPreprocessing: true });
    }
  }

  /**
   * PERFORMANCE: Batch speech generation - model loads ONCE
   * This is 3-4x faster than loading model for each chunk separately
   */
  async generateBatchSpeech(chunks, outputPath, options = {}) {
    const speakerWav = options.speakerWav || path.join(this.voiceSamplesDir, "narrator_sample_2.wav");
    // AUTOMATIC LANGUAGE DETECTION: Detect from combined chunks text if not provided
    const combinedText = chunks.join(' ');
    const language = options.language || process.env.XTTS_LANGUAGE || this.detectLanguage(combinedText);
    
    // Prepare chunk data
    const chunkPaths = [];
    const chunksData = chunks.map((text, i) => {
      const chunkPath = outputPath.replace(".wav", `_chunk_${i}.wav`);
      chunkPaths.push(chunkPath);
      console.log(`   📦 [Chunk ${i + 1}/${chunks.length}] Length: ${text.length} chars`);
      return {
        text: text,
        output_path: chunkPath
      };
    });
    
    // Write chunks to temporary JSON file
    const chunksJsonPath = outputPath.replace(".wav", "_chunks.json");
    fs.writeFileSync(chunksJsonPath, JSON.stringify(chunksData, null, 2), 'utf8');
    
    try {
      // Call batch Python runner
      const batchRunnerPath = path.join(__dirname, "xtts_v2_batch_runner.py");
      const pythonCmd = this.getPythonCommand();
      
      await new Promise((resolve, reject) => {
        const args = [batchRunnerPath, chunksJsonPath, speakerWav, language];
        const pythonProcess = spawn(pythonCmd, args, { 
          shell: true,
          env: { ...process.env, PYTHONUNBUFFERED: '1', USE_CUDA: process.env.USE_CUDA || 'true' }
        });

        let stderr = "";
        let stdout = "";
        
        pythonProcess.stdout.on("data", (data) => {
          const output = data.toString().trim();
          stdout += output + "\n";
          console.log(`[XTTS-v2:PYTHON] ${output}`);
        });

        pythonProcess.stderr.on("data", (data) => {
          const errOutput = data.toString().trim();
          stderr += errOutput + "\n";
          // FutureWarning'leri görmezden gel
          if (!errOutput.includes('FutureWarning') && !errOutput.includes('weights_only')) {
            console.error(`[XTTS-v2:ERROR] ${errOutput}`);
          }
        });

        pythonProcess.on("close", (code) => {
          // Clean up JSON file
          try { fs.unlinkSync(chunksJsonPath); } catch (e) {}
          
          if (code !== 0) {
            // ACCESS_VIOLATION (0xC0000005 = 3221225477) için özel mesaj
            let errorMsg = `XTTS-v2 batch failed with code ${code}`;
            if (code === 3221225477 || code === -1073741819) {
              errorMsg = `XTTS-v2 crashed (ACCESS_VIOLATION). Possible causes:\n` +
                `  1. GPU memory insufficient - try closing other apps\n` +
                `  2. CUDA/PyTorch version mismatch\n` +
                `  3. Model file corrupted - delete and re-download\n` +
                `  Falling back to Coqui TTS...`;
              console.error(`⚠️ ${errorMsg}`);
            }
            reject(new Error(`${errorMsg}\nStderr: ${stderr.slice(-500)}`));
          } else {
            // Verify all chunks were created
            const allExist = chunkPaths.every(p => fs.existsSync(p));
            if (allExist) {
              console.log(`✅ [XTTS-v2] All ${chunks.length} chunks generated successfully (batch mode)`);
              resolve();
            } else {
              const missing = chunkPaths.filter(p => !fs.existsSync(p));
              reject(new Error(`XTTS-v2 batch completed but ${missing.length} output files not found`));
            }
          }
        });

        // Timeout - 5 dakika (XTTS yavaş olabilir)
        pythonProcess.on("error", (err) => {
          console.error(`[XTTS-v2:SPAWN_ERROR] ${err.message}`);
          reject(new Error(`XTTS-v2 spawn error: ${err.message}`));
        });
      });

      // FFmpeg ile chunk'ları birleştir
      await this.concatenateAudioFiles(chunkPaths, outputPath);
      
      // Chunk dosyalarını temizle
      chunkPaths.forEach((p) => fs.existsSync(p) && fs.unlinkSync(p));

      console.log("✅ [XTTS-v2] Long speech generated and concatenated successfully (batch mode)");
      return outputPath;
      
    } catch (error) {
      // Clean up on error
      try { fs.unlinkSync(chunksJsonPath); } catch (e) {}
      chunkPaths.forEach((p) => { try { fs.unlinkSync(p); } catch (e) {} });
      throw error;
    }
  }
  
  /**
   * Get Python command (venv or system)
   */
  getPythonCommand() {
    const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
      return `"${venvPython}"`;
    }
    return 'python';
  }

  /**
   * Birden fazla audio dosyasını birleştir
   * PROFESSIONAL FIX: Use concat demuxer for gapless audio concatenation (no volume drops)
   */
  concatenateAudioFiles(filePaths, outputPath) {
    return new Promise((resolve, reject) => {
      console.log(`🔗 [XTTS-v2] Concatenating ${filePaths.length} audio chunks...`);
      
      // Create temporary concat list file for FFmpeg
      const concatListPath = outputPath.replace('.wav', '_concat_list.txt');
      const concatListContent = filePaths.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent, 'utf8');
      
      // Use concat demuxer for perfect audio concatenation (no gaps, no volume drops)
      const command = ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .audioCodec('pcm_s16le') // WAV format (lossless)
        .audioFrequency(22050) // Match XTTS output
        .audioChannels(1) // Mono
        .on("error", (err) => {
          // Clean up concat list file
          try { fs.unlinkSync(concatListPath); } catch (e) {}
          console.error(`❌ [XTTS-v2] Concatenation error: ${err.message}`);
          reject(err);
        })
        .on("end", () => {
          // Clean up concat list file
          try { fs.unlinkSync(concatListPath); } catch (e) {}
          console.log(`✅ [XTTS-v2] Audio chunks concatenated successfully`);
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }

  /**
   * Available voice samples'ları listele
   */
  getAvailableVoices() {
    try {
      if (!fs.existsSync(this.voiceSamplesDir)) {
        return [];
      }
      
      const files = fs.readdirSync(this.voiceSamplesDir);
      return files.filter(file => file.endsWith('.wav'));
    } catch (error) {
      console.error(`❌ [XTTS-v2] Error listing voices: ${error.message}`);
      return [];
    }
  }
}

module.exports = new XTTSTTS();

