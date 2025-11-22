import sys
import os
from TTS.api import TTS

if len(sys.argv) < 3:
    print("Usage: coqui_tts_api_runner.py <text> <output_path> [model_name] [speaker] [length_scale] [noise_scale]")
    sys.exit(1)

text = sys.argv[1]
output_path = sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "tts_models/en/vctk/vits"
speaker = sys.argv[4] if len(sys.argv) > 4 else "p230"

# Parse length_scale and noise_scale from arguments or environment
length_scale = None
noise_scale = None

if len(sys.argv) > 5 and sys.argv[5]:
    try:
        length_scale = float(sys.argv[5])
    except ValueError:
        length_scale = None

if len(sys.argv) > 6 and sys.argv[6]:
    try:
        noise_scale = float(sys.argv[6])
    except ValueError:
        noise_scale = None

# Fallback to environment variables if not provided
# CRITICAL: Default changed from 1.0 to 1.25 for more natural, slower speech
# Higher length_scale = slower, more human-like pacing
if length_scale is None:
    env_length_scale = os.getenv('COQUI_LENGTH_SCALE')
    length_scale = float(env_length_scale) if env_length_scale else 1.25

if noise_scale is None:
    env_noise_scale = os.getenv('COQUI_NOISE_SCALE')
    noise_scale = float(env_noise_scale) if env_noise_scale else 0.667

print(f"[Python] Generating TTS with model: {model_name}, speaker: {speaker}, length_scale: {length_scale}, noise_scale: {noise_scale}")

tts = TTS(model_name)
tts.tts_to_file(
    text=text, 
    file_path=output_path, 
    speaker=speaker,
    length_scale=length_scale,
    noise_scale=noise_scale
)
print(f"[Python] Done. Saved to {output_path}")
