from TTS.api import TTS

print("🎙️ XTTS-v2 Ses Klonlama Testi...")

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

test_text = "These armies weren’t just massive, they were unstoppable forces that reshaped the world. 10. The Egyptian New Kingdom — tens of thousands marching under the sun gods, forging the first great empire of Africa.  9. The Spartan Alliance — a wall of bronze and discipline that stood unbroken even against impossible odds.  8. The Persian Immortals — ten thousand flawless warriors whose ranks never fell below perfection. 7. The Macedonian Army — the unstoppable phalanx that followed Alexander across three continents.  6. The Roman Imperial Legions, — iron formations that carved their power into the map of the ancient world.  5. The Mongol Horde, — a storm of horsemen that could swallow entire kingdoms in a single charge.  4. The Ottoman Army at Its Peak, — an imperial war engine that thundered from Europe to Arabia. 3. The Napoleonic Grande Armée, — a force so vast it rewrote the fate of an entire continent. 2. The Allied Forces of World War II, — the largest military coalition humanity had ever assembled. 1. The Soviet Red Army in 1945, — the single biggest military force ever gathered on one front in human history."

tts.tts_to_file(
    text=test_text,
    speaker_wav="voice_samples/audio.wav",
    language="en",
    file_path="voice_samples/cloned_output_new.wav"
)

print("✅ Tamamlandı! 'voice_samples/cloned_output.wav' dosyasını dinle!")


