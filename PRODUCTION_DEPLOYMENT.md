# 🚀 Production Deployment Guide - Render.com

## 📋 **ÖNEMLİ: ŞU ANDA PUSH ETME!**

Proje localde çalışıyor ama production için hazır değil. Bu rehberi takip ederek production'a hazırlayalım.

## 🔧 **PRODUCTION HAZIRLIĞI**

### **1. Environment Variables Ayarları**

**Local (.env):**
```bash
NODE_ENV=development
USE_LOCAL_AI=true
TTS_PROVIDER=windows
```

**Production (Render.com):**
```bash
NODE_ENV=production
USE_LOCAL_AI=false
TTS_PROVIDER=huggingface
YOUTUBE_REDIRECT_URI=https://your-app-name.onrender.com/auth/youtube/callback
```

### **2. Ollama Production'da Çalışmayacak**

- ✅ **Local**: Ollama (llama3:8b) çalışıyor
- ❌ **Production**: Ollama kurulu değil, HuggingFace kullanacak

### **3. TTS Production'da Farklı**

- ✅ **Local**: Windows TTS çalışıyor  
- ✅ **Production**: HuggingFace TTS kullanacak

## 🚀 **DEPLOYMENT ADIMLARI**

### **Adım 1: Production Config Test**
```bash
# Local'de production mode test et
NODE_ENV=production USE_LOCAL_AI=false npm start
```

### **Adım 2: GitHub'a Push**
```bash
git add .
git commit -m "Production ready: Environment-based AI/TTS configuration"
git push origin main
```

### **Adım 3: Render.com Setup**
1. New Web Service → Connect GitHub repo
2. Environment Variables ekle (yukarıdaki production değerleri)
3. Deploy et

## ⚠️ **KRİTİK NOKTALAR**

1. **Ollama sadece local'de** - Production'da HuggingFace
2. **Windows TTS sadece local'de** - Production'da HuggingFace TTS
3. **USE_LOCAL_AI=false** production'da
4. **YOUTUBE_REDIRECT_URI** production URL'i

## 🧪 **TEST ET**

Production config'i test etmeden push etme!

---

**Sonraki adım: Production config'i test et, sonra push et!**
