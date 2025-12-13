import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const isDevelopment = process.env.NODE_ENV !== 'production';
// Disable file logging in container/ECS environments - they should use CloudWatch via stdout
const isContainerEnv = process.env.ECS_CONTAINER_METADATA_URI || process.env.AWS_EXECUTION_ENV || process.env.DISABLE_FILE_LOGGING === 'true';

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.ms(),
  nestWinstonModuleUtilities.format.nestLike('DayTradeDak', {
    colors: !isContainerEnv, // Disable colors in container for cleaner CloudWatch logs
    prettyPrint: !isContainerEnv,
  }),
);

// Define log directory
const logDir = process.env.LOG_DIR || 'logs';

// Create transports
const transports: winston.transport[] = [
  // Console transport - always enabled, CloudWatch will capture stdout
  new winston.transports.Console({
    format: isContainerEnv ? customFormat : (isDevelopment ? consoleFormat : customFormat),
    level: isDevelopment ? 'debug' : 'info',
  }),
];

// File transports for production - but NOT in container environments
// ECS containers should log to stdout which CloudWatch captures
if (!isDevelopment && !isContainerEnv) {
  try {
    // Error log file
    transports.push(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'error',
        format: customFormat,
      }),
    );

    // Combined log file
    transports.push(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat,
      }),
    );

    // Application specific logs
    transports.push(
      new DailyRotateFile({
        dirname: `${logDir}/app`,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '7d',
        format: customFormat,
      }),
    );
  } catch (error) {
    console.warn('Failed to initialize file logging, continuing with console only:', error);
  }
}

// Create logger configuration
export const winstonConfig: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: customFormat,
  transports,
  // Exit on uncaught errors
  exitOnError: false,
};

// Create winston logger instance
export const logger = winston.createLogger(winstonConfig);

// Log startup info
if (isContainerEnv) {
  logger.info('Running in container environment - file logging disabled, using stdout for CloudWatch');
}
