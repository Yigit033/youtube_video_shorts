const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Security middleware configuration
const securityMiddleware = (app) => {
  if (process.env.NODE_ENV === 'production') {
    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.pexels.com", "https://api-inference.huggingface.co", "https://localhost:11434"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      }
    });
    
    app.use('/api/', limiter);
    app.use('/auth/', limiter);
    
    // Compression
    app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
    
    // Logging setup
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const accessLogStream = fs.createWriteStream(
      path.join(logDir, 'access.log'),
      { flags: 'a' }
    );
    
    app.use(morgan('combined', { 
      stream: accessLogStream,
      skip: (req, res) => req.url === '/health'
    }));
    
    // CORS for production
    app.use((req, res, next) => {
      const allowedOrigins = [
        process.env.CORS_ORIGIN || 'https://youtube-shorts-automation.onrender.com',
        'https://localhost:3000'
      ];
      
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    
    console.log('✅ Production security middleware loaded');
  } else {
    console.log('🔧 Development mode - security middleware disabled');
  }
};

module.exports = securityMiddleware;
