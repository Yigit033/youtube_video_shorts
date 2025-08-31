#!/bin/bash

# YouTube Shorts Automation - Production Deployment Script
# This script automates the deployment process to Render.com

set -e

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo "🔍 Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is not installed. Please install Git first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met${NC}"
}

# Build Docker image
build_docker() {
    echo "🐳 Building Docker image..."
    
    if docker build -t youtube-shorts-automation .; then
        echo -e "${GREEN}✅ Docker image built successfully${NC}"
    else
        echo -e "${RED}❌ Docker build failed${NC}"
        exit 1
    fi
}

# Test Docker image locally
test_docker() {
    echo "🧪 Testing Docker image locally..."
    
    # Stop any existing container
    docker stop youtube-shorts-automation-test 2>/dev/null || true
    docker rm youtube-shorts-automation-test 2>/dev/null || true
    
    # Run container in background
    docker run -d --name youtube-shorts-automation-test -p 3001:3000 youtube-shorts-automation
    
    # Wait for container to start
    echo "⏳ Waiting for container to start..."
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Local Docker test successful${NC}"
    else
        echo -e "${RED}❌ Local Docker test failed${NC}"
        docker logs youtube-shorts-automation-test
        exit 1
    fi
    
    # Clean up test container
    docker stop youtube-shorts-automation-test
    docker rm youtube-shorts-automation-test
}

# Check Git status
check_git() {
    echo "📝 Checking Git status..."
    
    if [ -z "$(git status --porcelain)" ]; then
        echo -e "${GREEN}✅ Working directory clean${NC}"
    else
        echo -e "${YELLOW}⚠️  Working directory has uncommitted changes${NC}"
        echo "Please commit or stash your changes before deploying"
        exit 1
    fi
    
    if [ -z "$(git branch --show-current)" ]; then
        echo -e "${RED}❌ Not on a branch. Please checkout a branch first.${NC}"
        exit 1
    fi
}

# Deploy to Render.com
deploy_render() {
    echo "☁️  Deploying to Render.com..."
    
    # Check if render.yaml exists
    if [ ! -f "render.yaml" ]; then
        echo -e "${RED}❌ render.yaml not found${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}📋 Manual steps required:${NC}"
    echo "1. Push your code to GitHub:"
    echo "   git push origin main"
    echo ""
    echo "2. Go to https://dashboard.render.com"
    echo "3. Click 'New +' → 'Web Service'"
    echo "4. Connect your GitHub repository"
    echo "5. Select the repository and branch"
    echo "6. Render will automatically detect render.yaml"
    echo "7. Set your environment variables:"
    echo "   - YOUTUBE_CLIENT_ID"
    echo "   - YOUTUBE_CLIENT_SECRET"
    echo "   - PEXELS_API_KEY"
    echo "   - HUGGINGFACE_API_KEY (optional)"
    echo "8. Click 'Create Web Service'"
    echo ""
    echo -e "${GREEN}🎉 Your service will be deployed automatically!${NC}"
}

# Main deployment flow
main() {
    echo "=========================================="
    echo "🎬 YouTube Shorts Automation"
    echo "🚀 Production Deployment Script"
    echo "=========================================="
    echo ""
    
    check_requirements
    check_git
    build_docker
    test_docker
    deploy_render
    
    echo ""
    echo -e "${GREEN}✅ Deployment preparation completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push code to GitHub"
    echo "2. Deploy on Render.com"
    echo "3. Configure environment variables"
    echo "4. Test your production service"
}

# Run main function
main "$@"
