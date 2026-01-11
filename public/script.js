// YouTube Shorts Automation Frontend
class ShortsAutomation {
    constructor() {
        this.currentJobId = null;
        this.pollInterval = null;
        this.mediaCounter = 0;
        // Store accounts data for re-upload feature
        this.accounts = [];
        this.currentAccount = null;
        // Performance optimization: Debounce render operations
        this.renderDebounceTimer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.checkInstagramAuthStatus(); // NEW: Check Instagram auth status
        this.checkTikTokAuthStatus(); // NEW: Check TikTok auth status
        this.checkSystemStatus();
        this.setupMusicSelection();
        this.loadPiperVoices(); // Load Piper voices on init
        this.loadCoquiVoices(); // Load Coqui voices on init
        this.loadXTTSVoices(); // Load XTTS-v2 voices on init
        
        // Check for OAuth callback in URL (redirect-based auth)
        this.handleOAuthCallback();
        this.handleInstagramOAuthCallback(); // NEW: Handle Instagram OAuth callback
        this.handleTikTokOAuthCallback(); // NEW: Handle TikTok OAuth callback
        
        // Set up periodic auth check (every 60 seconds)
        setInterval(() => {
            this.checkAuthStatus();
            this.checkInstagramAuthStatus(); // NEW: Check Instagram auth periodically
            this.checkTikTokAuthStatus(); // NEW: Check TikTok auth periodically
        }, 60000);
        
        // Initialize duration display
        setTimeout(() => {
            this.updateDurationDisplay();
        }, 500); // Small delay to ensure DOM is ready
    }
    
    // NEW: Handle OAuth callback from redirect
    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        const platform = urlParams.get('platform');
        
