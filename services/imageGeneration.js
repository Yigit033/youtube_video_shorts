const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.sdxlModel = 'stabilityai/stable-diffusion-xl-base-1.0';
    this.outputDir = path.join(__dirname, '..', 'temp', 'images');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateImage(prompt, filename) {
    if (!this.apiKey) {
      console.log('⚠️ HuggingFace API key not configured');
      return null;
    }

    try {
      console.log(`🎨 Generating image: "${prompt}"`);
      
      // Enhanced prompt for better quality
      const enhancedPrompt = this.enhancePrompt(prompt);
      
      // First try: SDXL with correct format
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.sdxlModel}`,
        {
          inputs: enhancedPrompt,
          options: {
            wait_for_model: true,
            use_cache: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'image/png',
            'x-wait-for-model': 'true'
          },
          responseType: 'arraybuffer',
          timeout: 120000 // 2 minutes for model loading
        }
      );

      const imagePath = path.join(this.outputDir, `${filename}.png`);
      fs.writeFileSync(imagePath, response.data);
      
      console.log(`✅ Image generated: ${filename}.png`);
      return imagePath;
    } catch (error) {
      console.error('❌ SDXL generation failed:', error.message);
      
      // If quota exceeded, use existing images or create placeholder
      if (error.response && error.response.status === 402) {
        console.log('🔄 API quota exceeded, using existing images or creating placeholder');
        
        // Check if we have any existing images
        const existingImages = fs.readdirSync(this.outputDir).filter(file => file.endsWith('.png'));
        if (existingImages.length > 0) {
          const randomImage = existingImages[Math.floor(Math.random() * existingImages.length)];
          const sourcePath = path.join(this.outputDir, randomImage);
          const targetPath = path.join(this.outputDir, `${filename}.png`);
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`✅ Using existing image: ${randomImage}`);
          return targetPath;
        } else {
          // Create a simple colored placeholder
          console.log('🔄 Creating colored placeholder image');
          return this.createPlaceholderImage(filename);
        }
      }
      
      // Try fallback model for other errors
      try {
        console.log('🔄 Trying fallback model: runwayml/stable-diffusion-v1-5');
        
        const fallbackResponse = await axios.post(
          'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
          {
            inputs: this.enhancePrompt(prompt),
            options: {
              wait_for_model: true,
              use_cache: false
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'image/png',
              'x-wait-for-model': 'true'
            },
            responseType: 'arraybuffer',
            timeout: 120000
          }
        );

        const imagePath = path.join(this.outputDir, `${filename}.png`);
        fs.writeFileSync(imagePath, fallbackResponse.data);
        
        console.log(`✅ Fallback image generated: ${filename}.png`);
        return imagePath;
      } catch (fallbackError) {
        console.error('❌ Fallback image generation also failed:', fallbackError.message);
        return this.createPlaceholderImage(filename);
      }
    }
  }

  enhancePrompt(prompt) {
    // Add quality enhancements to the prompt
    const enhancements = [
      'high quality',
      'detailed',
      'professional photography',
      'cinematic lighting',
      'sharp focus',
      'vibrant colors'
    ];
    
    return `${prompt}, ${enhancements.join(', ')}`;
  }

  // Create a simple colored placeholder image
  createPlaceholderImage(filename) {
    try {
      const { createCanvas } = require('canvas');
      const canvas = createCanvas(1024, 576);
      const ctx = canvas.getContext('2d');
      
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, 1024, 576);
      gradient.addColorStop(0, '#4a90e2');
      gradient.addColorStop(1, '#7b68ee');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1024, 576);
      
      // Add text
      ctx.fillStyle = 'white';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('AI Generated', 512, 288);
      
      const imagePath = path.join(this.outputDir, `${filename}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(imagePath, buffer);
      
      console.log(`✅ Placeholder image created: ${filename}.png`);
      return imagePath;
    } catch (error) {
      console.error('❌ Failed to create placeholder image:', error.message);
      return null;
    }
  }

  async generateMultipleImages(prompt, count = 4) {
    const images = [];
    
    // Try to generate new images first
    for (let i = 0; i < count; i++) {
      const imagePath = await this.generateImage(prompt, `image_${i + 1}`);
      if (imagePath) {
        images.push(imagePath);
      }
    }
    
    // If we don't have enough images, use existing ones
    if (images.length < count) {
      const existingImages = fs.readdirSync(this.outputDir).filter(file => 
        file.startsWith('ai_image_') && file.endsWith('.png')
      );
      
      const needed = count - images.length;
      for (let i = 0; i < needed && i < existingImages.length; i++) {
        const randomImage = existingImages[Math.floor(Math.random() * existingImages.length)];
        const imagePath = path.join(this.outputDir, randomImage);
        images.push(imagePath);
        console.log(`✅ Added existing image: ${randomImage}`);
      }
    }
    
    return images;
  }
}

module.exports = ImageGenerationService;
