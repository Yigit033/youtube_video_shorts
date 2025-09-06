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
        this.setupMusicSelection();
        
        // Set up periodic auth check (every 60 seconds)
        setInterval(() => {
            this.checkAuthStatus();
        }, 60000);
    }

    setupEventListeners() {
        // AI Generation form
        const aiForm = document.getElementById('shorts-form');
        aiForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Professional upload form
        const uploadForm = document.getElementById('professional-form');
        uploadForm.addEventListener('submit', (e) => this.handleProfessionalSubmit(e));
        
        // Mode selection
        document.getElementById('ai-mode-btn').addEventListener('click', () => {
            console.log('🔄 Switching to AI mode');
            this.switchMode('ai');
        });
        document.getElementById('upload-mode-btn').addEventListener('click', () => {
            console.log('🔄 Switching to Upload mode');
            this.switchMode('upload');
        });
        
        // Video upload
        this.setupVideoUpload();
    }

    switchMode(mode) {
        console.log(`🔄 Switching to ${mode} mode`);
        const aiForm = document.getElementById('ai-form');
        const uploadForm = document.getElementById('upload-form');
        const aiBtn = document.getElementById('ai-mode-btn');
        const uploadBtn = document.getElementById('upload-mode-btn');
        
        console.log('📋 Elements found:', {
            aiForm: !!aiForm,
            uploadForm: !!uploadForm,
            aiBtn: !!aiBtn,
            uploadBtn: !!uploadBtn
        });
        
        if (mode === 'ai') {
            console.log('✅ Showing AI form, hiding upload form');
            aiForm.classList.remove('hidden');
            uploadForm.classList.add('hidden');
            aiBtn.classList.add('bg-blue-50', 'border-blue-200');
            aiBtn.classList.remove('border-gray-200');
            uploadBtn.classList.remove('bg-purple-50', 'border-purple-200');
            uploadBtn.classList.add('border-gray-200');
        } else {
            console.log('✅ Showing upload form, hiding AI form');
            aiForm.classList.add('hidden');
            uploadForm.classList.remove('hidden');
            uploadBtn.classList.add('bg-purple-50', 'border-purple-200');
            uploadBtn.classList.remove('border-gray-200');
            aiBtn.classList.remove('bg-blue-50', 'border-blue-200');
            aiBtn.classList.add('border-gray-200');
        }
    }

    setupVideoUpload() {
        const uploadInput = document.getElementById('video-upload');
        const uploadArea = document.getElementById('upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        const videoPreview = document.getElementById('video-preview');
        const videoInfo = document.getElementById('video-info');
        const removeBtn = document.getElementById('remove-video');

        // Click to upload
        uploadArea.addEventListener('click', () => uploadInput.click());
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-purple-400', 'bg-purple-50');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-purple-400', 'bg-purple-50');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-purple-400', 'bg-purple-50');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleVideoFile(files[0]);
            }
        });

        // File input change
        uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleVideoFile(e.target.files[0]);
            }
        });

        // Remove video
        removeBtn.addEventListener('click', () => {
            uploadInput.value = '';
            uploadArea.classList.remove('hidden');
            uploadPreview.classList.add('hidden');
        });

        // Toggle subtitle options based on checkbox
        document.getElementById('add-subtitles').addEventListener('change', (e) => {
            const subtitleOptions = document.getElementById('subtitle-options');
            if (e.target.checked) {
                subtitleOptions.classList.remove('hidden');
            } else {
                subtitleOptions.classList.add('hidden');
            }
        });
    }

    handleVideoFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('Please select a video file');
            return;
        }

        const uploadArea = document.getElementById('upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        const videoPreview = document.getElementById('video-preview');
        const videoInfo = document.getElementById('video-info');

        // Show preview
        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        
        // Show file info
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        videoInfo.textContent = `${file.name} (${sizeInMB} MB)`;
        
        uploadArea.classList.add('hidden');
        uploadPreview.classList.remove('hidden');
    }

    async checkAuthStatus() {
        try {
            console.log('🔍 Checking authentication status...');
            const response = await fetch('/api/youtube/auth-status');
            const data = await response.json();
            console.log('✅ Auth status received:', data.authenticated);
            this.updateAuthStatus(data.authenticated);
        } catch (error) {
            console.error('❌ Failed to check auth status:', error);
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

    async handleProfessionalSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const videoFile = document.getElementById('video-upload').files[0];
        
        if (!videoFile) {
            alert('Please select a video file');
            return;
        }

        try {
            this.showProgress('Uploading video...');
            this.updateProgress({ progress: 0, currentStep: 'Uploading video...' });

            // Upload video
            const uploadFormData = new FormData();
            uploadFormData.append('video', videoFile);
            
            const uploadResponse = await fetch('/upload/video', {
                method: 'POST',
                body: uploadFormData
            });

            const uploadResult = await uploadResponse.json();
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Upload failed');
            }

            this.updateProgress({ progress: 20, currentStep: 'Analyzing video content...' });

            // Process video professionally
            const processData = {
                videoId: uploadResult.videoId,
                contentBrief: formData.get('contentBrief'),
                targetFormat: formData.get('targetFormat'),
                musicStyle: document.getElementById('music-style').value,
                musicSelection: document.getElementById('music-selection').value,
                selectedMusicId: document.querySelector('input[name="music-option"]:checked')?.value || null,
                colorGrading: document.getElementById('color-grading').value,
                addSubtitles: document.getElementById('add-subtitles').checked,
                addMusic: document.getElementById('add-music').checked,
                batchExport: document.getElementById('batch-export').checked,
                subtitleStyle: document.getElementById('subtitle-style').value
            };

            // Debug checkbox values
            console.log('🔍 [Frontend] Checkbox values:');
            console.log('  - addSubtitles:', processData.addSubtitles, 'type:', typeof processData.addSubtitles);
            console.log('  - addMusic:', processData.addMusic, 'type:', typeof processData.addMusic);
            console.log('  - batchExport:', processData.batchExport, 'type:', typeof processData.batchExport);

            const processResponse = await fetch('/api/process-professional', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(processData)
            });

            const processResult = await processResponse.json();
            
            if (processResult.success) {
                this.updateProgress({ progress: 100, currentStep: 'Video processing complete!' });
                this.showProfessionalResults(processResult);
            } else {
                throw new Error(processResult.error || 'Processing failed');
            }

        } catch (error) {
            console.error('Professional processing failed:', error);
            this.showError('Failed to process video: ' + error.message);
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

    // Show progress UI for professional flow
    showProgress(initialStep = 'Initializing...') {
        document.getElementById('idle-state').classList.add('hidden');
        document.getElementById('progress-container').classList.remove('hidden');
        document.getElementById('results-container').classList.add('hidden');

        const processBtn = document.getElementById('process-btn');
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        }

        this.updateProgress({ progress: 0, currentStep: initialStep });
    }

    // Show results for professional flow
    showProfessionalResults(result) {
        const resultsContainer = document.getElementById('results-container');
        const videoResults = document.getElementById('video-results');

        const links = [];
        if (result.processedVideo) {
            links.push({ title: 'Processed Video', url: result.processedVideo });
        }
        if (result.exports) {
            Object.entries(result.exports).forEach(([format, url]) => {
                if (url) links.push({ title: `Export: ${format.toUpperCase()}`, url });
            });
        }

        videoResults.innerHTML = links.map(item => `
            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1">
                        <h5 class="font-medium text-gray-800">${item.title}</h5>
                        <video src="${item.url}" controls class="w-full mt-2 rounded"></video>
                    </div>
                    <div class="flex flex-col gap-2 min-w-[220px]">
                        <a href="${item.url}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm text-center hover:bg-blue-700 transition-colors">
                            <i class="fas fa-eye mr-1"></i> Preview
                        </a>
                        <button class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors" onclick='openUploadDialog(${JSON.stringify({}).replace(/"/g, "&quot;")});' data-url="${item.url}" data-title="${item.title}">
                            <i class="fab fa-youtube mr-1"></i> Upload to YouTube
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        resultsContainer.classList.remove('hidden');

        const processBtn = document.getElementById('process-btn');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>Process & Enhance Video';
        }
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

    // Setup music selection functionality
    setupMusicSelection() {
        const musicStyleSelect = document.getElementById('music-style');
        const musicSelectionSelect = document.getElementById('music-selection');
        const musicOptionsContainer = document.getElementById('music-options-container');

        // Load music options when music style changes
        if (musicStyleSelect) {
            musicStyleSelect.addEventListener('change', async () => {
                const mood = musicStyleSelect.value;
                if (mood !== 'auto') {
                    await this.loadMusicOptions(mood);
                } else {
                    musicOptionsContainer.classList.add('hidden');
                }
            });
        }

        // Show/hide music options based on selection
        if (musicSelectionSelect) {
            musicSelectionSelect.addEventListener('change', () => {
                const selection = musicSelectionSelect.value;
                if (selection === 'auto' || selection === 'none') {
                    musicOptionsContainer.classList.add('hidden');
                } else {
                    musicOptionsContainer.classList.remove('hidden');
                    // Load music options for the selected mood
                    this.loadMusicOptions(selection);
                }
            });
        }
    }

    // Load music options from the server
    async loadMusicOptions(mood) {
        try {
            const response = await fetch(`/api/music-options?mood=${mood}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayMusicOptions(data.musicOptions);
            } else {
                console.error('Failed to load music options:', data.error);
            }
        } catch (error) {
            console.error('Error loading music options:', error);
        }
    }

    // Display music options in the UI (YouTube Audio Library style)
    displayMusicOptions(musicOptions) {
        const musicOptionsList = document.getElementById('music-options-list');
        if (!musicOptionsList) return;
        
        musicOptionsList.innerHTML = '';

        musicOptions.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
            
            optionElement.innerHTML = `
                <input type="radio" name="music-option" value="${option.id}" id="music-${option.id}" class="text-blue-600 focus:ring-blue-500">
                <label for="music-${option.id}" class="flex-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                        <div class="text-sm font-medium text-gray-900">${option.title}</div>
                        <div class="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">${option.duration || '30s'}</div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                        <span class="inline-block bg-gray-100 px-2 py-1 rounded mr-2">${option.genre || 'Music'}</span>
                        <span class="text-gray-400">${option.source}</span>
                    </div>
                </label>
            `;

            // Select first option by default
            if (index === 0) {
                optionElement.querySelector('input').checked = true;
            }

            musicOptionsList.appendChild(optionElement);
        });

        // Show the container
        const container = document.getElementById('music-options-container');
        if (container) {
            container.classList.remove('hidden');
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

// Upload dialog logic
let pendingUpload = { url: '', title: '' };
function openUploadDialog(item) {
    const btn = event.currentTarget;
    const url = btn.getAttribute('data-url');
    const title = btn.getAttribute('data-title') || 'My Video';
    pendingUpload = { url, title };

    // Pre-fill with AI suggestions endpoint later; for now show placeholders then fill after fetch
    document.getElementById('ud-title').value = 'Generating...';
    document.getElementById('ud-description').value = 'Generating...';
    document.getElementById('ud-tags').value = '';
    document.getElementById('ud-datetime').value = '';

    const dlg = document.getElementById('upload-dialog');
    dlg.classList.remove('hidden');
    dlg.classList.add('flex');

    // Fetch AI metadata suggestions (server will use SEO service)
    fetch('/api/ai-metadata-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: title || 'video content' })
    }).then(r => r.json()).then(s => {
        if (s && s.success) {
            document.getElementById('ud-title').value = s.data.title || title;
            document.getElementById('ud-description').value = s.data.description || '';
            document.getElementById('ud-tags').value = Array.isArray(s.data.tags) ? s.data.tags.join(', ') : '';
        } else {
            document.getElementById('ud-title').value = title;
            document.getElementById('ud-description').value = '';
        }
    }).catch(() => {
        document.getElementById('ud-title').value = title;
        document.getElementById('ud-description').value = '';
    });
}

