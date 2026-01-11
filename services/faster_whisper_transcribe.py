#!/usr/bin/env python3
"""
Faster-Whisper transcription script for word-level timing
This script uses Faster-Whisper to extract word-level timestamps from audio
for perfect subtitle synchronization with TTS audio.
"""

import sys
import json
import os
import gc

def cleanup_memory():
    """Bellek temizleme"""
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except:
        pass

# MEMORY-OPTIMIZED: Import inside function to delay memory allocation
def transcribe_audio(audio_path, model_size="base", device="cpu", compute_type="int8", language=None):
    """
    Transcribe audio using Faster-Whisper and return word-level timestamps
    
    Args:
        audio_path: Path to audio file
        model_size: Whisper model size (tiny, base, small, medium, large)
        device: Device to use (cpu, cuda)
        compute_type: Compute type (int8, int8_float16, float16, float32)
        language: Language code (e.g., 'en', 'tr', 'es') or None for auto-detection
    
    Returns:
        List of word-level timestamps with start, end, and word text
    """
    try:
        # MEMORY-OPTIMIZED: Clean memory before loading model
        cleanup_memory()
        
        # Import here to delay memory allocation
        from faster_whisper import WhisperModel
        
        # PROFESSIONAL: Set cache directory to project's models folder
        # This prevents network issues and ensures offline operation
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "models", "faster-whisper")
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize Whisper model with local cache
        print(f"🎤 [Faster-Whisper] Loading model: {model_size} ({device})", file=sys.stderr)
        print(f"📁 [Faster-Whisper] Cache directory: {cache_dir}", file=sys.stderr)
        
        # MEMORY-OPTIMIZED: Use smaller model if memory is low
        # Try to detect available memory
        try:
            import psutil
            available_memory_gb = psutil.virtual_memory().available / (1024**3)
            print(f"💾 [Faster-Whisper] Available memory: {available_memory_gb:.1f} GB", file=sys.stderr)
            
            # If less than 2GB available, force tiny model
            if available_memory_gb < 2 and model_size not in ['tiny']:
                print(f"⚠️ [Faster-Whisper] Low memory! Switching from {model_size} to tiny model", file=sys.stderr)
                model_size = 'tiny'
        except ImportError:
            pass  # psutil not available, continue with requested model
        
        # CRITICAL: download_root parameter for offline mode
        # MEMORY-OPTIMIZED: Use cpu_threads=4 to limit memory usage
        model = WhisperModel(
            model_size, 
            device=device, 
            compute_type=compute_type,
            download_root=cache_dir,  # Use local cache
            local_files_only=False,  # Try local first, download if needed
            cpu_threads=4  # MEMORY-OPTIMIZED: Limit CPU threads
        )
        
        # Transcribe with word-level timestamps
        print(f"🎤 [Faster-Whisper] Transcribing: {audio_path}", file=sys.stderr)
        
        # Language name mapping for better logging
        language_names = {
            'tr': 'Turkish',
            'en': 'English', 
            'es': 'Spanish',
            'de': 'German',
            'fr': 'French',
            None: 'Auto-detect'
        }
        lang_display = language_names.get(language, language or 'Auto-detect')
        print(f"🌍 [Faster-Whisper] Target language: {lang_display}", file=sys.stderr)
        
        # PROFESSIONAL: Retry mechanism for network issues
        max_retries = 3
        retry_delay = 2
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # CRITICAL: Use provided language or auto-detect (None = auto-detect)
                # This ensures better timing accuracy for ALL languages
                # HIGH QUALITY SETTINGS for best transcription accuracy
                # These settings work well for both English AND non-English languages
                segments, info = model.transcribe(
                    audio_path,
                    word_timestamps=True,  # CRITICAL: Enable word-level timestamps
                    language=language,  # None = auto-detect, or specific language code
                    beam_size=5,  # Higher = more accurate (but slower)
                    best_of=5,  # Number of candidates to consider
                    patience=1.0,  # Beam search patience factor
                    length_penalty=1.0,  # Length penalty for beam search
                    temperature=0.0,  # Use greedy decoding for consistency (deterministic)
                    compression_ratio_threshold=2.4,  # Filter out bad segments
                    log_prob_threshold=-1.0,  # Filter low probability segments
                    no_speech_threshold=0.6,  # Threshold for no speech detection
                    condition_on_previous_text=True,  # Use context for better accuracy
                    vad_filter=True,  # Voice Activity Detection for better accuracy
                    vad_parameters=dict(
                        min_silence_duration_ms=300,  # Shorter silence detection for precise timing
                        speech_pad_ms=200,  # Padding around speech segments
                        threshold=0.5  # VAD sensitivity (0.0-1.0)
                    )
                )
                # Success - break retry loop
                break
            except Exception as transcribe_error:
                last_error = transcribe_error
                if attempt < max_retries - 1:
                    import time
                    print(f"⚠️ [Faster-Whisper] Attempt {attempt + 1} failed, retrying in {retry_delay}s...", file=sys.stderr)
                    time.sleep(retry_delay)
                else:
                    # Final attempt failed
                    raise transcribe_error
        
        print(f"🎤 [Faster-Whisper] Detected language: {info.language} (probability: {info.language_probability:.2f})", file=sys.stderr)
        
        # Extract word-level timestamps
        words = []
        for segment in segments:
            for word_info in segment.words:
                words.append({
                    "word": word_info.word.strip(),
                    "start": word_info.start,
                    "end": word_info.end,
                    "probability": word_info.probability
                })
        
        print(f"✅ [Faster-Whisper] Extracted {len(words)} word-level timestamps", file=sys.stderr)
        
        # Return as JSON
        return json.dumps({
            "success": True,
            "words": words,
            "language": info.language,
            "language_probability": info.language_probability
        })
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [Faster-Whisper] Error: {error_msg}", file=sys.stderr)
        # MEMORY-OPTIMIZED: Clean up on error
        cleanup_memory()
        return json.dumps({
            "success": False,
            "error": error_msg,
            "words": []
        })
    finally:
        # MEMORY-OPTIMIZED: Always clean up after transcription
        cleanup_memory()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python faster_whisper_transcribe.py <audio_path> [model_size] [device] [compute_type] [language]",
            "words": []
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    device = sys.argv[3] if len(sys.argv) > 3 else "cpu"
    compute_type = sys.argv[4] if len(sys.argv) > 4 else "int8"
    language = sys.argv[5] if len(sys.argv) > 5 else None
    # Convert "None" string to actual None for auto-detection
    if language == "None" or language == "":
        language = None
    
    if not os.path.exists(audio_path):
        print(json.dumps({
            "success": False,
            "error": f"Audio file not found: {audio_path}",
            "words": []
        }))
        sys.exit(1)
    
    result = transcribe_audio(audio_path, model_size, device, compute_type, language)
    print(result)

