"""
XTTS-v2 Voice Cloning Runner
Bu script XTTS-v2 modelini kullanarak ses klonlama yapar
Node.js'den çağrılır ve WAV çıktısı üretir
"""
import sys
import os
import io
import gc

# CRITICAL FIX: Force UTF-8 encoding for Windows console
# This prevents UnicodeEncodeError with emoji characters
if sys.platform == 'win32':
    # Reconfigure stdout and stderr to use UTF-8
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def cleanup_memory():
    """Bellek temizleme - GPU ve RAM"""
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    except:
        pass

def check_cuda_availability():
    """CUDA durumunu kontrol et"""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            print(f"[XTTS-v2] CUDA available: {torch.cuda.get_device_name(0)}")
        return cuda_available
    except Exception as e:
        print(f"[XTTS-v2] CUDA check: {e}")
        return False

def main():
    # Argüman kontrolü
    if len(sys.argv) < 5:
        print("[XTTS-v2] ERROR: Usage: python xtts_v2_runner.py <text> <output_path> <speaker_wav> <language>", file=sys.stderr)
        sys.exit(1)
    
    text = sys.argv[1]
    output_path = sys.argv[2]
    speaker_wav = sys.argv[3]
    language = sys.argv[4]
    
    # Debug output (NO EMOJIS for Windows compatibility)
    print("[XTTS-v2 Runner] Starting voice cloning...")
    print(f"   Text length: {len(text)} characters")
    print(f"   Output: {os.path.basename(output_path)}")
    print(f"   Speaker WAV: {os.path.basename(speaker_wav)}")
    print(f"   Language: {language}")
    
    # Speaker WAV dosyasının varlığını kontrol et
    if not os.path.exists(speaker_wav):
        print(f"[XTTS-v2] ERROR: Speaker WAV file not found: {speaker_wav}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # CRITICAL: Önce belleği temizle
        cleanup_memory()
        
        # CUDA durumunu kontrol et
        cuda_actually_available = check_cuda_availability()
        
        # TTS library'yi import et
        from TTS.api import TTS
        
        # XTTS-v2 model yükle
        print("[XTTS-v2] Loading XTTS-v2 model...")
        
        # GPU kullanımı için - hem env var hem de gerçek CUDA durumunu kontrol et
        use_gpu_env = os.environ.get('USE_CUDA', '').lower() == 'true'
        use_gpu = use_gpu_env and cuda_actually_available
        
        if use_gpu_env and not cuda_actually_available:
            print("[XTTS-v2] WARNING: USE_CUDA=true but CUDA not available, using CPU")
        
        # Model yükleme - hata durumunda CPU'ya fallback
        try:
            tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=use_gpu)
        except Exception as model_error:
            if use_gpu:
                print(f"[XTTS-v2] GPU model load failed: {model_error}")
                print("[XTTS-v2] Retrying with CPU...")
                cleanup_memory()
                tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
                use_gpu = False
            else:
                raise model_error
        
        print(f"[XTTS-v2] Model loaded (GPU: {use_gpu})")
        
        # Ses klonlama ile üret
        print("[XTTS-v2] Generating speech with voice cloning...")
        
        # CRITICAL FIX: Disable sentence splitting!
        # XTTS'in kendi sentence splitter'ı sayıları ("10.", "9.") ayrı cümleler olarak algılıyor
        # Bu yüzden "Wanda D", "DAven", "Yeah", "Warrior" gibi random kelimeler üretiyor
        # split_sentences=False ile text'i olduğu gibi kullan
        tts.tts_to_file(
            text=text,
            speaker_wav=speaker_wav,
            language=language,
            file_path=output_path,
            split_sentences=False  # CRITICAL: Sentence splitting'i devre dışı bırak!
        )
        
        # Çıktı dosyasının oluşturulduğunu kontrol et
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"[XTTS-v2] SUCCESS: Speech generated successfully!")
            print(f"   Output file: {output_path}")
            print(f"   File size: {file_size} bytes")
        else:
            print("[XTTS-v2] ERROR: Output file was not created", file=sys.stderr)
            sys.exit(1)
            
    except ImportError as e:
        print(f"[XTTS-v2] ERROR: TTS library not found. Please install: pip install TTS", file=sys.stderr)
        print(f"   Details: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[XTTS-v2] ERROR: During speech generation: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        cleanup_memory()
        sys.exit(1)
    finally:
        # Final cleanup
        cleanup_memory()

if __name__ == "__main__":
    main()