document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'ud-cancel') {
        const dlg = document.getElementById('upload-dialog');
        dlg.classList.add('hidden');
        dlg.classList.remove('flex');
    }
    if (e.target && e.target.id === 'ud-confirm') {
        try {
            const title = document.getElementById('ud-title').value || pendingUpload.title;
            const description = document.getElementById('ud-description').value || '';
            const tags = document.getElementById('ud-tags').value || '';
            const scheduleISO = document.getElementById('ud-datetime').value || null;

            const payload = {
                fileUrl: pendingUpload.url,
                title,
                description,
                tags,
                scheduleISO,
                isShort: true
            };

            const resp = await fetch('/api/upload-to-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.error || 'Upload failed');

            // Show detailed success message
            const successMessage = `🎉 VIDEO UPLOAD SUCCESSFUL! 🎉\n\n` +
                `📺 Title: ${data.title || 'Your Video'}\n` +
                `🔗 URL: ${data.url || 'Processing...'}\n` +
                `📊 Video ID: ${data.videoId || 'N/A'}\n` +
                `⏰ Upload Time: ${new Date().toLocaleString()}\n` +
                `📱 Status: ${data.status === 'scheduled' ? 'Scheduled for ' + new Date(data.publishAt).toLocaleString() : 'Published Now'}\n\n` +
                `✨ Your video is ready to go viral! 🚀`;
            
            alert(successMessage);
            
            // Optional: Open the video in a new tab if URL is available
            if (data.url && confirm('Would you like to open your video on YouTube?')) {
                window.open(data.url, '_blank');
            }
        } catch (err) {
            alert('❌ Upload failed: ' + err.message);
        } finally {
            const dlg = document.getElementById('upload-dialog');
            dlg.classList.add('hidden');
            dlg.classList.remove('flex');
        }
    }
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ShortsAutomation();
});