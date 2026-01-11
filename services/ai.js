const axios = require('axios');

class AIService {
  constructor() {
    // Environment-based AI configuration
    this.isProduction = process.env.NODE_ENV === 'production';
    this.useLocalAI = !this.isProduction && process.env.USE_LOCAL_AI === 'true'; // Ollama'yı sadece local'de ve USE_LOCAL_AI=true ise aktif et
    this.localAIModel = process.env.OLLAMA_MODEL || 'llama3:8b';
    this.localAIUrl = 'http://127.0.0.1:11434/api/generate';
    this.isBrowser = typeof window !== 'undefined';
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (this.useLocalAI) {
      console.log('🤖 AI Service: Using local AI with Ollama (llama3:8b)');
      console.log('💡 Make sure Ollama is running: ollama serve');
      console.log('💡 Model: llama3:8b (4.7 GB)');
      console.log('💡 If Ollama fails, will fall back to high-quality templates');
    } else {
      console.log('🚀 AI Service: Production mode - Using template-based generation');
    }
  }

  async generateScript(topic, options = {}) {
    const {
      videoStyle = 'entertaining',
      targetAudience = 'gen-z',
      videoDuration = '30-45s',
      mood = 'energetic',
      ctaType = 'follow'
    } = options;
    
    console.log(`🤖 [AI Service] Generating script for: ${topic}`);
    console.log(`📊 [AI] Style: ${videoStyle}, Audience: ${targetAudience}, Duration: ${videoDuration}, Mood: ${mood}, CTA: ${ctaType}`);
    
    // Try local AI first if enabled
    if (this.useLocalAI) {
      try {
        console.log('💻 [AI] Using local Ollama...');
        return await this.generateWithOllama(topic, options);
      } catch (error) {
        console.warn('⚠️  [AI] Local AI failed:', error.message);
        console.log('🔄 [AI] Falling back to cloud AI...');
      }
    }

    // Try HuggingFace API with better model
    if (this.apiKey) {
      try {
        console.log('☁️  [AI] Using HuggingFace API...');
        return await this.generateWithHuggingFace(topic);
      } catch (error) {
        console.warn('⚠️  [AI] HuggingFace failed:', error.message);
        console.log('🔄 [AI] Falling back to enhanced templates...');
      }
    }

    // Fallback to enhanced template-based generation
    console.log('📝 [AI] Using enhanced template generation...');
    return this.createEnhancedScript(topic, options);
  }
  
