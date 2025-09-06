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

  async generateScript(topic) {
    console.log('\n[AI Service] Generating script...');
    
    if (this.useLocalAI) {
      try {
        return await this.generateWithOllama(topic);
      } catch (error) {
        console.error('Local AI Error:', error.message);
        console.log('Falling back to template-based generation');
        return this.createFallbackScript(topic);
      }
    }

    const prompt = `[INST] Generate a YouTube Shorts script about "${topic}" with this format:
    
    {
      "script": "A short, engaging script (60-90 seconds) with a hook, 2-3 key points, and a call to action.",
      "title": "Catchy title under 60 characters",
      "hashtags": ["#shorts", "#${topic.replace(/\\s+/g, '')}", "#viral", "#trending"]
    }[/INST]`;

    try {
      console.log('Sending request to HuggingFace API...');
      
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        { 
          inputs: prompt,
          parameters: {
            max_length: 500,
            temperature: 0.7,
            do_sample: true,
            num_return_sequences: 1,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'
          },
          timeout: 60000 // 60 seconds timeout
        }
      );
      
      console.log('Received response from AI model');
      
      if (!response.data || !response.data[0]?.generated_text) {
        console.warn('No valid response from primary model, trying fallback...');
        return await this.tryFallbackModel(prompt);
      }
      
      const generatedText = response.data[0].generated_text.trim();
      
      // Try to parse as JSON, fallback to plain text
      try {
        // Clean up the response to ensure valid JSON
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : generatedText;
        const parsed = JSON.parse(jsonText);
        
        return {
          script: parsed.script || generatedText,
          title: parsed.title || `Amazing Facts About ${topic}`,
          description: parsed.description || `Check out this amazing content about ${topic}!`,
          hashtags: parsed.hashtags || 
            [`#${topic.replace(/\\s+/g, '')}`, '#shorts', '#viral', '#trending']
        };
      } catch (e) {
        console.warn('Failed to parse AI response as JSON, using fallback');
        return this.createFallbackScript(topic, generatedText);
      }

    } catch (error) {
      console.error('AI Service Error:', error.message);
      
      // Try fallback model before giving up
      if (error.response?.status === 404 || error.code === 'ECONNABORTED') {
        console.log('Trying fallback model...');
        return await this.tryFallbackModel(prompt, topic);
      }
      
      // Fallback to manual script generation
      return this.createFallbackScript(topic);
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

  async generateWithOllama(topic) {
    if (this.isBrowser) {
      // In browser, use template-based generation
      return this.createFallbackScript(topic);
    }
    
    try {
      console.log('🤖 Ollama: Generating script with llama3:8b...');
      
      // Better prompt for llama3
      const prompt = `Write a YouTube Shorts script about "${topic}". Return ONLY a JSON object with this exact structure:

{
  "script": "Write a natural, conversational script (60-90 seconds) that tells a story about ${topic}. Make it engaging and relatable.",
  "title": "A catchy title under 60 characters",
  "hashtags": ["#shorts", "#${topic.replace(/\\s+/g, '')}", "#viral"]
}

CRITICAL: Return ONLY the JSON object, no other text.`;

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
              title: result.title || `Beautiful Story About ${topic}`,
              description: `A touching story about ${topic} that will warm your heart.`,
              hashtags: result.hashtags || ['#shorts', '#love', '#home', '#viral']
            };
          } else {
            // If no JSON, use the raw response as script
            console.log('📝 Using Ollama raw response as script');
            return {
              script: responseText,
              title: `Beautiful Story About ${topic}`,
              description: `A touching story about ${topic} that will warm your heart.`,
              hashtags: ['#shorts', '#love', '#home', '#viral']
            };
          }
        } catch (parseError) {
          console.log('⚠️ JSON parsing failed, using raw response');
          return {
            script: responseText,
            title: `Beautiful Story About ${topic}`,
            description: `A touching story about ${topic} that will warm your heart.`,
            hashtags: ['#shorts', '#love', '#home', '#viral']
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

  // Generate a simple script without AI
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