#!/usr/bin/env python3
"""
Download Faster-Whisper model to local cache for offline operation
This ensures the model is available even without internet connection
"""

import os
import sys

def download_whisper_model(model_size="base"):
    """
    Download Faster-Whisper model to local cache
    
    Args:
        model_size: Model size (tiny, base, small, medium, large)
    """
    try:
        from faster_whisper import WhisperModel
        
        # Set cache directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_dir = os.path.dirname(script_dir)
        cache_dir = os.path.join(project_dir, "models", "faster-whisper")
        os.makedirs(cache_dir, exist_ok=True)
        
        print(f"🎤 [Setup] Downloading Faster-Whisper model: {model_size}")
        print(f"📁 [Setup] Cache directory: {cache_dir}")
        print(f"⏳ [Setup] This may take a few minutes on first run...")
        
        # Initialize model (this will download it)
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=cache_dir
        )
        
        print(f"✅ [Setup] Model downloaded successfully!")
        print(f"✅ [Setup] Model cached at: {cache_dir}")
        print(f"✅ [Setup] Faster-Whisper is now ready for offline use!")
        
        return True
        
    except ImportError:
        print(f"❌ [Setup] Error: faster-whisper not installed!")
        print(f"💡 [Setup] Please install: pip install faster-whisper")
        return False
    except Exception as e:
        print(f"❌ [Setup] Error downloading model: {e}")
        return False

if __name__ == "__main__":
    model_size = sys.argv[1] if len(sys.argv) > 1 else "base"
    
    print(f"\n{'='*60}")
    print(f"FASTER-WHISPER MODEL DOWNLOADER")
    print(f"{'='*60}\n")
    
    success = download_whisper_model(model_size)
    
    if success:
        print(f"\n{'='*60}")
        print(f"✅ SETUP COMPLETE!")
        print(f"{'='*60}\n")
        sys.exit(0)
    else:
        print(f"\n{'='*60}")
        print(f"❌ SETUP FAILED!")
        print(f"{'='*60}\n")
        sys.exit(1)