  async generateWithHuggingFace(topic) {
    const prompt = `Create a VIRAL YouTube Shorts script about "${topic}". 

MANDATORY LIMITS:
1. Script: MAXIMUM 25 WORDS (30 seconds)
2. Format: Hook (5 words) + Main (10 words) + CTA (5 words)
3. NO explanations, NO fluff
4. Count every word!

JSON format: 
- script: 25 words MAX
- title: under 40 chars
- hashtags: 3 tags only`;

    try {
      // Use a better model for text generation (updated to working model)
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
        { 
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.8,
            top_p: 0.95,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minutes for model loading
        }
      );
      
      if (!response.data || !response.data[0]?.generated_text) {
        throw new Error('No response from HuggingFace');
      }
      
      const generatedText = response.data[0].generated_text.trim();
      console.log('✅ [AI] HuggingFace response received');
      
      // Try to parse JSON from response
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            script: parsed.script || generatedText,
            title: parsed.title || `Amazing ${topic} Facts You Need to Know!`,
            description: parsed.description || `Discover incredible facts about ${topic}! 🚀`,
            hashtags: parsed.hashtags || this.generateHashtags(topic)
          };
        }
      } catch (e) {
        console.warn('⚠️  [AI] Could not parse JSON, using text as script');
      }
      
      // If parsing fails, use the text as script
      return this.createEnhancedScript(topic, generatedText);

    } catch (error) {
      console.error('❌ [AI] HuggingFace error:', error.message);
      throw error;
    }
  }
  
  async tryFallbackModel(prompt, topic) {
    console.log('Trying fallback model:', this.fallbackModel);
    
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.fallbackModel}`,
        { 
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.8,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'
          },
          timeout: 60000
        }
      );
      
      if (response.data && response.data[0]?.generated_text) {
        // Try to extract JSON from the response
        const responseText = response.data[0].generated_text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              script: parsed.script || responseText,
              title: parsed.title || `Amazing Facts About ${topic}`,
              hashtags: parsed.hashtags || [`#${topic.replace(/\\s+/g, '')}`, '#shorts', '#viral']
            };
          } catch (e) {
            console.warn('Failed to parse fallback model response as JSON');
          }
        }
        return this.createFallbackScript(topic, responseText);
      }
    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError.message);
      if (fallbackError.response) {
        console.error('Response status:', fallbackError.response.status);
        console.error('Response data:', fallbackError.response.data);
      }
    }
    
    return this.createFallbackScript(topic);
  }

  async generateWithOllama(topic, options = {}) {
    if (this.isBrowser) {
      // In browser, use template-based generation
      return this.createFallbackScript(topic);
    }
    
    const {
      videoStyle = 'entertaining',
      targetAudience = 'gen-z',
      videoDuration = '30-45s',
      mood = 'energetic',
      ctaType = 'follow',
      explicitWordCount,
      regenerate = false
    } = options;
    
    try {
      console.log('🤖 Ollama: Generating script with llama3:8b...');
      
      // Build style-specific guidelines WITH MOOD for emotion-specific vocabulary
      const styleGuide = this.getStyleGuidelines(videoStyle, mood);
      const audienceGuide = this.getAudienceGuidelines(targetAudience);
      const durationGuide = this.getDurationGuidelines(videoDuration);
      const ctaGuide = this.getCTAGuidelines(ctaType);
      
      // Get emotion vocabulary for the mood
      const emotionWords = this.getEmotionVocabulary(mood);
      const emotionHint = `The mood is ${mood}. Use emotion-specific words naturally: ${emotionWords.slice(0, 5).join(', ')}. The narrator's tone should reflect this mood - ${mood === 'sad' ? 'sad and emotional' : mood === 'calm' ? 'calm and peaceful' : mood === 'energetic' ? 'energetic and exciting' : mood === 'dramatic' ? 'dramatic and intense' : 'engaging'}.`;
      
      // FULL-LENGTH narration prompt for complete video coverage
      const wordCount = explicitWordCount || this.getWordCount(videoDuration);
      
      // Enhanced prompt for regeneration
      const regenerationNote = regenerate 
        ? `IMPORTANT: The previous script was too short. Generate a COMPLETE, FULL-LENGTH script. DO NOT repeat the same sentences. Make it engaging, informative, and cover ${topic} thoroughly with unique content.`
        : '';
      
      const prompt = `Write a ${videoStyle} YouTube Shorts script about "${topic}" for ${targetAudience} audience. Return ONLY a JSON object:

{
  "script": "A complete, engaging script about ${topic}. ${durationGuide} ${styleGuide} ${audienceGuide} ${emotionHint} The script must be EXACTLY ${wordCount} words. Cover the topic thoroughly with unique, non-repetitive content. Each sentence should add value. Use emotion-specific vocabulary naturally. ${ctaGuide}",
  "title": "Under 60 characters, viral and engaging",
  "hashtags": ["#shorts", "#${topic.replace(/\\s+/g, '')}", "#viral", "#trending"]
}

CRITICAL REQUIREMENTS:
- Script MUST be EXACTLY ${wordCount} words (±10) for full video narration
- This is for a ${videoDuration} video
- Mood: ${mood} - The script should FEEL ${mood} through word choice and tone
- Target Audience: ${targetAudience} - Use appropriate language and references
- NO repetition of sentences or phrases
- NO filler phrases like "This is important information you need to know"
- Make it natural, engaging, and informative
- Each sentence should add unique value
- Count your words carefully!
- Use emotion-specific vocabulary: ${emotionWords.slice(0, 8).join(', ')}

${regenerationNote}`;

      const response = await axios.post(this.localAIUrl, {
        model: this.localAIModel,
        prompt: prompt,
        stream: false
      }, {
        timeout: 60000 // 60 seconds timeout
      });

      console.log('✅ Ollama response received');
      
      if (response.data?.response) {
        const responseText = response.data.response.trim();
        console.log('📝 Ollama raw response:', responseText.substring(0, 200) + '...');
        
        try {
          // Try to extract JSON from response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonText = jsonMatch[0];
            const result = JSON.parse(jsonText);
            
            console.log('✅ Ollama JSON parsed successfully');
            return {
              script: result.script || responseText,
              title: result.title || this.generateViralTitle(topic, options),
              description: this.generateSEODescription(result.script || responseText, topic, options),
              hashtags: result.hashtags || this.generateViralHashtags(topic, options)
            };
          } else {
            // If no JSON, use the raw response as script
            console.log('📝 Using Ollama raw response as script');
            return {
              script: responseText,
              title: this.generateViralTitle(topic, options),
              description: this.generateSEODescription(responseText, topic, options),
              hashtags: this.generateViralHashtags(topic, options)
            };
          }
        } catch (parseError) {
          console.log('⚠️ JSON parsing failed, using raw response');
          return {
            script: responseText,
            title: this.generateViralTitle(topic, options),
            description: this.generateSEODescription(responseText, topic, options),
            hashtags: this.generateViralHashtags(topic, options)
          };
        }
      }
      
      throw new Error('No response from Ollama');
    } catch (error) {
      console.error('❌ Ollama Error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 Ollama is not running. Start it with: ollama serve');
      }
      throw error;
    }
  }

  // Generate hashtags based on topic
  generateHashtags(topic) {
    const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = cleanTopic.split(' ').filter(w => w.length > 3);
    
    const hashtags = [
      '#Shorts',
      '#Viral',
      '#Trending',
      '#FYP',
      '#MustWatch'
    ];
    
    // Add topic-specific hashtags
    words.slice(0, 3).forEach(word => {
      hashtags.push(`#${word.charAt(0).toUpperCase() + word.slice(1)}`);
    });
    
    return hashtags.slice(0, 8);
  }
  
  // Helper methods for guidelines - ENHANCED with emotion-specific vocabulary
  getStyleGuidelines(style, mood = 'energetic') {
    const emotionWords = this.getEmotionVocabulary(mood);
    const guides = {
      'entertaining': `Use fun, engaging language with humor. Include words like: ${emotionWords.join(', ')}. Make it exciting and captivating. Use exclamations and enthusiasm!`,
      'educational': `Be informative and clear, teach something valuable. Use precise, confident language. Include words like: ${emotionWords.slice(0, 3).join(', ')}. Sound knowledgeable and trustworthy.`,
      'motivational': `Inspire and energize, use powerful words. Include words like: ${emotionWords.join(', ')}. Make it uplifting and empowering. Use strong, confident statements.`,
      'storytelling': `Tell a compelling narrative with emotion. Include words like: ${emotionWords.join(', ')}. Create emotional connection. Use descriptive, vivid language.`,
      'controversial': `Make a bold statement, challenge assumptions. Include words like: ${emotionWords.slice(0, 4).join(', ')}. Be direct and provocative.`,
      'quick-tips': `Be direct and practical, actionable advice. Include words like: ${emotionWords.slice(0, 2).join(', ')}. Keep it concise and valuable.`
    };
    return guides[style] || guides['entertaining'];
  }

  getAudienceGuidelines(audience) {
    const guides = {
      'gen-z': `Use casual, trendy language. No formal tone. Include Gen-Z slang and references like: "no cap", "fr fr", "that's fire", "lowkey", "ngl", "bet", "slaps", "vibe". Use emojis in descriptions. Sound like a friend talking, not a teacher.`,
      'millennials': `Professional but relatable. Modern references. Use phrases like: "game-changer", "next level", "real talk", "honestly", "actually". Balance professionalism with authenticity. Reference modern culture and trends.`,
      'general': `Universal appeal, simple language. Clear and accessible. Avoid jargon. Use everyday language that everyone understands.`,
      'professionals': `Business-focused, professional tone. Use terms like: "leverage", "optimize", "strategic", "impact", "value proposition", "ROI", "scalable". Sound authoritative and credible.`,
      'students': `Educational, easy to understand. Use phrases like: "here's how", "let me break it down", "the key is", "think of it like". Make complex topics simple.`
    };
    return guides[audience] || guides['gen-z'];
  }

  // NEW: Emotion-specific vocabulary based on mood
  getEmotionVocabulary(mood) {
    const vocabularies = {
      'energetic': ['incredible', 'amazing', 'mind-blowing', 'unbelievable', 'stunning', 'powerful', 'dynamic', 'explosive', 'thrilling', 'electrifying', 'intense', 'vibrant'],
      'calm': ['peaceful', 'serene', 'gentle', 'soothing', 'tranquil', 'relaxing', 'comfortable', 'easy', 'smooth', 'balanced', 'harmonious', 'quiet'],
      'dramatic': ['shocking', 'devastating', 'heartbreaking', 'tragic', 'intense', 'powerful', 'emotional', 'profound', 'deep', 'moving', 'stirring', 'compelling'],
      'fun': ['hilarious', 'wacky', 'crazy', 'wild', 'insane', 'ridiculous', 'absurd', 'comical', 'entertaining', 'playful', 'lighthearted', 'joyful'],
      'professional': ['strategic', 'systematic', 'methodical', 'precise', 'effective', 'efficient', 'optimized', 'streamlined', 'sophisticated', 'advanced', 'expert', 'masterful'],
      'romantic': ['beautiful', 'lovely', 'charming', 'enchanting', 'captivating', 'alluring', 'tender', 'sweet', 'passionate', 'intimate', 'heartfelt', 'romantic'],
      'sad': ['heartbreaking', 'devastating', 'tragic', 'painful', 'difficult', 'challenging', 'struggling', 'overwhelming', 'emotional', 'touching', 'moving', 'sorrowful'],
      'happy': ['wonderful', 'fantastic', 'brilliant', 'excellent', 'delightful', 'joyful', 'cheerful', 'uplifting', 'positive', 'bright', 'sunny', 'radiant']
    };
    return vocabularies[mood] || vocabularies['energetic'];
  }

  // NEW: Inject emotion-specific vocabulary into script naturally
  injectEmotionVocabulary(script, mood, emotionWords, targetAudience) {
    // Common words to replace with emotion-specific ones
    const replacements = {
      'amazing': emotionWords[0] || 'amazing',
      'incredible': emotionWords[1] || 'incredible',
      'great': emotionWords[2] || 'great',
      'good': emotionWords[3] || 'good',
      'important': emotionWords[4] || 'important'
    };
    
    // Replace generic words with emotion-specific ones (max 3-4 replacements to keep natural)
    let modifiedScript = script;
    let replacementCount = 0;
    const maxReplacements = 4;
    
    for (const [generic, emotionWord] of Object.entries(replacements)) {
      if (replacementCount >= maxReplacements) break;
      
      // Replace only if the generic word exists and emotion word is different
      if (generic !== emotionWord && modifiedScript.toLowerCase().includes(generic)) {
        // Use case-insensitive replacement but preserve original case
        modifiedScript = modifiedScript.replace(
          new RegExp(`\\b${generic}\\b`, 'gi'),
          (match) => {
            // Preserve original case
            if (match === match.toUpperCase()) {
              return emotionWord.toUpperCase();
            } else if (match[0] === match[0].toUpperCase()) {
              return emotionWord.charAt(0).toUpperCase() + emotionWord.slice(1);
            }
            return emotionWord;
          }
        );
        replacementCount++;
      }
    }
    
    // Add audience-specific language adjustments
    if (targetAudience === 'gen-z') {
      // Add Gen-Z flavor naturally
      const genZPhrases = ['no cap', 'fr', 'that\'s fire', 'lowkey', 'ngl'];
      const randomPhrase = genZPhrases[Math.floor(Math.random() * genZPhrases.length)];
      
      // Insert Gen-Z phrase naturally (only if script is long enough)
      if (modifiedScript.split(/\s+/).length > 20) {
        const sentences = modifiedScript.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 2) {
          const insertIndex = Math.floor(sentences.length / 2);
          sentences[insertIndex] = sentences[insertIndex].trim() + ` ${randomPhrase},`;
          modifiedScript = sentences.join('. ') + '.';
        }
      }
    } else if (targetAudience === 'professionals') {
      // Replace casual phrases with professional ones
      modifiedScript = modifiedScript
        .replace(/\bgot\b/gi, 'obtained')
        .replace(/\bgot it\b/gi, 'understood')
        .replace(/\bawesome\b/gi, 'excellent')
        .replace(/\bcool\b/gi, 'effective');
    }
    
    return modifiedScript;
  }

  getDurationGuidelines(duration) {
    const guides = {
      '15-30s': 'EXACTLY 40-50 words! Fast-paced narration.',
      '30-45s': 'EXACTLY 60-80 words! Engaging full narration.',
      '45-60s': 'EXACTLY 80-100 words! Complete story.'
    };
    return guides[duration] || guides['30-45s'];
  }
  
  getWordCount(duration) {
    const counts = {
      '15-30s': 45,
      '30-45s': 70,
      '45-60s': 90
    };
    return counts[duration] || 70;
  }

  getCTAGuidelines(ctaType) {
    const ctas = {
      'follow': 'End with: Follow for more!',
      'comment': 'End with: Comment below!',
      'share': 'End with: Share this!',
      'watch-more': 'End with: Watch till end!',
      'none': 'No call-to-action needed.'
    };
    return ctas[ctaType] || ctas['follow'];
  }

  getCTA(ctaType) {
    const ctas = {
      'follow': 'Follow for more!',
      'comment': 'Comment below!',
      'share': 'Share this!',
      'watch-more': 'Watch till end!',
      'none': ''
    };
    return ctas[ctaType] || ctas['follow'];
  }

  // Enhanced script generation with better templates - FULL LENGTH based on video duration
  createEnhancedScript(topic, options = {}) {
    console.log('🎭 [AI] Creating enhanced script...');
    
    const {
      videoStyle = 'entertaining',
      targetAudience = 'gen-z',
      videoDuration = '30-45s',
      mood = 'energetic',
      ctaType = 'follow',
      explicitWordCount
    } = options;
    
    // Get target word count
    const targetWordCount = explicitWordCount || this.getWordCount(videoDuration);
    
    // Clean and analyze topic
    const cleanTopic = topic.toLowerCase().trim();
    const words = cleanTopic.split(' ').filter(w => w.length > 3);
    const mainKeyword = words[0] || cleanTopic;
    
    // Style-specific FULL-LENGTH script templates (not just 1-2 sentences)
    const styleTemplates = {
      'entertaining': [
        `Wait! ${mainKeyword} changed everything. Found the secret yesterday. It's simpler than you think. This will blow your mind. Here's what makes ${mainKeyword} so fascinating. The best part? It's easier than you think. I tested this myself and results were amazing. You'll be surprised by how simple this really is. This method works for everyone, no exceptions. The secret is understanding the basics first. Once you master this, everything clicks. Trust me, this works. ${this.getCTA(ctaType)}`,
        `You won't believe this ${mainKeyword} hack! Tried it yesterday. Results are insane. Everyone needs to know this secret. The technique is straightforward and effective. Most people overcomplicate things. Keep it simple and focus on what matters. I've seen incredible results with this approach. The key is consistency and patience. Start small and build from there. This will transform how you think about ${mainKeyword}. ${this.getCTA(ctaType)}`
      ],
      'educational': [
        `Learn ${mainKeyword} in 30 seconds. Here's what experts don't tell you. Three simple steps that work. Game-changing knowledge you need. Research shows this approach is highly effective. The science behind this is fascinating. Experts recommend this strategy for best results. Understanding ${mainKeyword} can transform your perspective. Let me break down the key facts. This method is backed by real data. ${this.getCTA(ctaType)}`,
        `${mainKeyword} explained simply. Most people get this wrong. Here's the truth about how it works. Science-backed facts that matter. The fundamentals are crucial to understand. Once you grasp these concepts, everything makes sense. Studies confirm this approach works better. Real-world applications show incredible results. The evidence is clear and compelling. ${this.getCTA(ctaType)}`
      ],
      'motivational': [
        `${mainKeyword} can transform your life. I proved it myself through hard work. You have the power to change everything. Start today and take that first step. Remember, ${mainKeyword} is within your reach. You have everything you need to succeed. Take action now, don't wait for perfect timing. Your future self will thank you for this. Believe in yourself and make it happen. The journey starts with a single decision. ${this.getCTA(ctaType)}`,
        `Stop doubting yourself about ${mainKeyword}. You're capable of amazing things beyond imagination. Take action now and see the results. Success awaits those who persist. The path forward is clearer than you think. Success awaits those who dare to try. Your potential is limitless when you commit. Every expert was once a beginner. Start where you are and grow. ${this.getCTA(ctaType)}`
      ],
      'storytelling': [
        `Never forget my ${mainKeyword} journey. Everything clicked that day when I least expected it. My life changed forever in that moment. Here's what happened and why it matters. Let me share what I learned along the way. This discovery changed everything for me completely. The journey taught me valuable lessons about persistence. Looking back, this was a turning point in my life. The experience shaped who I am today. ${this.getCTA(ctaType)}`,
        `Three years ago, ${mainKeyword} seemed impossible to achieve. Then I discovered this simple truth. Everything changed when I understood the real secret. True story that transformed my perspective. The breakthrough came when I least expected it. This moment defined my entire approach. I learned that patience and consistency are key. The results speak for themselves clearly. ${this.getCTA(ctaType)}`
      ],
      'controversial': [
        `Unpopular opinion: ${mainKeyword} is overrated by most people. Here's what's missing from the conversation. Real secret revealed through my own testing. Most people get ${mainKeyword} completely wrong. The truth might surprise you significantly. Here's what they don't want you to know. I'll show you the real facts behind this. This goes against everything you've heard before. ${this.getCTA(ctaType)}`,
        `Everyone's wrong about ${mainKeyword} and here's why. I'll prove it with real evidence. Shocking truth ahead that changes everything. Ready for reality? Most advice is misleading. The conventional wisdom doesn't work in practice. Real results come from understanding the fundamentals. Test this yourself and see the difference. ${this.getCTA(ctaType)}`
      ],
      'quick-tips': [
        `Master ${mainKeyword} fast? Here's the cheat code that works. Forget old ways that waste your time. Focus here on what actually matters. This shortcut saves you time and effort. Apply this technique immediately for best results. Skip the complicated methods, use this instead. The fastest way to see real progress. Actionable advice that works right away. ${this.getCTA(ctaType)}`,
        `${mainKeyword} in 3 steps that actually work. Skip the fluff and focus on essentials. Actionable advice only that delivers results. Works immediately when applied correctly. Here's the fastest way to master this. Focus on these key points for success. The method is simpler than you think. Start applying these principles today. ${this.getCTA(ctaType)}`
      ]
    };
    
    // Get emotion vocabulary for mood-specific word injection
    const emotionWords = this.getEmotionVocabulary(mood);
    
    // Get base template
    const templates = styleTemplates[videoStyle] || styleTemplates['entertaining'];
    let script = templates[Math.floor(Math.random() * templates.length)];
    
    // Inject emotion-specific vocabulary into script based on mood
    script = this.injectEmotionVocabulary(script, mood, emotionWords, targetAudience);
    
    // Expand script to match target word count if needed
    const currentWordCount = script.split(/\s+/).length;
    if (currentWordCount < targetWordCount * 0.8) {
      // Add more content based on style AND mood
      const expansionPhrases = {
        'entertaining': [
          `The results speak for themselves.`,
          `This is game-changing information.`,
          `You need to try this yourself.`,
          `The impact is incredible.`,
          `This changes everything you know.`
        ],
        'educational': [
          `The research is clear on this.`,
          `Experts agree this method works.`,
          `The data supports this approach.`,
          `Studies confirm these findings.`,
          `This is based on solid evidence.`
        ],
        'motivational': [
          `You can achieve anything you set your mind to.`,
          `The only limit is your imagination.`,
          `Success is closer than you think.`,
          `Your potential is unlimited.`,
          `Greatness starts with a single step.`
        ],
        'storytelling': [
          `The story continues to inspire me.`,
          `That moment changed my perspective forever.`,
          `I still remember how it felt.`,
          `The lessons learned were invaluable.`,
          `This experience shaped my future.`
        ],
        'controversial': [
          `The mainstream narrative is misleading.`,
          `Real evidence tells a different story.`,
          `Most people don't know the truth.`,
          `The facts contradict popular belief.`,
          `This challenges conventional thinking.`
        ],
        'quick-tips': [
          `This saves you hours of work.`,
          `The efficiency gain is significant.`,
          `You'll see results immediately.`,
          `This method is proven to work.`,
          `The simplicity is the key.`
        ]
      };
      
      const phrases = expansionPhrases[videoStyle] || expansionPhrases['entertaining'];
      let addedWords = 0;
      const neededWords = targetWordCount - currentWordCount;
      
      while (addedWords < neededWords - 5 && script.split(/\s+/).length < targetWordCount) {
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        script += ' ' + phrase;
        addedWords += phrase.split(/\s+/).length;
      }
    }
    
    // Generate contextual title
    const titleTemplates = [
      `${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)}: What You Need To Know! 🔥`,
      `The Truth About ${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)} 😱`,
      `${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)} Explained Simply ⚡`,
      `Amazing ${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)} Facts! 🤯`,
      `Everything About ${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)} 💯`
    ];
    
    const title = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
    
    // Generate engaging description
    const description = `Discover fascinating insights about ${mainKeyword}! 🚀\n\nIn this short video, I share key information about ${mainKeyword} that everyone should know. This content is based on real facts and expert knowledge. 🔥\n\n👉 Like if you found this helpful!\n👉 Subscribe for daily knowledge!\n👉 Share your thoughts in comments!\n\n${this.generateHashtags(topic).map(tag => `#${tag}`).join(' ')}\n\n🎯 Stay informed, stay ahead!`;
    
    return {
      script,
      title,
      description,
      hashtags: this.generateHashtags(topic)
    };
  }

  
  generateTopicContent(topic) {
    // Generate engaging content based on topic
    return `Let me break down the 3 most important things about ${topic} that you absolutely need to know.\n\nFirst, ${topic} is more powerful than most people realize. The latest research shows incredible results.\n\nSecond, there's a common mistake everyone makes with ${topic}. Once you avoid this, everything changes.\n\nThird, the secret technique that professionals use with ${topic} is actually super simple. Anyone can do it.`;
  }
  
  // Legacy generateViralTitle - now redirects to enhanced version
  // This function is kept for backward compatibility
  generateViralTitleLegacy(topic) {
    return this.generateViralTitle(topic, {});
  }
  
  generateDescription(topic) {
    return `Discover the secrets of ${topic} that will change your perspective! \ud83d\ude80\n\nIn this video, we reveal:\n\u2705 The truth about ${topic}\n\u2705 Common mistakes to avoid\n\u2705 Pro tips that actually work\n\n\ud83d\udd14 Subscribe for more amazing content!\n\ud83d\udc4d Like if you learned something new!\n\ud83d\udcac Comment your thoughts below!\n\n${this.generateHashtags(topic).join(' ')}`;
  }
  
  // Generate a simple script without AI (legacy fallback)
  createFallbackScript(topic, aiText = '') {
    const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    // Create context-aware script based on topic
    let script, title, description;
    
    if (aiText) {
      script = aiText;
      title = `Amazing Facts About ${topic} | Must Watch!`;
      description = `Learn interesting facts about ${topic} in this short video!`;
    } else if (topic.includes('house') && topic.includes('wife') && topic.includes('tea')) {
      // Special handling for house/husband/wife scenarios
      script = `In every home, there's a beautiful story of love and care. Picture this: a man working hard on his house, 
      building dreams with his own hands. Meanwhile, his loving wife prepares a warm cup of tea, thinking of his comfort. 
      And in the end, they share a beautiful moment together, embracing the love that makes their house a home. 
      This is the magic of partnership and love.`;
      title = `Love in the Little Things | Home Sweet Home`;
      description = `A beautiful story about love, home, and the little moments that matter most.`;
    } else if (topic.includes('working') && topic.includes('house')) {
      script = `There's something special about working on your own house. Every nail, every board, every detail 
      represents your dreams and hard work. It's not just construction - it's building a future, creating memories, 
      and making a place where love can grow. The satisfaction of seeing your vision come to life is unmatched.`;
      title = `Building Dreams | Home Construction`;
      description = `The joy and satisfaction of working on your own house and building your dreams.`;
    } else {
      // Generic script for other topics
      script = `Did you know that ${topic} has some amazing secrets? Let me share the top 3 facts that will blow your mind! 
      First, this incredible topic has been fascinating people for years. Second, there are so many interesting aspects to explore. 
      Third, you can learn so much more about this! What's your favorite fact about ${topic}? Let me know in the comments below!`;
      title = `Amazing Facts About ${topic} | Must Watch!`;
      description = `Learn interesting facts about ${topic} in this short video!`;
    }
    
    const hashtags = [
      `#${cleanTopic.replace(/\s+/g, '')}`,
      '#shorts',
      '#viral',
      '#trending',
      '#love',
      '#home',
      '#family',
      '#amazing'
    ];

    return {
      script: script.slice(0, 500), // Keep it short for TTS
      title: title,
      description: description + '\n\n🔥 Subscribe for more amazing content!\n📱 Follow us for daily facts!\n\n' + hashtags.join(' '),
      hashtags: hashtags
    };
  }

  // Generate VIRAL, high-engagement titles - Content strategist approach
  // Focus: Curiosity, emotional response, value promise, simplicity, format variety, SEO, originality
  generateViralTitle(topic, options = {}) {
    const style = options.videoStyle || 'entertaining';
    const mood = options.mood || 'energetic';
    const audience = options.targetAudience || 'gen-z';
    
    // Clean topic for better title generation
    const cleanTopic = topic.trim();
    const topicWords = cleanTopic.split(' ').filter(w => w.length > 2);
    const mainKeyword = topicWords[0] || cleanTopic;
    const shortTopic = cleanTopic.length > 25 ? mainKeyword : cleanTopic;
    
    // VIRAL TITLE TEMPLATES - High engagement, curiosity-driven, emotional
    const viralTemplates = {
      'educational': [
        // Curiosity + Value Promise
        `The ${mainKeyword} Secret Nobody Tells You`,
        `Why Everyone's Wrong About ${mainKeyword}`,
        `${mainKeyword}: The Truth That Changes Everything`,
        `This ${mainKeyword} Method Will Shock You`,
        `The ${mainKeyword} Hack That Actually Works`,
        // Question Format
        `Is ${mainKeyword} Really What You Think?`,
        `What They Don't Want You to Know About ${mainKeyword}`,
        // Number Format
        `3 ${mainKeyword} Mistakes That Ruin Everything`,
        `The 1 ${mainKeyword} Rule That Changes Everything`,
        // Emotional + Value
        `I Tried ${mainKeyword} For 30 Days - Here's What Happened`,
        `${mainKeyword} Explained: Why This Changes Everything`
      ],
      'entertaining': [
        // Shock + Curiosity
        `This ${mainKeyword} Trick Will BLOW Your Mind! 🤯`,
        `You Won't BELIEVE What ${mainKeyword} Can Do!`,
        `I Tested ${mainKeyword} - The Results Are INSANE!`,
        // Question + Mystery
        `What If ${mainKeyword} Was Actually This Simple?`,
        `Why Is Everyone Obsessed With ${mainKeyword}?`,
        // Emotional Hook
        `${mainKeyword} Just Got CRAZY - Watch This!`,
        `This ${mainKeyword} Hack Is TOO Good To Be True`,
        // Number + Value
        `5 ${mainKeyword} Secrets That Will Change Your Life`,
        `The ${mainKeyword} Method That Broke The Internet`,
        // Curiosity Gap
        `The ${mainKeyword} Secret Everyone's Hiding`,
        `${mainKeyword}: The Truth Will Shock You`
      ],
      'motivational': [
        // Transformation Promise
        `${mainKeyword} Changed My Life - Here's How`,
        `How ${mainKeyword} Transformed Everything`,
        `The ${mainKeyword} Mindset That Changed My Life`,
        // Emotional + Value
        `Why ${mainKeyword} Is The Key To Success`,
        `${mainKeyword}: Your Path To Success Starts Here`,
        // Question Format
        `What If ${mainKeyword} Was Your Missing Piece?`,
        `Is ${mainKeyword} The Secret You've Been Missing?`,
        // Story Format
        `My ${mainKeyword} Journey: From Zero To Hero`,
        `How I Used ${mainKeyword} To Change Everything`
      ],
      'storytelling': [
        // Emotional Story Hook
        `The ${mainKeyword} Story That Changed Everything`,
        `How ${mainKeyword} Changed My Life Forever`,
        `The Day ${mainKeyword} Changed Everything`,
        // Mystery + Curiosity
        `What Happened When I Tried ${mainKeyword}`,
        `The ${mainKeyword} Secret That Changed My World`,
        // Transformation
        `From Zero to Hero: My ${mainKeyword} Story`,
        `The ${mainKeyword} Moment That Changed Everything`
      ],
      'controversial': [
        // Bold Statement
        `Everyone's WRONG About ${mainKeyword}!`,
        `The ${mainKeyword} Truth They're Hiding`,
        `Why ${mainKeyword} Is Actually A Lie`,
        // Question + Challenge
        `Is ${mainKeyword} Really What You Think?`,
        `What If Everything You Know About ${mainKeyword} Is Wrong?`,
        // Unpopular Opinion
        `Unpopular Opinion: ${mainKeyword} Explained`,
        `The ${mainKeyword} Truth Nobody Wants To Hear`,
        // Shock Value
        `I'm Going To Tell You The Truth About ${mainKeyword}`,
        `${mainKeyword}: The Shocking Truth Revealed`
      ],
      'quick-tips': [
        // Value Promise + Speed
        `${mainKeyword} Hacks That Actually Work! 💡`,
        `5 ${mainKeyword} Tricks That Will Change Your Life`,
        `The ${mainKeyword} Shortcut Nobody Tells You`,
        // Question Format
        `Want To Master ${mainKeyword}? Here's How`,
        `How To ${mainKeyword} In 3 Simple Steps`,
        // Curiosity + Value
        `The ${mainKeyword} Method That Saves Hours`,
        `${mainKeyword}: The Ultimate Life Hack`,
        // Number Format
        `7 ${mainKeyword} Secrets Professionals Use`,
        `The ${mainKeyword} Trick That Changes Everything`
      ]
    };
    
    // Get base templates for style
    let templates = viralTemplates[style] || viralTemplates['entertaining'];
    
    // Audience-specific adjustments
    if (audience === 'gen-z') {
      // Add Gen-Z friendly titles
      templates = [
        ...templates,
        `${mainKeyword} Is Actually INSANE - No Cap!`,
        `This ${mainKeyword} Hack Is FIRE! 🔥`,
        `Why ${mainKeyword} Is Lowkey The Best Thing Ever`,
        `${mainKeyword}: This Will Blow Your Mind, Fr!`
      ];
    } else if (audience === 'professionals') {
      // More professional but still engaging
      templates = [
        ...templates,
        `The ${mainKeyword} Strategy That Actually Works`,
        `Why Top Professionals Use ${mainKeyword}`,
        `${mainKeyword}: The Data-Backed Approach`,
        `The ${mainKeyword} Framework For Success`
      ];
    }
    
    // Select random template
    let title = templates[Math.floor(Math.random() * templates.length)];
    
    // Ensure 50-70 character range (optimal for YouTube)
    // If too long, intelligently shorten
    if (title.length > 70) {
      // Try to keep the most impactful part
      const words = title.split(' ');
      let shortened = '';
      for (const word of words) {
        if ((shortened + ' ' + word).length <= 67) {
          shortened += (shortened ? ' ' : '') + word;
        } else {
          break;
        }
      }
      title = shortened || title.substring(0, 67);
    } else if (title.length < 50) {
      // If too short, add impact words (but keep it natural)
      const impactWords = ['Now', 'Here', 'This', 'Why', 'How'];
      if (!title.startsWith(impactWords.find(w => title.startsWith(w)))) {
        // Already has impact, keep as is
      }
    }
    
    // Final validation: Ensure it's engaging
    // Remove any boring words at the start
    const boringStarters = ['About', 'The Topic', 'Introduction to'];
    for (const starter of boringStarters) {
      if (title.toLowerCase().startsWith(starter.toLowerCase())) {
        // Regenerate if starts with boring word
        title = templates[Math.floor(Math.random() * templates.length)];
        break;
      }
    }
    
    return title.trim();
  }

  // Generate SEO-optimized, keyword-rich description - ENHANCED with JSON cleaning and duration awareness
  generateSEODescription(script, topic, options = {}) {
    const style = options.videoStyle || 'entertaining';
    const audience = options.targetAudience || 'gen-z';
    const cta = options.ctaType || 'follow';
    const videoDuration = options.videoDuration || '30-45s';
    
    // CRITICAL: Clean script from JSON artifacts and formatting
    let cleanScript = script;
    if (typeof cleanScript === 'object') {
      cleanScript = cleanScript.script || JSON.stringify(cleanScript);
    }
    
    // Remove JSON formatting if present
    cleanScript = cleanScript
      .replace(/^\{[\s\S]*?"script":\s*"/m, '') // Remove JSON start
      .replace(/"[\s\S]*\}$/m, '') // Remove JSON end
      .replace(/\\n/g, ' ') // Replace \n with space
      .replace(/\\"/g, '"') // Unescape quotes
      .replace(/\\/g, '') // Remove other escapes
      .replace(/\{[\s\S]*?\}/g, '') // Remove any remaining JSON objects
      .replace(/\[[\s\S]*?\]/g, '') // Remove any remaining JSON arrays
      .trim();
    
    // Extract key phrases from CLEAN script (first 80 chars, but ensure it's a complete sentence)
    let hook = cleanScript.substring(0, 80).trim();
    // Try to end at a sentence boundary
    const lastPeriod = hook.lastIndexOf('.');
    const lastExclamation = hook.lastIndexOf('!');
    const lastQuestion = hook.lastIndexOf('?');
    const lastBoundary = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastBoundary > 30) {
      hook = hook.substring(0, lastBoundary + 1);
    } else if (hook.length > 50) {
      hook = hook.substring(0, 50).trim() + '...';
    }
    
    // Calculate actual duration for description
    let durationSeconds = 45; // default
    let durationPhrase = 'under 60 seconds';
    if (videoDuration === '15-30s') {
      durationSeconds = 30;
      durationPhrase = 'under 30 seconds';
    } else if (videoDuration === '30-45s') {
      durationSeconds = 45;
      durationPhrase = 'under 1 minute';
    } else if (videoDuration === '45-60s') {
      durationSeconds = 60;
      durationPhrase = '1 minute';
    }
    
    // SEO keywords based on topic
    const keywords = this.generateSEOKeywords(topic, style);
    
    // CTA variations
    const ctaText = {
      'follow': '👉 FOLLOW for daily viral content!',
      'comment': '💬 COMMENT your thoughts below!',
      'share': '📤 SHARE this with your friends!',
      'watch-more': '▶️ WATCH MORE on our channel!',
      'none': ''
    }[cta] || '👉 FOLLOW for more!';
    
    // Build SEO-rich description with clean text
    const description = `${hook}

🔥 Discover the BEST ${topic} tips and tricks!
💡 Perfect for ${audience === 'gen-z' ? 'Gen-Z' : audience === 'millennials' ? 'Millennials' : 'everyone'}!
⚡ ${style === 'educational' ? 'Learn something new' : style === 'entertaining' ? 'Get entertained' : 'Get inspired'} in ${durationPhrase}!

${ctaText ? ctaText + '\n' : ''}📌 Keywords: ${keywords.join(', ')}

#Shorts #Viral #${topic.replace(/\s+/g, '')} #Trending #FYP #ForYou #Explore`;
    
    // Final cleanup: Remove any remaining JSON artifacts
    return description
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[[\s\S]*?\]/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();
  }

  // Generate SEO keywords
  generateSEOKeywords(topic, style) {
    const baseKeywords = [topic, 'shorts', 'viral', 'trending'];
    const styleKeywords = {
      'educational': ['learn', 'tutorial', 'howto', 'tips', 'guide'],
      'entertaining': ['funny', 'amazing', 'mindblowing', 'incredible', 'wow'],
      'inspirational': ['motivation', 'inspiration', 'success', 'goals', 'mindset'],
      'quick-tips': ['hacks', 'tricks', 'lifehacks', 'protips', 'secrets']
    };
    
    return [...baseKeywords, ...(styleKeywords[style] || styleKeywords['entertaining'])].slice(0, 8);
  }

  // Generate viral hashtags
  generateViralHashtags(topic, options = {}) {
    const style = options.videoStyle || 'entertaining';
    const mood = options.mood || 'energetic';
    
    const baseHashtags = ['#shorts', '#viral', '#trending', '#fyp', '#foryou'];
    const topicHashtag = `#${topic.replace(/\s+/g, '').toLowerCase()}`;
    
    const styleHashtags = {
      'educational': ['#learn', '#tutorial', '#education', '#knowledge'],
      'entertaining': ['#funny', '#amazing', '#mindblown', '#wow'],
      'inspirational': ['#motivation', '#inspiration', '#success', '#goals'],
      'quick-tips': ['#lifehacks', '#tips', '#tricks', '#protips']
    };
    
    const moodHashtags = {
      'energetic': ['#energy', '#hype', '#lit'],
      'calm': ['#chill', '#relax', '#peaceful'],
      'fun': ['#fun', '#entertainment', '#enjoy']
    };
    
    return [
      ...baseHashtags,
      topicHashtag,
      ...(styleHashtags[style] || []).slice(0, 2),
      ...(moodHashtags[mood] || []).slice(0, 1)
    ].slice(0, 12); // YouTube allows max 15 hashtags, use 12 for safety
  }

  // Test the AI service connection
  async testConnection() {
    try {
      const testScript = await this.generateScript('technology');
      return { success: true, script: testScript };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIService();