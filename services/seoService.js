const { HfInference } = require('@huggingface/inference');
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

class SEOService {
  constructor() {
    this.targetLanguages = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja'];
  }

  /**
   * Generate SEO optimized metadata for videos
   * @param {string} topic - Video topic/content
   * @returns {Promise<Object>} SEO optimized metadata
   */
  async generateSEOMetadata(topic) {
    try {
      // Professional SEO prompt with viral hooks and trending elements
      const prompt = `Create VIRAL YouTube Shorts metadata for: "${topic}"

REQUIREMENTS:
- Title: 60 chars max, hook-based, emotional, trending keywords, NO dates
- Description: 200 chars max, call-to-action, emojis, relevant to content
- Tags: 10-15 hashtags, trending, relevant, mix of broad/narrow

EXAMPLES:
Title: "This Will Change Your Mind About Dogs Forever! 🐕"
Description: "You won't believe what these dogs do! This will melt your heart ❤️ #Dogs #Cute #Viral"
Tags: "#Dogs #Cute #Viral #Shorts #Pets #Heartwarming #Trending #FYP #MustWatch #Amazing"

Generate JSON: {"title": "...", "description": "...", "tags": "..."}`;

      // For now, use fallback metadata generation
      console.log('🔍 [SEO] Using fallback metadata generation...');
      return this.getEnhancedFallbackMetadata(topic);

      // Parse the JSON response
      let seoData;
      try {
        const jsonMatch = response.generated_text.match(/```json\n([\s\S]*?)\n```/) || 
                         response.generated_text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : response.generated_text;
        seoData = JSON.parse(jsonString);
      } catch (e) {
        console.error('Failed to parse SEO data, using enhanced fallback', e);
        seoData = this.getEnhancedFallbackMetadata(topic);
      }

      // Ensure all required fields are present and optimized
      return {
        title: this.optimizeTitle(seoData.title || `This Will Blow Your Mind About ${topic}!`),
        description: this.optimizeDescription(seoData.description || `You won't believe this! ${topic} content that will amaze you! 🔥 #Shorts #Viral`),
        tags: this.optimizeTags(seoData.tags ? seoData.tags.split(',').map(tag => tag.trim()) : [topic, 'viral', 'trending']),
        category: '22' // 22 = People & Blogs (better for Shorts)
      };
    } catch (error) {
      console.error('Error generating SEO metadata:', error);
      return this.getEnhancedFallbackMetadata(topic);
    }
  }

  /**
   * Generate enhanced fallback metadata with viral hooks
   */
  getEnhancedFallbackMetadata(topic) {
    const hooks = [
      "This Will Blow Your Mind!",
      "You Won't Believe This!",
      "This Changes Everything!",
      "Mind = Blown!",
      "This Is Incredible!",
      "Wait Until You See This!",
      "This Is Amazing!",
      "You Need To See This!"
    ];
    
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    const emojis = ["🔥", "💯", "⚡", "🎯", "✨", "🚀", "💥", "🎉"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    return {
      title: `${randomHook} ${topic} ${randomEmoji}`,
      description: `You won't believe what happens next! This ${topic} content will amaze you! ${randomEmoji} Don't forget to like and subscribe for more viral content! #Shorts #Viral #Trending`,
      tags: this.optimizeTags([topic, 'viral', 'trending', 'shorts', 'fyp', 'mustwatch', 'amazing', 'incredible']),
      category: '22' // 22 = People & Blogs
    };
  }

  /**
   * Optimize title for maximum engagement
   */
  optimizeTitle(title) {
    if (!title) return "This Will Blow Your Mind! 🔥";
    
    // Remove dates and generic words
    let optimized = title
      .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
      .replace(/amazing video about/gi, '')
      .replace(/video content/gi, 'this')
      .trim();
    
    // Add emoji if none present
    if (!optimized.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u)) {
      optimized += ' 🔥';
    }
    
    // Ensure it's under 60 characters
    if (optimized.length > 60) {
      optimized = optimized.substring(0, 57) + '...';
    }
    
    return optimized;
  }

