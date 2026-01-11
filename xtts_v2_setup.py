"""
XTTS-v2 Model Setup & Test Script
Bu script XTTS-v2 modelini sisteme indirir ve hazır sesleri test eder
"""
import os
from TTS.api import TTS

# Çıktı klasörü
OUTPUT_DIR = "xtts_v2_samples"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Test metni - belgesel tarzı
TEST_TEXT = "Subscribe now — and do not … miss out on the greatest discoveries in human history."

print("="*70)
print("🎙️  XTTS-v2 MODEL KURULUMU VE TEST")
print("="*70)

# Model yükleme (İlk seferde otomatik indirilir - biraz zaman alabilir)
print("\n📥 XTTS-v2 modeli indiriliyor/yükleniyor...")
print("⏳ İlk seferde 1-2 GB model indirileceği için bekleyin...")
print("-"*70)

try:
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
    print("✅ Model başarıyla yüklendi!")
    
except Exception as e:
    print(f"❌ Model yüklenirken hata: {e}")
    print("\n💡 Çözüm önerileri:")
    print("1. İnternet bağlantınızı kontrol edin")
    print("2. pip install TTS --upgrade komutunu çalıştırın")
    print("3. Python 3.8+ kullandığınızdan emin olun")
    exit(1)

print("\n" + "="*70)

# Hazır konuşmacıları kontrol et
if hasattr(tts, 'speakers') and tts.speakers:
    speakers = tts.speakers
    print(f"\n🎤 HAZIR SESLER ({len(speakers)} adet bulundu):")
    print("-"*70)
    for i, speaker in enumerate(speakers, 1):
        print(f"{i}. {speaker}")
    
    print("\n" + "="*70)
    print("🎬 Hazır sesler için örnek dosyalar oluşturuluyor...")
    print("-"*70)
    
    # Her hazır ses için örnek oluştur
    for speaker in speakers:
        try:
            output_file = os.path.join(OUTPUT_DIR, f"builtin_{speaker.replace(' ', '_')}.wav")
            
            tts.tts_to_file(
                text=TEST_TEXT,
                speaker=speaker,
                language="en",
                file_path=output_file
            )
            
            print(f"✅ {speaker} - Oluşturuldu: {output_file}")
            
        except Exception as e:
            print(f"❌ {speaker} - Hata: {str(e)}")
    
else:
    print("\n⚠️  XTTS-v2'de hazır konuşmacı bulunamadı (bu normaldir)")
    print("XTTS-v2 ses klonlama için tasarlanmıştır - kendi seslerinizi kullanacaksınız!")

print("\n" + "="*70)
print("📊 KURULUM TAMAMLANDI!")
print("="*70)

print(f"\n📁 Oluşturulan dosyalar: '{OUTPUT_DIR}' klasöründe")

print("\n" + "="*70)
print("🎯 ŞİMDİ YAPMANIZ GEREKENLER:")
print("="*70)
print("""
1. HAZIR SESLERİ DİNLEYİN:
   - '{0}' klasöründeki dosyaları dinleyin
   - Hazır sesler genelde az olur (1-5 adet)

2. KENDİ NARRATOR SESLERİNİZİ EKLEYIN:
   
   A) YouTube'dan Sesler İndirin:
      - "David Attenborough documentary" ara
      - "BBC documentary narrator" ara
      - "History Channel narrator" ara
      - yt-dlp veya online araçlarla sesi indirin
   
   B) Audacity ile Düzenleyin:
      - 6-10 saniyelik temiz konuşma bölümünü kes
      - Arka plan sesi/müzik olmasın
      - WAV formatında kaydet
   
   C) Test Edin:
      Aşağıdaki kod ile test edin:

""".format(OUTPUT_DIR))

print("""
from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

# Kendi narrator sesinizi test edin
tts.tts_to_file(
    text="Your documentary script here",
    speaker_wav="path/to/your_narrator_6sec.wav",  # 6-10 saniye ses
    language="en",
    file_path="cloned_narrator_test.wav"
)
""")

print("\n" + "="*70)
print("💡 ÖNEMLİ NOTLAR:")
print("="*70)
print("""
- XTTS-v2 modelinin gücü SES KLONLAMADA!
- Hazır sesler sınırlıdır (1-5 adet)
- Profesyonel belgesel için YouTube'dan narrator sesleri klonlayın
- 6-10 saniyelik temiz ses yeterli
- Klonlanan sesler çok gerçekçi olur!

🎥 Belgesel/Tarih videoları için XTTS-v2 + Klonlanmış Ses = Mükemmel! ✨
""")

print("="*70)