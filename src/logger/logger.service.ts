import { Injectable, LoggerService } from '@nestjs/common';
import { logger } from './winston.config';

@Injectable()
export class CustomLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    logger.info(message, { context: context || this.context });
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(message, {
      context: context || this.context,
      trace,
    });
  }

  warn(message: any, context?: string) {
    logger.warn(message, { context: context || this.context });
  }

  debug(message: any, context?: string) {
    logger.debug(message, { context: context || this.context });
  }

  verbose(message: any, context?: string) {
    logger.verbose(message, { context: context || this.context });
  }

  // Additional methods for structured logging
  logHttpRequest(req: any, res: any, responseTime: number) {
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      correlationId: req.headers['x-correlation-id'],
    };

    if (res.statusCode >= 400) {
      logger.error('HTTP Request Error', log);
    } else {
      logger.info('HTTP Request', log);
    }
  }

  logDatabaseQuery(query: string, parameters: any[], duration: number) {
    logger.debug('Database Query', {
      query,
      parameters,
      duration: `${duration}ms`,
      context: 'TypeORM',
    });
  }

  logBusinessEvent(event: string, data: any) {
    logger.info(`Business Event: ${event}`, {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  logSecurityEvent(event: string, data: any) {
    logger.warn(`Security Event: ${event}`, {
      event,
      data,
      timestamp: new Date().toISOString(),
      context: 'Security',
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string = 'ms') {
    logger.info(`Performance Metric: ${metric}`, {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context: 'Performance',
    });
  }
}
