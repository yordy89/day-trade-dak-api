export default () => ({
  // Application
  port: parseInt(process.env.PORT, 10) || 4000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    uri: process.env.MONGO_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // Redis Cache
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // AWS Configuration
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3: {
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      profileImageFolder: process.env.AWS_S3_PROFILE_IMAGE_FOLDER,
      classFolder: process.env.AWS_S3_CLASS_VIDEO_FOLDER,
      mentorshipFolder: process.env.AWS_S3_MENTORSHIP_FOLDER,
      stockFolder: process.env.AWS_S3_STOCK_VIDEO_FOLDER,
      psicotradingFolder: process.env.AWS_S3_PSICOTRADING_VIDEO_FOLDER,
      curso1Folder: process.env.AWS_S3_CURSO_1_FOLDER,
      classesFolder: process.env.AWS_S3_CLASS_COURSE_CLASS || 'course-class',
    },
  },

  // CloudFront
  cloudfront: {
    domain: process.env.CLOUDFRONT_DOMAIN,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Finnhub
  finnhub: {
    apiKey: process.env.FINNHUB_API_KEY,
  },

  // Email (SendGrid)
  email: {
    sendGridApiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@daytradedak.com',
    fromName: process.env.FROM_NAME || 'DayTradeDak',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
    limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Throttle
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  // CORS
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    credentials: true,
  },

  // Performance
  performance: {
    enableMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL, 10) || 60000,
  },
});
