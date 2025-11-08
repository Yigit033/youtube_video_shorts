# 🤖 Ollama Kurulum Kılavuzu

## 🎯 Neden Ollama?

### ✅ Avantajlar:
```
✅ Tamamen ücretsiz
✅ Lokal çalışır (internet gerekmez)
✅ Çok kaliteli scriptler (+300%)
✅ Context awareness
✅ Llama 3, Mistral, Gemma modelleri
✅ API limiti yok
```

### ❌ HuggingFace Sorunu:
```
❌ 410 error (deprecated models)
❌ API limitleri
❌ İnternet gerekli
❌ Yavaş yanıt
```

---

## 🚀 Ollama Kurulumu (Windows)

### 1. **Download ve Kurulum:**
```powershell
# Ollama'yı indir
# https://ollama.ai/download

# Installer'ı çalıştır
# OllamaSetup.exe

# Kurulum tamamlandı!
```

### 2. **Ollama'yı Başlat:**
```powershell
# Yeni terminal aç
ollama serve

# Çıktı:
# Listening on 127.0.0.1:11434
```

### 3. **Model İndir:**
```powershell
# Yeni terminal aç (ollama serve çalışırken)

# Llama 3 (Önerilen) - 4.7GB
ollama pull llama3:8b

# Alternatifler:
# ollama pull mistral:7b    # 4.1GB
# ollama pull gemma:7b      # 5.0GB
# ollama pull llama3:70b    # 40GB (çok güçlü ama yavaş)
```

### 4. **Test:**
```powershell
# Test et
ollama run llama3:8b "Write a short story about technology"

# Başarılı! AI yanıt verdi
```

---

## 🎛️ .env Konfigürasyonu

### Ollama'yı Aktif Et:
```env
# Local AI kullan
USE_LOCAL_AI=true

# Ollama model
OLLAMA_MODEL=llama3:8b

# Ollama URL (default)
OLLAMA_URL=http://localhost:11434

# HuggingFace fallback (opsiyonel)
HUGGINGFACE_API_KEY=your_key_here
```

---

## 🤖 Mevcut Modeller

### Llama 3 (Önerilen) ⭐⭐⭐⭐⭐
```
Model: llama3:8b
Boyut: 4.7GB
Kalite: Mükemmel
Hız: Hızlı (2-5 saniye)
Context: 8K tokens
```

### Mistral ⭐⭐⭐⭐
```
Model: mistral:7b
Boyut: 4.1GB
Kalite: Çok iyi
Hız: Çok hızlı (1-3 saniye)
Context: 8K tokens
```

### Gemma ⭐⭐⭐⭐
```
Model: gemma:7b
Boyut: 5.0GB
Kalite: İyi
Hız: Hızlı (2-4 saniye)
Context: 8K tokens
```

### Llama 3 70B ⭐⭐⭐⭐⭐
```
Model: llama3:70b
Boyut: 40GB
Kalite: Olağanüstü
Hız: Yavaş (10-30 saniye)
Context: 8K tokens
Gereksinim: 32GB+ RAM
```

---

## 📊 Performans Karşılaştırması

### AI Script Kalitesi:

| AI | Kalite | Hız | Maliyet | İnternet |
|----|--------|-----|---------|----------|
| **Ollama (Llama3)** | ⭐⭐⭐⭐⭐ | 2-5s | $0 | ❌ |
| HuggingFace | ⭐⭐⭐⭐ | 5-10s | $0 | ✅ |
| Templates | ⭐⭐⭐ | <1s | $0 | ❌ |

---

## 🎯 Kullanım

### Otomatik Kullanım:
```bash
# 1. Ollama'yı başlat (bir kere)
ollama serve

# 2. Platform'u başlat (yeni terminal)
npm start

# ✅ [AI] Using local Ollama...
# ✅ [AI] Script generated successfully!
```

### Manuel Test:
```javascript
const aiService = require('./services/ai');

// Test
const script = await aiService.generateScript('technology');
// ✅ Ollama kullanılacak
```

---

## 🔧 Sorun Giderme

### Problem: "ECONNREFUSED 127.0.0.1:11434"
```powershell
# Ollama çalışmıyor
# Çözüm: Ollama'yı başlat
ollama serve

# Yeni terminal'de platform'u başlat
npm start
```

### Problem: "Model not found"
```powershell
# Model indirilmemiş
# Çözüm: Model'i indir
ollama pull llama3:8b

# Model listesi
ollama list
```

### Problem: "Out of memory"
```powershell
# RAM yetersiz
# Çözüm: Daha küçük model kullan

# 8GB RAM → llama3:8b
# 16GB RAM → mistral:7b veya llama3:8b
# 32GB+ RAM → llama3:70b
```

### Problem: "Slow response"
```powershell
# Model çok büyük
# Çözüm: Daha küçük model

# llama3:70b → llama3:8b
# veya
# mistral:7b (en hızlı)
```

---

## 📈 Beklenen Sonuçlar

### Öncesi (Templates):
```
📝 Script kalitesi: ⭐⭐⭐
🎯 Context awareness: Yok
⚡ Hız: <1 saniye
💡 Yaratıcılık: Düşük
```

### Sonrası (Ollama):
```
📝 Script kalitesi: ⭐⭐⭐⭐⭐
🎯 Context awareness: Mükemmel
⚡ Hız: 2-5 saniye
💡 Yaratıcılık: Yüksek
```

---

## 💡 Pro Tipler

### 1. **Ollama'yı Arka Planda Çalıştır:**
```powershell
# Windows Service olarak kur
# Otomatik başlasın

# Veya Task Scheduler ile
# Başlangıçta otomatik başlat
```

### 2. **Farklı Modeller Dene:**
```env
# Hız öncelikli
OLLAMA_MODEL=mistral:7b

# Kalite öncelikli
OLLAMA_MODEL=llama3:8b

# En iyi kalite (güçlü PC)
OLLAMA_MODEL=llama3:70b
```

### 3. **Fallback Chain:**
```
Ollama → HuggingFace → Templates
```

---

## 🎉 Kurulum Tamamlandı!

### Test Et:
```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: Platform
npm start

# Dashboard: http://localhost:3000
# Topic: "artificial intelligence"
# Count: 1
```

### Beklenen Çıktı:
```
🤖 [AI] Using local Ollama...
🤖 Ollama: Generating script with llama3:8b...
✅ [AI] Script generated successfully!
📝 Script quality: Excellent
⚡ Generation time: 3.2s
```

---

## 🚀 SONUÇ

**Ollama = En İyi AI Çözümü!**

- ✅ Tamamen ücretsiz
- ✅ Çok kaliteli scriptler
- ✅ Lokal çalışır
- ✅ API limiti yok
- ✅ Kolay kurulum

**Şimdi kur ve AI gücünü kullan! 🤖✨**

---

## 📚 Ek Kaynaklar

### Ollama Komutları:
```powershell
# Model listesi
ollama list

# Model sil
ollama rm llama3:8b

# Model bilgisi
ollama show llama3:8b

# Tüm modeller
ollama pull --help
```

### Önerilen Setup:
```
💻 8GB RAM: mistral:7b
💻 16GB RAM: llama3:8b
💻 32GB+ RAM: llama3:70b
```

**Başarılar! 🚀**
