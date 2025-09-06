const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'temp', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm|m4v/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'));
    }
  }
});

// Upload video endpoint
router.post('/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No video file uploaded' 
      });
    }

    const videoPath = req.file.path;
    const videoInfo = await analyzeVideo(videoPath);
    
    res.json({
      success: true,
      videoId: path.basename(videoPath, path.extname(videoPath)),
      videoPath: videoPath,
      info: videoInfo,
      message: 'Video uploaded and analyzed successfully'
    });

  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Analyze uploaded video
async function analyzeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Video analysis failed: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      const info = {
        duration: parseFloat(metadata.format.duration),
        size: parseInt(metadata.format.size),
        format: metadata.format.format_name,
        video: videoStream ? {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: eval(videoStream.r_frame_rate),
          bitrate: parseInt(videoStream.bit_rate)
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          channels: audioStream.channels,
          sampleRate: parseInt(audioStream.sample_rate),
          bitrate: parseInt(audioStream.bit_rate)
        } : null,
        isShortsCompatible: videoStream && videoStream.height > videoStream.width,
        aspectRatio: videoStream ? (videoStream.width / videoStream.height).toFixed(2) : null
      };

      resolve(info);
    });
  });
}

// Get video preview/thumbnail
router.get('/preview/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoPath = path.join(__dirname, '..', 'temp', 'uploads', `${videoId}.mp4`);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const thumbnailPath = path.join(__dirname, '..', 'temp', 'thumbnails', `${videoId}_thumb.jpg`);
    const thumbnailDir = path.dirname(thumbnailPath);
    
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Generate thumbnail at 5 seconds
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['5%'],
        filename: path.basename(thumbnailPath),
        folder: thumbnailDir,
        size: '320x180'
      })
      .on('end', () => {
        res.json({
          success: true,
          thumbnailPath: thumbnailPath,
          videoPath: videoPath
        });
      })
      .on('error', (err) => {
        res.status(500).json({ 
          success: false, 
          error: `Thumbnail generation failed: ${err.message}` 
        });
      });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete uploaded video
router.delete('/video/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    const videoPath = path.join(__dirname, '..', 'temp', 'uploads', `${videoId}.mp4`);
    
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      res.json({ success: true, message: 'Video deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Video not found' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