        // Handle YouTube OAuth callback
        if (authStatus === 'success' && (!platform || platform === 'youtube')) {
            const accountId = urlParams.get('accountId');
            const channel = urlParams.get('channel');
            console.log(`✅ YouTube authentication successful: ${channel || accountId}`);
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Refresh auth status
            this.checkAuthStatus();
        } else if (authStatus === 'error' && (!platform || platform === 'youtube')) {
            const message = urlParams.get('message');
            console.error('❌ YouTube authentication failed:', message);
            alert('Authentication failed: ' + (message || 'Unknown error'));
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // NEW: Handle Instagram OAuth callback
    handleInstagramOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        const platform = urlParams.get('platform');
        
        if (authStatus === 'success' && platform === 'instagram') {
            const accountId = urlParams.get('accountId');
            const username = urlParams.get('username');
            console.log(`✅ Instagram authentication successful: @${username || accountId}`);
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Refresh auth status
            this.checkInstagramAuthStatus();
        } else if (authStatus === 'error' && platform === 'instagram') {
            const message = urlParams.get('message');
            console.error('❌ Instagram authentication failed:', message);
            alert('Instagram authentication failed: ' + (message || 'Unknown error'));
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
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
        
        // Refresh voices button (Piper)
        const refreshVoicesBtn = document.getElementById('refresh-voices-btn');
        if (refreshVoicesBtn) {
            refreshVoicesBtn.addEventListener('click', () => {
                this.loadPiperVoices();
            });
        }

        // Refresh XTTS voices button
        const refreshXTTSVoicesBtn = document.getElementById('refresh-xtts-voices-btn');
        if (refreshXTTSVoicesBtn) {
            refreshXTTSVoicesBtn.addEventListener('click', () => {
                this.loadXTTSVoices();
            });
        }

        // Refresh Coqui voices button
        const refreshCoquiVoicesBtn = document.getElementById('refresh-coqui-voices-btn');
        if (refreshCoquiVoicesBtn) {
            refreshCoquiVoicesBtn.addEventListener('click', () => {
                this.loadCoquiVoices();
            });
        }

        // TTS Provider selection - Show/hide voice sections
        const ttsProviderSelect = document.getElementById('tts-provider');
        if (ttsProviderSelect) {
            ttsProviderSelect.addEventListener('change', (e) => {
                this.handleTTSProviderChange(e.target.value);
            });
            // Initialize visibility on page load
            this.handleTTSProviderChange(ttsProviderSelect.value);
        }
        
        // Step Wizard Navigation
        this.currentStep = 1;
        this.totalSteps = 4;
        this.initStepWizard();

        // Custom input mode toggle
        const customInputMode = document.getElementById('custom-input-mode');
        if (customInputMode) {
            customInputMode.addEventListener('change', (e) => {
                this.handleModeToggle(e.target.checked);
                // Update duration display when mode changes
                this.updateDurationDisplay();
                // If on Step 2, update visibility immediately
                if (this.currentStep === 2) {
                    const customInputSection = document.getElementById('custom-input-section');
                    const aiMediaSection = document.getElementById('ai-media-section');
                    if (e.target.checked) {
                        if (customInputSection) customInputSection.classList.remove('hidden');
                        if (aiMediaSection) aiMediaSection.classList.add('hidden');
                    } else {
                        if (customInputSection) customInputSection.classList.add('hidden');
                        if (aiMediaSection) aiMediaSection.classList.remove('hidden');
                    }
                }
            });
        }
        
        // Preset buttons event listeners
        this.setupPresetButtons();
        
        // Custom images preview
        const customImages = document.getElementById('custom-images');
        if (customImages) {
            customImages.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    // Show loading indicator
                    const preview = document.getElementById('media-preview');
                    if (preview) {
                        preview.innerHTML = '<div class="col-span-4 text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600">Processing images...</p></div>';
                    }
                    await this.handleImageUpload(e.target.files);
                }
            });
        }
        
        // Custom videos preview
        const customVideos = document.getElementById('custom-videos');
        if (customVideos) {
            customVideos.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    // Show loading indicator
                    const preview = document.getElementById('media-preview');
                    if (preview) {
                        preview.innerHTML = '<div class="col-span-4 text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600">Processing videos...</p></div>';
                    }
                    await this.handleVideoUpload(e.target.files);
                }
            });
        }
        
        // Update video duration control when custom input mode changes
        if (customInputMode) {
            customInputMode.addEventListener('change', (e) => {
                if (!e.target.checked) {
                    this.updateVideoDurationControl(0);
                } else if (this.mediaFiles && this.mediaFiles.length > 0) {
                    this.updateVideoDurationControl(this.mediaFiles.length);
                }
                this.updateDurationDisplay(); // NEW: Update duration display
            });
        }
        
        // NEW: Script textarea event listener for real-time duration calculation
        const customScript = document.getElementById('custom-script');
        if (customScript) {
            customScript.addEventListener('input', () => {
                this.updateDurationDisplay();
            });
            // Also update on paste
            customScript.addEventListener('paste', () => {
                setTimeout(() => this.updateDurationDisplay(), 10);
            });
        }

        // JSON Import functionality
        this.setupJSONImport();
        
        // Show/hide thumbnail upload section based on video format
        const videoFormatSelect = document.getElementById('video-format');
        const thumbnailSection = document.getElementById('thumbnail-upload-section');
        const thumbnailInput = document.getElementById('custom-thumbnail');
        const thumbnailPreview = document.getElementById('thumbnail-preview');
        const thumbnailPreviewImg = document.getElementById('thumbnail-preview-img');
        
        if (videoFormatSelect && thumbnailSection) {
            // Initial state
            this.updateThumbnailSectionVisibility(videoFormatSelect.value, thumbnailSection);
            this.updateCrossPostInstagramVisibility(videoFormatSelect.value); // NEW: Update cross-post visibility
            
            // Update on change
            videoFormatSelect.addEventListener('change', (e) => {
                this.updateThumbnailSectionVisibility(e.target.value, thumbnailSection);
                this.updateCrossPostInstagramVisibility(e.target.value); // NEW: Update cross-post visibility
            });
        }
        
        // Thumbnail preview
        if (thumbnailInput && thumbnailPreview && thumbnailPreviewImg) {
            thumbnailInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        thumbnailPreviewImg.src = event.target.result;
                        thumbnailPreview.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                } else {
                    thumbnailPreview.classList.add('hidden');
                }
            });
        }
    }
    
    updateThumbnailSectionVisibility(videoFormat, thumbnailSection) {
        if (videoFormat === 'youtube') {
            thumbnailSection.classList.remove('hidden');
        } else {
            thumbnailSection.classList.add('hidden');
            // Clear thumbnail input when hidden
            const thumbnailInput = document.getElementById('custom-thumbnail');
            if (thumbnailInput) {
                thumbnailInput.value = '';
            }
            const thumbnailPreview = document.getElementById('thumbnail-preview');
            if (thumbnailPreview) {
                thumbnailPreview.classList.add('hidden');
            }
        }
    }

    // NEW: Update cross-post to Instagram visibility based on video format
    updateCrossPostInstagramVisibility(videoFormat) {
        const crossPostSection = document.getElementById('cross-post-instagram-section');
        const crossPostCheckbox = document.getElementById('cross-post-instagram');
        const crossPostWarning = document.getElementById('cross-post-warning');
        
        if (!crossPostSection || !crossPostCheckbox) return;
        
        if (videoFormat === 'shorts') {
            // Shorts format: Enable cross-posting
            crossPostSection.classList.remove('opacity-50');
            crossPostCheckbox.disabled = false;
            crossPostCheckbox.checked = false; // Reset checkbox when switching
            if (crossPostWarning) {
                crossPostWarning.classList.add('hidden');
            }
        } else {
            // Normal YouTube video: Disable cross-posting (Instagram Reels limit: 90 seconds)
            crossPostSection.classList.add('opacity-50');
            crossPostCheckbox.disabled = true;
            crossPostCheckbox.checked = false; // Uncheck when disabled
            if (crossPostWarning) {
                crossPostWarning.classList.remove('hidden');
            }
        }
    }
    
    // Initialize mediaFiles array (replaces imageFiles)
    initMediaFiles() {
        if (!this.mediaFiles) {
            this.mediaFiles = [];
        }
        if (typeof this.mediaCounter !== 'number') {
            this.mediaCounter = 0;
        }
    }
    
    /**
     * Create optimized thumbnail from image file (max 200x200px for performance)
     * @param {File} file - Image file
     * @returns {Promise<string>} - Base64 thumbnail data URL
     */
    async createImageThumbnail(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate optimal thumbnail size (max 200x200px)
                    const maxSize = 200;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height = (height * maxSize) / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = (width * maxSize) / height;
                            height = maxSize;
                        }
                    }
                    
                    // Create canvas with optimized size
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw resized image (better quality with imageSmoothingEnabled)
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to JPEG with 0.85 quality (good balance)
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.85);
                    
                    // Cleanup
                    img.src = '';
                    resolve(thumbnail);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async handleImageUpload(files) {
        this.initMediaFiles();
        
        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        
        if (newFiles.length > 0) {
            // CRITICAL: Process files in order to preserve upload sequence
            const startOrder = this.mediaFiles.length;
            
            // Show loading indicator
            const mediaPreview = document.getElementById('media-preview');
            if (mediaPreview) {
                mediaPreview.innerHTML = `<div class="col-span-4 text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600">Processing ${newFiles.length} image${newFiles.length > 1 ? 's' : ''}...</p></div>`;
            }
            
            // OPTIMIZED: Process all files in parallel for speed, but maintain order
            const processingPromises = newFiles.map((file, i) => {
                const order = startOrder + i;
                return this.createImageThumbnail(file)
                    .then(preview => ({
                        id: `media_${Date.now()}_${this.mediaCounter++}`,
                        file: file,
                        type: 'image',
                        order: order,
                        preview: preview
                    }))
                    .catch(error => {
                        console.warn(`⚠️ Failed to process image ${i + 1}: ${error.message}`);
                        return null; // Return null for failed files
                    });
            });
            
            // Wait for all files to process in parallel
            const processedFiles = await Promise.all(processingPromises);
            
            // Filter out failed files and add to mediaFiles (maintain order)
            processedFiles.forEach(processedFile => {
                if (processedFile) {
                    this.mediaFiles.push(processedFile);
                }
            });
            
            // Render once after all files are processed
            this.renderMediaPreview();
            this.updateFileInputs();
            this.updateVideoDurationControl(this.mediaFiles.length);
            this.updateDurationDisplay();
        } else {
            this.renderMediaPreview();
            this.updateVideoDurationControl(0);
            this.updateDurationDisplay();
        }
    }
    
    /**
     * Create optimized thumbnail from video file (max 200x200px for performance)
     * @param {File} file - Video file
     * @returns {Promise<{preview: string, duration: number}>} - Thumbnail and duration
     */
    async createVideoThumbnail(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true; // Mute to allow autoplay
            
            const cleanup = () => {
                if (video.src) {
                    URL.revokeObjectURL(video.src);
                }
            };
            
            video.onloadedmetadata = () => {
                try {
                    // Calculate optimal thumbnail size (max 200x200px)
                    const maxSize = 200;
                    let width = video.videoWidth || 320;
                    let height = video.videoHeight || 240;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height = (height * maxSize) / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = (width * maxSize) / height;
                            height = maxSize;
                        }
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Better quality rendering
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    video.currentTime = 0.1; // Get frame at 0.1s
                    
                    video.onseeked = () => {
                        try {
                            ctx.drawImage(video, 0, 0, width, height);
                            const preview = canvas.toDataURL('image/jpeg', 0.85);
                            const duration = video.duration || 8;
                            
                            cleanup();
                            resolve({
                                preview: preview,
                                duration: duration
                            });
                        } catch (error) {
                            cleanup();
                            reject(error);
                        }
                    };
                    
                    video.onerror = () => {
                        cleanup();
                        reject(new Error('Video metadata loading failed'));
                    };
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };
            
            video.onerror = () => {
                cleanup();
                reject(new Error('Video loading failed'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    async handleVideoUpload(files) {
        this.initMediaFiles();
        
        const newFiles = Array.from(files).filter(f => f.type.startsWith('video/'));
        
        if (newFiles.length > 0) {
            // CRITICAL: Process files in order to preserve upload sequence
            const startOrder = this.mediaFiles.length;
            
            // Show loading indicator
            const mediaPreview = document.getElementById('media-preview');
            if (mediaPreview) {
                mediaPreview.innerHTML = `<div class="col-span-4 text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600">Processing ${newFiles.length} video${newFiles.length > 1 ? 's' : ''}...</p></div>`;
            }
            
            // OPTIMIZED: Process all files in parallel for speed, but maintain order
            const processingPromises = newFiles.map((file, i) => {
                const order = startOrder + i;
                return this.createVideoThumbnail(file)
                    .then(({ preview, duration }) => ({
                        id: `media_${Date.now()}_${this.mediaCounter++}`,
                        file: file,
                        type: 'video',
                        order: order,
                        preview: preview,
                        duration: duration
                    }))
                    .catch(error => {
                        console.warn(`⚠️ Failed to process video ${i + 1}: ${error.message}`);
                        return null; // Return null for failed files
                    });
            });
            
            // Wait for all files to process in parallel
            const processedFiles = await Promise.all(processingPromises);
            
            // Filter out failed files and add to mediaFiles (maintain order)
            processedFiles.forEach(processedFile => {
                if (processedFile) {
                    this.mediaFiles.push(processedFile);
                }
            });
            
            // Render once after all files are processed
            this.renderMediaPreview();
            this.updateFileInputs();
            this.updateVideoDurationControl(this.mediaFiles.length);
            this.updateDurationDisplay();
        } else {
            this.renderMediaPreview();
            this.updateDurationDisplay();
        }
    }
    
    /**
     * Debounced render function - batches multiple render calls for better performance
     * @param {boolean} immediate - If true, render immediately without debounce (for drag-drop)
     */
    renderMediaPreview(immediate = false) {
        // Clear existing debounce timer
        if (this.renderDebounceTimer) {
            clearTimeout(this.renderDebounceTimer);
            this.renderDebounceTimer = null;
        }
        
        // If immediate, render right away (for user interactions like drag-drop)
        if (immediate) {
            this._renderMediaPreviewInternal();
            return;
        }
        
        // Otherwise, debounce for 150ms to batch multiple updates
        this.renderDebounceTimer = setTimeout(() => {
            this._renderMediaPreviewInternal();
            this.renderDebounceTimer = null;
        }, 150);
    }
    
    /**
     * Internal render function - actual DOM manipulation
     * @private
     */
    _renderMediaPreviewInternal() {
        const mediaPreview = document.getElementById('media-preview');
        const mediaPreviewSection = document.getElementById('media-preview-section');
        const imagePreview = document.getElementById('image-preview');
        const videoPreview = document.getElementById('video-preview');
        
        if (!this.mediaFiles || this.mediaFiles.length === 0) {
            if (mediaPreview) mediaPreview.innerHTML = '';
            if (imagePreview) imagePreview.innerHTML = '';
            if (videoPreview) videoPreview.innerHTML = '';
            if (mediaPreviewSection) mediaPreviewSection.classList.add('hidden');
            return;
        }
        
        // Show combined preview section
        if (mediaPreviewSection) {
            mediaPreviewSection.classList.remove('hidden');
        }
        
        // Clear old previews
        if (mediaPreview) mediaPreview.innerHTML = '';
        if (imagePreview) imagePreview.innerHTML = '';
        if (videoPreview) videoPreview.innerHTML = '';
        
        // Sort by order
        const sortedMedia = [...this.mediaFiles].sort((a, b) => a.order - b.order);
        
        // Store dragged index globally
        let draggedIndex = null;
        let currentIndicator = null;
        let currentIndicatorContainer = null;
        
        sortedMedia.forEach((mediaItem, displayIndex) => {
            const actualIndex = this.mediaFiles.indexOf(mediaItem);
            const container = document.createElement('div');
            container.className = 'relative cursor-move group transition-all duration-200 bg-white rounded-lg shadow-md hover:shadow-lg';
            container.draggable = true;
            container.dataset.index = actualIndex;
            container.style.minHeight = '120px';
            
            // Create preview element (larger, more professional)
            let previewElement;
            if (mediaItem.type === 'image') {
                previewElement = document.createElement('img');
                previewElement.src = mediaItem.preview || '';
                previewElement.className = 'w-full h-32 object-cover rounded-t-lg border-b-2 border-green-400 pointer-events-none';
            } else {
                previewElement = document.createElement('img');
                previewElement.src = mediaItem.preview || '';
                previewElement.className = 'w-full h-32 object-cover rounded-t-lg border-b-2 border-blue-400 pointer-events-none';
            }
            previewElement.title = mediaItem.file.name;
            previewElement.draggable = false;
            previewElement.loading = 'lazy';
            
            // File name (truncated if too long)
            const fileName = document.createElement('div');
            fileName.className = 'px-2 py-1 text-xs text-gray-600 truncate';
            fileName.textContent = mediaItem.file.name.length > 20 
                ? mediaItem.file.name.substring(0, 20) + '...' 
                : mediaItem.file.name;
            fileName.title = mediaItem.file.name;
            
            // Type badge (top-left) - larger and more visible
            const typeBadge = document.createElement('div');
            typeBadge.className = `absolute top-2 left-2 ${mediaItem.type === 'image' ? 'bg-green-600' : 'bg-blue-600'} text-white text-xs font-bold rounded-md px-2 py-1 shadow-lg z-10`;
            typeBadge.textContent = mediaItem.type === 'image' ? '📷 IMG' : '🎬 VID';
            
            // Order badge (top-right) - larger and more prominent
            const orderBadge = document.createElement('div');
            orderBadge.className = 'absolute top-2 right-2 bg-gradient-to-br from-purple-600 to-purple-700 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg z-10 ring-2 ring-white';
            orderBadge.textContent = displayIndex + 1;
            
            // Delete button - more visible
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg z-20 transition-all cursor-pointer hover:scale-110 opacity-0 group-hover:opacity-100';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = `Remove this ${mediaItem.type}`;
            deleteBtn.style.fontSize = '20px';
            deleteBtn.style.lineHeight = '1';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Direct removal with smooth animation
                this.removeMediaWithAnimation(container, actualIndex, mediaItem, displayIndex);
            });
            
            container.appendChild(previewElement);
            container.appendChild(fileName);
            container.appendChild(typeBadge);
            container.appendChild(orderBadge);
            container.appendChild(deleteBtn);
            
            // DRAG START - Enhanced visual feedback
            container.addEventListener('dragstart', (e) => {
                draggedIndex = actualIndex;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/json', JSON.stringify({ index: actualIndex }));
                
                // Enhanced visual feedback
                container.style.opacity = '0.5';
                container.style.transform = 'scale(0.95)';
                container.classList.add('ring-4', 'ring-purple-500', 'ring-opacity-75', 'z-50');
                container.style.transition = 'all 0.2s ease';
                
                // Add drag ghost image
                const dragImage = container.cloneNode(true);
                dragImage.style.opacity = '0.8';
                e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
            });
            
            // DRAG END - Reset styles
            container.addEventListener('dragend', (e) => {
                container.style.opacity = '1';
                container.style.transform = 'scale(1)';
                container.classList.remove('ring-4', 'ring-purple-500', 'ring-opacity-75', 'z-50', 'border-purple-500', 'bg-purple-50');
                container.style.transition = 'all 0.3s ease';
                
                // Remove all insertion indicators
                if (mediaPreview) {
                    const existingIndicators = mediaPreview.querySelectorAll('.insertion-indicator');
                    existingIndicators.forEach(ind => ind.remove());
                }
                
                draggedIndex = null;
                currentIndicator = null;
                currentIndicatorContainer = null;
            });
            
            // DRAG OVER - Show insertion point
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                
                if (draggedIndex !== null && draggedIndex !== actualIndex) {
                    // Calculate insertion position (before or after)
                    const rect = container.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    const insertBefore = e.clientY < midpoint;
                    
                    // Remove indicator from other container
                    if (currentIndicator && currentIndicatorContainer && currentIndicatorContainer !== container) {
                        currentIndicator.remove();
                        currentIndicator = null;
                        currentIndicatorContainer = null;
                    }

                    if (!currentIndicator) {
                        currentIndicator = document.createElement('div');
                        currentIndicator.className = 'insertion-indicator absolute left-0 right-0 h-1 bg-purple-500 rounded-full shadow-lg z-30';
                        currentIndicator.style.pointerEvents = 'none';
                        currentIndicator.style.transition = 'all 0.15s ease';
                        currentIndicatorContainer = container;
                        container.appendChild(currentIndicator);
                    }

                    if (insertBefore) {
                        currentIndicator.style.top = '-6px';
                        currentIndicator.style.bottom = 'auto';
                    } else {
                        currentIndicator.style.top = 'auto';
                        currentIndicator.style.bottom = '-6px';
                    }
                    
                    // Visual feedback on container
                    container.classList.add('border-purple-500', 'bg-purple-50');
                }
            });
            
            // DRAG LEAVE - Remove indicator
            container.addEventListener('dragleave', (e) => {
                e.preventDefault();
                
                // Only remove if actually leaving the container (not just moving to child)
                const rect = container.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || 
                    e.clientY < rect.top || e.clientY > rect.bottom) {
                    container.classList.remove('border-purple-500', 'bg-purple-50');
                    container.style.transform = 'scale(1)';
                    
                    if (currentIndicator && currentIndicatorContainer === container) {
                        currentIndicator.remove();
                        currentIndicator = null;
                        currentIndicatorContainer = null;
                    }
                }
            });
            
            // DROP: Reorder with smooth animation
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                container.classList.remove('border-purple-500', 'bg-purple-50');
                container.style.transform = 'scale(1)';
                
                if (currentIndicator && currentIndicatorContainer === container) {
                    currentIndicator.remove();
                }
                currentIndicator = null;
                currentIndicatorContainer = null;
                
                let sourceIndex = draggedIndex;
                if (sourceIndex === null) {
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('application/json'));
                        sourceIndex = data.index;
                    } catch (err) {
                        sourceIndex = parseInt(e.dataTransfer.getData('text/plain')) || null;
                    }
                }
                
                const targetIndex = actualIndex;
                
                if (sourceIndex !== null && sourceIndex !== targetIndex && 
                    sourceIndex >= 0 && sourceIndex < this.mediaFiles.length &&
                    targetIndex >= 0 && targetIndex < this.mediaFiles.length) {
                    
                    // Calculate insertion position
                    const rect = container.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    const insertBefore = e.clientY < midpoint;
                    
                    // Get target order based on insertion position
                    let targetOrder;
                    if (insertBefore) {
                        // Insert before target
                        targetOrder = this.mediaFiles[targetIndex].order;
                        // Shift all items from target onwards
                        this.mediaFiles.forEach(item => {
                            if (item.order >= targetOrder && item !== this.mediaFiles[sourceIndex]) {
                                item.order += 1;
                            }
                        });
                    } else {
                        // Insert after target
                        targetOrder = this.mediaFiles[targetIndex].order + 1;
                        // Shift all items after target
                        this.mediaFiles.forEach(item => {
                            if (item.order >= targetOrder && item !== this.mediaFiles[sourceIndex]) {
                                item.order += 1;
                            }
                        });
                    }
                    
                    // Set source order
                    this.mediaFiles[sourceIndex].order = targetOrder;
                    
                    // Normalize orders (0, 1, 2, 3...)
                    this.mediaFiles.sort((a, b) => a.order - b.order);
                    this.mediaFiles.forEach((item, idx) => {
                        item.order = idx;
                    });
                    
                    // Re-render with smooth transition
                    this.renderMediaPreview();
                    
                    // Update file inputs
                    this.updateFileInputs();
                    
                    // Update duration display
                    this.updateDurationDisplay();
                    
                    console.log(`🔄 Reordered: ${this.mediaFiles[sourceIndex].type} → Position ${targetOrder + 1}`);
                }
                
                draggedIndex = null;
                currentIndicator = null;
                currentIndicatorContainer = null;
            });
            
            // Touch support for mobile devices
            let touchStartY = null;
            let touchStartIndex = null;
            
            container.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                touchStartIndex = actualIndex;
                container.style.opacity = '0.7';
            }, { passive: true });
            
            container.addEventListener('touchmove', (e) => {
                if (touchStartY !== null) {
                    const touchY = e.touches[0].clientY;
                    const deltaY = touchY - touchStartY;
                    container.style.transform = `translateY(${deltaY}px)`;
                }
            }, { passive: true });
            
            container.addEventListener('touchend', (e) => {
                if (touchStartY !== null) {
                    container.style.opacity = '1';
                    container.style.transform = 'translateY(0)';
                    touchStartY = null;
                    touchStartIndex = null;
                }
            }, { passive: true });
            
            if (mediaPreview) {
                mediaPreview.appendChild(container);
            }
        });
    }
    
    // NEW: Remove media with smooth animation and toast notification
    removeMediaWithAnimation(containerElement, index, mediaItem, displayIndex) {
        if (!this.mediaFiles || index < 0 || index >= this.mediaFiles.length) {
            return;
        }
        
        // Smooth fade-out animation
        containerElement.style.transition = 'all 0.3s ease';
        containerElement.style.opacity = '0';
        containerElement.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            const fileName = mediaItem.file.name.length > 20 
                ? mediaItem.file.name.substring(0, 20) + '...' 
                : mediaItem.file.name;
            this.removeMedia(index);
            this.showToast(`${mediaItem.type === 'image' ? 'Image' : 'Video'} removed: ${fileName}`, 'success');
        }, 300);
    }
    
    // NEW: Show toast notification
    showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.getElementById('media-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'media-toast';
        toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-xl z-50 transform transition-all duration-300 flex items-center gap-2 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.minWidth = '200px';
        
        // Add icon
        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                        type === 'error' ? 'fas fa-exclamation-circle' : 
                        'fas fa-info-circle';
        toast.appendChild(icon);
        
        // Add message
        const messageText = document.createElement('span');
        messageText.textContent = message;
        toast.appendChild(messageText);
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Auto remove after 2.5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2500);
    }
    
    removeMedia(index) {
        if (!this.mediaFiles || index < 0 || index >= this.mediaFiles.length) {
            return;
        }
        
        const mediaItem = this.mediaFiles[index];
        const fileName = mediaItem.file.name;
        const mediaType = mediaItem.type;
        
        // Remove from array
        this.mediaFiles.splice(index, 1);
        
        // Reorder remaining items
        this.mediaFiles.forEach((item, idx) => {
            item.order = idx;
        });
        
                    // Re-render preview (immediate for drag-drop)
                    this.renderMediaPreview(true);
        
        // Update file inputs
        this.updateFileInputs();
        
        // Update video duration control
        this.updateVideoDurationControl(this.mediaFiles.length);
        
        // Update duration display
        this.updateDurationDisplay();
        
        console.log(`🗑️ Removed ${mediaType}: ${fileName} (${this.mediaFiles.length} items remaining)`);
    }
    
    // Legacy support - keep for backward compatibility
    removeImage(index) {
        this.removeMedia(index);
    }
    
    updateVideoDurationControl(mediaCount) {
        const videoDurationSelect = document.getElementById('video-duration');
        const videoDurationHint = document.getElementById('video-duration-hint');
        const videoDurationAuto = document.getElementById('video-duration-auto');
        const customInputMode = document.getElementById('custom-input-mode');
        
        if (!videoDurationSelect || !videoDurationHint || !videoDurationAuto) return;
        
        const isCustomMode = customInputMode && customInputMode.checked;
        
        if (isCustomMode && mediaCount > 0) {
            // Disable video duration selection when custom media is provided
            videoDurationSelect.disabled = true;
            videoDurationSelect.classList.add('bg-gray-100', 'cursor-not-allowed');
            videoDurationHint.classList.add('hidden');
            videoDurationAuto.classList.remove('hidden');
            
            // Calculate estimated duration
            const estimatedDuration = this.calculateVideoDurationFromMedia(mediaCount);
            const minutes = Math.floor(estimatedDuration / 60);
            const seconds = Math.round(estimatedDuration % 60);
            
            const imageCount = this.mediaFiles ? this.mediaFiles.filter(m => m.type === 'image').length : 0;
            const videoCount = this.mediaFiles ? this.mediaFiles.filter(m => m.type === 'video').length : 0;
            
            videoDurationAuto.innerHTML = `<i class="fas fa-info-circle mr-1"></i>Estimated duration: ~${minutes}:${seconds.toString().padStart(2, '0')} (${imageCount} images × ~6.5s + ${videoCount} videos × 8s)`;
        } else {
            // Enable video duration selection
            videoDurationSelect.disabled = false;
            videoDurationSelect.classList.remove('bg-gray-100', 'cursor-not-allowed');
            videoDurationHint.classList.remove('hidden');
            videoDurationAuto.classList.add('hidden');
        }
    }
    
    // NEW: Calculate media duration with detailed info
    calculateMediaDuration() {
        if (!this.mediaFiles || this.mediaFiles.length === 0) {
            return { duration: 0, text: '-', details: '' };
        }
        
        const imageCount = this.mediaFiles.filter(m => m.type === 'image').length;
        const videoCount = this.mediaFiles.filter(m => m.type === 'video').length;
        const totalMedia = imageCount + videoCount;
        
        // Geçiş süreleri (montajda kullanılan: 0.6s)
        const transitionTime = 0.6;
        const totalTransitions = Math.max(0, totalMedia - 1);
        const totalTransitionDuration = totalTransitions * transitionTime;
        
        // Resim süreleri (optimal: 6.5s)
        const baseImageDuration = 6.5;
        const imageDuration = imageCount * baseImageDuration;
        
        // Video süreleri (8s sabit)
        const videoDuration = videoCount * 8;
        
        // Toplam
        const totalDuration = imageDuration + videoDuration + totalTransitionDuration;
        
        const minutes = Math.floor(totalDuration / 60);
        const seconds = Math.round(totalDuration % 60);
        
        return {
            duration: totalDuration,
            text: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            details: `${imageCount} images × ${baseImageDuration}s + ${videoCount} videos × 8s + ${totalTransitions} transitions × ${transitionTime}s`
        };
    }
    
    // Preset Buttons functionality
    setupPresetButtons() {
        const presets = {
            'preset-tr-youtube': {
                name: '🇹🇷 TR YouTube',
                videoFormat: 'youtube',
                ttsProvider: 'xtts',
                xttsVoice: 'Gdhspor Ses New V1',
                showThumbnail: true,
                subtitles: true
            },
            'preset-tr-shorts': {
                name: '🇹🇷 TR Shorts',
                videoFormat: 'shorts',
                ttsProvider: 'xtts',
                xttsVoice: 'Gdhspor Ses New V1',
                showThumbnail: false,
                subtitles: true
            },
            'preset-en-youtube': {
                name: '🇬🇧 EN YouTube',
                videoFormat: 'youtube',
                ttsProvider: 'xtts',
                xttsVoice: 'Ingilizce KalıN',
                showThumbnail: true,
                subtitles: true
            },
            'preset-en-shorts': {
                name: '🇬🇧 EN Shorts',
                videoFormat: 'shorts',
                ttsProvider: 'xtts',
                xttsVoice: 'Ingilizce KalıN',
                showThumbnail: false,
                subtitles: true
            }
        };

        // Add click listeners to all preset buttons
        Object.keys(presets).forEach(presetId => {
            const btn = document.getElementById(presetId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.applyPreset(presetId, presets[presetId]);
                });
            }
        });

        // Restore last selected preset from localStorage (only highlight, don't auto-apply)
        const lastPreset = localStorage.getItem('lastSelectedPreset');
        if (lastPreset && presets[lastPreset]) {
            this.highlightSelectedPreset(lastPreset);
        }
    }

    // Apply preset settings
    applyPreset(presetId, preset) {
        console.log(`🎬 Applying preset: ${preset.name}`);
        
        // Save to localStorage for persistence
        localStorage.setItem('lastSelectedPreset', presetId);

        // 1. Set Video Format
        const videoFormatSelect = document.getElementById('video-format');
        if (videoFormatSelect) {
            videoFormatSelect.value = preset.videoFormat;
            // Trigger change event to update thumbnail visibility
            videoFormatSelect.dispatchEvent(new Event('change'));
        }

        // 2. Set TTS Provider
        const ttsProviderSelect = document.getElementById('tts-provider');
        if (ttsProviderSelect) {
            ttsProviderSelect.value = preset.ttsProvider;
            ttsProviderSelect.dispatchEvent(new Event('change'));
        }

        // 3. Set XTTS Voice (need to find the matching option)
        const xttsVoiceSelect = document.getElementById('xtts-voice');
        if (xttsVoiceSelect) {
            // Find option that contains the voice name
            const options = xttsVoiceSelect.options;
            let found = false;
            for (let i = 0; i < options.length; i++) {
                if (options[i].text.includes(preset.xttsVoice) || options[i].value.includes(preset.xttsVoice)) {
                    xttsVoiceSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.warn(`⚠️ Voice "${preset.xttsVoice}" not found in XTTS voices`);
            }
        }

        // 4. Handle Thumbnail Section visibility
        const thumbnailSection = document.getElementById('thumbnail-upload-section');
        if (thumbnailSection) {
            if (preset.showThumbnail) {
                thumbnailSection.classList.remove('hidden');
            } else {
                thumbnailSection.classList.add('hidden');
            }
        }

        // 5. Set Subtitles
        const subtitlesCheckbox = document.getElementById('subtitles-enabled');
        if (subtitlesCheckbox) {
            subtitlesCheckbox.checked = preset.subtitles;
        }

        // 6. Update UI to show selected preset
        this.highlightSelectedPreset(presetId);

        // 7. Show status message
        this.showPresetStatus(preset.name);
    }

    // Highlight selected preset button
    highlightSelectedPreset(selectedId) {
        // Remove highlight from all preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('ring-4', 'ring-yellow-400', 'ring-offset-2');
        });

        // Add highlight to selected button
        const selectedBtn = document.getElementById(selectedId);
        if (selectedBtn) {
            selectedBtn.classList.add('ring-4', 'ring-yellow-400', 'ring-offset-2');
        }
    }

    // Show preset status message
    showPresetStatus(presetName) {
        const statusDiv = document.getElementById('preset-status');
        if (statusDiv) {
            statusDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
            statusDiv.classList.add('bg-green-100', 'text-green-700');
            statusDiv.innerHTML = `<i class="fas fa-check-circle mr-2"></i>Preset "${presetName}" applied! Settings configured.`;
            
            // Hide after 3 seconds
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    }
    
    // JSON Import functionality
    setupJSONImport() {
        const jsonImportBtn = document.getElementById('json-import-btn');
        const jsonPasteBtn = document.getElementById('json-paste-btn');
        const jsonImportFile = document.getElementById('json-import-file');

        if (jsonImportBtn && jsonImportFile) {
            // File import button
            jsonImportBtn.addEventListener('click', () => {
                jsonImportFile.click();
            });

            // File selected
            jsonImportFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleJSONFile(file);
                }
            });
        }

        if (jsonPasteBtn) {
            // Paste JSON button
            jsonPasteBtn.addEventListener('click', () => {
                this.showJSONPasteModal();
            });
        }
    }

    // Handle JSON file import
    async handleJSONFile(file) {
        const statusEl = document.getElementById('json-import-status');
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            this.applyJSONData(data);
            
            if (statusEl) {
                statusEl.className = 'mt-2 p-2 rounded-lg text-sm bg-green-100 text-green-800';
                statusEl.innerHTML = '<i class="fas fa-check-circle mr-1"></i> JSON imported successfully! Review the fields below.';
                statusEl.classList.remove('hidden');
                setTimeout(() => statusEl.classList.add('hidden'), 5000);
            }
        } catch (error) {
            console.error('JSON import error:', error);
            if (statusEl) {
                statusEl.className = 'mt-2 p-2 rounded-lg text-sm bg-red-100 text-red-800';
                statusEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> Error: ${error.message}`;
                statusEl.classList.remove('hidden');
            }
        }
        
        // Reset file input
        document.getElementById('json-import-file').value = '';
    }

    // Show JSON paste modal
    showJSONPasteModal() {
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'json-paste-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                        <i class="fas fa-paste mr-2 text-purple-600"></i>
                        Paste JSON Content
                    </h3>
                    <button id="close-json-modal" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <textarea
                    id="json-paste-textarea"
                    rows="12"
                    placeholder='Paste your JSON here...

Example format:
{
  "title": "Your Video Title",
  "description": "Your video description...",
  "script": "[1] First scene text...\\n\\n[2] Second scene...",
  "tags": ["tag1", "tag2", "tag3"],
  "voice": "ingilizce_kalın.wav",
  "language": "en"
}'
                    class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                ></textarea>
                <div class="mt-4 flex gap-2">
                    <button id="apply-json-btn" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200">
                        <i class="fas fa-check mr-2"></i>Apply JSON
                    </button>
                    <button id="cancel-json-btn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all duration-200">
                        Cancel
                    </button>
                </div>
                <div id="json-modal-status" class="hidden mt-3 p-2 rounded-lg text-sm"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('close-json-modal').addEventListener('click', () => modal.remove());
        document.getElementById('cancel-json-btn').addEventListener('click', () => modal.remove());
        
        document.getElementById('apply-json-btn').addEventListener('click', () => {
            const textarea = document.getElementById('json-paste-textarea');
            const statusEl = document.getElementById('json-modal-status');
            
            try {
                const data = JSON.parse(textarea.value);
                this.applyJSONData(data);
                
                // Show success and close
                const mainStatusEl = document.getElementById('json-import-status');
                if (mainStatusEl) {
                    mainStatusEl.className = 'mt-2 p-2 rounded-lg text-sm bg-green-100 text-green-800';
                    mainStatusEl.innerHTML = '<i class="fas fa-check-circle mr-1"></i> JSON imported successfully! Review the fields below.';
                    mainStatusEl.classList.remove('hidden');
                    setTimeout(() => mainStatusEl.classList.add('hidden'), 5000);
                }
                modal.remove();
            } catch (error) {
                statusEl.className = 'mt-3 p-2 rounded-lg text-sm bg-red-100 text-red-800';
                statusEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> Invalid JSON: ${error.message}`;
                statusEl.classList.remove('hidden');
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Apply JSON data to form fields
    applyJSONData(data) {
        console.log('📥 Applying JSON data:', data);
        
        // Title
        if (data.title) {
            const titleEl = document.getElementById('custom-title');
            if (titleEl) {
                titleEl.value = data.title;
                this.highlightField(titleEl);
            }
        }

        // Description
        if (data.description) {
            const descEl = document.getElementById('custom-description');
            if (descEl) {
                descEl.value = data.description;
                this.highlightField(descEl);
            }
        }

        // Script
        if (data.script) {
            const scriptEl = document.getElementById('custom-script');
            if (scriptEl) {
                scriptEl.value = data.script;
                this.highlightField(scriptEl);
                // Update duration display
                this.updateDurationDisplay();
            }
        }

        // Tags (can be array or comma-separated string)
        if (data.tags) {
            const tagsEl = document.getElementById('custom-tags');
            if (tagsEl) {
                const tagsValue = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
                tagsEl.value = tagsValue;
                this.highlightField(tagsEl);
            }
        }

        // Voice selection (XTTS)
        if (data.voice) {
            const voiceEl = document.getElementById('xtts-voice-select');
            if (voiceEl) {
                // Find and select the matching option
                const options = voiceEl.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === data.voice || options[i].text.includes(data.voice)) {
                        voiceEl.selectedIndex = i;
                        this.highlightField(voiceEl);
                        break;
                    }
                }
            }
        }

        // Language
        if (data.language) {
            const langEl = document.getElementById('xtts-language');
            if (langEl) {
                langEl.value = data.language;
                this.highlightField(langEl);
            }
        }

        // Video style
        if (data.style) {
            const styleEl = document.getElementById('video-style');
            if (styleEl) {
                styleEl.value = data.style;
                this.highlightField(styleEl);
            }
        }

        // Target audience
        if (data.targetAudience) {
            const audienceEl = document.getElementById('target-audience');
            if (audienceEl) {
                audienceEl.value = data.targetAudience;
                this.highlightField(audienceEl);
            }
        }

        // Mood
        if (data.mood) {
            const moodEl = document.getElementById('video-mood');
            if (moodEl) {
                moodEl.value = data.mood;
                this.highlightField(moodEl);
            }
        }

        // Topic (for AI mode fallback)
        if (data.topic) {
            const topicEl = document.getElementById('topic');
            if (topicEl) {
                topicEl.value = data.topic;
                this.highlightField(topicEl);
            }
        }

        console.log('✅ JSON data applied successfully');
    }

    // Highlight a field to show it was updated
    highlightField(element) {
        element.classList.add('ring-2', 'ring-green-400', 'bg-green-50');
        setTimeout(() => {
            element.classList.remove('ring-2', 'ring-green-400', 'bg-green-50');
        }, 2000);
    }

    // NEW: Calculate script duration
    calculateScriptDuration() {
        const scriptTextarea = document.getElementById('custom-script');
        if (!scriptTextarea || !scriptTextarea.value.trim()) {
            return { duration: 0, text: '-', wordCount: 0 };
        }
        
        const script = scriptTextarea.value.trim();
        const wordCount = script.split(/\s+/).filter(w => w.length > 0).length;
        
        // TTS hızı: 2.925 kelime/saniye (increased from 2.5), adjusted by COQUI_LENGTH_SCALE (default: 1.3)
        // Get length_scale from environment or use default 1.3
        // This is a frontend estimate, actual value comes from server
        // IMPROVED: Increased base rate to achieve ~2.25 words/sec for better duration estimation
        const lengthScale = 1.3; // Default, server will use actual env value
        const baseWordsPerSecond = 2.925;
        const adjustedWordsPerSecond = baseWordsPerSecond / lengthScale; // 1.3 için = 2.25 words/sec
        
        // Duration = wordCount / wordsPerSecond (noktalama duraklamaları hesaba katılmıyor)
        const wordDuration = wordCount / adjustedWordsPerSecond;
        const duration = wordDuration;
        
        const minutes = Math.floor(duration / 60);
        const seconds = Math.round(duration % 60);
        
        return {
            duration: duration,
            text: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            wordCount: wordCount,
            pauseTime: 0
        };
    }
    
    // NEW: Update duration display
    updateDurationDisplay() {
        const mediaInfo = this.calculateMediaDuration();
        const scriptInfo = this.calculateScriptDuration();
        
        // UI elementleri
        const mediaDurationEl = document.getElementById('media-duration');
        const scriptDurationEl = document.getElementById('script-duration');
        const totalDurationEl = document.getElementById('total-duration');
        const warningEl = document.getElementById('duration-warning');
        
        // Medya süresini göster
        if (mediaDurationEl) {
            mediaDurationEl.textContent = mediaInfo.text;
            if (mediaInfo.details) {
                mediaDurationEl.title = mediaInfo.details;
            }
        }
        
        // Script süresini göster
        if (scriptDurationEl) {
            scriptDurationEl.textContent = scriptInfo.text;
            if (scriptInfo.wordCount > 0) {
                scriptDurationEl.title = `${scriptInfo.wordCount} words`;
            }
        }
        
        // Toplam süre (akıllı dengeleme mantığı)
        let totalDuration = 0;
        let warning = '';
        
        if (mediaInfo.duration > 0 && scriptInfo.duration > 0) {
            // İkisi de var: max kullan (backend'deki mantık)
            totalDuration = Math.max(mediaInfo.duration, scriptInfo.duration);
            
            const difference = Math.abs(mediaInfo.duration - scriptInfo.duration);
            if (difference > 5) {
                if (scriptInfo.duration < mediaInfo.duration) {
                    warning = `⚠️ Script is ${Math.round(difference)}s shorter than media. Consider adding more content to your script.`;
                } else {
                    warning = `⚠️ Script is ${Math.round(difference)}s longer than media. Consider adding more images/videos.`;
                }
            }
        } else if (mediaInfo.duration > 0) {
            totalDuration = mediaInfo.duration;
        } else if (scriptInfo.duration > 0) {
            totalDuration = scriptInfo.duration;
        }
        
        // Toplam süreyi göster
        if (totalDurationEl) {
            if (totalDuration > 0) {
                const minutes = Math.floor(totalDuration / 60);
                const seconds = Math.round(totalDuration % 60);
                totalDurationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                totalDurationEl.textContent = '-';
            }
        }
        
        // Uyarıyı göster
        if (warningEl) {
            if (warning) {
                warningEl.textContent = warning;
                warningEl.classList.remove('hidden');
            } else {
                warningEl.classList.add('hidden');
            }
        }
    }
    
    calculateVideoDurationFromMedia(mediaCount) {
        if (!this.mediaFiles || this.mediaFiles.length === 0) {
            return 0;
        }
        
        // Calculate based on actual media types
        const transitionTime = 0.4; // seconds per transition
        const avgSecondsPerImage = 6.5;
        const secondsPerVideo = 8; // Fixed 8 seconds for videos
        
        let totalDuration = 0;
        this.mediaFiles.forEach(media => {
            if (media.type === 'image') {
                totalDuration += avgSecondsPerImage;
            } else if (media.type === 'video') {
                totalDuration += secondsPerVideo;
            }
        });
        
        // Add transition time
        const totalTransitions = this.mediaFiles.length - 1;
        totalDuration += totalTransitions * transitionTime;
        
        return Math.round(totalDuration);
    }
    
    updateFileInputs() {
        // Update images input
        const imagesInput = document.getElementById('custom-images');
        if (imagesInput && this.mediaFiles) {
            const imageFiles = this.mediaFiles
                .filter(m => m.type === 'image')
                .sort((a, b) => a.order - b.order)
                .map(m => m.file);
            
            const dataTransfer = new DataTransfer();
            imageFiles.forEach(file => {
                dataTransfer.items.add(file);
            });
            imagesInput.files = dataTransfer.files;
        }
        
        // Update videos input
        const videosInput = document.getElementById('custom-videos');
        if (videosInput && this.mediaFiles) {
            const videoFiles = this.mediaFiles
                .filter(m => m.type === 'video')
                .sort((a, b) => a.order - b.order)
                .map(m => m.file);
            
            const dataTransfer = new DataTransfer();
            videoFiles.forEach(file => {
                dataTransfer.items.add(file);
            });
            videosInput.files = dataTransfer.files;
        }
    }
    
    // Legacy support
    updateFileInput() {
        this.updateFileInputs();
    }
    
    async notifyBackendImageRemoved(fileName, remainingCount) {
        try {
            // Optional: Send to backend for logging/analytics
            await fetch('/api/images/removed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileName,
                    remainingCount: remainingCount,
                    timestamp: Date.now()
                })
            }).catch(() => {
                // Silently fail - this is optional
            });
        } catch (error) {
            // Silently fail - this is optional logging
        }
    }
    
    async notifyBackendFileListUpdate(fileCount) {
        try {
            // Optional: Send to backend for logging/analytics
            await fetch('/api/images/updated', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileCount: fileCount,
                    timestamp: Date.now()
                })
            }).catch(() => {
                // Silently fail - this is optional
            });
        } catch (error) {
            // Silently fail - this is optional logging
        }
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
            console.log('✅ Auth status received:', data);
            this.updateAuthStatus(data);
        } catch (error) {
            console.error('❌ Failed to check auth status:', error);
            this.updateAuthStatus({ authenticated: false, error: 'Connection error' });
        }
    }

    // NEW: Check Instagram authentication status
    async checkInstagramAuthStatus() {
        try {
            const response = await fetch('/api/instagram/current-account');
            const data = await response.json();
            this.updateInstagramAuthStatus(data);
        } catch (error) {
            console.error('❌ Failed to check Instagram auth status:', error);
            this.updateInstagramAuthStatus({ authenticated: false, error: 'Connection error' });
        }
    }

    // NEW: Update Instagram authentication status UI
    updateInstagramAuthStatus(data) {
        const authContent = document.getElementById('instagram-auth-content');
        if (!authContent) return;
        
        const { authenticated, account, error } = data || {};
        
        if (error) {
            authContent.innerHTML = `
                <div class="flex items-center text-red-600">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>Error: ${error}</span>
                </div>
            `;
            return;
        }

        if (authenticated && account) {
            authContent.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center text-green-600">
                            <i class="fas fa-check-circle mr-2"></i>
                            <span>Connected</span>
                        </div>
                        <button onclick="authenticateInstagram()" class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 text-sm">
                            <i class="fas fa-plus mr-1"></i>
                            Add Account
                        </button>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm font-medium text-gray-700">@${account.username}</p>
                        <p class="text-xs text-gray-500">Instagram Business Account</p>
                    </div>
                </div>
            `;
        } else {
            authContent.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center text-yellow-600">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span>Instagram not connected</span>
                    </div>
                    <button onclick="authenticateInstagram()" class="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors">
                        <i class="fab fa-instagram mr-1"></i>
                        Connect
                    </button>
                </div>
            `;
        }
    }

    // NEW: Check TikTok authentication status
    async checkTikTokAuthStatus() {
        try {
            const response = await fetch('/api/tiktok/current-account');
            const data = await response.json();
            this.updateTikTokAuthStatus(data);
        } catch (error) {
            console.error('❌ Failed to check TikTok auth status:', error);
            this.updateTikTokAuthStatus({ authenticated: false, error: 'Connection error' });
        }
    }

    // NEW: Update TikTok authentication status UI
    updateTikTokAuthStatus(data) {
        const authContent = document.getElementById('tiktok-auth-content');
        if (!authContent) return;
        
        const { authenticated, account, error } = data || {};
        
        if (error) {
            authContent.innerHTML = `
                <div class="flex items-center text-red-600">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>Error: ${error}</span>
                </div>
            `;
            return;
        }

        if (authenticated && account) {
            authContent.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center text-green-600">
                            <i class="fas fa-check-circle mr-2"></i>
                            <span>Connected</span>
                        </div>
                        <button onclick="authenticateTikTok()" class="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm">
                            <i class="fas fa-plus mr-1"></i>
                            Add Account
                        </button>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm font-medium text-gray-700">@${account.username}</p>
                        <p class="text-xs text-gray-500">TikTok Account</p>
                    </div>
                </div>
            `;
        } else {
            authContent.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center text-yellow-600">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span>TikTok not connected</span>
                    </div>
                    <button onclick="authenticateTikTok()" class="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <i class="fab fa-tiktok mr-1"></i>
                        Connect
                    </button>
                </div>
            `;
        }
    }

    // NEW: Handle TikTok OAuth callback
    handleTikTokOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const auth = urlParams.get('auth');
        const platform = urlParams.get('platform');
        const accountId = urlParams.get('accountId');
        const username = urlParams.get('username');
        const message = urlParams.get('message');

        if (auth && platform === 'tiktok') {
            if (auth === 'success') {
                console.log(`✅ TikTok authentication successful: @${username}`);
                this.checkTikTokAuthStatus();
                // Show success notification
                if (window.showNotification) {
                    window.showNotification(`TikTok account connected: @${username}`, 'success');
                }
            } else if (auth === 'error') {
                console.error(`❌ TikTok authentication failed: ${message}`);
                alert(`TikTok authentication failed: ${message || 'Unknown error'}`);
            }
            
            // Clean URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }

    updateAuthStatus(data) {
        const authContent = document.getElementById('auth-content');
        const { authenticated, accountsCount = 0, currentAccount, accounts = [], error } = data || {};
        
        // Store accounts data for re-upload feature
        this.accounts = accounts || [];
        this.currentAccount = currentAccount || null;
        
        console.log('📊 Auth Status Data:', { authenticated, accountsCount, accounts, currentAccount, error });
        
        if (error) {
            authContent.innerHTML = `
                <div class="flex items-center text-red-600">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>Error: ${error}</span>
                </div>
            `;
            return;
        }

        if (authenticated && accountsCount > 0) {
            // Multi-account UI
            let accountsHtml = '';
            if (accounts && accounts.length > 0) {
                // Filter duplicates (same email or accountId)
                const uniqueAccounts = [];
                const seenEmails = new Set();
                const seenAccountIds = new Set();
                
                for (const account of accounts) {
                    const email = account.email?.toLowerCase() || '';
                    const accountId = account.accountId;
                    
                    // Skip duplicates
                    if (email && seenEmails.has(email)) {
                        console.warn(`⚠️ Frontend: Skipping duplicate account (same email): ${email}`);
                        continue;
                    }
                    
                    if (seenAccountIds.has(accountId)) {
                        console.warn(`⚠️ Frontend: Skipping duplicate account (same ID): ${accountId}`);
                        continue;
                    }
                    
                    seenEmails.add(email);
                    seenAccountIds.add(accountId);
                    uniqueAccounts.push(account);
                }
                
                console.log(`📋 Frontend: Displaying ${uniqueAccounts.length} unique account(s) out of ${accounts.length} total`);
                
                accountsHtml = uniqueAccounts.map(account => `
                    <option value="${account.accountId}" ${account.isCurrent ? 'selected' : ''}>
                        ${account.channelInfo?.title || 'Unknown Channel'} ${account.email ? `(${account.email})` : ''}
                    </option>
                `).join('');
            } else {
                // Fallback: if accounts array is empty but accountsCount > 0, show current account
                console.warn('⚠️ Accounts array is empty but accountsCount > 0. Using currentAccount as fallback.');
                if (currentAccount) {
                    accountsHtml = `
                        <option value="${currentAccount.accountId}" selected>
                            ${currentAccount.channelInfo?.title || 'Unknown Channel'} ${currentAccount.email ? `(${currentAccount.email})` : ''}
                        </option>
                    `;
                }
            }
            
            authContent.innerHTML = `
                <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center text-green-600">
                        <i class="fas fa-check-circle mr-2"></i>
                            <span>${accountsCount} Account(s) Connected</span>
                    </div>
                        <button onclick="authenticateYouTube()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            <i class="fas fa-plus mr-1"></i>
                            Add Account
                        </button>
                    </div>
                    
                    ${accountsCount > 1 ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-user-circle mr-1"></i>
                            Select Account for Upload
                        </label>
                        <select 
                            id="youtube-account-select" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            ${accountsHtml}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">Videos will be uploaded to the selected account</p>
                    </div>
                    ` : `
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-1"></i>
                            Uploading to: <strong>${currentAccount?.channelInfo?.title || 'Current Account'}</strong>
                        </p>
                    </div>
                    `}
                    
                    ${currentAccount ? `
                    <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div>
                            <p class="text-sm font-medium text-gray-700">${currentAccount.channelInfo?.title || 'Unknown Channel'}</p>
                            ${currentAccount.email ? `<p class="text-xs text-gray-500">${currentAccount.email}</p>` : ''}
                        </div>
                        ${accountsCount > 1 ? `
                        <button 
                            onclick="removeYouTubeAccount('${currentAccount.accountId}')" 
                            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                            title="Remove this account"
                        >
                            <i class="fas fa-trash mr-1"></i>
                            Remove
                        </button>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
            
            // Add event listener for account selection
            if (accountsCount > 1) {
                const selectElement = document.getElementById('youtube-account-select');
                if (selectElement) {
                    selectElement.addEventListener('change', async (e) => {
                        await this.selectYouTubeAccount(e.target.value);
                    });
                }
            }
        } else {
            // No accounts - show authentication button
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
    
    // NEW: Select YouTube account
    async selectYouTubeAccount(accountId) {
        try {
            const response = await fetch('/api/youtube/accounts/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('✅ Account selected:', data.currentAccount?.channelInfo?.title);
                this.checkAuthStatus(); // Refresh UI
            } else {
                throw new Error(data.error || 'Failed to select account');
            }
        } catch (error) {
            console.error('❌ Failed to select account:', error);
            alert('Failed to select account: ' + error.message);
        }
    }
    
    // NEW: Remove YouTube account
    async removeYouTubeAccount(accountId) {
        if (!confirm('Are you sure you want to remove this account? You will need to re-authenticate to use it again.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/youtube/accounts/${accountId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('✅ Account removed');
                this.checkAuthStatus(); // Refresh UI
            } else {
                throw new Error(data.error || 'Failed to remove account');
            }
        } catch (error) {
            console.error('❌ Failed to remove account:', error);
            alert('Failed to remove account: ' + error.message);
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
        const customInputMode = document.getElementById('custom-input-mode')?.checked || false;
        
        // Check if custom inputs are provided
        const customImages = formData.getAll('customImages');
        const customScript = formData.get('customScript')?.trim() || '';
        const customMusic = formData.get('customMusic');
        const customTitle = formData.get('customTitle')?.trim() || '';
        const customDescription = formData.get('customDescription')?.trim() || '';
        const customTags = formData.get('customTags')?.trim() || '';
        const topic = formData.get('topic')?.trim() || '';
        
        // Validation: topic or custom script required
        if (!topic && !customScript) {
            this.showError('Please provide either a topic or a custom script');
            return;
        }
        
        // Prepare data - use FormData for file uploads
        const uploadFormData = new FormData();
        
        // Add custom files if provided
        // CRITICAL: Use this.mediaFiles if available (preserves drag-and-drop order)
        // Build mediaSequence array for backend
        let mediaSequence = [];
        
        if (this.mediaFiles && this.mediaFiles.length > 0) {
            // Sort by order
            const sortedMedia = [...this.mediaFiles].sort((a, b) => a.order - b.order);
            
            // Separate images and videos, append to FormData in order
            sortedMedia.forEach((mediaItem, index) => {
                if (mediaItem.type === 'image') {
                    uploadFormData.append('customImages', mediaItem.file);
                } else if (mediaItem.type === 'video') {
                    uploadFormData.append('customVideos', mediaItem.file);
                }
                
                // Build sequence array
                mediaSequence.push({
                    type: mediaItem.type,
                    order: index,
                    filename: mediaItem.file.name,
                    originalName: mediaItem.file.name,
                    clientId: mediaItem.id || null
                });
            });
            
            // Send mediaSequence as JSON
            uploadFormData.append('mediaSequence', JSON.stringify(mediaSequence));
            
            const imageCount = sortedMedia.filter(m => m.type === 'image').length;
            const videoCount = sortedMedia.filter(m => m.type === 'video').length;
            console.log(`📸 [Custom] ${imageCount} images + ${videoCount} videos uploaded (order preserved)`);
        } else {
            // Fallback: use file inputs directly (backward compatibility)
            const orderedImages = (customImages && customImages.length > 0 && customImages[0].size > 0 ? customImages : []);
            if (orderedImages.length > 0) {
                orderedImages.forEach((file, index) => {
                    if (file && file.size > 0) {
                        uploadFormData.append('customImages', file);
                        mediaSequence.push({
                            type: 'image',
                            order: index,
                            filename: file.name,
                            originalName: file.name,
                            clientId: null
                        });
                    }
                });
                uploadFormData.append('mediaSequence', JSON.stringify(mediaSequence));
                console.log(`📸 [Custom] ${orderedImages.length} images uploaded (fallback mode)`);
            }
        }
        
        if (customScript) {
            uploadFormData.append('customScript', customScript);
            console.log(`📝 [Custom] Script provided (${customScript.length} chars)`);
        }
        
        if (customMusic && customMusic.size > 0) {
            uploadFormData.append('customMusic', customMusic);
            console.log(`🎵 [Custom] Music uploaded: ${customMusic.name}`);
        }
        
        if (customTitle) {
            uploadFormData.append('customTitle', customTitle);
            console.log(`📝 [Custom] Title provided (${customTitle.length} chars)`);
        }
        
        if (customDescription) {
            uploadFormData.append('customDescription', customDescription);
            console.log(`📝 [Custom] Description provided (${customDescription.length} chars)`);
        }
        
        if (customTags) {
            uploadFormData.append('customTags', customTags);
            console.log(`🏷️  [Custom] Tags provided: ${customTags}`);
        }
        
        // CRITICAL: Add custom thumbnail if provided (only for YouTube format)
        const customThumbnail = formData.get('customThumbnail');
        if (customThumbnail && customThumbnail.size > 0) {
            uploadFormData.append('customThumbnail', customThumbnail);
            console.log(`🖼️  [Custom] Thumbnail uploaded: ${customThumbnail.name} (${(customThumbnail.size / 1024).toFixed(2)} KB)`);
        }
        
        // Add regular form data
        uploadFormData.append('topic', topic);
        uploadFormData.append('count', formData.get('count') || '1');
        uploadFormData.append('publishDate', formData.get('publishDate') || '');
        uploadFormData.append('videoFormat', formData.get('videoFormat') || 'shorts');
        
        // CRITICAL: TTS provider and voice selection
        const ttsProvider = formData.get('ttsProvider') || 'auto';
        const xttsVoice = formData.get('xttsVoice') || 'auto';
        const ttsVoice = formData.get('ttsVoice') || 'auto';
        const coquiVoice = formData.get('coquiVoice') || 'auto';
        
        uploadFormData.append('ttsProvider', ttsProvider);
        uploadFormData.append('xttsVoice', xttsVoice);
        uploadFormData.append('ttsVoice', ttsVoice);
        uploadFormData.append('coquiVoice', coquiVoice);
        
        console.log(`🎤 [TTS] Provider: ${ttsProvider}`);
        if (ttsProvider === 'xtts' && xttsVoice !== 'auto') {
            console.log(`🎭 [XTTS-v2] Voice: ${xttsVoice}`);
        } else if (ttsProvider === 'coqui' && coquiVoice !== 'auto') {
            console.log(`🎤 [Coqui] Voice: ${coquiVoice}`);
        } else if (ttsProvider === 'piper' && ttsVoice !== 'auto') {
            console.log(`🎤 [Piper] Voice: ${ttsVoice}`);
        }
        
        uploadFormData.append('subtitlesEnabled', formData.get('subtitlesEnabled') || 'true');
        uploadFormData.append('videoStyle', formData.get('videoStyle') || 'entertaining');
        uploadFormData.append('targetAudience', formData.get('targetAudience') || 'gen-z');
        uploadFormData.append('videoDuration', formData.get('videoDuration') || '30-45s');
        uploadFormData.append('mood', formData.get('mood') || 'energetic');
        uploadFormData.append('ctaType', formData.get('ctaType') || 'follow');
        uploadFormData.append('useCustomInput', customInputMode ? 'true' : 'false');
        
        // Add cross-posting to Instagram option
        const crossPostInstagram = document.getElementById('cross-post-instagram')?.checked || false;
        uploadFormData.append('crossPostToInstagram', crossPostInstagram ? 'true' : 'false');
        
        // Add cross-posting to TikTok option
        const crossPostTikTok = document.getElementById('cross-post-tiktok')?.checked || false;
        uploadFormData.append('crossPostToTikTok', crossPostTikTok ? 'true' : 'false');

        try {
            this.startGeneration();
            
            const response = await fetch('/api/generate-shorts', {
                method: 'POST',
                body: uploadFormData // FormData automatically sets Content-Type with boundary
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

        this.pollInterval = setInterval(async () => {
            await this.checkJobStatus();
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
                
                try {
                if (status.status === 'completed') {
                        // Refresh accounts before showing results (for re-upload feature)
                        await this.checkAuthStatus();
                        await this.showResults(status.videos || []);
                } else {
                        this.showError(status.errors?.join(', ') || 'Generation failed');
                }
                } catch (finalizeError) {
                    console.error('Error finalizing job:', finalizeError);
                    this.showError(finalizeError.message || 'Failed to finalize generation');
                } finally {
                this.resetUI();
                    this.currentJobId = null;
                }
            }
        } catch (error) {
            console.error('Error checking job status:', error);
        }
    }

    updateProgress(status) {
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const circularProgress = document.getElementById('circular-progress');
        const circularProgressText = document.getElementById('circular-progress-text');
        const progressStatus = document.getElementById('progress-status');
        const progressTime = document.getElementById('progress-time');
        
        const progress = status.progress || 0;
        
        // Update linear progress bar
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${progress}%`;
        }
        
        // Update circular progress
        if (circularProgress && circularProgressText) {
            const angle = (progress / 100) * 360;
            circularProgress.style.background = `conic-gradient(from 0deg, #667eea 0%, #667eea ${angle}deg, #e5e7eb ${angle}deg)`;
            circularProgressText.textContent = `${progress}%`;
        }
        
        // Update status text
        if (progressStatus && status.currentStep) {
            progressStatus.textContent = status.currentStep;
        }
        
        // Update time estimate (simple calculation)
        if (progressTime) {
            if (progress > 0 && progress < 100) {
                const estimatedTotal = 120; // 2 minutes estimate
                const elapsed = (progress / 100) * estimatedTotal;
                const remaining = Math.max(0, estimatedTotal - elapsed);
                progressTime.textContent = `Estimated time remaining: ${Math.ceil(remaining)}s`;
            } else if (progress >= 100) {
                progressTime.textContent = 'Almost done!';
            } else {
                progressTime.textContent = 'Estimated time: Calculating...';
            }
        }
        
        // Update step cards
        this.updateProgressStepCards(status);
    }

    // Update progress step cards
    updateProgressStepCards(status) {
        const stepCards = {
            1: { id: 'step-card-1', icon: 'fa-file-alt', title: 'Generating Script', desc: 'Creating engaging content...' },
            2: { id: 'step-card-2', icon: 'fa-microphone', title: 'Creating Audio', desc: 'Generating TTS narration...' },
            3: { id: 'step-card-3', icon: 'fa-video', title: 'Processing Video', desc: 'Assembling final video...' },
            4: { id: 'step-card-4', icon: 'fa-upload', title: 'Uploading', desc: 'Publishing to YouTube...' }
        };

        // Determine current step based on progress
        let currentStepNum = 1;
        if (status.progress >= 75) currentStepNum = 4;
        else if (status.progress >= 50) currentStepNum = 3;
        else if (status.progress >= 25) currentStepNum = 2;

        Object.keys(stepCards).forEach(stepNum => {
            const stepCard = document.getElementById(stepCards[stepNum].id);
            if (stepCard) {
                const stepNumInt = parseInt(stepNum);
                stepCard.classList.remove('active', 'completed');
                
                if (stepNumInt < currentStepNum) {
                    stepCard.classList.add('completed');
                    const icon = stepCard.querySelector('i');
                    if (icon) icon.className = 'fas fa-check text-green-500';
                } else if (stepNumInt === currentStepNum) {
                    stepCard.classList.add('active');
                    const icon = stepCard.querySelector('i');
                    if (icon) {
                        icon.className = `fas ${stepCards[stepNum].icon} text-blue-600`;
                        // Add pulse animation
                        icon.classList.add('animate-pulse');
                    }
                } else {
                    const icon = stepCard.querySelector('i');
                    if (icon) icon.className = `fas ${stepCards[stepNum].icon} text-gray-500`;
                }
            }
        });
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

    // Get all accounts (for re-upload feature)
    getAccounts() {
        return this.accounts || [];
    }

    // Get current account (for re-upload feature)
    getCurrentAccount() {
        return this.currentAccount || null;
    }

    async showResults(videos) {
        const resultsContainer = document.getElementById('results-container');
        const videoResults = document.getElementById('video-results');
        
        // Get accounts for re-upload feature (already refreshed in checkJobStatus)
        const accounts = this.getAccounts();
        const currentAccount = this.getCurrentAccount();
        const otherAccounts = accounts.filter(acc => acc.accountId !== currentAccount?.accountId);
        const hasMultipleAccounts = accounts.length > 1;
        
        console.log('🔍 [Re-upload] Accounts:', accounts.length, 'Other accounts:', otherAccounts.length);
        console.log('🔍 [Re-upload] Videos with savedVideoId:', videos.map(v => ({ title: v.title, savedVideoId: v.savedVideoId })));
        
        videoResults.innerHTML = videos.map(video => {
            const hasReuploadOption = video.savedVideoId && hasMultipleAccounts && otherAccounts.length > 0;
            
            if (video.savedVideoId && !hasReuploadOption) {
                console.log('⚠️ [Re-upload] Video has savedVideoId but re-upload option disabled:', {
                    savedVideoId: video.savedVideoId,
                    hasMultipleAccounts,
                    otherAccountsLength: otherAccounts.length
                });
            }
            
            return `
            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h5 class="font-medium text-gray-800">${video.title}</h5>
                        <p class="text-sm text-gray-500 mt-1">Video ID: ${video.videoId}</p>
                    </div>
                    <div class="flex gap-2">
                        ${hasReuploadOption ? `
                        <button 
                            onclick="openReuploadDialog('${video.savedVideoId}', ${JSON.stringify(otherAccounts).replace(/"/g, '&quot;').replace(/'/g, '&#39;')}, null)"
                            class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                            title="Upload to other channels"
                        >
                            <i class="fas fa-share-alt mr-1"></i>
                            Re-upload
                        </button>
                        ` : ''}
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
            </div>
        `;
        }).join('');

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

    // Load Piper TTS voices from backend
    async loadPiperVoices() {
        try {
            const response = await fetch('/api/piper-voices');
            const data = await response.json();
            
            const voiceSelect = document.getElementById('tts-voice');
            if (!voiceSelect) return;
            
            // Clear existing options except "Auto"
            voiceSelect.innerHTML = '<option value="auto">🎤 Auto (Default Voice)</option>';
            
            if (data.success && data.voices && data.voices.length > 0) {
                data.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.path;
                    const displayName = voice.name || voice.filename || 'Unknown Voice';
                    option.textContent = `${displayName}${voice.quality ? ` (${voice.quality})` : ''}`;
                    voiceSelect.appendChild(option);
                });
                console.log(`✅ Loaded ${data.voices.length} Piper voice(s):`, data.voices.map(v => v.name || v.filename));
                
                // Show debug info in console
                if (data.debug) {
                    console.log('🔍 Debug Info:', data.debug);
                }
                if (data.searchedDirs && data.searchedDirs.length > 0) {
                    console.log('📁 Searched directories:', data.searchedDirs);
                }
            } else {
                console.warn('⚠️ No Piper voices found.');
                if (data.error) {
                    console.error('Error:', data.error);
                }
                if (data.debug) {
                    console.log('🔍 Debug Info:', data.debug);
                    console.log('💡 Tip: Ses dosyalarınızı C:\\piper\\ klasörüne koyun veya PIPER_MODEL env variable\'ını ayarlayın');
                }
            }
        } catch (error) {
            console.error('❌ Error loading Piper voices:', error);
            // Keep default "Auto" option
        }
    }

    // Initialize Step Wizard
    initStepWizard() {
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        const generateBtn = document.getElementById('generate-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                // Validate current step before proceeding
                if (this.validateCurrentStep()) {
                    this.goToStep(this.currentStep + 1);
                }
            });
        }

        // Update step indicators and navigation buttons on load
        this.updateStepIndicators();
        this.updateNavigationButtons();
    }

    // Validate current step
    validateCurrentStep() {
        if (this.currentStep === 1) {
            const customInputMode = document.getElementById('custom-input-mode')?.checked;
            const customScript = document.getElementById('custom-script')?.value.trim();
            const topic = document.getElementById('topic')?.value.trim();

            if (customInputMode) {
                // Custom mode: Script is required
                if (!customScript) {
                    alert('⚠️ Please enter a custom script for custom mode.');
                    document.getElementById('custom-script')?.focus();
                    return false;
                }
            } else {
                // AI mode: Topic is required
                if (!topic) {
                    alert('⚠️ Please enter a topic for AI generation.');
                    document.getElementById('topic')?.focus();
                    return false;
                }
            }
        }
        return true;
    }

    // Navigate to specific step
    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;

        // Hide current step
        const currentStepContent = document.querySelector(`.step-content[data-step="${this.currentStep}"]`);
        if (currentStepContent) {
            currentStepContent.classList.remove('active');
        }

        // Show new step
        this.currentStep = step;
        const newStepContent = document.querySelector(`.step-content[data-step="${this.currentStep}"]`);
        if (newStepContent) {
            newStepContent.classList.add('active');
        }

        // Update step indicators
        this.updateStepIndicators();

        // Update navigation buttons
        this.updateNavigationButtons();

        // If Step 2, ensure custom input section visibility matches mode
        if (step === 2) {
            const customInputMode = document.getElementById('custom-input-mode')?.checked;
            const customInputSection = document.getElementById('custom-input-section');
            const aiMediaSection = document.getElementById('ai-media-section');
            
            if (customInputMode) {
                if (customInputSection) customInputSection.classList.remove('hidden');
                if (aiMediaSection) aiMediaSection.classList.add('hidden');
            } else {
                if (customInputSection) customInputSection.classList.add('hidden');
                if (aiMediaSection) aiMediaSection.classList.remove('hidden');
            }
        }
    }

    // Update step indicators
    updateStepIndicators() {
        const stepItems = document.querySelectorAll('.step-item');
        stepItems.forEach((item, index) => {
            const stepNum = index + 1;
            item.classList.remove('active', 'completed');
            if (stepNum < this.currentStep) {
                item.classList.add('completed');
            } else if (stepNum === this.currentStep) {
                item.classList.add('active');
            }
        });
    }

    // Update navigation buttons visibility
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        const generateBtn = document.getElementById('generate-btn');

        if (prevBtn) {
            prevBtn.classList.toggle('hidden', this.currentStep === 1);
        }
        if (nextBtn) {
            nextBtn.classList.toggle('hidden', this.currentStep === this.totalSteps);
        }
        if (generateBtn) {
            generateBtn.classList.toggle('hidden', this.currentStep !== this.totalSteps);
        }
    }

    // Handle Custom/AI Mode Toggle
    handleModeToggle(isCustomMode) {
        const customInputSection = document.getElementById('custom-input-section');
        const customScriptSection = document.getElementById('custom-script-section');
        const jsonImportSection = document.getElementById('json-import-section');
        const presetButtonsSection = document.getElementById('preset-buttons-section');
        const aiTopicSection = document.getElementById('ai-topic-section');
        const aiMediaSection = document.getElementById('ai-media-section');
        const aiVideoStyleSection = document.getElementById('ai-video-style-section');
        const aiTargetAudienceSection = document.getElementById('ai-target-audience-section');
        const aiMoodSection = document.getElementById('ai-mood-section');
        const formTitle = document.getElementById('title-text');
        const formSubtitle = document.getElementById('subtitle-text');
        const aiForm = document.getElementById('ai-form');

        if (isCustomMode) {
            // Custom Mode: Show custom inputs, hide AI options
            if (customInputSection) customInputSection.classList.remove('hidden');
            if (customScriptSection) customScriptSection.classList.remove('hidden');
            if (jsonImportSection) jsonImportSection.classList.remove('hidden');
            if (presetButtonsSection) presetButtonsSection.classList.remove('hidden');
            if (aiTopicSection) aiTopicSection.classList.add('hidden');
            if (aiMediaSection) aiMediaSection.classList.add('hidden');
            if (aiVideoStyleSection) aiVideoStyleSection.classList.add('hidden');
            if (aiTargetAudienceSection) aiTargetAudienceSection.classList.add('hidden');
            if (aiMoodSection) aiMoodSection.classList.add('hidden');
            if (formTitle) formTitle.textContent = 'Custom Video Creation';
            if (formSubtitle) formSubtitle.textContent = 'Upload Your Own Content';
            if (aiForm) {
                aiForm.classList.remove('ai-mode-active');
                aiForm.classList.add('custom-mode-active');
            }
        } else {
            // AI Mode: Hide custom inputs, show AI options
            if (customInputSection) customInputSection.classList.add('hidden');
            if (customScriptSection) customScriptSection.classList.add('hidden');
            if (jsonImportSection) jsonImportSection.classList.add('hidden');
            if (presetButtonsSection) presetButtonsSection.classList.add('hidden');
            if (aiTopicSection) aiTopicSection.classList.remove('hidden');
            if (aiMediaSection) aiMediaSection.classList.remove('hidden');
            if (aiVideoStyleSection) aiVideoStyleSection.classList.remove('hidden');
            if (aiTargetAudienceSection) aiTargetAudienceSection.classList.remove('hidden');
            if (aiMoodSection) aiMoodSection.classList.remove('hidden');
            if (formTitle) formTitle.textContent = 'Video Creation Studio';
            if (formSubtitle) formSubtitle.textContent = 'AI-Powered Content Generation';
            if (aiForm) {
                aiForm.classList.remove('custom-mode-active');
                aiForm.classList.add('ai-mode-active');
            }
        }
    }

    // Load Coqui TTS voices from backend
    async loadXTTSVoices() {
        try {
            const response = await fetch('/api/xtts-voices');
            const data = await response.json();
            
            const voiceSelect = document.getElementById('xtts-voice');
            if (!voiceSelect) return;
            
            // Clear existing options except "Auto"
            voiceSelect.innerHTML = '<option value="auto">🎤 Auto (Default - Narrator Sample 2)</option>';
            
            if (data.success && data.voices && data.voices.length > 0) {
                data.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id; // Full filename (e.g., "narrator_sample_2.wav")
                    const displayName = voice.name || voice.id;
                    option.textContent = `🎭 ${displayName}`;
                    voiceSelect.appendChild(option);
                });
                console.log(`✅ Loaded ${data.voices.length} XTTS voice(s):`, data.voices.map(v => v.name || v.id));
            } else {
                console.warn('⚠️ No XTTS voices found.');
                if (data.error) {
                    console.error('Error:', data.error);
                }
            }
        } catch (error) {
            console.error('❌ Error loading XTTS voices:', error);
        }
    }

    async loadCoquiVoices() {
        try {
            const response = await fetch('/api/coqui-voices');
            const data = await response.json();
            
            const voiceSelect = document.getElementById('coqui-voice');
            if (!voiceSelect) return;
            
            // Clear existing options except "Auto"
            voiceSelect.innerHTML = '<option value="auto">🎤 Auto (Default Voice - p230)</option>';
            
            if (data.success && data.voices && data.voices.length > 0) {
                data.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id; // Use speaker ID (e.g., "p260")
                    const displayName = voice.name || voice.id;
                    option.textContent = displayName;
                    voiceSelect.appendChild(option);
                });
                console.log(`✅ Loaded ${data.voices.length} Coqui voice(s):`, data.voices.map(v => v.name || v.id));
                
                if (data.model) {
                    console.log(`📦 Using model: ${data.model}`);
                }
            } else {
                console.warn('⚠️ No Coqui voices found.');
                if (data.error) {
                    console.error('Error:', data.error);
                }
            }
        } catch (error) {
            console.error('❌ Error loading Coqui voices:', error);
            // Keep default "Auto" option
        }
    }

    handleTTSProviderChange(provider) {
        const xttsSection = document.getElementById('xtts-voice-section');
        const coquiSection = document.getElementById('coqui-voice-section');
        
        if (!xttsSection || !coquiSection) return;
        
        // Show/hide voice sections based on selected provider
        if (provider === 'xtts') {
            xttsSection.style.display = 'block';
            coquiSection.style.display = 'none';
        } else if (provider === 'coqui') {
            xttsSection.style.display = 'none';
            coquiSection.style.display = 'block';
        } else if (provider === 'auto') {
            // Auto: Show both sections
            xttsSection.style.display = 'block';
            coquiSection.style.display = 'block';
        } else {
            // Other providers (piper, gtts, windows): Hide both
            xttsSection.style.display = 'none';
            coquiSection.style.display = 'none';
        }
    }
}

