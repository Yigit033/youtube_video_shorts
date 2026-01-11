# 🎤 Piper TTS Ses Ekleme Kılavuzu

## ✅ HIZLI KULLANIM (3 ADIM)

### 1️⃣ Ses Dosyasını İndirin
```powershell
# Örnek: Yeni bir ses indirmek için
# HuggingFace'den ses dosyasını indirin:
# https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US

# Örnek: joe sesi
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx" -OutFile "C:\piper\en_US-joe-medium.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json" -OutFile "C:\piper\en_US-joe-medium.onnx.json"
```

### 2️⃣ Dosyayı Doğru Yere Koyun
**Ses dosyalarınızı şu klasörlerden birine koyun:**
- ✅ `C:\piper\` (ÖNERİLEN)
- ✅ `C:\piper\models\`
- ✅ Proje klasörü: `project\piper\`
- ✅ Proje klasörü: `project\piper\models\`

**ÖNEMLİ:** Her ses için 2 dosya gerekli:
- `.onnx` dosyası (ses modeli)
- `.onnx.json` dosyası (ses konfigürasyonu)

### 3️⃣ Sayfayı Yenileyin
1. Tarayıcıda sayfayı yenileyin (F5)
2. Veya "🔄 Refresh Voice List" butonuna tıklayın
3. Yeni sesiniz listede görünecek!

---

## 🔍 SORUN GİDERME

### ❌ Ses Görünmüyor?

**1. Dosya Konumunu Kontrol Edin:**
```powershell
# PowerShell'de kontrol edin
dir C:\piper\*.onnx
```

**2. Tarayıcı Console'unu Kontrol Edin:**
- F12 tuşuna basın
- Console sekmesine gidin
- "🔄 Refresh Voice List" butonuna tıklayın
- Console'da hangi klasörlerin tarandığını göreceksiniz

**3. Manuel Test:**
```powershell
# Ses dosyasının çalıştığını test edin
C:\piper\piper.exe --model C:\piper\en_US-joe-medium.onnx --output_file test.wav
# Sonra bir şey yazın ve Enter'a basın
```

**4. .env Dosyasını Kontrol Edin:**
```env
# .env dosyanızda şunlar olmalı:
PIPER_PATH=C:\piper\piper.exe
PIPER_MODEL=C:\piper\en_US-lessac-medium.onnx  # Varsayılan ses
TTS_PROVIDER=piper
```

---

## 📋 MEVCUT SESLER (Örnek)

### İngilizce (US) Sesler:
- `en_US-lessac-medium` - Önerilen ⭐
- `en_US-joe-medium` - Erkek ses
- `en_US-libritts-high` - Yüksek kalite
- `en_US-ljspeech-high` - Hızlı

### Tüm Sesleri Görmek İçin:
https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US

---

## 🎯 ÖZET

1. ✅ Ses dosyasını `.onnx` ve `.onnx.json` formatında indirin
2. ✅ `C:\piper\` klasörüne koyun
3. ✅ Sayfayı yenileyin veya "Refresh Voice List" butonuna tıklayın
4. ✅ Ses listede görünecek!

**Sistem otomatik olarak şu klasörleri tarar:**
- `C:\piper\` ve alt klasörleri
- `C:\piper\models\` ve alt klasörleri
- Proje klasöründeki `piper\` klasörleri
- PIPER_MODEL env variable'ındaki klasör

**Sesler otomatik bulunur, ekstra ayar gerekmez!** 🎉

