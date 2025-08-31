// YouTube Shorts Automation Frontend
class ShortsAutomation {
    constructor() {
        this.currentJobId = null;
        this.pollInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.checkSystemStatus();
    }

    setupEventListeners() {
        const form = document.getElementById('shorts-form');
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/youtube/auth-status');
            const data = await response.json();
            this.updateAuthStatus(data.authenticated);
        } catch (error) {
            console.error('Failed to check auth status:', error);
            this.updateAuthStatus(false, 'Connection error');
        }
    }

    updateAuthStatus(authenticated, error = null) {
        const authContent = document.getElementById('auth-content');
        
        if (error) {
            authContent.innerHTML = `
                <div class="flex items-center text-red-600">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>Error: ${error}</span>
                </div>
            `;
            return;
        }

        if (authenticated) {
            authContent.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center text-green-600">
                        <i class="fas fa-check-circle mr-2"></i>
                        <span>Connected to YouTube</span>
                    </div>
                    <span class="text-sm text-gray-500">Ready to upload</span>
                </div>
            `;
        } else {
            authContent.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center text-yellow-600">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span>YouTube not connected</span>
                    </div>
                    <button onclick="authenticateYouTube()" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                        <i class="fab fa-youtube mr-1"></i>
                        Connect
                    </button>
                </div>
            `;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            topic: formData.get('topic'),
            count: parseInt(formData.get('count')),
            publishDate: formData.get('publishDate') || null
        };

        if (!data.topic.trim()) {
            this.showError('Please enter a topic');
            return;
        }

        try {
            this.startGeneration();
            
            const response = await fetch('/api/generate-shorts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (response.ok) {
                this.currentJobId = result.jobId;
                this.startPolling();
            } else {
                throw new Error(result.error || 'Failed to start generation');
            }
            
        } catch (error) {
            this.showError(error.message);
            this.resetUI();
        }
    }

    startGeneration() {
        // Hide idle state and show progress
        document.getElementById('idle-state').classList.add('hidden');
        document.getElementById('progress-container').classList.remove('hidden');
        document.getElementById('results-container').classList.add('hidden');
        
        // Disable form
        const generateBtn = document.getElementById('generate-btn');
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
    }

    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        this.pollInterval = setInterval(() => {
            this.checkJobStatus();
        }, 2000); // Check every 2 seconds
    }

    async checkJobStatus() {
        if (!this.currentJobId) return;

        try {
            const response = await fetch(`/api/job-status/${this.currentJobId}`);
            const status = await response.json();

            this.updateProgress(status);

            if (status.status === 'completed' || status.status === 'error') {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
                
                if (status.status === 'completed') {
                    this.showResults(status.videos);
                } else {
                    this.showError(status.errors.join(', ') || 'Generation failed');
                }
                
                this.resetUI();
            }
        } catch (error) {
            console.error('Error checking job status:', error);
        }
    }

    updateProgress(status) {
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const currentStep = document.getElementById('current-step');

        progressBar.style.width = `${status.progress || 0}%`;
        progressPercent.textContent = `${status.progress || 0}%`;
        currentStep.innerHTML = `
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span>${status.currentStep || 'Processing...'}</span>
        `;
    }

    showResults(videos) {
        const resultsContainer = document.getElementById('results-container');
        const videoResults = document.getElementById('video-results');
        
        videoResults.innerHTML = videos.map(video => `
            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h5 class="font-medium text-gray-800">${video.title}</h5>
                        <p class="text-sm text-gray-500 mt-1">Video ID: ${video.videoId}</p>
                    </div>
                    <a 
                        href="${video.url}" 
                        target="_blank" 
                        class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                    >
                        <i class="fab fa-youtube mr-1"></i>
                        View
                    </a>
                </div>
            </div>
        `).join('');

        resultsContainer.classList.remove('hidden');
        
        // Hide progress and show success message
        document.getElementById('progress-container').classList.add('hidden');
        document.getElementById('current-step').innerHTML = `
            <i class="fas fa-check-circle text-green-500 mr-2"></i>
            <span class="text-green-600">All videos completed successfully!</span>
        `;
    }

    showError(message) {
        const currentStep = document.getElementById('current-step');
        currentStep.innerHTML = `
            <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
            <span class="text-red-600">Error: ${message}</span>
        `;
    }

    resetUI() {
        const generateBtn = document.getElementById('generate-btn');
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-rocket mr-2"></i>Generate & Upload Shorts';
    }

    async checkSystemStatus() {
        const services = ['ai', 'tts', 'pexels', 'ffmpeg'];
        
        for (const service of services) {
            try {
                const response = await fetch(`/api/test/${service}`);
                const result = await response.json();
                this.updateServiceStatus(service, result.success, result.error);
            } catch (error) {
                this.updateServiceStatus(service, false, 'Connection failed');
            }
        }
    }

    updateServiceStatus(service, success, error = null) {
        const statusElement = document.getElementById(`${service}-status`);
        
        if (success) {
            statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>Ready</span>';
        } else {
            statusElement.innerHTML = `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>Error</span>`;
            if (error) {
                statusElement.title = error;
            }
        }
    }
}

// Global functions
async function authenticateYouTube() {
    try {
        const response = await fetch('/api/youtube/auth');
        const data = await response.json();
        
        if (data.authUrl) {
            window.open(data.authUrl, 'youtube-auth', 'width=600,height=600');
            
            // Listen for auth completion
            window.addEventListener('message', (event) => {
                if (event.data.type === 'youtube-auth-complete') {
                    location.reload(); // Refresh to update auth status
                }
            });
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Failed to start authentication process');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ShortsAutomation();
});