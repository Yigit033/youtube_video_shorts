const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LocalVideoGenerationService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'temp', 'videos');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Local GPU-based video generation using Stable Video Diffusion
  async generateVideoFromImage(imagePath, filename) {
    try {
      console.log(`🎬 [LOCAL GPU] Generating video from image: ${path.basename(imagePath)}`);
      
      const outputPath = path.join(this.outputDir, `${filename}.mp4`);
      
      // Python script for SVD
      const pythonScript = `
import torch
from diffusers import StableVideoDiffusionPipeline
from PIL import Image
import os
import numpy as np

def generate_video(image_path, output_path):
    try:
        # Load SVD pipeline with timeout and fallback
        try:
            print("[INFO] Trying primary SVD model...")
            pipe = StableVideoDiffusionPipeline.from_pretrained(
                "stabilityai/stable-video-diffusion-img2vid-xt",
                torch_dtype=torch.float16,
                variant="fp16",
                local_files_only=False,
                resume_download=True,
                max_retries=3,
                cache_dir="./models"  # Local cache
            )
        except Exception as e:
            print(f"[ERROR] Primary SVD model failed: {e}")
            try:
                print("[INFO] Trying alternative SVD model...")
                # Try alternative model
                pipe = StableVideoDiffusionPipeline.from_pretrained(
                    "stabilityai/stable-video-diffusion-img2vid-xt-1-1",
                    torch_dtype=torch.float16,
                    variant="fp16",
                    local_files_only=False,
                    resume_download=True,
                    max_retries=3,
                    cache_dir="./models"  # Local cache
                )
            except Exception as e2:
                print(f"[ERROR] Alternative SVD model also failed: {e2}")
                print("[INFO] Falling back to CPU-based simple animation...")
                return generate_simple_animation(image_path, output_path)
        
        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = pipe.to(device)
        
        # Load image
        image = Image.open(image_path)
        
        # Generate video with optimized parameters
        video_frames = pipe(
            image, 
            num_frames=14,  # Reduced for faster generation
            fps=7,
            height=576,     # Reduced height for speed
            width=1024      # Reduced width for speed
        ).frames
        
        # Save video
        video_frames[0].save(
            output_path,
            save_all=True,
            append_images=video_frames[1:],
            duration=1000//7,  # 7 fps
            loop=0
        )
        
        print(f"[SUCCESS] Video generated: {output_path}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

def generate_simple_animation(image_path, output_path):
    """Generate simple CPU-based animation as fallback"""
    try:
        print("[INFO] Generating simple CPU animation...")
        
        # Load image
        image = Image.open(image_path)
        
        # Resize to target dimensions
        image = image.resize((1024, 576), Image.Resampling.LANCZOS)
        
        # Create simple zoom effect
        frames = []
        for i in range(14):  # 14 frames
            # Calculate zoom factor
            zoom = 1.0 + (i * 0.02)  # Gradual zoom
            
            # Create zoomed frame
            width, height = image.size
            new_width = int(width / zoom)
            new_height = int(height / zoom)
            
            # Crop center
            left = (width - new_width) // 2
            top = (height - new_height) // 2
            right = left + new_width
            bottom = top + new_height
            
            frame = image.crop((left, top, right, bottom))
            frame = frame.resize((1024, 576), Image.Resampling.LANCZOS)
            
            frames.append(frame)
        
        # Save as animated GIF
        frames[0].save(
            output_path.replace('.mp4', '.gif'),
            save_all=True,
            append_images=frames[1:],
            duration=200,  # 200ms per frame
            loop=0
        )
        
        print(f"[SUCCESS] Simple animation generated: {output_path.replace('.mp4', '.gif')}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Simple animation failed: {e}")
        return False

# Execute
if __name__ == "__main__":
    import sys
    image_path = sys.argv[1]
    output_path = sys.argv[2]
    generate_video(image_path, output_path)
`;

      // Write Python script
      const scriptPath = path.join(__dirname, '..', 'temp', 'svd_script.py');
      fs.writeFileSync(scriptPath, pythonScript);

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [scriptPath, imagePath, outputPath]);
        
        // Set timeout for the entire process
        const timeout = setTimeout(() => {
          console.log('⏰ [LOCAL GPU] Timeout reached, killing process...');
          pythonProcess.kill();
          resolve(null);
        }, 300000); // 5 minutes timeout
        
        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(`[SVD] ${output}`);
          
          // Check for progress indicators
          if (output.includes('Fetching') || output.includes('Downloading')) {
            console.log('📥 [SVD] Model download in progress...');
          }
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const error = data.toString();
          console.error(`[SVD Error] ${error}`);
          
          // Check for specific errors
          if (error.includes('CUDA out of memory')) {
            console.log('💾 [SVD] VRAM insufficient, will use CPU');
          }
        });
        
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          if (code === 0 && fs.existsSync(outputPath)) {
            console.log(`✅ [LOCAL GPU] Video generated: ${filename}.mp4`);
            resolve(outputPath);
          } else {
            console.log(`❌ [LOCAL GPU] Video generation failed (code: ${code}), falling back to cloud`);
            resolve(null);
          }
        });
        
        pythonProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`❌ [LOCAL GPU] Process error: ${error.message}`);
          resolve(null);
        });
      });
      
    } catch (error) {
      console.error('❌ [LOCAL GPU] Video generation failed:', error.message);
      return null;
    }
  }

  // Generate multiple videos from images
  async generateMultipleVideos(imagePaths, baseFilename) {
    const videos = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      const videoPath = await this.generateVideoFromImage(
        imagePaths[i], 
        `${baseFilename}_local_video_${i + 1}`
      );
      if (videoPath) {
        videos.push({
          path: videoPath,
          source: 'local-gpu-generated',
          duration: 3, // 3 seconds per video
          quality: 100 // High quality GPU-generated
        });
      }
    }
    
    return videos;
  }

  // Check if GPU is available
  async checkGPUAvailability() {
    try {
      const pythonScript = `
import torch
print("CUDA Available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU Count:", torch.cuda.device_count())
    print("GPU Name:", torch.cuda.get_device_name(0))
    print("VRAM:", torch.cuda.get_device_properties(0).total_memory / 1024**3, "GB")
else:
    print("No GPU available")
`;

      const scriptPath = path.join(__dirname, '..', 'temp', 'gpu_check.py');
      fs.writeFileSync(scriptPath, pythonScript);

      return new Promise((resolve) => {
        const pythonProcess = spawn('python', [scriptPath]);
        let output = '';
        
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        pythonProcess.on('close', () => {
          const hasGPU = output.includes('CUDA Available: True');
          console.log(`🔍 GPU Check: ${output}`);
          resolve(hasGPU);
        });
      });
    } catch (error) {
      console.error('❌ GPU check failed:', error.message);
      return false;
    }
  }
}

module.exports = LocalVideoGenerationService;
