const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class IntelligentMusicService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'music');
    this.cacheDir = path.join(__dirname, '..', 'temp', 'music_cache');
    this.ensureDirectories();
    
    // Free music sources
    this.sources = {
      pixabay: {
        apiKey: process.env.PIXABAY_API_KEY,
        baseUrl: 'https://pixabay.com/api/videos/',
        audioUrl: 'https://pixabay.com/api/'
      },
      freesound: {
        apiKey: process.env.FREESOUND_API_KEY,
        baseUrl: 'https://freesound.org/apiv2/search/text/'
      }
    };
  }

  ensureDirectories() {
    [this.outputDir, this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Analyze content and recommend music
  async recommendMusic(contentAnalysis, options = {}) {
    const {
      duration = 60,
      mood = 'auto',
      genre = 'auto',
      energy = 'auto'
    } = options;

    console.log('🎵 [Music] Analyzing content for music recommendations...');
    console.log('📝 [Music] Content analysis:', JSON.stringify(contentAnalysis, null, 2));

    // Extract mood and energy from content
    const extractedMood = mood === 'auto' ? this.extractMoodFromContent(contentAnalysis) : mood;
    const extractedEnergy = energy === 'auto' ? this.extractEnergyFromContent(contentAnalysis) : energy;
    const extractedGenre = genre === 'auto' ? this.extractGenreFromContent(contentAnalysis) : genre;

    console.log(`🎵 [Music] Extracted: mood=${extractedMood}, energy=${extractedEnergy}, genre=${extractedGenre}`);

    // Try to find real music first
    const musicRecommendations = await this.findRealMusic(contentAnalysis, {
      mood: extractedMood,
      energy: extractedEnergy,
      genre: extractedGenre,
      duration: duration
    });

    if (musicRecommendations && musicRecommendations.length > 0) {
      console.log(`🎵 [Music] Found ${musicRecommendations.length} real music recommendations`);
      return {
        mood: extractedMood,
        energy: extractedEnergy,
        genre: extractedGenre,
        recommendations: musicRecommendations,
        selected: musicRecommendations[0]
      };
    }

    // Fallback to synthetic music
    console.log(`🎵 [Music] No real music found, generating synthetic for mood: ${extractedMood}`);
    return {
      mood: extractedMood,
      energy: extractedEnergy,
      genre: extractedGenre,
      recommendations: [],
      selected: {
        id: `synthetic_${extractedMood}_${Date.now()}`,
        title: `${extractedMood.charAt(0).toUpperCase() + extractedMood.slice(1)} Background Music`,
        mood: extractedMood,
        energy: extractedEnergy,
        genre: extractedGenre,
        duration: duration
      }
    };
  }

  // Extract mood from content analysis (enhanced)
  extractMoodFromContent(analysis) {
    const content = JSON.stringify(analysis).toLowerCase();
    console.log('🔍 [Music] Analyzing content for mood:', content.substring(0, 200) + '...');
    
    // Multi-language mood detection
    const moodKeywords = {
      'fun': ['fun', 'happy', 'joy', 'laugh', 'smile', 'playful', 'cheerful', 'comedy', 'humor', 'entertaining', 'light', 'bright', 'eğlenceli', 'komik', 'neşeli', 'mutlu', 'gülümseme'],
      'calm': ['calm', 'peaceful', 'relaxing', 'meditation', 'zen', 'quiet', 'soft', 'gentle', 'serene', 'tranquil', 'nature', 'ocean', 'forest', 'sakin', 'huzurlu', 'meditasyon', 'doğa', 'deniz'],
      'dramatic': ['dramatic', 'intense', 'epic', 'powerful', 'emotional', 'serious', 'deep', 'cinematic', 'movie', 'thriller', 'suspense', 'dramatik', 'yoğun', 'güçlü', 'duygusal', 'ciddi', 'sinematik'],
      'professional': ['professional', 'business', 'corporate', 'office', 'meeting', 'presentation', 'formal', 'serious', 'work', 'company', 'profesyonel', 'kurumsal', 'iş', 'ofis', 'toplantı', 'sunum'],
      'energetic': ['energetic', 'upbeat', 'exciting', 'fast', 'dynamic', 'active', 'sport', 'fitness', 'workout', 'dance', 'party', 'celebration', 'enerjik', 'motivasyon', 'heyecan', 'hızlı', 'dinamik', 'spor'],
      'romantic': ['romantic', 'love', 'couple', 'relationship', 'wedding', 'valentine', 'heart', 'passion', 'intimate', 'romantik', 'aşk', 'çift', 'evlilik', 'kalp', 'tutku']
    };

    let maxScore = 0;
    let detectedMood = 'professional';

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      let score = 0;
      keywords.forEach(keyword => {
        if (content.includes(keyword)) {
          score += 1;
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        detectedMood = mood;
      }
    }

    console.log(`🎵 [Music] Detected mood: ${detectedMood} (score: ${maxScore})`);
    return detectedMood;
  }

  // Legacy function for backward compatibility
  extractMood(analysis) {
    return this.extractMoodFromContent(analysis);
  }

  // Extract energy level from content (enhanced)
  extractEnergyFromContent(analysis) {
    const content = JSON.stringify(analysis).toLowerCase();
    
    const highEnergyKeywords = ['yüksek', 'hızlı', 'dinamik', 'enerjik', 'heyecan', 'hızlı', 'fast', 'high', 'energetic', 'dynamic', 'intense', 'powerful', 'exciting', 'active', 'sport', 'fitness', 'workout', 'dance', 'party'];
    const lowEnergyKeywords = ['düşük', 'yavaş', 'sakin', 'huzurlu', 'soft', 'gentle', 'calm', 'peaceful', 'relaxing', 'quiet', 'slow', 'low', 'meditation', 'zen', 'tranquil'];
    
    let highScore = 0;
    let lowScore = 0;
    
    highEnergyKeywords.forEach(keyword => {
      if (content.includes(keyword)) highScore++;
    });
    
    lowEnergyKeywords.forEach(keyword => {
      if (content.includes(keyword)) lowScore++;
    });
    
    if (highScore > lowScore) return 'high';
    if (lowScore > highScore) return 'low';
    return 'medium';
  }

  // Legacy function
  extractEnergy(analysis) {
    return this.extractEnergyFromContent(analysis);
  }

  // Extract genre from content (enhanced)
  extractGenreFromContent(analysis) {
    const content = JSON.stringify(analysis).toLowerCase();
    
    const genreKeywords = {
      'rock': ['rock', 'guitar', 'band', 'electric', 'guitar', 'rock music', 'rock müzik', 'gitar', 'spor', 'fitness', 'egzersiz'],
      'electronic': ['electronic', 'synth', 'techno', 'edm', 'electronic music', 'elektronik', 'synthesizer', 'teknoloji', 'modern', 'dijital'],
      'classical': ['classical', 'orchestra', 'piano', 'violin', 'symphony', 'classical music', 'klasik', 'piyano', 'keman'],
      'jazz': ['jazz', 'saxophone', 'trumpet', 'jazz music', 'caz', 'saksofon'],
      'ambient': ['ambient', 'atmospheric', 'background', 'ambient music', 'ambiyans', 'atmosferik', 'eğitim', 'öğretici', 'bilim'],
      'pop': ['pop', 'popular', 'mainstream', 'pop music', 'popüler', 'ana akım'],
      'cinematic': ['cinematic', 'movie', 'film', 'soundtrack', 'cinematic music', 'sinematik', 'film müziği'],
      'acoustic': ['acoustic', 'organic', 'natural', 'unplugged', 'akustik', 'doğa', 'çevre', 'organik']
    };

    let maxScore = 0;
    let detectedGenre = 'pop';

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      let score = 0;
      keywords.forEach(keyword => {
        if (content.includes(keyword)) {
          score += 1;
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        detectedGenre = genre;
      }
    }

    return detectedGenre;
  }

  // Legacy function
  extractGenre(analysis) {
    return this.extractGenreFromContent(analysis);
  }

  // Find real music from free sources
  async findRealMusic(contentAnalysis, options) {
    const { mood, energy, genre, duration } = options;
    
    console.log(`🎵 [Music] Searching for real music: mood=${mood}, energy=${energy}, genre=${genre}`);
    
    try {
      // Try Pixabay first (free music API)
      const pixabayMusic = await this.fetchFromPixabayEnhanced(mood, energy, genre, duration);
      if (pixabayMusic) {
        return [pixabayMusic];
      }
      
      // Try Freesound (free sound effects and music)
      const freesoundMusic = await this.fetchFromFreesoundEnhanced(mood, energy, genre, duration);
      if (freesoundMusic) {
        return [freesoundMusic];
      }
      
      // Try curated music database
      const curatedMusic = await this.fetchFromCuratedDatabase(mood, energy, genre, duration);
      if (curatedMusic) {
        return [curatedMusic];
      }
      
      console.log('🎵 [Music] No real music found from any source');
      return [];
    } catch (error) {
      console.warn('⚠️ Real music search failed:', error.message);
      return [];
    }
  }

  // Search music from multiple sources
  async searchMusic(criteria) {
    const results = [];
    
    // Search Pixabay
    try {
      const pixabayResults = await this.searchPixabay(criteria);
      results.push(...pixabayResults);
    } catch (error) {
      console.warn('⚠️ Pixabay search failed:', error.message);
    }

    // Search Freesound
    try {
      const freesoundResults = await this.searchFreesound(criteria);
      results.push(...freesoundResults);
    } catch (error) {
      console.warn('⚠️ Freesound search failed:', error.message);
    }

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score);
  }

  // Search Pixabay for music
  async searchPixabay(criteria) {
    if (!this.sources.pixabay.apiKey) {
      throw new Error('Pixabay API key not configured');
    }

    const query = this.buildMusicQuery(criteria);
    const response = await axios.get(this.sources.pixabay.audioUrl, {
      params: {
        key: this.sources.pixabay.apiKey,
        q: query,
        category: 'music',
        min_duration: Math.max(10, criteria.duration - 10),
        max_duration: criteria.duration + 10,
        per_page: 20,
        safesearch: 'true'
      }
    });

    return response.data.hits.map(hit => ({
      id: hit.id,
      title: hit.tags,
      duration: hit.duration,
      url: hit.videos?.medium?.url || hit.videos?.small?.url,
      source: 'pixabay',
      score: this.calculateRelevanceScore(hit, criteria),
      preview: hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : null
    }));
  }

  // Search Freesound for music
  async searchFreesound(criteria) {
    if (!this.sources.freesound.apiKey) {
      throw new Error('Freesound API key not configured');
    }

    const query = this.buildMusicQuery(criteria);
    const response = await axios.get(this.sources.freesound.baseUrl, {
      params: {
        query: query,
        filter: 'duration:[10 TO 120]',
        fields: 'id,name,url,previews,duration,tags',
        page_size: 20
      },
      headers: {
        'Authorization': `Token ${this.sources.freesound.apiKey}`
      }
    });

    return response.data.results.map(sound => ({
      id: sound.id,
      title: sound.name,
      duration: sound.duration,
      url: sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-mp3-128'],
      source: 'freesound',
      score: this.calculateRelevanceScore(sound, criteria),
      preview: null
    }));
  }

  // Build search query from criteria
  buildMusicQuery(criteria) {
    const moodKeywords = {
      energetic: 'energetic upbeat fast tempo',
      calm: 'calm peaceful slow ambient',
      dramatic: 'dramatic cinematic orchestral',
      fun: 'fun happy cheerful playful',
      professional: 'corporate business professional',
      upbeat: 'upbeat positive energetic'
    };

    const energyKeywords = {
      high: 'fast tempo high energy',
      medium: 'medium tempo moderate',
      low: 'slow tempo low energy'
    };

    const genreKeywords = {
      ambient: 'ambient atmospheric',
      electronic: 'electronic synth',
      acoustic: 'acoustic guitar piano',
      rock: 'rock guitar drums',
      pop: 'pop commercial'
    };

    const query = [
      moodKeywords[criteria.mood] || '',
      energyKeywords[criteria.energy] || '',
      genreKeywords[criteria.genre] || '',
      'royalty free music'
    ].filter(Boolean).join(' ');

    return query;
  }

  // Calculate relevance score
  calculateRelevanceScore(item, criteria) {
    let score = 0;
    const title = (item.title || item.tags || '').toLowerCase();
    const duration = item.duration || 0;

    // Duration match (closer to target = higher score)
    const durationDiff = Math.abs(duration - criteria.duration);
    score += Math.max(0, 100 - durationDiff);

    // Mood match
    const moodKeywords = {
      energetic: ['energetic', 'upbeat', 'fast', 'dynamic'],
      calm: ['calm', 'peaceful', 'slow', 'ambient'],
      dramatic: ['dramatic', 'cinematic', 'orchestral', 'epic'],
      fun: ['fun', 'happy', 'cheerful', 'playful'],
      professional: ['corporate', 'business', 'professional', 'clean'],
      upbeat: ['upbeat', 'positive', 'energetic', 'bright']
    };

    const moodWords = moodKeywords[criteria.mood] || [];
    moodWords.forEach(word => {
      if (title.includes(word)) score += 20;
    });

    // Energy match
    const energyKeywords = {
      high: ['fast', 'high', 'energetic', 'dynamic'],
      medium: ['medium', 'moderate', 'balanced'],
      low: ['slow', 'low', 'calm', 'gentle']
    };

    const energyWords = energyKeywords[criteria.energy] || [];
    energyWords.forEach(word => {
      if (title.includes(word)) score += 15;
    });

    // Genre match
    const genreKeywords = {
      ambient: ['ambient', 'atmospheric', 'ethereal'],
      electronic: ['electronic', 'synth', 'digital'],
      acoustic: ['acoustic', 'guitar', 'piano', 'organic'],
      rock: ['rock', 'guitar', 'drums', 'electric'],
      pop: ['pop', 'commercial', 'mainstream']
    };

    const genreWords = genreKeywords[criteria.genre] || [];
    genreWords.forEach(word => {
      if (title.includes(word)) score += 10;
    });

    return Math.min(100, score);
  }

  // Download and process music
  async downloadMusic(musicItem, targetDuration) {
    try {
      // Try to fetch from free music sources first
      console.log('🎵 [Music] Fetching from free music sources...');
      const freeMusic = await this.fetchFreeMusic(musicItem, targetDuration);
      if (freeMusic) {
        return freeMusic;
      }
      
      // Fallback to synthetic music
      console.log('🎵 [Music] Generating synthetic music...');
      return await this.generateSyntheticMusic(musicItem, targetDuration);
    } catch (error) {
      console.warn('⚠️ Music download failed, generating synthetic:', error.message);
      return await this.generateSyntheticMusic(musicItem, targetDuration);
    }
  }

  async generateSyntheticMusic(musicItem, targetDuration) {
    try {
      const outputPath = path.join(this.outputDir, `synthetic_music_${Date.now()}.wav`);
      
      console.log('🎵 [Music] Creating simple background audio...');
      
      // Create a simple audio file using Node.js built-in approach
      return new Promise((resolve, reject) => {
        const fs = require('fs');
        const path = require('path');
        
        // Create a simple WAV file header and data
        const sampleRate = 44100;
        const duration = Math.min(targetDuration, 30); // Limit to 30 seconds max
        const numSamples = sampleRate * duration;
        const buffer = Buffer.alloc(44 + numSamples * 2); // WAV header + 16-bit samples
        
        // WAV header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + numSamples * 2, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // Mono
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28);
        buffer.writeUInt16LE(2, 32);
        buffer.writeUInt16LE(16, 34);
        buffer.write('data', 36);
        buffer.writeUInt32LE(numSamples * 2, 40);
        
        // Generate richer music based on mood
        const mood = musicItem.mood || 'professional';
        const frequencies = this.getMoodFrequencies(mood);
        
        for (let i = 0; i < numSamples; i++) {
          let sample = 0;
          const time = i / sampleRate;
          
          // Create a chord with multiple frequencies
          frequencies.forEach((freq, index) => {
            const volume = 0.3 / frequencies.length; // Distribute volume across frequencies
            const envelope = Math.exp(-time * 0.1) * (1 - Math.exp(-time * 2)); // Attack and decay
            sample += Math.sin(2 * Math.PI * freq * time) * volume * envelope;
          });
          
          // Add some variation based on mood
          if (mood === 'energetic' || mood === 'upbeat') {
            sample += Math.sin(2 * Math.PI * 880 * time) * 0.1; // Higher harmonic
          }
          
          // Apply overall volume
          sample *= 0.6; // Increased overall volume
          const sampleValue = Math.round(Math.max(-32767, Math.min(32767, sample * 32767)));
          buffer.writeInt16LE(sampleValue, 44 + i * 2);
        }
        
        // Write WAV file directly
        try {
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ Simple background audio created: ${outputPath}`);
          resolve(outputPath);
        } catch (writeError) {
          console.error('❌ Failed to write WAV file:', writeError);
          reject(writeError);
        }
      });
    } catch (error) {
      console.error('❌ Synthetic music generation failed:', error);
      return null;
    }
  }

  getMoodFrequency(mood) {
    const frequencies = {
      'calm': 220,      // A3
      'energetic': 440, // A4
      'dramatic': 330,  // E4
      'fun': 523,       // C5
      'professional': 392, // G4
      'upbeat': 494     // B4
    };
    return frequencies[mood] || 220;
  }

  getMoodFrequencies(mood) {
    const frequencySets = {
      'calm': [220, 330, 440],           // A3, E4, A4 - peaceful chord
      'energetic': [440, 523, 659],      // A4, C5, E5 - energetic chord
      'dramatic': [330, 392, 494],       // E4, G4, B4 - dramatic chord
      'fun': [523, 659, 784],            // C5, E5, G5 - fun chord
      'professional': [392, 494, 587],   // G4, B4, D5 - professional chord
      'upbeat': [440, 554, 659],         // A4, C#5, E5 - upbeat chord
      'romantic': [261, 329, 392]        // C4, E4, G4 - romantic chord
    };
    return frequencySets[mood] || [220, 330, 440];
  }

  // Enhanced synthetic music generation
  async generateEnhancedSyntheticMusic(musicItem, targetDuration) {
    try {
      const outputPath = path.join(this.outputDir, `enhanced_music_${Date.now()}.wav`);
      
      console.log(`🎵 [Music] Creating enhanced synthetic music: ${musicItem.name}`);
      console.log(`🎵 [Music] Mood: ${musicItem.mood}, Energy: ${musicItem.energy}, Genre: ${musicItem.genre}`);
      
      return new Promise((resolve, reject) => {
        const fs = require('fs');
        const path = require('path');
        
        // Create a more complex WAV file
        const sampleRate = 44100;
        const duration = Math.min(targetDuration, 60); // Limit to 60 seconds max
        const numSamples = sampleRate * duration;
        const buffer = Buffer.alloc(44 + numSamples * 2); // WAV header + 16-bit samples
        
        // WAV header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + numSamples * 2, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // Mono
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28);
        buffer.writeUInt16LE(2, 32);
        buffer.writeUInt16LE(16, 34);
        buffer.write('data', 36);
        buffer.writeUInt32LE(numSamples * 2, 40);
        
        // Generate enhanced music based on mood, energy, and genre
        const mood = musicItem.mood || 'professional';
        const energy = musicItem.energy || 'medium';
        const genre = musicItem.genre || 'ambient';
        
        const frequencies = this.getMoodFrequencies(mood);
        const energyMultiplier = this.getEnergyMultiplier(energy);
        const genreModifier = this.getGenreModifier(genre);
        
        for (let i = 0; i < numSamples; i++) {
          let sample = 0;
          const time = i / sampleRate;
          
          // Create a chord with multiple frequencies
          frequencies.forEach((freq, index) => {
            const volume = (0.3 / frequencies.length) * energyMultiplier;
            const envelope = this.getEnvelope(time, energy, mood);
            const frequency = freq * genreModifier;
            
            sample += Math.sin(2 * Math.PI * frequency * time) * volume * envelope;
          });
          
          // Add genre-specific variations
          sample += this.getGenreVariation(time, genre, energy);
          
          // Add some rhythm based on energy
          if (energy === 'high') {
            const beatFreq = 2; // 2 Hz beat
            sample += Math.sin(2 * Math.PI * beatFreq * time) * 0.1 * energyMultiplier;
          }
          
          // Apply overall volume and limiting
          sample *= 0.7; // Increased overall volume
          sample = Math.max(-0.95, Math.min(0.95, sample)); // Soft limiting
          
          const sampleValue = Math.round(sample * 32767);
          buffer.writeInt16LE(sampleValue, 44 + i * 2);
        }
        
        // Write WAV file directly
        try {
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ Enhanced synthetic music created: ${outputPath}`);
          resolve(outputPath);
        } catch (writeError) {
          console.error('❌ Failed to write enhanced WAV file:', writeError);
          reject(writeError);
        }
      });
    } catch (error) {
      console.error('❌ Enhanced synthetic music generation failed:', error);
      return null;
    }
  }

  getEnergyMultiplier(energy) {
    const multipliers = {
      'low': 0.3,
      'medium': 0.6,
      'high': 1.0
    };
    return multipliers[energy] || 0.6;
  }

  getGenreModifier(genre) {
    const modifiers = {
      'rock': 1.2,
      'electronic': 1.5,
      'classical': 0.8,
      'jazz': 1.1,
      'ambient': 0.6,
      'pop': 1.0,
      'cinematic': 1.3,
      'acoustic': 0.9,
      'corporate': 0.7
    };
    return modifiers[genre] || 1.0;
  }

  getEnvelope(time, energy, mood) {
    // Attack and decay envelope
    const attack = energy === 'high' ? 0.05 : 0.2;
    const decay = energy === 'high' ? 0.1 : 0.3;
    
    if (time < attack) {
      return time / attack;
    } else if (time < attack + decay) {
      return 1 - ((time - attack) / decay) * 0.3;
    } else {
      return 0.7;
    }
  }

  getGenreVariation(time, genre, energy) {
    let variation = 0;
    
    switch (genre) {
      case 'electronic':
        variation += Math.sin(2 * Math.PI * 880 * time) * 0.05; // Higher harmonic
        if (energy === 'high') {
          variation += Math.sin(2 * Math.PI * 1760 * time) * 0.03; // Even higher
        }
        break;
      case 'jazz':
        variation += Math.sin(2 * Math.PI * 440 * time * 1.5) * 0.03; // Jazz harmony
        break;
      case 'cinematic':
        variation += Math.sin(2 * Math.PI * 220 * time) * 0.04; // Lower bass
        break;
      case 'rock':
        variation += Math.sin(2 * Math.PI * 660 * time) * 0.04; // Rock harmony
        break;
    }
    
    return variation;
  }

  async createSimpleTone(outputPath, duration) {
    try {
      console.log('🎵 [Music] Creating simple tone...');
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(`sine=frequency=440:duration=${duration}`)
          .inputFormat('lavfi')
          .audioFilters(['volume=0.1'])
          .outputOptions(['-acodec', 'mp3', '-ar', '44100'])
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Simple tone created: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Simple tone creation failed:', err);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      console.error('❌ Simple tone creation failed:', error);
      return null;
    }
  }

  async createSilentAudio(outputPath, duration) {
    try {
      console.log('🔇 [Music] Creating silent audio as fallback...');
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(`anullsrc=channel_layout=stereo:sample_rate=44100`)
          .inputFormat('lavfi')
          .outputOptions(['-t', duration.toString()])
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Silent audio created: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Silent audio creation failed:', err);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      console.error('❌ Silent audio creation failed:', error);
      return null;
    }
  }

  async downloadMusicOld(musicItem, targetDuration) {
    try {
      const outputPath = path.join(this.outputDir, `music_${musicItem.id}.mp3`);
      
      // Check cache first
      const cachePath = path.join(this.cacheDir, `music_${musicItem.id}.mp3`);
      if (fs.existsSync(cachePath)) {
        console.log('🎵 [Music] Using cached music');
        return await this.processMusicFile(cachePath, targetDuration);
      }

      // Download music
      console.log(`🎵 [Music] Downloading: ${musicItem.title}`);
      const response = await axios.get(musicItem.url, { responseType: 'stream' });
      
      const writer = fs.createWriteStream(cachePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            const processedPath = await this.processMusicFile(cachePath, targetDuration);
            resolve(processedPath);
          } catch (error) {
            reject(error);
          }
        });
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('❌ Music download failed:', error);
      throw error;
    }
  }

  // Process music file (trim, normalize, etc.)
  async processMusicFile(inputPath, targetDuration) {
    const outputPath = path.join(this.outputDir, `processed_${Date.now()}.mp3`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          'loudnorm=I=-16:TP=-1.5:LRA=11', // Normalize
          'afade=t=in:st=0:d=2', // Fade in
          'afade=t=out:st=' + (targetDuration - 2) + ':d=2' // Fade out
        ])
        .duration(targetDuration)
        .audioCodec('mp3')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Music processed: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  }

  // Generate music based on mood (synthetic) - REMOVED LAVFI
  async generateSyntheticMusicOld(mood, duration) {
    // This function is disabled due to lavfi issues
    console.log('⚠️ Old synthetic music generation disabled due to lavfi issues');
    return null;
  }

  // Fetch free music from various sources
  async fetchFreeMusic(musicItem, targetDuration) {
    try {
      const mood = musicItem.mood || 'professional';
      console.log(`🎵 [Music] Fetching free music for mood: ${mood}`);
      
      // Try Pixabay first (free music API)
      const pixabayMusic = await this.fetchFromPixabay(mood, targetDuration);
      if (pixabayMusic) {
        return pixabayMusic;
      }
      
      // Try Freesound (free sound effects and music)
      const freesoundMusic = await this.fetchFromFreesound(mood, targetDuration);
      if (freesoundMusic) {
        return freesoundMusic;
      }
      
      // Try YouTube Audio Library (free music)
      const youtubeMusic = await this.fetchFromYouTubeAudioLibrary(mood, targetDuration);
      if (youtubeMusic) {
        return youtubeMusic;
      }
      
      console.log('🎵 [Music] No free music found, will generate synthetic');
      return null;
    } catch (error) {
      console.warn('⚠️ Free music fetching failed:', error.message);
      return null;
    }
  }

  // Enhanced Pixabay music fetching
  async fetchFromPixabayEnhanced(mood, energy, genre, targetDuration) {
    try {
      const apiKey = process.env.PIXABAY_API_KEY;
      if (!apiKey) {
        console.log('🎵 [Music] No Pixabay API key, skipping...');
        return null;
      }
      
      // Create search query based on mood, energy, and genre
      const searchQuery = this.buildMusicSearchQuery(mood, energy, genre);
      console.log(`🎵 [Music] Searching Pixabay for: "${searchQuery}"`);
      
      const response = await axios.get(this.sources.pixabay.audioUrl, {
        params: {
          key: apiKey,
          q: searchQuery,
          category: 'music',
          min_duration: Math.max(10, targetDuration - 10),
          max_duration: targetDuration + 10,
          per_page: 5,
          safesearch: true
        },
        timeout: 10000
      });

      if (response.data && response.data.hits && response.data.hits.length > 0) {
        const music = response.data.hits[0];
        console.log(`🎵 [Music] Found Pixabay music: ${music.tags}`);
        
        return {
          id: `pixabay_${music.id}`,
          title: music.tags || 'Pixabay Music',
          mood: mood,
          energy: energy,
          genre: genre,
          duration: targetDuration,
          source: 'Pixabay',
          url: music.webformatURL,
          downloadUrl: music.largeImageURL
        };
      }
      
      console.log('🎵 [Music] No Pixabay music found');
      return null;
    } catch (error) {
      console.warn('⚠️ Pixabay enhanced fetch failed:', error.message);
      return null;
    }
  }

  // Build intelligent music search query
  buildMusicSearchQuery(mood, energy, genre) {
    const moodKeywords = {
      'calm': 'ambient,peaceful,relaxing,soft,gentle',
      'energetic': 'upbeat,energetic,fast,dynamic,exciting',
      'dramatic': 'dramatic,epic,cinematic,powerful,intense',
      'fun': 'happy,cheerful,playful,fun,joyful',
      'professional': 'corporate,business,professional,clean,modern',
      'romantic': 'romantic,love,passionate,emotional,intimate',
      'upbeat': 'positive,motivational,inspiring,upbeat,cheerful'
    };

    const energyKeywords = {
      'high': 'fast,energetic,dynamic,powerful,intense',
      'medium': 'moderate,balanced,steady,comfortable',
      'low': 'slow,calm,gentle,soft,peaceful'
    };

    const genreKeywords = {
      'rock': 'rock,guitar,electric,band',
      'electronic': 'electronic,synth,techno,edm,digital',
      'classical': 'classical,orchestra,piano,violin,symphony',
      'jazz': 'jazz,saxophone,trumpet,blues',
      'ambient': 'ambient,atmospheric,background,atmospheric',
      'pop': 'pop,popular,mainstream,contemporary',
      'cinematic': 'cinematic,movie,film,soundtrack,orchestral',
      'acoustic': 'acoustic,organic,natural,unplugged'
    };

    const moodQuery = moodKeywords[mood] || 'music';
    const energyQuery = energyKeywords[energy] || '';
    const genreQuery = genreKeywords[genre] || '';

    return [moodQuery, energyQuery, genreQuery].filter(Boolean).join(',');
  }

  // Legacy Pixabay function
  async fetchFromPixabay(mood, targetDuration) {
    return await this.fetchFromPixabayEnhanced(mood, 'medium', 'ambient', targetDuration);
  }

  // Fetch from Freesound (free sound effects and music)
  async fetchFromFreesound(mood, targetDuration) {
    try {
      const apiKey = process.env.FREESOUND_API_KEY;
      if (!apiKey) {
        console.log('🎵 [Music] No Freesound API key, skipping...');
        return null;
      }
      
      // Skip Freesound for now due to API issues
      console.log('🎵 [Music] Freesound temporarily disabled due to API issues');
      return null;

      const moodKeywords = {
        'calm': 'ambient,peaceful,relaxing',
        'energetic': 'upbeat,energetic,fast',
        'dramatic': 'dramatic,epic,cinematic',
        'professional': 'corporate,business,professional',
        'fun': 'happy,cheerful,playful',
        'upbeat': 'upbeat,positive,energetic'
      };

      const keywords = moodKeywords[mood] || 'background music';
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(keywords)}&filter=duration:[10 TO 300]&fields=id,name,download,previews&token=${apiKey}`;

      console.log(`🎵 [Music] Fetching from Freesound: ${keywords}`);
      
      const response = await axios.get(url);
      const sounds = response.data.results || [];
      
      if (sounds.length > 0) {
        const selectedSound = sounds[0]; // Take the first result
        const downloadUrl = selectedSound.download;
        
        if (downloadUrl) {
          const outputPath = path.join(this.outputDir, `freesound_music_${Date.now()}.mp3`);
          
          // Download the audio file
          const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });
          const writer = fs.createWriteStream(outputPath);
          downloadResponse.data.pipe(writer);
          
          return new Promise((resolve, reject) => {
            writer.on('finish', () => {
              console.log(`✅ Freesound music downloaded: ${outputPath}`);
              resolve(outputPath);
            });
            writer.on('error', reject);
          });
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Freesound fetch failed:', error.message);
      return null;
    }
  }

  // Enhanced curated music database
  async fetchFromCuratedDatabase(mood, energy, genre, targetDuration) {
    try {
      console.log(`🎵 [Music] Using enhanced curated database: mood=${mood}, energy=${energy}, genre=${genre}`);
      
      // Enhanced curated music tracks with more variety
      const curatedTracks = {
        'upbeat': [
          { id: 'upbeat_1', name: 'Happy Upbeat', duration: 30, mood: 'upbeat', energy: 'high', genre: 'pop' },
          { id: 'upbeat_2', name: 'Energetic Pop', duration: 45, mood: 'upbeat', energy: 'high', genre: 'pop' },
          { id: 'upbeat_3', name: 'Positive Vibes', duration: 60, mood: 'upbeat', energy: 'medium', genre: 'electronic' },
          { id: 'upbeat_4', name: 'Summer Energy', duration: 30, mood: 'upbeat', energy: 'high', genre: 'rock' },
          { id: 'upbeat_5', name: 'Morning Motivation', duration: 45, mood: 'upbeat', energy: 'medium', genre: 'acoustic' }
        ],
        'calm': [
          { id: 'calm_1', name: 'Peaceful Ambient', duration: 30, mood: 'calm', energy: 'low', genre: 'ambient' },
          { id: 'calm_2', name: 'Soft Piano', duration: 45, mood: 'calm', energy: 'low', genre: 'classical' },
          { id: 'calm_3', name: 'Gentle Strings', duration: 60, mood: 'calm', energy: 'low', genre: 'classical' },
          { id: 'calm_4', name: 'Nature Sounds', duration: 30, mood: 'calm', energy: 'low', genre: 'ambient' },
          { id: 'calm_5', name: 'Meditation', duration: 45, mood: 'calm', energy: 'low', genre: 'ambient' }
        ],
        'professional': [
          { id: 'pro_1', name: 'Corporate Background', duration: 30, mood: 'professional', energy: 'medium', genre: 'corporate' },
          { id: 'pro_2', name: 'Business Presentation', duration: 45, mood: 'professional', energy: 'medium', genre: 'corporate' },
          { id: 'pro_3', name: 'Executive Summary', duration: 60, mood: 'professional', energy: 'low', genre: 'corporate' },
          { id: 'pro_4', name: 'Conference Room', duration: 30, mood: 'professional', energy: 'medium', genre: 'ambient' },
          { id: 'pro_5', name: 'Board Meeting', duration: 45, mood: 'professional', energy: 'low', genre: 'classical' }
        ],
        'dramatic': [
          { id: 'drama_1', name: 'Epic Cinematic', duration: 30, mood: 'dramatic', energy: 'high', genre: 'cinematic' },
          { id: 'drama_2', name: 'Intense Action', duration: 45, mood: 'dramatic', energy: 'high', genre: 'cinematic' },
          { id: 'drama_3', name: 'Powerful Orchestral', duration: 60, mood: 'dramatic', energy: 'high', genre: 'classical' },
          { id: 'drama_4', name: 'Thriller', duration: 30, mood: 'dramatic', energy: 'high', genre: 'electronic' },
          { id: 'drama_5', name: 'Heroic Theme', duration: 45, mood: 'dramatic', energy: 'high', genre: 'cinematic' }
        ],
        'fun': [
          { id: 'fun_1', name: 'Playful Jingle', duration: 30, mood: 'fun', energy: 'high', genre: 'pop' },
          { id: 'fun_2', name: 'Cheerful Melody', duration: 45, mood: 'fun', energy: 'medium', genre: 'pop' },
          { id: 'fun_3', name: 'Happy Tune', duration: 60, mood: 'fun', energy: 'medium', genre: 'electronic' },
          { id: 'fun_4', name: 'Kids Theme', duration: 30, mood: 'fun', energy: 'high', genre: 'pop' },
          { id: 'fun_5', name: 'Party Time', duration: 45, mood: 'fun', energy: 'high', genre: 'electronic' }
        ],
        'romantic': [
          { id: 'romantic_1', name: 'Love Theme', duration: 30, mood: 'romantic', energy: 'low', genre: 'classical' },
          { id: 'romantic_2', name: 'Passionate', duration: 45, mood: 'romantic', energy: 'medium', genre: 'acoustic' },
          { id: 'romantic_3', name: 'Intimate', duration: 60, mood: 'romantic', energy: 'low', genre: 'jazz' }
        ]
      };

      // Filter tracks by mood, energy, and genre
      let tracks = curatedTracks[mood] || curatedTracks['professional'];
      
      if (energy !== 'auto') {
        tracks = tracks.filter(track => track.energy === energy);
      }
      
      if (genre !== 'auto') {
        tracks = tracks.filter(track => track.genre === genre);
      }
      
      if (tracks.length === 0) {
        tracks = curatedTracks[mood] || curatedTracks['professional'];
      }
      
      const selectedTrack = tracks[Math.floor(Math.random() * tracks.length)];
      
      console.log(`🎵 [Music] Selected curated track: ${selectedTrack.name} (${selectedTrack.genre}, ${selectedTrack.energy})`);
      
      // Generate enhanced synthetic music with the selected track info
      const musicItem = { 
        mood: mood, 
        energy: energy,
        genre: genre,
        id: selectedTrack.id,
        name: selectedTrack.name,
        duration: Math.min(selectedTrack.duration, targetDuration)
      };
      
      return await this.generateEnhancedSyntheticMusic(musicItem, targetDuration);
    } catch (error) {
      console.warn('⚠️ Curated music fetch failed:', error.message);
      return null;
    }
  }

  // Legacy function
  async fetchFromYouTubeAudioLibrary(mood, targetDuration) {
    return await this.fetchFromCuratedDatabase(mood, 'medium', 'ambient', targetDuration);
  }

  // Extract audio from video and trim to target duration
  async extractAudioFromVideo(videoPath, audioPath, targetDuration) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .audioCodec('pcm_s16le') // Use PCM instead of AAC/MP3
        .audioFrequency(44100)
        .duration(targetDuration)
        .output(audioPath)
        .on('end', () => {
          console.log(`✅ Audio extracted: ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('❌ Audio extraction failed:', err);
          reject(err);
        })
        .run();
    });
  }
}

module.exports = new IntelligentMusicService();
