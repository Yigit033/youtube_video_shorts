// intelligentMusicService.js
// Geliştirilmiş akıllı müzik servisi
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class IntelligentMusicService {
  constructor() {
    this.baseTemp = path.join(__dirname, '..', 'temp');
    this.outputDir = path.join(this.baseTemp, 'music');
    this.cacheDir = path.join(this.baseTemp, 'music_cache');
    this.ensureDirectories();

    this.sources = {
      freesound: {
        apiKey: process.env.FREESOUND_API_KEY,
        baseUrl: 'https://freesound.org/apiv2',
        enabled: !!process.env.FREESOUND_API_KEY
      },
      pixabay: {
        apiKey: process.env.PIXABAY_API_KEY,
        audioUrl: 'https://pixabay.com/api/videos/' // pixabay video/audio endpoint usage (metadata)
      },
      // Placeholders for other curated providers (Mixkit, YouTubeAudioLibrary etc.)
      mixkit: { enabled: !!process.env.MIXKIT_API_KEY },
      youtubeLibrary: { enabled: true } // will use curated fallback (no public API)
    };

    // Normalization target for final audio processing
    this.targetLUFS = process.env.MUSIC_TARGET_LUFS || -14; // prefer -14 LUFS for Shorts
    this.defaultFade = 2; // seconds
    console.log('✅ IntelligentMusicService initialized');
  }

  ensureDirectories() {
    [this.outputDir, this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  // -------------------------
  // Public API
  // -------------------------
  async recommendMusic(contentAnalysis, options = {}) {
    const {
      duration = 30,
      mood = 'auto',
      genre = 'auto',
      energy = 'auto',
      videoStyle = null
    } = options;

    // ENHANCED: Better mood extraction with style hints
    let extractedMood = mood === 'auto' ? this.extractMoodFromContent(contentAnalysis) : mood;
    
    // If style is provided, use it to refine mood
    if (videoStyle && (mood === 'auto' || !mood)) {
      const styleMoodMap = {
        'entertaining': 'fun',
        'educational': 'professional',
        'motivational': 'energetic',
        'storytelling': 'dramatic',
        'controversial': 'dramatic',
        'quick-tips': 'energetic'
      };
      const styleMood = styleMoodMap[videoStyle];
      if (styleMood) {
        extractedMood = styleMood;
        console.log(`🎵 [Music] Style "${videoStyle}" → mood "${extractedMood}"`);
      }
    }
    
    const extractedEnergy = energy === 'auto' ? this.extractEnergyFromContent(contentAnalysis) : energy;
    const extractedGenre = genre === 'auto' ? this.extractGenreFromContent(contentAnalysis) : genre;
    
    // ENHANCED: Refine energy based on mood
    let finalEnergy = extractedEnergy;
    if (extractedEnergy === 'auto' || !extractedEnergy) {
      const moodEnergyMap = {
        'energetic': 'high',
        'fun': 'high',
        'calm': 'low',
        'dramatic': 'medium',
        'professional': 'low',
        'romantic': 'low',
        'sad': 'low',
        'happy': 'high'
      };
      finalEnergy = moodEnergyMap[extractedMood] || 'medium';
    } else {
      finalEnergy = extractedEnergy;
    }

    // Try real music with refined parameters
    const real = await this.findRealMusic(contentAnalysis, {
      mood: extractedMood,
      energy: finalEnergy,
      genre: extractedGenre,
      duration
    });

    if (real && real.length) {
      console.log(`✅ [Music] Found ${real.length} real music tracks matching mood: ${extractedMood}, energy: ${finalEnergy}`);
      return {
        mood: extractedMood,
        energy: finalEnergy,
        genre: extractedGenre,
        recommendations: real,
        selected: real[0]
      };
    }

    // fallback: request AI-generated music or generate synthetic
    const aiMusic = await this.generateAIMusic({ mood: extractedMood, energy: finalEnergy, genre: extractedGenre }, duration);
    if (aiMusic) {
      console.log(`✅ [Music] Generated AI music for mood: ${extractedMood}, energy: ${finalEnergy}`);
      return {
        mood: extractedMood,
        energy: finalEnergy,
        genre: extractedGenre,
        recommendations: [aiMusic],
        selected: aiMusic
      };
    }

    // final fallback: simple synthetic placeholder
    console.log(`⚠️ [Music] Using synthetic music for mood: ${extractedMood}, energy: ${finalEnergy}`);
    const synthetic = {
      id: `synthetic_${extractedMood}_${Date.now()}`,
      title: `${extractedMood} background`,
      mood: extractedMood,
      energy: finalEnergy,
      genre: extractedGenre,
      path: await this.generateEnhancedSyntheticMusic({ mood: extractedMood, energy: finalEnergy, genre: extractedGenre }, duration),
      duration
    };
    return {
      mood: extractedMood,
      energy: finalEnergy,
      genre: extractedGenre,
      recommendations: [synthetic],
      selected: synthetic
    };
  }

  // -------------------------
  // Content analysis helpers
  // (preserved & slightly improved from your file)
  // -------------------------
  extractMoodFromContent(analysis) {
    try {
      const content = JSON.stringify(analysis).toLowerCase();
      const moodKeywords = {
        fun: ['fun','happy','joy','laugh','smile','playful','cheerful','comedy','entertaining','light','bright','eğlenceli','komik','neşeli'],
        calm: ['calm','peaceful','relaxing','meditation','zen','quiet','soft','gentle','serene','tranquil','sakin','huzurlu'],
        dramatic: ['dramatic','intense','epic','powerful','emotional','serious','deep','cinematic','thriller','suspense','dramatik'],
        professional: ['professional','business','corporate','presentation','formal','profesyonel','kurumsal'],
        energetic: ['energetic','upbeat','exciting','fast','dynamic','active','enerjik','motivasyon'],
        romantic: ['romantic','love','wedding','valentine','romantik','aşk']
      };

      let best = { mood: 'professional', score: 0 };
      for (const [mood, keywords] of Object.entries(moodKeywords)) {
        let score = 0;
        for (const kw of keywords) if (content.includes(kw)) score++;
        if (score > best.score) best = { mood, score };
      }
      return best.mood;
    } catch (e) {
      return 'professional';
    }
  }

  extractEnergyFromContent(analysis) {
    const content = JSON.stringify(analysis).toLowerCase();
    const high = ['yüksek','hızlı','dinamik','enerjik','fast','high','intense','powerful','exciting','active'];
    const low = ['düşük','yavaş','sakin','huzurlu','soft','gentle','calm','relaxing','slow','meditation'];
    let h=0, l=0;
    high.forEach(k=>{ if (content.includes(k)) h++; });
    low.forEach(k=>{ if (content.includes(k)) l++; });
    if (h>l) return 'high';
    if (l>h) return 'low';
    return 'medium';
  }

  extractGenreFromContent(analysis) {
    const content = JSON.stringify(analysis).toLowerCase();
    const mapping = {
      rock: ['rock','guitar','band'],
      electronic: ['electronic','synth','edm','techno'],
      classical: ['classical','orchestra','piano','violin'],
      jazz: ['jazz','saxophone','caz'],
      ambient: ['ambient','background','atmosphere','tutorial'],
      pop: ['pop','popular','mainstream'],
      cinematic: ['cinematic','movie','film','soundtrack'],
      acoustic: ['acoustic','guitar','organic','nature']
    };
    let best = { genre: 'pop', score: 0 };
    for (const [g, keys] of Object.entries(mapping)) {
      let s = 0;
      keys.forEach(k=>{ if (content.includes(k)) s++; });
      if (s>best.score) best = { genre: g, score: s };
    }
    return best.genre;
  }

  // -------------------------
  // Search real music across sources
  // -------------------------
  async findRealMusic(contentAnalysis, options) {
    const { mood, energy, genre, duration } = options;
    try {
      // 1) Freesound (HIGH PRIORITY - FREE, HIGH QUALITY)
      if (this.sources.freesound.enabled) {
        const freesoundMusic = await this.fetchFromFreesound(mood, energy, genre, duration);
        if (freesoundMusic) return [freesoundMusic];
      }

      // 2) Pixabay enhanced - DISABLED: Pixabay API returns images, not music!
      // const pix = await this.fetchFromPixabayEnhanced(mood, energy, genre, duration);
      // if (pix) return [pix];

      // 3) Mixkit placeholder (if you integrate a scraper or API)
      // 4) YoutubeAudioLibrary fallback (curated list in your repo)
      const curated = await this.fetchFromCuratedDatabase(mood, energy, genre, duration);
      if (curated) return [curated];

      return [];
    } catch (err) {
      console.warn('⚠️ findRealMusic error:', err.message);
      return [];
    }
  }

  // -------------------------
  // Freesound API Integration
  // -------------------------
  async fetchFromFreesound(mood, energy, genre, targetDuration) {
    if (!this.sources.freesound.apiKey) return null;

    try {
      const query = this.buildMusicSearchQuery(mood, energy, genre);
      console.log(`🎵 [Freesound] Searching for: "${query}"`);

      const response = await axios.get(`${this.sources.freesound.baseUrl}/search/text/`, {
        params: {
          query: query,
          filter: 'duration:[15 TO 180]', // Removed type:mp3 - accept all audio formats
          sort: 'rating_desc',
          fields: 'id,name,duration,previews,download',
          page_size: 15 // More results for better selection
        },
        headers: {
          'Authorization': `Token ${this.sources.freesound.apiKey}`
        },
        timeout: 10000
      });

      if (!response.data || !response.data.results || response.data.results.length === 0) {
        console.log('ℹ️  [Freesound] No results found');
        return null;
      }

      // Select best candidate by duration
      const candidates = response.data.results.filter(r => r.previews && r.previews['preview-hq-mp3']);
      if (candidates.length === 0) return null;

      const chosen = candidates.reduce((best, cur) => {
        const bestDiff = Math.abs(best.duration - targetDuration);
        const curDiff = Math.abs(cur.duration - targetDuration);
        return curDiff < bestDiff ? cur : best;
      }, candidates[0]);

      console.log(`✅ [Freesound] Selected: ${chosen.name} (${chosen.duration}s)`);

      // Download preview (HQ MP3)
      const downloadUrl = chosen.previews['preview-hq-mp3'];
      const outputPath = path.join(this.cacheDir, `freesound_${chosen.id}.mp3`);

      if (!fs.existsSync(outputPath)) {
        const writer = fs.createWriteStream(outputPath);
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });
        downloadResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      }

      return {
        id: `freesound_${chosen.id}`,
        title: chosen.name,
        duration: chosen.duration,
        path: outputPath,
        source: 'freesound'
      };
    } catch (err) {
      console.warn('⚠️  [Freesound] Error:', err.message);
      return null;
    }
  }

  // -------------------------
  // Pixabay enhanced (metadata -> download) 
  // -------------------------
  async fetchFromPixabayEnhanced(mood, energy, genre, targetDuration) {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return null;

    try {
      const q = this.buildMusicSearchQuery(mood, energy, genre);
      const resp = await axios.get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q,
          safesearch: true,
          per_page: 10
        },
        timeout: 10000
      });

      if (!resp.data || !resp.data.hits || resp.data.hits.length===0) return null;

      // Select best candidate by duration closeness and tags
      const candidates = resp.data.hits.map(h => ({
        id: `pixabay_${h.id}`,
        title: h.tags || 'pixabay',
        duration: h.duration || targetDuration,
        url: h.webformatURL || h.videos?.medium?.url || null,
        source: 'pixabay',
        raw: h
      })).filter(c=>c.url);

      if (candidates.length===0) return null;
      const chosen = candidates.reduce((best, cur) => {
        const bestDiff = Math.abs(best.duration - targetDuration);
        const curDiff = Math.abs(cur.duration - targetDuration);
        return curDiff < bestDiff ? cur : best;
      }, candidates[0]);

      // Download into cache and return processed path
      const downloaded = await this.downloadAndCache(chosen.url, `${chosen.id}.mp3`);
      const processed = await this.processMusicFile(downloaded, targetDuration);
      return {
        id: chosen.id,
        title: chosen.title,
        mood,
        energy,
        genre,
        duration: targetDuration,
        source: 'pixabay',
        path: processed
      };
    } catch (err) {
      console.warn('⚠️ fetchFromPixabayEnhanced failed:', err.message);
      return null;
    }
  }

  buildMusicSearchQuery(mood, energy, genre) {
    // SIMPLIFIED: Use only the most relevant term + "music" to get better results
    // "energetic energetic pop royalty free music" is too specific and returns no results
    const primaryTerm = mood !== 'auto' ? mood : energy !== 'auto' ? energy : 'upbeat';
    return `${primaryTerm} music`;
  }

  // -------------------------
  // Disk cache download helper
  // -------------------------
  async downloadAndCache(url, filename) {
    try {
      const safeName = filename.replace(/[^\w\-\.]/g,'_');
      const cachePath = path.join(this.cacheDir, safeName);
      if (fs.existsSync(cachePath)) return cachePath;

      const response = await axios.get(url, { responseType: 'stream', timeout: 20000 });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(cachePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return cachePath;
    } catch (err) {
      console.warn('⚠️ downloadAndCache failed:', err.message);
      throw err;
    }
  }

  // -------------------------
  // Process audio (trim, normalize to target LUFS, fade)
  // Uses ffmpeg (spawn) to avoid fluent-ffmpeg complexity
  // -------------------------
  async processMusicFile(inputPath, targetDuration = 30, opts = {}) {
    const fadeIn = opts.fadeIn ?? this.defaultFade;
    const fadeOut = opts.fadeOut ?? this.defaultFade;
    const outPath = path.join(this.outputDir, `processed_${path.basename(inputPath).replace(/\W/g,'_')}_${Date.now()}.mp3`);

    // CRITICAL: Check if file is actually audio (not image/video)
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }

    // Use ffmpeg loudnorm in two-pass if available; here do single-pass with target LUFS var
    // We use -af loudnorm=I=<target>:TP=-1.0:LRA=7 for Shorts-friendly level
    const targetI = this.targetLUFS;

    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-vn', // CRITICAL: Ignore video/image streams, audio only
        '-t', String(Math.max(5, targetDuration)),
        '-af', `loudnorm=I=${targetI}:TP=-1.0:LRA=7,afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${Math.max(0,targetDuration-fadeOut)}:d=${fadeOut}`,
        '-b:a', '192k',
        '-acodec', 'libmp3lame', // Force MP3 codec
        outPath
      ];

      const ff = spawn('ffmpeg', args, { windowsHide: true });
      let stderr = '';
      ff.stderr.on('data', d => stderr += d.toString());
      ff.on('close', code => {
        if (code === 0 && fs.existsSync(outPath)) {
          resolve(outPath);
        } else {
          console.error('ffmpeg processMusicFile failed:', stderr.slice(-1000));
          reject(new Error('ffmpeg failed to process music'));
        }
      });
      ff.on('error', err => reject(err));
    });
  }

  // -------------------------
  // AI Music (optional) — placeholder
  // If you have an API (Mubert, Riffusion, Suno, Mubert), call it here.
  // Otherwise returns null.
  // -------------------------
  async generateAIMusic(meta, duration) {
    // Example placeholder: if you have MUBERT_API_KEY, call their endpoint.
    if (process.env.MUBERT_API_KEY) {
      try {
        // pseudo-code: replace with real provider's API
        const prompt = `${meta.mood} ${meta.energy} ${meta.genre} background music for ${duration}s`;
        const resp = await axios.post('https://api.mubert.com/v2/track', { prompt, duration }, {
          headers: { Authorization: `Bearer ${process.env.MUBERT_API_KEY}` },
          timeout: 30000
        });
        if (resp.data && resp.data.url) {
          const dl = await this.downloadAndCache(resp.data.url, `mubert_${Date.now()}.mp3`);
          const proc = await this.processMusicFile(dl, duration);
          return { id: `mubert_${Date.now()}`, title: `AI ${meta.mood}`, path: proc, mood: meta.mood, energy: meta.energy, genre: meta.genre, duration };
        }
      } catch (err) {
        console.warn('⚠️ generateAIMusic failed:', err.message);
      }
    }
    return null;
  }

  // -------------------------
  // Enhanced synthetic generation using ffmpeg lavfi where possible,
  // fallback to programmatic WAV if ffmpeg not available.
  // -------------------------
  async generateEnhancedSyntheticMusic(musicItem, duration = 30) {
    // try ffmpeg lavfi approach for richer sound
    const outPath = path.join(this.outputDir, `synthetic_enhanced_${musicItem.mood}_${Date.now()}.wav`);
    try {
      // build frequencies based on mood
      const freqs = this.getMoodFrequencies(musicItem.mood);
      // build lavfi inputs and filter_complex
      // create multiple sine inputs and mix, add subtle percussion via square tone modulated
      const inputs = freqs.map(f => ['-f','lavfi','-i', `sine=frequency=${f}:sample_rate=44100:duration=${duration}`]).flat();
      const filterParts = freqs.map((f, i) => `[${i}:a]volume=${(0.3/freqs.length).toFixed(3)}[s${i}]`).join(';');
      const mixes = freqs.map((_,i)=>`[s${i}]`).join('');
      const complex = `${filterParts};${mixes}amix=inputs=${freqs.length}:duration=first,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3,volume=0.6`;

      const args = [...inputs, '-filter_complex', complex, '-t', String(duration), '-y', outPath];
      await this._spawnFFmpeg(args);
      return outPath;
    } catch (err) {
      console.warn('⚠️ generateEnhancedSyntheticMusic ffmpeg failed:', err.message);
      // fallback: use simple WAV generator (from your previous code style)
      return await this._generateSimpleWavFallback(musicItem, duration);
    }
  }

  _spawnFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', args, { windowsHide: true });
      let stderr = '';
      ff.stderr.on('data', d => stderr += d.toString());
      ff.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error('ffmpeg failed: ' + stderr.slice(-1000)));
      });
      ff.on('error', err => reject(err));
    });
  }

  async _generateSimpleWavFallback(musicItem, duration) {
    const outputPath = path.join(this.outputDir, `synthetic_simple_${musicItem.mood}_${Date.now()}.wav`);
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * Math.min(duration, 60));
    const buffer = Buffer.alloc(44 + numSamples * 2);
    // write WAV header
    buffer.write('RIFF',0); buffer.writeUInt32LE(36 + numSamples*2,4); buffer.write('WAVE',8);
    buffer.write('fmt ',12); buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(1,22);
    buffer.writeUInt32LE(sampleRate,24); buffer.writeUInt32LE(sampleRate*2,28); buffer.writeUInt16LE(2,32); buffer.writeUInt16LE(16,34);
    buffer.write('data',36); buffer.writeUInt32LE(numSamples*2,40);
    const freqs = this.getMoodFrequencies(musicItem.mood);
    for (let i=0;i<numSamples;i++){
      const t = i/sampleRate;
      let s=0;
      freqs.forEach((f,idx)=>{ s += Math.sin(2*Math.PI*f*t)*(0.25/freqs.length)*Math.exp(-t*0.3); });
      s = Math.max(-0.95, Math.min(0.95, s*0.9));
      buffer.writeInt16LE(Math.round(s*32767), 44 + i*2);
    }
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }

  // utility freq sets
  getMoodFrequencies(mood) {
    const sets = {
      calm: [220, 330, 440],
      energetic: [440, 523, 659],
      dramatic: [164, 220, 330],
      fun: [523, 659, 784],
      professional: [392, 494, 587],
      upbeat: [440, 554, 659],
      romantic: [261, 329, 392]
    };
    return sets[mood] || sets.professional;
  }

  // -------------------------
  // Curated DB fallback (local mapping)
  // -------------------------
  async fetchFromCuratedDatabase(mood, energy, genre, targetDuration) {
    // Keep simple curated list: use a metadata entry pointing to a local file if exists
    // You can expand this to include local 'services/music' assets in repo
    const curated = {
      upbeat: [{id:'upbeat_1', name:'Upbeat Demo', genre:'pop', energy:'high', file: path.join(__dirname,'../assets/music/upbeat_demo.mp3'), duration:30}],
      calm: [{id:'calm_1', name:'Calm Demo', genre:'ambient', energy:'low', file: path.join(__dirname,'../assets/music/calm_demo.mp3'), duration:30}],
      professional:[{id:'pro_1', name:'Corporate Demo', genre:'corporate', energy:'medium', file: path.join(__dirname,'../assets/music/pro_demo.mp3'), duration:30}]
    };

    const list = (curated[mood] || curated['professional']).filter(t => (genre==='auto' || t.genre===genre));
    if (!list.length) return null;
    const chosen = list[Math.floor(Math.random() * list.length)];
    if (fs.existsSync(chosen.file)) {
      const processed = await this.processMusicFile(chosen.file, Math.min(chosen.duration, targetDuration));
      return { id: chosen.id, title: chosen.name, path: processed, mood, energy, genre, duration: Math.min(chosen.duration, targetDuration), source: 'curated_local' };
    }
    return null;
  }
}

module.exports = IntelligentMusicService;