// Global functions
// NEW: Authenticate Instagram
async function authenticateInstagram() {
    try {
        const response = await fetch('/api/instagram/auth-url');
        const data = await response.json();
        
        if (data.success && data.authUrl) {
            window.location.href = data.authUrl;
        } else {
            alert('Failed to get Instagram authentication URL: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Failed to start Instagram authentication:', error);
        alert('Failed to start authentication: ' + error.message);
    }
}

// NEW: Authenticate TikTok
async function authenticateTikTok() {
    try {
        const response = await fetch('/api/tiktok/auth-url');
        const data = await response.json();
        
        if (data.success && data.authUrl) {
            window.location.href = data.authUrl;
        } else {
            alert('Failed to get TikTok authentication URL: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Failed to start TikTok authentication:', error);
        alert('Failed to start authentication: ' + error.message);
    }
}

async function authenticateYouTube() {
    try {
        const response = await fetch('/api/youtube/auth');
        const data = await response.json();
        
        if (data.authUrl) {
            // Use redirect instead of popup to avoid redirect_uri_mismatch
            // Redirect to OAuth URL - callback will redirect back to home page
            window.location.href = data.authUrl;
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Failed to start authentication: ' + error.message);
    }
}

// NEW: Global function for removing account
async function removeYouTubeAccount(accountId) {
    if (window.shortsAutomation) {
        await window.shortsAutomation.removeYouTubeAccount(accountId);
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

            const result = data.result || {};
            
            // Show detailed success message with re-upload option
            const successMessage = `🎉 VIDEO UPLOAD SUCCESSFUL! 🎉\n\n` +
                `📺 Title: ${result.title || title || 'Your Video'}\n` +
                `🔗 URL: ${result.url || 'Processing...'}\n` +
                `📊 Video ID: ${result.videoId || 'N/A'}\n` +
                `⏰ Upload Time: ${new Date().toLocaleString()}\n` +
                `📱 Status: ${result.status === 'scheduled' ? 'Scheduled for ' + new Date(result.publishAt).toLocaleString() : 'Published Now'}\n\n` +
                `✨ Your video is ready to go viral! 🚀`;
            
            alert(successMessage);
            
            // Show re-upload option if savedVideoId exists and multiple accounts available
            if (result.savedVideoId) {
                console.log('💾 [Re-upload] Saved video ID found:', result.savedVideoId);
                // Refresh accounts data first
                if (window.shortsAutomation) {
                    await window.shortsAutomation.checkAuthStatus();
                }
                
                const accounts = window.shortsAutomation?.getAccounts() || [];
                console.log('📋 [Re-upload] Available accounts:', accounts.length);
                
                if (accounts.length > 1) {
                    const currentAccount = window.shortsAutomation?.getCurrentAccount();
                    const otherAccounts = accounts.filter(acc => acc.accountId !== currentAccount?.accountId);
                    console.log('📋 [Re-upload] Other accounts:', otherAccounts.length);
                    
                    if (otherAccounts.length > 0 && confirm(`Would you like to upload this video to ${otherAccounts.length} other channel(s)?`)) {
                        openReuploadDialog(result.savedVideoId, otherAccounts, {
                            title: title,
                            description: description,
                            tags: tags
                        });
                    }
                } else {
                    console.log('⚠️ [Re-upload] Only one account available, skipping re-upload option');
                }
            } else {
                console.log('⚠️ [Re-upload] No savedVideoId in result:', result);
            }
            
            // Optional: Open the video in a new tab if URL is available
            if (result.url && confirm('Would you like to open your video on YouTube?')) {
                window.open(result.url, '_blank');
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

// Re-upload dialog functions
let currentReuploadData = null;

function openReuploadDialog(videoId, accounts, metadata = null) {
    currentReuploadData = { videoId, accounts, metadata };
    
    const dialog = document.getElementById('reupload-dialog');
    const accountsList = document.getElementById('reupload-accounts-list');
    const progressDiv = document.getElementById('reupload-progress');
    
    // Reset UI
    progressDiv.classList.add('hidden');
    accountsList.innerHTML = '';
    
    // Create checkboxes for each account
    accounts.forEach(account => {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'flex items-center p-3 border rounded hover:bg-gray-50';
        accountDiv.innerHTML = `
            <input type="checkbox" 
                   id="account-${account.accountId}" 
                   value="${account.accountId}" 
                   class="mr-3 w-4 h-4 text-blue-600"
                   checked>
            <label for="account-${account.accountId}" class="flex-1 cursor-pointer">
                <div class="font-medium">${account.channelInfo?.title || 'Unknown Channel'}</div>
                <div class="text-xs text-gray-500">${account.email || ''}</div>
            </label>
        `;
        accountsList.appendChild(accountDiv);
    });
    
    dialog.classList.remove('hidden');
    dialog.classList.add('flex');
}

function closeReuploadDialog() {
    const dialog = document.getElementById('reupload-dialog');
    dialog.classList.add('hidden');
    dialog.classList.remove('flex');
    currentReuploadData = null;
}

// Re-upload dialog event listeners
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'reupload-cancel') {
        closeReuploadDialog();
    }
    
    if (e.target && e.target.id === 'reupload-confirm') {
        if (!currentReuploadData) return;
        
        const accountsList = document.getElementById('reupload-accounts-list');
        const progressDiv = document.getElementById('reupload-progress');
        const statusDiv = document.getElementById('reupload-status');
        const confirmBtn = document.getElementById('reupload-confirm');
        
        // Get selected account IDs
        const selectedAccounts = Array.from(accountsList.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        if (selectedAccounts.length === 0) {
            alert('Please select at least one channel');
            return;
        }
        
        // Show progress
        confirmBtn.disabled = true;
        progressDiv.classList.remove('hidden');
        statusDiv.textContent = `Uploading to ${selectedAccounts.length} channel(s)...`;
        
        try {
            const response = await fetch('/api/reupload-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: currentReuploadData.videoId,
                    accountIds: selectedAccounts,
                    customMetadata: currentReuploadData.metadata
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Re-upload failed');
            }
            
            // Show results
            let message = `✅ Successfully uploaded to ${data.results.length} channel(s):\n\n`;
            data.results.forEach(result => {
                message += `📺 ${result.channelName}\n🔗 ${result.url}\n\n`;
            });
            
            if (data.errors && data.errors.length > 0) {
                message += `\n❌ Failed to upload to ${data.errors.length} channel(s):\n\n`;
                data.errors.forEach(error => {
                    message += `❌ ${error.accountId}: ${error.error}\n`;
                });
            }
            
            alert(message);
            closeReuploadDialog();
        } catch (error) {
            alert('❌ Re-upload failed: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            progressDiv.classList.add('hidden');
        }
    }
});

// Schedule Time Helper Function for Quick Buttons
function setScheduleTime(hoursFromNow, specificHour = null) {
    const input = document.getElementById('publish-date');
    if (!input) return;
    
    const now = new Date();
    let targetDate = new Date(now);
    
    if (hoursFromNow > 0) {
        // Add hours from now
        targetDate.setHours(targetDate.getHours() + hoursFromNow);
    } else if (specificHour !== null) {
        // Set to specific hour today or tomorrow
        targetDate.setHours(specificHour, 0, 0, 0);
        // If the time has passed today, set it for tomorrow
        if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
    }
    
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    
    input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    // Visual feedback
    input.classList.add('ring-2', 'ring-purple-400');
    setTimeout(() => {
        input.classList.remove('ring-2', 'ring-purple-400');
    }, 500);
}

// Set minimum date for publish-date input on page load
document.addEventListener('DOMContentLoaded', () => {
    const publishInput = document.getElementById('publish-date');
    if (publishInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        publishInput.min = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.shortsAutomation = new ShortsAutomation();
});