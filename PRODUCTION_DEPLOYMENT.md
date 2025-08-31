# 🚀 Production Deployment Guide

## Overview

This guide will help you deploy the YouTube Shorts Automation Platform to production using Render.com with Docker support.

## 🎯 What We've Built

### ✅ Production-Ready Features
- **Docker Containerization** - Consistent environment across all deployments
- **Production Security** - Helmet, rate limiting, CORS protection
- **Health Monitoring** - Comprehensive health check endpoints
- **Environment Management** - Production vs Development configuration
- **Logging & Monitoring** - Production-grade logging with Morgan
- **Performance Optimization** - Compression, optimized middleware

### 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                   │
├─────────────────────────────────────────────────────────────┤
│  Render.com (Free Tier)                                    │
│  ├── Docker Container                                      │
│  │   ├── Node.js 18 + FFmpeg + Ollama                     │
│  │   ├── Production Security Middleware                    │
│  │   ├── Health Check Endpoints                            │
│  │   └── Optimized TTS & AI Services                      │
│  └── Auto-deploy from GitHub                               │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Prerequisites

### Required Tools
- [Docker](https://docs.docker.com/get-docker/) - Containerization
- [Git](https://git-scm.com/) - Version control
- [Node.js](https://nodejs.org/) - Local development (v16+)
- [FFmpeg](https://ffmpeg.org/download.html) - Local testing

### Required Accounts
- [GitHub](https://github.com/) - Code repository
- [Render.com](https://render.com/) - Free hosting
- [Google Cloud Console](https://console.cloud.google.com/) - YouTube API
- [Pexels](https://www.pexels.com/api/) - Stock videos

## 🚀 Quick Deployment

### 1. Automated Deployment Script
```bash
# Make script executable
chmod +x scripts/deploy.sh

# Run deployment script
./scripts/deploy.sh
```

### 2. Manual Deployment Steps
```bash
# Build Docker image
npm run docker:build

# Test locally
npm run docker:compose

# Push to GitHub
git add .
git commit -m "Production deployment ready"
git push origin main
```

## ☁️ Render.com Setup

### 1. Create Account
- Go to [Render.com](https://render.com/)
- Sign up with GitHub account

### 2. Deploy Service
- Click "New +" → "Web Service"
- Connect GitHub repository
- Select repository and branch
- Render will auto-detect `render.yaml`

### 3. Environment Variables
Set these in Render.com dashboard:
```bash
NODE_ENV=production
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
PEXELS_API_KEY=your_pexels_key
HUGGINGFACE_API_KEY=your_hf_key (optional)
```

## 🔧 Configuration

### Production Environment
```bash
# config/production.js
NODE_ENV: 'production'
TTS_PRIORITY: 'edge,local,fallback'
AI_PRIORITY: 'ollama,template,fallback'
RATE_LIMIT_MAX_REQUESTS: 100
```

### Security Features
- **Helmet.js** - Security headers
- **Rate Limiting** - 100 requests per 15 minutes
- **CORS Protection** - Origin validation
- **Input Validation** - Request size limits
- **Error Handling** - Production-safe error messages

## 📊 Monitoring & Health Checks

### Health Endpoints
```bash
# Basic health check
GET /health

# Detailed system info
GET /health/detailed
```

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "memory": {
    "used": 45,
    "total": 128
  },
  "services": {
    "tempDirectories": {
      "audio": { "exists": true, "writable": true },
      "videos": { "exists": true, "writable": true },
      "output": { "exists": true, "writable": true }
    }
  }
}
```

## 🐳 Docker Commands

### Local Development
```bash
# Build image
docker build -t youtube-shorts-automation .

# Run container
docker run -p 3000:3000 youtube-shorts-automation

# Run with docker-compose
docker-compose up --build
```

### Production
```bash
# Build production image
docker build -t youtube-shorts-automation:prod .

# Run production container
docker run -d \
  --name youtube-shorts-prod \
  -p 3000:3000 \
  -e NODE_ENV=production \
  youtube-shorts-automation:prod
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Docker Build Fails
```bash
# Check Docker daemon
docker info

# Clean up images
docker system prune -a

# Rebuild without cache
docker build --no-cache -t youtube-shorts-automation .
```

#### 2. Container Won't Start
```bash
# Check container logs
docker logs youtube-shorts-automation

# Check container status
docker ps -a

# Run with interactive mode
docker run -it youtube-shorts-automation /bin/bash
```

#### 3. Health Check Fails
```bash
# Test health endpoint locally
curl -f http://localhost:3000/health

# Check environment variables
docker exec youtube-shorts-automation env | grep NODE_ENV

# Verify port binding
docker port youtube-shorts-automation
```

### Performance Issues
```bash
# Monitor container resources
docker stats youtube-shorts-automation

# Check memory usage
docker exec youtube-shorts-automation free -h

# Monitor logs
docker logs -f youtube-shorts-automation
```

## 📈 Scaling & Optimization

### Render.com Free Tier Limits
- **750 hours/month** - Sufficient for personal use
- **512MB RAM** - Optimize memory usage
- **Shared CPU** - Handle concurrent requests efficiently

### Optimization Tips
1. **Memory Management** - Monitor heap usage
2. **Request Batching** - Group API calls
3. **Caching** - Cache TTS and AI responses
4. **Cleanup** - Regular temp file cleanup

## 🔐 Security Best Practices

### Environment Variables
- Never commit `.env` files
- Use Render.com environment variables
- Rotate API keys regularly

### Network Security
- HTTPS only in production
- CORS origin validation
- Rate limiting enabled

### Input Validation
- Request size limits
- File type validation
- Sanitize user inputs

## 📚 Additional Resources

### Documentation
- [Render.com Docs](https://render.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Production](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

### Support
- [GitHub Issues](https://github.com/yourusername/youtube-shorts-automation/issues)
- [Render.com Support](https://render.com/docs/help)

## 🎉 Success Checklist

- [ ] Docker image builds successfully
- [ ] Local Docker test passes
- [ ] Code pushed to GitHub
- [ ] Render.com service created
- [ ] Environment variables configured
- [ ] Health check endpoint responds
- [ ] YouTube authentication works
- [ ] Video generation successful
- [ ] Production monitoring active

---

**🎬 Your YouTube Shorts Automation Platform is now production-ready!**

Deploy with confidence and start creating amazing content automatically! 🚀
