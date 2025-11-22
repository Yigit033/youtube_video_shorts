# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    python3-dev \
    py3-pip \
    make \
    g++ \
    curl \
    bash \
    git \
    espeak \
    festival \
    flite \
    linux-headers

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Create Python virtual environment for Coqui TTS
RUN python3 -m venv /app/venv

# Activate venv and install Coqui TTS dependencies
ENV PATH="/app/venv/bin:$PATH"
RUN pip install --upgrade pip setuptools wheel && \
    pip install TTS && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy application code
COPY . .

# Ensure Python script is executable
RUN chmod +x /app/services/coqui_tts_api_runner.py

# Create necessary directories
RUN mkdir -p temp/audio temp/videos temp/output logs temp/uploads temp/watermarked

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_PATH=/app/venv/bin/python3

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