  /**
   * Optimize description for engagement
   */
  optimizeDescription(description) {
    if (!description) return "You won't believe this! 🔥 #Shorts #Viral #Trending";
    
    let optimized = description.trim();
    
    // Add emojis if none present
    if (!optimized.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u)) {
      optimized += ' 🔥';
    }
    
    // Add call to action if missing
    if (!optimized.toLowerCase().includes('like') && !optimized.toLowerCase().includes('subscribe')) {
      optimized += ' Don\'t forget to like and subscribe!';
    }
    
    // Ensure it's under 200 characters
    if (optimized.length > 200) {
      optimized = optimized.substring(0, 197) + '...';
    }
    
    return optimized;
  }

  /**
   * Optimize tags with hashtags and trending keywords
   */
  optimizeTags(tags) {
    if (!Array.isArray(tags)) return ['#Shorts', '#Viral', '#Trending'];
    
    const optimized = tags.map(tag => {
      // Remove # if already present to avoid double hashtags
      let cleanTag = tag.replace(/^#+/, '').trim();
      
      // Add # if not present
      if (!cleanTag.startsWith('#')) {
        cleanTag = '#' + cleanTag;
      }
      
      // Capitalize first letter of each word for better visibility
      cleanTag = cleanTag.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      return cleanTag;
    });
    
    // Add essential trending tags if missing
    const essentialTags = ['#Shorts', '#Viral', '#Trending', '#FYP'];
    essentialTags.forEach(essential => {
      if (!optimized.some(tag => tag.toLowerCase().includes(essential.toLowerCase().replace('#', '')))) {
        optimized.push(essential);
      }
    });
    
    // Limit to 15 tags max
    return optimized.slice(0, 15);
  }

  /**
   * Translate text to multiple languages
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code (e.g., 'es', 'fr')
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLang) {
    if (!text || !targetLang) return text;
    
    try {
      // Use a free multilingual model
      const response = await hf.textGeneration({
        model: 'facebook/mbart-large-50-many-to-many-mmt',
        inputs: `Translate to ${targetLang}: ${text}`,
        parameters: { max_new_tokens: 300 }
      });
      
      // Extract the translated part (remove the prompt)
      const translated = response.generated_text
        .replace(`Translate to ${targetLang}: `, '')
        .trim();
      
      return translated || text;
    } catch (error) {
      console.error(`Translation to ${targetLang} failed:`, error.message);
      return text; // Return original text if translation fails
    }
  }

  /**
   * Generate A/B test variations for video metadata
   * @param {Object} baseMetadata - Base metadata to create variations from
   * @returns {Array} Array of metadata variations
   */
  generateABTestVariations(baseMetadata) {
    const variations = [];
    
    // Variation 1: Question title
    const questionTitle = baseMetadata.title.endsWith('?') 
      ? baseMetadata.title 
      : `Is ${baseMetadata.title}? Find Out Now!`;
    
    // Variation 2: Numbered list
    const numberedTitle = baseMetadata.title.startsWith('10') || baseMetadata.title.startsWith('5')
      ? baseMetadata.title
      : `5 Amazing Facts About ${baseMetadata.title.split(' ')[0]}`;
    
    // Variation 3: Urgency/Scarcity
    const urgentTitle = baseMetadata.title.includes('!') 
      ? baseMetadata.title 
      : `You Won't Believe ${baseMetadata.title} - Must Watch!`;
    
    // Add variations
    variations.push({ ...baseMetadata, title: questionTitle, variation: 'question' });
    variations.push({ ...baseMetadata, title: numberedTitle, variation: 'numbered' });
    variations.push({ ...baseMetadata, title: urgentTitle, variation: 'urgent' });
    
    return variations;
  }
}

module.exports = new SEOService();
