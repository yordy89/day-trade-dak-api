import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly minScore: number;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY') || '';
    this.minScore = this.configService.get<number>('RECAPTCHA_MIN_SCORE') || 0.5;
    this.enabled = this.configService.get<boolean>('RECAPTCHA_ENABLED') !== false;

    if (this.enabled && !this.secretKey) {
      this.logger.warn('reCAPTCHA is enabled but RECAPTCHA_SECRET_KEY is not set');
    }
  }

  async verifyToken(token: string, expectedAction?: string): Promise<boolean> {
    // If reCAPTCHA is disabled, always return true
    if (!this.enabled) {
      this.logger.debug('reCAPTCHA is disabled, skipping verification');
      return true;
    }

    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured, skipping verification');
      return true;
    }

    if (!token) {
      this.logger.warn('No reCAPTCHA token provided');
      throw new BadRequestException('reCAPTCHA verification required');
    }

    try {
      const response = await axios.post<RecaptchaVerifyResponse>(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: this.secretKey,
            response: token,
          },
        },
      );

      const { success, score, action } = response.data;

      if (!success) {
        this.logger.warn('reCAPTCHA verification failed', {
          errors: response.data['error-codes'],
        });
        return false;
      }

      // Check score (reCAPTCHA v3)
      if (score !== undefined && score < this.minScore) {
        this.logger.warn(`reCAPTCHA score too low: ${score} < ${this.minScore}`);
        return false;
      }

      // Check action if expected
      if (expectedAction && action !== expectedAction) {
        this.logger.warn(`reCAPTCHA action mismatch: expected ${expectedAction}, got ${action}`);
        return false;
      }

      this.logger.debug(`reCAPTCHA verified successfully, score: ${score}`);
      return true;
    } catch (error) {
      this.logger.error('reCAPTCHA verification error', error);
      // In case of network errors, we might want to allow the request
      // depending on security requirements. For now, we'll reject.
      return false;
    }
  }
}
