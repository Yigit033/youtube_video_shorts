const axios = require('axios');

class AIService {
  constructor() {
    // Environment-based AI configuration
    this.isProduction = process.env.NODE_ENV === 'production';
    this.useLocalAI = this.isProduction ? false : (process.env.USE_LOCAL_AI === 'true');
    this.localAIModel = process.env.OLLAMA_MODEL || 'llama3';
    this.localAIUrl = 'http://localhost:11434/api/generate';
    this.isBrowser = typeof window !== 'undefined';
    
    if (this.useLocalAI && !this.isBrowser && !this.isProduction) {
      console.log('🤖 AI Service: Using local AI with Ollama');
      console.log('💡 Make sure Ollama is running: https://ollama.ai/');
      console.log(`💡 Run: ollama pull ${this.localAIModel}`);
      console.log('💡 If Ollama is not available, the system will fall back to template-based generation');
    } else if (this.isProduction) {
      console.log('🚀 AI Service: Production mode - Using template-based generation for stability');
      this.useLocalAI = false;
    } else if (this.isBrowser) {
      console.log('🌐 Running in browser environment - Using template-based generation');
      this.synth = window.speechSynthesis;
      this.useLocalAI = false;
    } else {
      console.log('🤖 AI Service: Local AI is disabled - Using template-based generation');
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
        'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct',
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
      const prompt = `Create a YouTube Shorts script about "${topic}" in JSON format: {
        "script": "A short, engaging script (60-90 seconds) with a hook, 2-3 key points, and a call to action.",
        "title": "Catchy title under 60 characters",
        "hashtags": ["#shorts", "#${topic.replace(/\\s+/g, '')}", "#viral", "#trending"]
      }`;

      const response = await axios.post(this.localAIUrl, {
        model: this.localAIModel,
        prompt: prompt,
        stream: false,
        format: 'json'
      }, {
        timeout: 30000 // 30 seconds timeout
      });

      if (response.data?.response) {
        const result = JSON.parse(response.data.response);
        return {
          script: result.script,
          title: result.title,
          description: `Check out this video about ${topic}!`,
          hashtags: result.hashtags
        };
      }
      throw new Error('Invalid response from Ollama');
    } catch (error) {
      console.error('Ollama Error:', error.message);
      throw error;
    }
  }

  // Generate a simple script without AI
  createFallbackScript(topic, aiText = '') {
    const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const hashtags = [
      `#${cleanTopic.replace(/\s+/g, '')}`,
      '#shorts',
      '#viral',
      '#trending',
      '#facts',
      '#amazing',
      '#mindblown',
      '#educational'
    ];
    
    const script = aiText || 
      `Did you know that ${topic} has some amazing secrets? Let me share the top 3 facts that will blow your mind! 
      First, this incredible topic has been fascinating people for years. Second, there are so many interesting aspects to explore. 
      Third, you can learn so much more about this! What's your favorite fact about ${topic}? Let me know in the comments below!`;

    return {
      script: script.slice(0, 500), // Keep it short for TTS
      title: `Amazing Facts About ${topic} | Must Watch!`,
      description: `Learn interesting facts about ${topic} in this short video!\n\n` +
                 `🔥 Subscribe for more amazing content!\n` +
                 `📱 Follow us for daily facts!\n\n` +
                 hashtags.join(' '),
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