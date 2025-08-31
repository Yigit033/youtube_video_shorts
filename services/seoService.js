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
      // Use a smaller, free model for SEO generation
      const prompt = `Generate YouTube metadata for: "${topic}"
      Format as JSON with: title, description, tags (comma-separated)`;

      const response = await hf.textGeneration({
        model: 'tiiuae/falcon-7b-instruct',
        inputs: prompt,
        parameters: { 
          max_new_tokens: 300,
          return_full_text: false,
          temperature: 0.7
        }
      });

      // Parse the JSON response
      let seoData;
      try {
        // Extract JSON from markdown code block if present
        const jsonMatch = response.generated_text.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response.generated_text;
        seoData = JSON.parse(jsonString);
      } catch (e) {
        console.error('Failed to parse SEO data, using fallback', e);
        seoData = this.getFallbackMetadata(topic);
      }

      // Ensure all required fields are present
      return {
        title: seoData.title || `Amazing Video About ${topic}`,
        description: seoData.description || `Watch this interesting video about ${topic}. Don't forget to like and subscribe!`,
        tags: seoData.tags ? seoData.tags.split(',').map(tag => tag.trim()) : [topic, 'viral', 'trending'],
        category: seoData.category || '28' // 28 = Science & Technology
      };
    } catch (error) {
      console.error('Error generating SEO metadata:', error);
      return this.getFallbackMetadata(topic);
    }
  }

  /**
   * Generate fallback metadata in case of API failure
   */
  getFallbackMetadata(topic) {
    const timestamp = new Date().toISOString().split('T')[0];
    return {
      title: `Amazing Video About ${topic} - ${timestamp}`,
      description: `Check out this interesting video about ${topic}. Don't forget to like and subscribe for more content!`,
      tags: [topic, 'viral', 'trending', 'shorts'],
      category: '28' // 28 = Science & Technology
    };
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
