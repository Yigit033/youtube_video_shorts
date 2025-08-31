const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      platform: process.platform,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      system: {
        cpu: os.cpus().length,
        loadAverage: os.loadavg(),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024)
      },
      services: {
        tempDirectories: await checkTempDirectories(),
        diskSpace: await checkDiskSpace()
      }
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus(),
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        networkInterfaces: os.networkInterfaces()
      },
      services: {
        tempDirectories: await checkTempDirectories(),
        diskSpace: await checkDiskSpace(),
        environmentVariables: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ? 'configured' : 'not configured',
          PEXELS_API_KEY: process.env.PEXELS_API_KEY ? 'configured' : 'not configured',
          HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'configured' : 'not configured'
        }
      }
    };

    res.status(200).json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check temp directories
async function checkTempDirectories() {
  const tempDir = path.join(__dirname, '..', 'temp');
  const subDirs = ['audio', 'videos', 'output'];
  const results = {};

  for (const subDir of subDirs) {
    const fullPath = path.join(tempDir, subDir);
    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        results[subDir] = {
          exists: true,
          writable: true,
          size: stats.size,
          created: stats.birthtime
        };
      } else {
        results[subDir] = { exists: false, writable: false };
      }
    } catch (error) {
      results[subDir] = { exists: false, writable: false, error: error.message };
    }
  }

  return results;
}

// Check disk space
async function checkDiskSpace() {
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    const stats = fs.statSync(tempDir);
    const device = stats.dev;
    
    // This is a simplified check - in production you might want to use a proper disk space library
    return {
      tempDirectory: {
        device: device,
        inode: stats.ino,
        size: stats.size
      }
    };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = router;
