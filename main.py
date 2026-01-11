"""
VCTK Speaker Voice Tester
Bu script tüm VCTK konuşmacılarını test eder ve ses örnekleri oluşturur
"""

import os
from TTS.api import TTS

# Test metni - erkek sesi için uygun cümle
TEST_TEXT = "Subscribe now — and do not … miss out!"

# Çıktı klasörü
OUTPUT_DIR = "vctk_voice_samples"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Model yükleme (GPU olmadan)
print("🎙️ Model yükleniyor...")
tts = TTS(model_name="tts_models/en/vctk/vits")

# Tüm konuşmacıları al
speakers = tts.speakers
print(f"\n✅ Toplam {len(speakers)} konuşmacı bulundu\n")

# Test edilecek konuşmacılar (potansiyel erkek sesler)
# p2XX serisi genelde erkek, ama test edelim
test_speakers = [
    'p317'
]

print("🎬 Ses örnekleri oluşturuluyor...\n")
success_count = 0
failed_speakers = []

for speaker in test_speakers:
    try:
        output_file = os.path.join(OUTPUT_DIR, f"{speaker}_sample.mp3")
        
        # Ses sentezi (speaker parametresi kullanarak)
        tts.tts_to_file(
            text=TEST_TEXT,
            speaker=speaker,
            file_path=output_file
        )
        
        success_count += 1
        print(f"✅ {speaker} - Oluşturuldu: {output_file}")
        
    except Exception as e:
        failed_speakers.append(speaker)
        print(f"❌ {speaker} - Hata: {str(e)}")

print(f"\n{'='*60}")
print(f"📊 ÖZET:")
print(f"✅ Başarılı: {success_count}")
print(f"❌ Başarısız: {len(failed_speakers)}")
print(f"\n📁 Ses dosyaları '{OUTPUT_DIR}' klasöründe")
print(f"{'='*60}")

print(f"\n🎧 ŞİMDİ YAPMANIZ GEREKENLER:")
print(f"1. '{OUTPUT_DIR}' klasörünü açın")
print(f"2. Her ses dosyasını dinleyin")
print(f"3. En tok, derin ve sinematik erkek sesini seçin")
print(f"4. Dosya adındaki speaker ID'yi (örn: p260) .env dosyanıza yazın")
print(f"\n💡 İPUCU: 'p2XX' ile başlayanlar genelde erkek seslerdir")
print(f"   Derin ses için düşük pitch, tok artikülasyon arayın!")