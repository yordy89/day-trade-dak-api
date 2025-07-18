import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.prettyPrint(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.ms(),
  nestWinstonModuleUtilities.format.nestLike('DayTradeDak', {
    colors: true,
    prettyPrint: true,
  }),
);

// Define log directory
const logDir = process.env.LOG_DIR || 'logs';

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : customFormat,
    level: isDevelopment ? 'debug' : 'info',
  }),
];

// File transports for production
if (!isDevelopment) {
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
}

// Create logger configuration
export const winstonConfig: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: customFormat,
  transports,
  // Exit on uncaught errors
  exitOnError: false,
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      dirname: logDir,
      filename: 'rejections.log',
    }),
  ],
};

// Create winston logger instance
export const logger = winston.createLogger(winstonConfig);

// Log unhandled exceptions
if (!isDevelopment) {
  logger.exceptions.handle(
    new winston.transports.File({
      dirname: logDir,
      filename: 'exceptions.log',
    }),
  );
}
