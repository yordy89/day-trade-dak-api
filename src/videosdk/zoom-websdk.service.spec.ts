import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ZoomWebSDKService } from './zoom-websdk.service';

describe('ZoomWebSDKService', () => {
  let service: ZoomWebSDKService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoomWebSDKService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                ZOOM_SDK_KEY: 'test-sdk-key',
                ZOOM_SDK_SECRET: 'test-sdk-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ZoomWebSDKService>(ZoomWebSDKService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when SDK key and secret are configured', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when SDK credentials are missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      const serviceWithoutConfig = new ZoomWebSDKService(configService);
      expect(serviceWithoutConfig.isConfigured()).toBe(false);
    });
  });

  describe('validateMeetingNumber', () => {
    it('should validate correct meeting numbers', () => {
      expect(service.validateMeetingNumber('123456789')).toBe(true); // 9 digits
      expect(service.validateMeetingNumber('1234567890')).toBe(true); // 10 digits
      expect(service.validateMeetingNumber('12345678901')).toBe(true); // 11 digits
      expect(service.validateMeetingNumber('123 456 7890')).toBe(true); // with spaces
      expect(service.validateMeetingNumber('123-456-7890')).toBe(true); // with hyphens
    });

    it('should reject invalid meeting numbers', () => {
      expect(service.validateMeetingNumber('12345678')).toBe(false); // too short
      expect(service.validateMeetingNumber('123456789012')).toBe(false); // too long
      expect(service.validateMeetingNumber('abc123456')).toBe(false); // contains letters
      expect(service.validateMeetingNumber('')).toBe(false); // empty
    });
  });

  describe('cleanMeetingNumber', () => {
    it('should remove spaces and hyphens from meeting numbers', () => {
      expect(service.cleanMeetingNumber('123 456 7890')).toBe('1234567890');
      expect(service.cleanMeetingNumber('123-456-7890')).toBe('1234567890');
      expect(service.cleanMeetingNumber('123 - 456 - 7890')).toBe('1234567890');
      expect(service.cleanMeetingNumber('1234567890')).toBe('1234567890');
    });
  });

  describe('generateSDKSignature', () => {
    it('should generate a valid JWT signature', () => {
      const dto = {
        meetingNumber: '1234567890',
        role: 0 as const,
      };

      const signature = service.generateSDKSignature(dto);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      // JWT format: header.payload.signature
      expect(signature.split('.').length).toBe(3);
    });

    it('should throw error when SDK credentials are not configured', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      const serviceWithoutConfig = new ZoomWebSDKService(configService);

      expect(() => {
        serviceWithoutConfig.generateSDKSignature({
          meetingNumber: '1234567890',
          role: 0,
        });
      }).toThrow('Zoom SDK credentials are not configured');
    });
  });

  describe('generateWebSDKCredentials', () => {
    it('should generate complete credentials object', () => {
      const credentials = service.generateWebSDKCredentials(
        '1234567890',
        0,
        'Test User',
        'test@example.com',
        'password123',
      );

      expect(credentials).toMatchObject({
        signature: expect.any(String),
        sdkKey: 'test-sdk-key',
        meetingNumber: '1234567890',
        role: 0,
        userName: 'Test User',
        userEmail: 'test@example.com',
        password: 'password123',
      });
    });

    it('should generate credentials without password', () => {
      const credentials = service.generateWebSDKCredentials(
        '1234567890',
        1,
        'Host User',
        'host@example.com',
      );

      expect(credentials).toMatchObject({
        signature: expect.any(String),
        sdkKey: 'test-sdk-key',
        meetingNumber: '1234567890',
        role: 1,
        userName: 'Host User',
        userEmail: 'host@example.com',
      });
      expect(credentials.password).toBeUndefined();
    });
  });
});