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
      ctaType = 'follow'
    } = options;
    
    try {
      console.log('🤖 Ollama: Generating script with llama3:8b...');
      
      // Build style-specific guidelines
      const styleGuide = this.getStyleGuidelines(videoStyle);
      const audienceGuide = this.getAudienceGuidelines(targetAudience);
      const durationGuide = this.getDurationGuidelines(videoDuration);
      const ctaGuide = this.getCTAGuidelines(ctaType);
      
      // FULL-LENGTH narration prompt for complete video coverage
      const wordCount = this.getWordCount(videoDuration);
      const prompt = `Write a ${videoStyle} YouTube Shorts script about "${topic}" for ${targetAudience} audience. Return ONLY a JSON object:

{
  "script": "${durationGuide} ${styleGuide} ${audienceGuide} ${ctaGuide} About ${topic}. MUST BE ${wordCount} WORDS for ${videoDuration} video!",
  "title": "Under 60 characters, viral and engaging",
  "hashtags": ["#shorts", "#${topic.replace(/\\s+/g, '')}", "#viral", "#trending"]
}

CRITICAL: Script MUST be EXACTLY ${wordCount} words (±10) for full video narration! This is for a ${videoDuration} video.`;

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
  
  // Helper methods for guidelines
  getStyleGuidelines(style) {
    const guides = {
      'entertaining': 'Use fun, engaging language with humor.',
      'educational': 'Be informative and clear, teach something valuable.',
      'motivational': 'Inspire and energize, use powerful words.',
      'storytelling': 'Tell a compelling narrative with emotion.',
      'controversial': 'Make a bold statement, challenge assumptions.',
      'quick-tips': 'Be direct and practical, actionable advice.'
    };
    return guides[style] || guides['entertaining'];
  }

  getAudienceGuidelines(audience) {
    const guides = {
      'gen-z': 'Use casual, trendy language. No formal tone.',
      'millennials': 'Professional but relatable. Modern references.',
      'general': 'Universal appeal, simple language.',
      'professionals': 'Business-focused, professional tone.',
      'students': 'Educational, easy to understand.'
    };
    return guides[audience] || guides['gen-z'];
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

  // Enhanced script generation with better templates
  createEnhancedScript(topic, options = {}) {
    console.log('🎭 [AI] Creating enhanced script...');
    
    const {
      videoStyle = 'entertaining',
      targetAudience = 'gen-z',
      videoDuration = '30-45s',
      mood = 'energetic',
      ctaType = 'follow'
    } = options;
    
    // Clean and analyze topic
    const cleanTopic = topic.toLowerCase().trim();
    const words = cleanTopic.split(' ').filter(w => w.length > 3);
    const mainKeyword = words[0] || cleanTopic;
    
    // Style-specific templates
    const styleTemplates = {
      'entertaining': [
        `Wait! ${mainKeyword} changed everything. Found the secret yesterday. It's simpler than you think. This will blow your mind. ${this.getCTA(ctaType)}`,
        `You won't believe this ${mainKeyword} hack! Tried it yesterday. Results are insane. Everyone needs to know. ${this.getCTA(ctaType)}`
      ],
      'educational': [
        `Learn ${mainKeyword} in 30 seconds. Here's what experts don't tell you. Three simple steps. Game-changing knowledge. ${this.getCTA(ctaType)}`,
        `${mainKeyword} explained simply. Most people get this wrong. Here's the truth. Science-backed facts. ${this.getCTA(ctaType)}`
      ],
      'motivational': [
        `${mainKeyword} can transform your life. I proved it myself. You have the power. Start today. ${this.getCTA(ctaType)}`,
        `Stop doubting yourself about ${mainKeyword}. You're capable of amazing things. Take action now. Success awaits. ${this.getCTA(ctaType)}`
      ],
      'storytelling': [
        `Never forget my ${mainKeyword} journey. Everything clicked that day. My life changed forever. Here's what happened. ${this.getCTA(ctaType)}`,
        `Three years ago, ${mainKeyword} was impossible. Then I discovered this. Everything changed. True story. ${this.getCTA(ctaType)}`
      ],
      'controversial': [
        `Unpopular opinion: ${mainKeyword} is overrated. Here's what's missing. Real secret revealed. Tested myself. ${this.getCTA(ctaType)}`,
        `Everyone's wrong about ${mainKeyword}. I'll prove it. Shocking truth ahead. Ready for reality? ${this.getCTA(ctaType)}`
      ],
      'quick-tips': [
        `Master ${mainKeyword} fast? Here's the cheat code. Forget old ways. Focus here. Take action now. ${this.getCTA(ctaType)}`,
        `${mainKeyword} in 3 steps. Skip the fluff. Actionable advice only. Works immediately. ${this.getCTA(ctaType)}`
      ]
    };
    
    const templates = styleTemplates[videoStyle] || styleTemplates['entertaining'];
    const script = templates[Math.floor(Math.random() * templates.length)];
    
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
  
  generateViralTitle(topic) {
    const templates = [
      `This ${topic} Secret Will Blow Your Mind! \ud83e\udd2f`,
      `${topic}: The Truth They Don't Tell You \ud83d\udd25`,
      `You're Doing ${topic} WRONG! Here's Why \ud83d\udea8`,
      `${topic} Hack That Actually Works! \u2705`,
      `The ${topic} Method That Changed Everything \ud83d\ude80`,
      `${topic}: What Experts Don't Want You To Know \ud83d\udd13`
    ];
    
    let title = templates[Math.floor(Math.random() * templates.length)];
    
    // Ensure under 60 characters
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title;
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

  // Generate VIRAL, SEO-optimized title
  generateViralTitle(topic, options = {}) {
    const style = options.videoStyle || 'entertaining';
    const titleTemplates = {
      'educational': [
        `${topic.toUpperCase()}: What You NEED to Know!`,
        `The Truth About ${topic} (Mind-Blowing!)`,
        `${topic} Explained in 30 Seconds`
      ],
      'entertaining': [
        `This ${topic} Hack Will BLOW Your Mind! 🤯`,
        `You Won't BELIEVE This ${topic} Trick!`,
        `${topic}: The Secret Everyone's Talking About`
      ],
      'inspirational': [
        `${topic} Changed My Life Forever 🔥`,
        `The ${topic} Story That Inspired Millions`,
        `Why ${topic} Is The Key To Success`
      ],
      'quick-tips': [
        `${topic} Hacks You MUST Try! 💡`,
        `5 ${topic} Tips That Actually Work`,
        `${topic}: The Ultimate Life Hack`
      ]
    };
    
    const templates = titleTemplates[style] || titleTemplates['entertaining'];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Generate SEO-optimized, keyword-rich description
  generateSEODescription(script, topic, options = {}) {
    const style = options.videoStyle || 'entertaining';
    const audience = options.targetAudience || 'gen-z';
    const cta = options.ctaType || 'follow';
    
    // Extract key phrases from script (first 50 chars)
    const hook = script.substring(0, 50).trim() + '...';
    
    // SEO keywords based on topic
    const keywords = this.generateSEOKeywords(topic, style);
    
    // CTA variations
    const ctaText = {
      'follow': '👉 FOLLOW for daily viral content!',
      'comment': '💬 COMMENT your thoughts below!',
      'share': '📤 SHARE this with your friends!',
      'watch-more': '▶️ WATCH MORE on our channel!'
    }[cta] || '👉 FOLLOW for more!';
    
    // Build SEO-rich description
    return `${hook}

🔥 Discover the BEST ${topic} tips and tricks!
💡 Perfect for ${audience === 'gen-z' ? 'Gen-Z' : audience === 'millennials' ? 'Millennials' : 'everyone'}!
⚡ ${style === 'educational' ? 'Learn something new' : style === 'entertaining' ? 'Get entertained' : 'Get inspired'} in under 60 seconds!

${ctaText}

📌 Keywords: ${keywords.join(', ')}

#Shorts #Viral #${topic.replace(/\s+/g, '')} #Trending #FYP #ForYou #Explore`;
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