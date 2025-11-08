# 🎤 PIPER TTS DOĞRU KURULUM REHBERİ

## ❌ SORUN
Klasörünüzde `piper.exe` YOK! Sadece Python dosyaları var (piper-phonemize).
Bu YANLIŞ araç - TTS için kullanılamaz.

## ✅ DOĞRU KURULUM

### ADIM 1: Doğru Piper'ı İndirin
1. Tarayıcınızda açın: https://github.com/rhasspy/piper/releases/latest
2. **Windows için** şu dosyayı indirin:
   - `piper_windows_amd64.zip` (yaklaşık 50 MB)

### ADIM 2: Klasöre Çıkarın
1. İndirilen ZIP'i açın
2. İçindeki TÜM dosyaları `C:\piper\` klasörüne kopyalayın
3. Şunları göreceksiniz:
   - ✅ `piper.exe` (OLMASI GEREKEN!)
   - ✅ `espeak-ng.dll`
   - ✅ `onnxruntime.dll`
   - ✅ `piper_phonemize.dll`

### ADIM 3: Model İndirin
1. Tarayıcıda açın: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/medium
2. Şu 2 dosyayı indirin:
   - `en_US-lessac-medium.onnx` (62 MB)
   - `en_US-lessac-medium.onnx.json` (8 KB)
3. Her ikisini de `C:\piper\` klasörüne kopyalayın

### ADIM 4: Test Edin
PowerShell'de çalıştırın:
```powershell
cd C:\piper
.\piper.exe --model en_US-lessac-medium.onnx --output_file test.wav
# Sonra bir şey yazın ve Enter'a basın
```

Eğer `test.wav` dosyası oluşursa ✅ BAŞARILI!

### ADIM 5: .env Güncelleyin
```env
PIPER_PATH=C:\piper\piper.exe
PIPER_MODEL=C:\piper\en_US-lessac-medium.onnx
```

## 🎯 SONUÇ
- ✅ `piper.exe` olmalı (şu an YOK!)
- ✅ Model dosyaları olmalı
- ✅ Test başarılı olmalı

## 🆘 SORUN YAŞARSANIZ
Bana şunu gönderin:
```powershell
dir C:\piper
```
