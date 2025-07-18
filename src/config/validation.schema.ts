import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(4000),
  HOST: Joi.string().default('0.0.0.0'),

  // Database
  MONGO_URI: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().default(10),

  // Redis (optional but recommended)
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),

  // AWS (required)
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_S3_BUCKET_NAME: Joi.string().required(),
  AWS_S3_PROFILE_IMAGE_FOLDER: Joi.string().optional(),
  AWS_S3_CLASS_VIDEO_FOLDER: Joi.string().optional(),
  AWS_S3_MENTORSHIP_FOLDER: Joi.string().optional(),
  AWS_S3_STOCK_VIDEO_FOLDER: Joi.string().optional(),
  AWS_S3_PSICOTRADING_VIDEO_FOLDER: Joi.string().optional(),
  AWS_S3_CURSO_1_FOLDER: Joi.string().optional(),

  // CloudFront (optional)
  CLOUDFRONT_DOMAIN: Joi.string().optional(),
  CLOUDFRONT_KEY_PAIR_ID: Joi.string().optional(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),

  // OpenAI
  OPENAI_API_KEY: Joi.string().optional().allow(''),

  // Finnhub
  FINNHUB_API_KEY: Joi.string().optional().allow(''),

  // Email
  SENDGRID_API_KEY: Joi.string().optional().allow(''),
  FROM_EMAIL: Joi.string().email().default('noreply@daytradedak.com'),
  FROM_NAME: Joi.string().default('DayTradeDak'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_DIR: Joi.string().default('logs'),
  LOG_MAX_FILES: Joi.string().default('14d'),
  LOG_MAX_SIZE: Joi.string().default('20m'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // Throttle
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // CORS
  ALLOWED_ORIGINS: Joi.string().optional(),

  // Performance
  ENABLE_PERFORMANCE_MONITORING: Joi.boolean().default(true),
  METRICS_INTERVAL: Joi.number().default(60000),
  PERFORMANCE_LOG_INTERVAL: Joi.number().default(300000),

  // Security
  REQUEST_TIMEOUT: Joi.number().default(30000),
  HELMET_CSP_DIRECTIVES: Joi.string().optional(),
});
