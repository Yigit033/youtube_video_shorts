"""
XTTS-v2 Batch Voice Cloning Runner
Bu script XTTS-v2 modelini BIR KEZ yükler ve birden fazla chunk'ı işler
PERFORMANS OPTIMIZASYONU: Model yükleme overhead'i ~4x azalır
"""
import sys
import os
import io
import json
import gc

# CRITICAL FIX: Force UTF-8 encoding for Windows console
if sys.platform == 'win32':
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
            print("[XTTS-v2 Batch] GPU memory cleared")
    except Exception as e:
        print(f"[XTTS-v2 Batch] Memory cleanup note: {e}")

def check_cuda_availability():
    """CUDA durumunu kontrol et ve detaylı bilgi ver"""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"[XTTS-v2 Batch] PyTorch version: {torch.__version__}")
        print(f"[XTTS-v2 Batch] CUDA available: {cuda_available}")
        if cuda_available:
            print(f"[XTTS-v2 Batch] CUDA version: {torch.version.cuda}")
            print(f"[XTTS-v2 Batch] GPU: {torch.cuda.get_device_name(0)}")
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            print(f"[XTTS-v2 Batch] GPU Memory: {gpu_memory:.1f} GB")
        return cuda_available
    except Exception as e:
        print(f"[XTTS-v2 Batch] CUDA check error: {e}")
        return False

def main():
    # Argüman kontrolü: chunks_json_path speaker_wav language
    if len(sys.argv) < 4:
        print("[XTTS-v2 Batch] ERROR: Usage: python xtts_v2_batch_runner.py <chunks_json_path> <speaker_wav> <language>", file=sys.stderr)
        sys.exit(1)
    
    chunks_json_path = sys.argv[1]
    speaker_wav = sys.argv[2]
    language = sys.argv[3]
    
    # Load chunks from JSON file
    try:
        with open(chunks_json_path, 'r', encoding='utf-8') as f:
            chunks_data = json.load(f)
    except Exception as e:
        print(f"[XTTS-v2 Batch] ERROR: Failed to load chunks JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    num_chunks = len(chunks_data)
    print(f"[XTTS-v2 Batch] Starting batch voice cloning for {num_chunks} chunks...")
    print(f"   Speaker WAV: {os.path.basename(speaker_wav)}")
    print(f"   Language: {language}")
    
    # Speaker WAV dosyasının varlığını kontrol et
    if not os.path.exists(speaker_wav):
        print(f"[XTTS-v2 Batch] ERROR: Speaker WAV file not found: {speaker_wav}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # CRITICAL: Önce belleği temizle
        cleanup_memory()
        
        # CUDA durumunu kontrol et
        cuda_actually_available = check_cuda_availability()
        
        # TTS library'yi import et
        from TTS.api import TTS
        
        # CRITICAL: Model'i BIR KEZ yükle (tüm chunk'lar için kullanılacak)
        print("[XTTS-v2 Batch] Loading XTTS-v2 model (ONE TIME LOAD)...")
        
        # USE_CUDA env var'ı kontrol et AMA CUDA gerçekten mevcut mu da kontrol et
        use_gpu_env = os.environ.get('USE_CUDA', '').lower() == 'true'
        use_gpu = use_gpu_env and cuda_actually_available
        
        if use_gpu_env and not cuda_actually_available:
            print("[XTTS-v2 Batch] WARNING: USE_CUDA=true but CUDA not available, falling back to CPU")
        
        print(f"[XTTS-v2 Batch] Loading model with GPU={use_gpu}...")
        
        # Model yükleme - hata durumunda CPU'ya fallback
        try:
            tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=use_gpu)
        except Exception as model_error:
            if use_gpu:
                print(f"[XTTS-v2 Batch] GPU model load failed: {model_error}")
                print("[XTTS-v2 Batch] Retrying with CPU...")
                cleanup_memory()
                tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
                use_gpu = False
            else:
                raise model_error
        
        print(f"[XTTS-v2 Batch] Model loaded successfully (GPU: {use_gpu})")
        print(f"[XTTS-v2 Batch] Processing {num_chunks} chunks with SINGLE model instance...")
        
        # Process each chunk
        success_count = 0
        for i, chunk_info in enumerate(chunks_data):
            text = chunk_info['text']
            output_path = chunk_info['output_path']
            
            print(f"\n[XTTS-v2 Batch] Chunk {i+1}/{num_chunks}:")
            print(f"   Text length: {len(text)} characters")
            print(f"   Output: {os.path.basename(output_path)}")
            
            try:
                # Generate speech (model already loaded!)
                tts.tts_to_file(
                    text=text,
                    speaker_wav=speaker_wav,
                    language=language,
                    file_path=output_path,
                    split_sentences=False  # CRITICAL: Disable internal splitting
                )
                
                # Verify output
                if os.path.exists(output_path):
                    file_size = os.path.getsize(output_path)
                    print(f"   SUCCESS: {file_size} bytes")
                    success_count += 1
                else:
                    print(f"   ERROR: Output file not created", file=sys.stderr)
                    
            except Exception as e:
                print(f"   ERROR: {str(e)}", file=sys.stderr)
                import traceback
                traceback.print_exc()
            
            # Her chunk sonrası bellek temizle (GPU memory leak önleme)
            if i < num_chunks - 1:  # Son chunk'tan sonra gerek yok
                gc.collect()
        
        print(f"\n[XTTS-v2 Batch] Batch processing complete: {success_count}/{num_chunks} chunks successful")
        
        # Final cleanup
        cleanup_memory()
        
        if success_count < num_chunks:
            sys.exit(1)
            
    except ImportError as e:
        print(f"[XTTS-v2 Batch] ERROR: TTS library not found. Please install: pip install TTS", file=sys.stderr)
        print(f"   Details: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[XTTS-v2 Batch] ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

