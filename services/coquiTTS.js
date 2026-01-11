const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

class CoquiTTSService {
  constructor() {
    this.outputDir = path.join(__dirname, "..", "temp", "audio");
    this.ensureOutputDir();
    
    // Python sanal ortam yolu (venv)
    this.pythonPath =
      process.platform === "win32"
        ? path.join(__dirname, "..", "venv", "Scripts", "python.exe")
        : path.join(__dirname, "..", "venv", "bin", "python3");

    this.apiScriptPath = path.join(
      __dirname,
      "coqui_tts_api_runner.py" // az önce oluşturduğumuz Python API script
    );
    
    this.model = process.env.COQUI_MODEL || "tts_models/en/vctk/vits";
    this.speaker = process.env.COQUI_SPEAKER || "p230"; // tok erkek ses
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Belgesel tarzı dramatik duraklamalar ekle
   * Her cümleden sonra belirli süre sessizlik (müzik çalacak)
   * SSML <break time="Xms"/> etiketlerini kullanır (Coqui TTS destekler)
   * 
   * @param {string} text - İşlenecek metin
   * @param {object} options - Ayarlar
   * @param {number} options.pauseInterval - Her kaç cümlede bir durak (1 = her cümle, 2 = her 2 cümle)
   * @param {number} options.pauseDuration - Duraklama süresi (milisaniye, default: 2000 = 2 saniye)
   * @returns {string} - SSML break etiketleri eklenmiş metin
   */
  insertDocumentaryBreaks(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    
    const pauseInterval = options.pauseInterval || 1; // Her kaç cümlede bir (1 = her cümle)
    const pauseDuration = options.pauseDuration || 2000; // Duraklama süresi (ms)
    
    // Cümleleri ayır (. ! ? ile bitenler)
    // Ayrıca [1], [2], [3] gibi numaralı paragrafları da dikkate al
    const sentencePattern = /(\[[0-9]+\]\s*)?[^.!?]+[.!?]+/g;
    const sentences = text.match(sentencePattern) || [];
    
    // Eğer cümle bulunamazsa, metni olduğu gibi döndür
    if (sentences.length === 0) {
      return text;
    }
    
    const result = [];
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;
      
      result.push(trimmedSentence);
      
      // Her N cümleden sonra durak ekle (son cümleden önce değil)
      if ((index + 1) % pauseInterval === 0 && index < sentences.length - 1) {
        result.push(`<break time="${pauseDuration}ms"/>`);
      }
    });
    
