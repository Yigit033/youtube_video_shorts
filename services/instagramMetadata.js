const seoService = require('./seoService');

/**
 * Instagram Metadata Service
 * Generates Instagram-optimized captions and hashtags
 * Adapts YouTube metadata for Instagram format
 */
class InstagramMetadataService {
  constructor() {
    // Instagram caption limits
    this.maxCaptionLength = 2200; // Instagram caption limit
    this.optimalCaptionLength = 125; // Optimal for engagement
    this.maxHashtags = 30; // Instagram hashtag limit
    this.optimalHashtags = 10; // Optimal for reach
  }

  /**
   * Generate Instagram caption from YouTube metadata
   * @param {Object} params - { title, description, tags, topic, youtubeUrl }
   * @returns {string} Instagram-optimized caption
   */
  generateCaption(params) {
    const { title, description, tags, topic, youtubeUrl } = params;
    
    // Build caption with hook, content, and CTA
    let caption = '';
    
    // 1. Hook (first line - attention grabber)
    const hook = this.generateHook(title, topic);
    caption += `${hook}\n\n`;
    
    // 2. Main content (adapted from description)
    const content = this.adaptDescription(description || title);
    caption += `${content}\n\n`;
    
    // 3. CTA (Call to Action)
    const cta = this.generateCTA(youtubeUrl);
    caption += `${cta}\n\n`;
    
    // 4. Hashtags will be added separately
    
    // Ensure caption doesn't exceed limit
    if (caption.length > this.maxCaptionLength) {
      caption = caption.substring(0, this.maxCaptionLength - 3) + '...';
    }
    
    return caption.trim();
  }

  /**
   * Generate attention-grabbing hook (first line)
   */
  generateHook(title, topic) {
    const hooks = [
      `🔥 ${title}`,
      `💡 ${title}`,
      `✨ ${title}`,
      `🎯 ${title}`,
      `🚀 ${title}`,
      `⚡ ${title}`,
      `💥 ${title}`,
      `🌟 ${title}`
    ];
    
    // Use emoji + title, or create hook from topic
    if (title && title.length < 50) {
      return hooks[Math.floor(Math.random() * hooks.length)];
    }
    
    // Generate hook from topic
    const topicHooks = [
      `🔥 You won't believe this!`,
      `💡 This will change everything!`,
      `✨ Mind-blowing facts!`,
      `🎯 You need to see this!`,
      `🚀 This is incredible!`,
      `⚡ Wait until you see this!`
    ];
    
    return topicHooks[Math.floor(Math.random() * topicHooks.length)];
  }

  /**
   * Adapt YouTube description for Instagram
   */
  adaptDescription(description) {
    if (!description) return '';
    
    // Remove YouTube-specific formatting
    let adapted = description
      .replace(/🔗.*youtube.*/gi, '') // Remove YouTube links
      .replace(/📺.*subscribe.*/gi, '') // Remove subscribe CTAs
      .replace(/Subscribe.*/gi, '')
      .trim();
    
    // Limit length for Instagram (optimal: 125 chars)
    if (adapted.length > this.optimalCaptionLength) {
      // Try to cut at sentence boundary
      const sentences = adapted.split(/[.!?]\s+/);
      let result = '';
      
      for (const sentence of sentences) {
        if ((result + sentence).length <= this.optimalCaptionLength) {
          result += sentence + '. ';
        } else {
          break;
        }
      }
      
      adapted = result.trim() || adapted.substring(0, this.optimalCaptionLength - 3) + '...';
    }
    
    return adapted;
  }

