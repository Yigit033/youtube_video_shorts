# 🎤 Piper TTS Kurulum Kılavuzu

## 🎯 Neden Piper TTS?

### ✅ Avantajlar:
```
✅ Python 3.12 uyumlu (Coqui TTS değil!)
✅ Çok hızlı (real-time)
✅ Hafif (50MB)
✅ Kaliteli sesler
✅ 40+ dil, 100+ ses
✅ Kolay kurulum
```

### ❌ Coqui TTS Sorunu:
```
❌ Python 3.12 ile uyumsuz
❌ Python 3.8-3.11 gerekli
❌ Büyük model dosyaları (~500MB)
❌ Yavaş kurulum
```

---

## 🚀 Piper TTS Kurulumu (Windows)

### 1. **Download:**
```powershell
# Piper TTS indir
Invoke-WebRequest -Uri "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_windows_amd64.zip" -OutFile "piper.zip"

# Extract
Expand-Archive -Path "piper.zip" -DestinationPath "C:\piper"

# Test
C:\piper\piper.exe --version
```

### 2. **Model İndir:**
```powershell
# En iyi İngilizce model
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" -OutFile "C:\piper\en_US-lessac-medium.onnx"

Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" -OutFile "C:\piper\en_US-lessac-medium.onnx.json"
```

### 3. **Test:**
```powershell
# Test TTS
echo "Hello, this is a test of Piper TTS" | C:\piper\piper.exe --model C:\piper\en_US-lessac-medium.onnx --output_file test.wav

# Başarılı! test.wav oluşturuldu
```

---

## 🎛️ .env Konfigürasyonu

### Piper TTS'i Aktif Et:
```env
# TTS Provider
TTS_PROVIDER=piper

# Piper TTS Ayarları
PIPER_PATH=C:\piper\piper.exe
PIPER_MODEL=C:\piper\en_US-lessac-medium.onnx

# Alternatif: gTTS (fallback)
# TTS_PROVIDER=gtts
```

---

## 🎙️ Mevcut Sesler

### İngilizce (US):

**1. lessac-medium** (Önerilen) ⭐⭐⭐⭐⭐
```
Kalite: Yüksek
Hız: Orta
Doğallık: Çok iyi
Boyut: 50MB
```

**2. libritts-high**
```
Kalite: Çok yüksek
Hız: Yavaş
Doğallık: Mükemmel
Boyut: 100MB
```

**3. ljspeech-high**
```
Kalite: Yüksek
Hız: Hızlı
Doğallık: İyi
Boyut: 30MB
```

### Diğer Diller:
```
🇹🇷 Turkish: tr_TR-dfki-medium
🇩🇪 German: de_DE-thorsten-medium
🇫🇷 French: fr_FR-siwis-medium
🇪🇸 Spanish: es_ES-sharvard-medium
🇮🇹 Italian: it_IT-riccardo-medium
```

---

## 📊 Performans Karşılaştırması

### TTS Kalitesi:

| TTS | Kalite | Hız | Python 3.12 | Boyut |
|-----|--------|-----|-------------|-------|
| **Piper TTS** | ⭐⭐⭐⭐ | ⚡⚡⚡⚡⚡ | ✅ | 50MB |
| Coqui TTS | ⭐⭐⭐⭐⭐ | ⚡⚡⚡ | ❌ | 500MB |
| gTTS | ⭐⭐⭐⭐ | ⚡⚡⚡⚡ | ✅ | 0MB |
| Windows TTS | ⭐⭐⭐ | ⚡⚡⚡⚡ | ✅ | 0MB |

---

## 🔧 Sorun Giderme

### Problem: "piper.exe not found"
```powershell
# PATH'e ekle
$env:PATH += ";C:\piper"

# Veya .env'de tam path kullan
PIPER_PATH=C:\piper\piper.exe
```

### Problem: "Model not found"
```powershell
# Model dosyalarını kontrol et
dir C:\piper\*.onnx

# Yoksa tekrar indir
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" -OutFile "C:\piper\en_US-lessac-medium.onnx"
```

### Problem: "Audio quality low"
```powershell
# Daha iyi model kullan
# lessac-medium → libritts-high
PIPER_MODEL=C:\piper\en_US-libritts-high.onnx
```

---

## 🎯 Kullanım

### Otomatik Kullanım:
```javascript
// Platform otomatik olarak Piper TTS kullanacak
// .env'de TTS_PROVIDER=piper olduğu sürece

npm start
// ✅ [Piper TTS] Generating speech...
// ✅ [Piper TTS] Speech generated successfully!
```

### Manuel Test:
```javascript
const tts = require('./services/tts');

// Test
await tts.generateSpeech('Hello world', 'test');
// ✅ Piper TTS kullanılacak
```

---

## 📈 Beklenen Sonuçlar

### Öncesi (gTTS):
```
🎤 Ses kalitesi: ⭐⭐⭐⭐
⚡ Hız: 1-2 saniye
🌐 İnternet: Gerekli
💾 Boyut: 0MB
```

### Sonrası (Piper TTS):
```
🎤 Ses kalitesi: ⭐⭐⭐⭐⭐
⚡ Hız: 0.5-1 saniye
🌐 İnternet: Gerekmez
💾 Boyut: 50MB
```

---

## 🎉 Kurulum Tamamlandı!

### Test Et:
```bash
npm start
# Dashboard: http://localhost:3000
# Topic: "technology"
# Count: 1
```

### Beklenen Çıktı:
```
🎤 [Piper TTS] Generating speech...
✅ [Piper TTS] Speech generated successfully!
🎵 [Music] Mixing audio with professional filters
✅ Video processing complete
✅ YouTube upload successful
```

---

## 💡 Pro Tipler

### 1. **Farklı Sesler Dene:**
```env
# Kadın ses
PIPER_MODEL=C:\piper\en_US-lessac-medium.onnx

# Erkek ses
PIPER_MODEL=C:\piper\en_US-ljspeech-high.onnx
```

### 2. **Hız Ayarı:**
```javascript
// services/tts.js içinde
// --length-scale parametresi ile hız ayarlanabilir
// 1.0 = normal, 0.8 = hızlı, 1.2 = yavaş
```

### 3. **Fallback Chain:**
```
Piper TTS → gTTS → Windows TTS → Silent
```

---

## 🚀 SONUÇ

**Piper TTS en iyi seçenek!**

- ✅ Python 3.12 uyumlu
- ✅ Hızlı ve kaliteli
- ✅ Kolay kurulum
- ✅ Offline çalışır
- ✅ Tamamen ücretsiz

**Şimdi kur ve profesyonel ses kalitesinin tadını çıkar! 🎤✨**