    return result.join(' ');
  }

  /**
   * Metni TTS için ön işleme: Noktalama işaretlerini doğal duraklamalara dönüştürür
   * Bu işlem sadece TTS seslendirmesini etkiler, ekranda görünen metni değiştirmez
   * 
   * CRITICAL: Ellipsis'leri em dash (—) ile değiştiriyoruz
   * Em dash TTS tarafından daha iyi işlenir ve doğal duraklama sağlar
   * Ellipsis'leri ayırmak "dot dot dot" gibi garip sesler çıkarıyor
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
  preprocessTextForDramaticPauses(text) {
    if (!text || typeof text !== 'string') return text;
    
    let processedText = text;
    
    // CRITICAL: Ellipsis'leri em dash (—) ile değiştir
    // Em dash TTS tarafından daha iyi işlenir ve doğal, insan gibi duraklama sağlar
    // Unicode ellipsis (…) ve ASCII ellipsis (...) her ikisini de yakala
    // PROFESSIONAL: Em dash'ten sonra 6 boşluk ekle (uzun duraklama ~1.2s)
    processedText = processedText.replace(/…/g, ' —      ');
    processedText = processedText.replace(/\.\.\./g, ' —      ');
    
    // PROFESSIONAL: Mevcut em dash'lerden sonra 6 boşluk ekle (uzun duraklama ~1.2s)
    // Em dash zaten metinde varsa, yeterli boşluk yoksa ekle
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
    // Ama noktalama işaretlerinden sonraki boşlukları koru
    processedText = processedText.replace(/\s{8,}/g, '      ');
    processedText = processedText.replace(/\s{7}/g, '      ');
    
    // BELGESEL TARZI DURAKLAMALAR EKLE
    // Her cümleden sonra SSML <break> etiketi ekle (müzik çalacak)
    // Environment variable'dan ayarlanabilir: DOCUMENTARY_PAUSE_INTERVAL, DOCUMENTARY_PAUSE_DURATION
    const pauseInterval = parseInt(process.env.DOCUMENTARY_PAUSE_INTERVAL) || 1; // Her kaç cümlede bir (1 = her cümle)
    const pauseDuration = parseInt(process.env.DOCUMENTARY_PAUSE_DURATION) || 2000; // Duraklama süresi (ms)
    
    processedText = this.insertDocumentaryBreaks(processedText, {
      pauseInterval: pauseInterval,
      pauseDuration: pauseDuration
    });
    
    return processedText.trim();
  }

  /**
   * Ana kısa metin seslendirme
   */
  async generateSpeech(text, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const model = options.model || this.model;
      const speaker = options.speaker || this.speaker;
      // CRITICAL: Default length_scale changed from 1.0 to 1.25 for more natural, slower speech
      // Higher length_scale = slower, more natural speech (human-like pacing)
      const lengthScale = options.lengthScale || process.env.COQUI_LENGTH_SCALE || '1.25';
      const noiseScale = options.noiseScale || process.env.COQUI_NOISE_SCALE || '0.667';
      
      // CRITICAL: Metni TTS için ön işleme (dramatik duraklamalar için)
      // Bu işlem sadece TTS seslendirmesini etkiler, ekranda görünen metni değiştirmez
      // Eğer skipPreprocessing flag'i varsa, ön işleme yapma (zaten generateLongSpeech'te yapıldı)
      const processedText = options.skipPreprocessing ? text : this.preprocessTextForDramaticPauses(text);
      
      console.log(`🎤 [Coqui TTS] Using Python API with model: ${model}, length_scale: ${lengthScale}, noise_scale: ${noiseScale}`);
      if (!options.skipPreprocessing) {
        console.log(`🎭 [Coqui TTS] Text preprocessed for dramatic pauses (ellipsis → pauses)`);
        // Belgesel duraklamaları kontrol et
        if (processedText.includes('<break time=')) {
          const breakCount = (processedText.match(/<break time=/g) || []).length;
          console.log(`🎬 [Coqui TTS] Documentary-style breaks added: ${breakCount} pauses (music will play during breaks)`);
      }
      }
      const args = [this.apiScriptPath, processedText, outputPath, model, speaker, lengthScale, noiseScale];

      const env = { ...process.env };
      const child = spawn(this.pythonPath, args, { env });

      child.stdout.on("data", (data) =>
        console.log(`[Coqui TTS:PYTHON] ${data.toString()}`)
      );
      child.stderr.on("data", (data) =>
        console.error(`[Coqui TTS:ERROR] ${data.toString()}`)
      );

      child.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          console.log(`✅ [Coqui TTS] Speech saved to: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`Coqui TTS failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Uzun metin (chunk'lara bölünür)
   */
  async generateLongSpeech(text, outputPath, options = {}) {
    // CRITICAL: Önce metni ön işleme (ellipsis → duraklamalar)
    // Bu işlem chunk'lara bölmeden önce yapılmalı ki ellipsis'ler korunsun
    const preprocessedText = this.preprocessTextForDramaticPauses(text);
    const chunks = this.splitTextIntoChunks(preprocessedText, 500);
    console.log(`📝 [Coqui TTS] Splitting text into ${chunks.length} chunks...`);
    console.log(`🎭 [Coqui TTS] Text preprocessed for dramatic pauses (ellipsis → pauses)`);
    
    const chunkPaths = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = outputPath.replace(".wav", `_chunk_${i}.wav`);
      // generateSpeech içinde tekrar ön işleme yapılmayacak (zaten yapıldı)
      // Ama generateSpeech içinde de ön işleme var, bu yüzden çift işleme olmaması için
      // generateSpeech'e ön işlenmiş metni gönderiyoruz
      await this.generateSpeech(chunks[i], chunkPath, { ...options, skipPreprocessing: true });
      chunkPaths.push(chunkPath);
    }
    
    await this.concatenateAudioFiles(chunkPaths, outputPath);
    chunkPaths.forEach((p) => fs.existsSync(p) && fs.unlinkSync(p));
    
    console.log("✅ [Coqui TTS] Long speech generated successfully");
    return outputPath;
  }

  splitTextIntoChunks(text, maxLength) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = "";
    
    for (const sentence of sentences) {
      if (
        (currentChunk + sentence).length > maxLength &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  async concatenateAudioFiles(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        ...inputPaths.flatMap((p) => ["-i", p]),
        "-filter_complex",
        `concat=n=${inputPaths.length}:v=0:a=1[out]`,
        "-map",
        "[out]",
        "-y",
        outputPath,
      ]);
      
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg concat failed (code ${code})`));
      });
    });
  }
}

module.exports = new CoquiTTSService();