  /**
   * Generate Call-to-Action for Instagram
   */
  generateCTA(youtubeUrl) {
    const ctas = [
      '🔗 Full video on YouTube! Link in bio 👆',
      '📺 Watch the full video on YouTube! Link in bio ⬆️',
      '🎬 Full video available on YouTube! Check bio 👆',
      '💯 Complete video on YouTube! Link in bio ⬆️',
      '🔥 Full version on YouTube! Link in bio 👆'
    ];
    
    if (youtubeUrl) {
      // Add YouTube URL as comment (Instagram allows URLs in comments)
      return `${ctas[Math.floor(Math.random() * ctas.length)]}\n\n💬 YouTube link in comments!`;
    }
    
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  /**
   * Generate Instagram hashtags
   * @param {Object} params - { tags, topic, videoFormat }
   * @returns {Array} Array of hashtags
   */
  generateHashtags(params) {
    const { tags = [], topic = '', videoFormat = 'shorts' } = params;
    
    const hashtags = new Set();
    
    // 1. Add topic-based hashtags
    if (topic) {
      const topicHashtags = this.extractTopicHashtags(topic);
      topicHashtags.forEach(tag => hashtags.add(tag));
    }
    
    // 2. Add tags from YouTube (convert to hashtags)
    tags.slice(0, 10).forEach(tag => {
      const hashtag = this.convertToHashtag(tag);
      if (hashtag) hashtags.add(hashtag);
    });
    
    // 3. Add format-specific hashtags
    if (videoFormat === 'shorts') {
      hashtags.add('shorts');
      hashtags.add('youtubeshorts');
      hashtags.add('viral');
      hashtags.add('fyp');
      hashtags.add('foryou');
    } else {
      hashtags.add('youtube');
      hashtags.add('video');
      hashtags.add('content');
    }
    
    // 4. Add trending/niche hashtags
    const trendingHashtags = this.getTrendingHashtags(topic);
    trendingHashtags.forEach(tag => hashtags.add(tag));
    
    // 5. Add engagement hashtags
    const engagementHashtags = [
      'explore',
      'trending',
      'viral',
      'instagood',
      'photooftheday',
      'picoftheday',
      'instadaily',
      'followme',
      'like4like',
      'follow4follow'
    ];
    
    // Add 2-3 random engagement hashtags
    const randomEngagement = engagementHashtags
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    randomEngagement.forEach(tag => hashtags.add(tag));
    
    // Convert to array and limit
    const hashtagArray = Array.from(hashtags).slice(0, this.optimalHashtags);
    
    return hashtagArray;
  }

  /**
   * Extract hashtags from topic
   */
  extractTopicHashtags(topic) {
    if (!topic) return [];
    
    // Split topic into words and create hashtags
    const words = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3); // Only words longer than 3 chars
    
    return words.slice(0, 5).map(word => word);
  }

  /**
   * Convert tag to hashtag format
   */
  convertToHashtag(tag) {
    if (!tag) return null;
    
    // Remove special characters, convert to lowercase
    const hashtag = tag
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .trim();
    
    // Must be 2-30 characters
    if (hashtag.length < 2 || hashtag.length > 30) {
      return null;
    }
    
    return hashtag;
  }

  /**
   * Get trending hashtags based on topic
   */
  getTrendingHashtags(topic) {
    // Topic-based trending hashtags
    const topicMap = {
      'history': ['history', 'ancient', 'facts', 'education', 'learn'],
      'science': ['science', 'facts', 'education', 'learn', 'knowledge'],
      'technology': ['tech', 'technology', 'innovation', 'future', 'ai'],
      'entertainment': ['entertainment', 'fun', 'comedy', 'viral', 'trending'],
      'lifestyle': ['lifestyle', 'life', 'motivation', 'inspiration', 'success'],
      'travel': ['travel', 'wanderlust', 'adventure', 'explore', 'world'],
      'food': ['food', 'foodie', 'cooking', 'recipe', 'delicious'],
      'fitness': ['fitness', 'workout', 'health', 'gym', 'motivation']
    };
    
    // Find matching topic
    const topicLower = (topic || '').toLowerCase();
    for (const [key, hashtags] of Object.entries(topicMap)) {
      if (topicLower.includes(key)) {
        return hashtags;
      }
    }
    
    // Default trending hashtags
    return ['viral', 'trending', 'fyp', 'explore', 'instagood'];
  }

  /**
   * Format hashtags as string (for caption)
   */
  formatHashtags(hashtags) {
    return hashtags.map(tag => `#${tag}`).join(' ');
  }

  /**
   * Generate complete Instagram caption with hashtags
   * @param {Object} params - { title, description, tags, topic, youtubeUrl, videoFormat }
   * @returns {string} Complete Instagram caption
   */
  generateCompleteCaption(params) {
    const { tags, topic, videoFormat } = params;
    
    // Generate base caption
    const baseCaption = this.generateCaption(params);
    
    // Generate hashtags
    const hashtags = this.generateHashtags({ tags, topic, videoFormat });
    const hashtagString = this.formatHashtags(hashtags);
    
    // Combine caption and hashtags
    const fullCaption = `${baseCaption}\n\n${hashtagString}`;
    
    // Ensure total length doesn't exceed limit
    if (fullCaption.length > this.maxCaptionLength) {
      // Reduce hashtags if needed
      const availableSpace = this.maxCaptionLength - baseCaption.length - 10;
      const maxHashtagChars = Math.max(0, availableSpace);
      
      let hashtagStringLimited = '';
      for (const hashtag of hashtags) {
        const hashtagWithSpace = `#${hashtag} `;
        if ((hashtagStringLimited + hashtagWithSpace).length <= maxHashtagChars) {
          hashtagStringLimited += hashtagWithSpace;
        } else {
          break;
        }
      }
      
      return `${baseCaption}\n\n${hashtagStringLimited.trim()}`;
    }
    
    return fullCaption;
  }
}

module.exports = new InstagramMetadataService();

