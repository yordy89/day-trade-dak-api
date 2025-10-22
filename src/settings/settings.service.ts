import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './settings.schema';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto, UpdateSettingValueDto, BulkUpdateSettingsDto } from './dto/update-setting.dto';
import { SettingCategory, SettingType } from './interfaces/setting.interface';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly CACHE_PREFIX = 'settings:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
    private cacheService: CacheService,
  ) {
    this.initializeDefaultSettings();
  }

  async create(createSettingDto: CreateSettingDto): Promise<Setting> {
    try {
      const existingSetting = await this.settingModel.findOne({ key: createSettingDto.key });
      if (existingSetting) {
        throw new ConflictException(`Setting with key "${createSettingDto.key}" already exists`);
      }

      const setting = new this.settingModel({
        ...createSettingDto,
        lastModifiedAt: new Date(),
      });

      const savedSetting = await setting.save();
      await this.invalidateCache(savedSetting.key);
      
      return savedSetting;
    } catch (error) {
      this.logger.error(`Error creating setting: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(category?: SettingCategory, isActive?: boolean): Promise<Setting[]> {
    const query: any = {};
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    return this.settingModel.find(query).sort({ 'metadata.order': 1, key: 1 });
  }

  async findByCategory(category: SettingCategory): Promise<Setting[]> {
    return this.settingModel.find({ category, isActive: true }).sort({ 'metadata.order': 1 });
  }

  async findOne(key: string): Promise<Setting> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    
    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    const setting = await this.settingModel.findOne({ key, isActive: true });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    // Cache the result
    await this.cacheService.set(cacheKey, JSON.stringify(setting), this.CACHE_TTL);
    
    return setting;
  }

  async getValue(key: string, defaultValue?: any): Promise<any> {
    try {
      const setting = await this.findOne(key);
      return this.parseValue(setting.value, setting.type);
    } catch (error) {
      if (error instanceof NotFoundException && defaultValue !== undefined) {
        return defaultValue;
      }
      throw error;
    }
  }

  async update(key: string, updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const setting = await this.settingModel.findOne({ key });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    const updated = await this.settingModel.findOneAndUpdate(
      { key },
      {
        ...updateSettingDto,
        lastModifiedAt: new Date(),
      },
      { new: true },
    );

    await this.invalidateCache(key);
    
    return updated;
  }

  async updateValue(key: string, updateValueDto: UpdateSettingValueDto): Promise<Setting> {
    let setting = await this.settingModel.findOne({ key });
    
    // If setting doesn't exist, create it with the provided value
    if (!setting) {
      // Check if it's the featured_stocks setting, create with appropriate defaults
      if (key === 'featured_stocks') {
        const newSetting = new this.settingModel({
          key: 'featured_stocks',
          value: updateValueDto.value,
          type: 'json',
          category: 'trading',
          metadata: {
            label: 'Featured Stocks',
            description: 'List of featured stock symbols displayed on the platform',
            visible: true,
            editable: true,
            order: 1,
          },
          isActive: true,
          lastModifiedBy: updateValueDto.lastModifiedBy,
          lastModifiedAt: new Date(),
        });
        
        const savedSetting = await newSetting.save();
        await this.invalidateCache(key);
        return savedSetting;
      }
      
      // For other settings, still throw error if not found
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    const updated = await this.settingModel.findOneAndUpdate(
      { key },
      {
        value: updateValueDto.value,
        lastModifiedBy: updateValueDto.lastModifiedBy,
        lastModifiedAt: new Date(),
      },
      { new: true },
    );

    await this.invalidateCache(key);
    
    return updated;
  }

  async bulkUpdate(bulkUpdateDto: BulkUpdateSettingsDto): Promise<Setting[]> {
    const updatedSettings: Setting[] = [];

    for (const { key, value } of bulkUpdateDto.settings) {
      const updated = await this.updateValue(key, {
        value,
        lastModifiedBy: bulkUpdateDto.lastModifiedBy,
      });
      updatedSettings.push(updated);
    }

    return updatedSettings;
  }

  async remove(key: string): Promise<void> {
    const result = await this.settingModel.deleteOne({ key });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    
    await this.invalidateCache(key);
  }

  async getPublicSettings(): Promise<Record<string, any>> {
    const settings = await this.settingModel.find({
      isActive: true,
      'metadata.visible': true,
    });

    const publicSettings: Record<string, any> = {};
    
    settings.forEach(setting => {
      const category = setting.category.toLowerCase();
      if (!publicSettings[category]) {
        publicSettings[category] = {};
      }
      publicSettings[category][setting.key] = this.parseValue(setting.value, setting.type);
    });

    return publicSettings;
  }

  private parseValue(value: any, type: SettingType): any {
    switch (type) {
      case SettingType.NUMBER:
        return Number(value);
      case SettingType.BOOLEAN:
        return Boolean(value);
      case SettingType.JSON:
        return typeof value === 'string' ? JSON.parse(value) : value;
      default:
        return value;
    }
  }

  private async invalidateCache(key: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    await this.cacheService.del(cacheKey);
  }

  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      // Social Media
      {
        key: 'facebook_url',
        value: 'https://www.facebook.com/daytradedak/',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'Facebook URL',
          description: 'Facebook page URL',
          visible: true,
          editable: true,
          order: 1,
        },
      },
      {
        key: 'instagram_url',
        value: 'https://www.instagram.com/daytradedak/',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'Instagram URL',
          description: 'Instagram profile URL',
          visible: true,
          editable: true,
          order: 2,
        },
      },
      {
        key: 'youtube_url',
        value: 'https://www.youtube.com/channel/UCYp6JiX1ModSSZnnVLQATiA',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'YouTube URL',
          description: 'YouTube channel URL',
          visible: true,
          editable: true,
          order: 3,
        },
      },
      {
        key: 'twitter_url',
        value: 'https://twitter.com/daytradedak',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'Twitter/X URL',
          description: 'Twitter/X profile URL',
          visible: true,
          editable: true,
          order: 4,
        },
      },
      {
        key: 'linkedin_url',
        value: 'https://linkedin.com/company/daytradedak',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'LinkedIn URL',
          description: 'LinkedIn company page URL',
          visible: true,
          editable: true,
          order: 5,
        },
      },
      {
        key: 'telegram_url',
        value: 'https://t.me/daytradedak',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'Telegram URL',
          description: 'Telegram channel URL',
          visible: true,
          editable: true,
          order: 6,
        },
      },
      {
        key: 'tiktok_url',
        value: 'https://www.tiktok.com/@daytradedak',
        type: SettingType.URL,
        category: SettingCategory.SOCIAL_MEDIA,
        metadata: {
          label: 'TikTok URL',
          description: 'TikTok profile URL',
          visible: true,
          editable: true,
          order: 7,
        },
      },
      // Contact Information
      {
        key: 'contact_email',
        value: 'support@daytradedak.com',
        type: SettingType.EMAIL,
        category: SettingCategory.CONTACT,
        metadata: {
          label: 'Contact Email',
          description: 'Main contact email address',
          visible: true,
          editable: true,
          order: 1,
        },
      },
      {
        key: 'contact_phone',
        value: '+1 (786) 355-1346',
        type: SettingType.PHONE,
        category: SettingCategory.CONTACT,
        metadata: {
          label: 'Contact Phone',
          description: 'Main contact phone number',
          visible: true,
          editable: true,
          order: 2,
        },
      },
      {
        key: 'contact_address',
        value: 'Miami, Florida, USA',
        type: SettingType.STRING,
        category: SettingCategory.CONTACT,
        metadata: {
          label: 'Contact Address',
          description: 'Company address',
          visible: true,
          editable: true,
          order: 3,
        },
      },
      // Footer Settings
      {
        key: 'footer_copyright_text',
        value: '© {{year}} DayTradeDak. Todos los derechos reservados.',
        type: SettingType.STRING,
        category: SettingCategory.FOOTER,
        metadata: {
          label: 'Copyright Text',
          description: 'Footer copyright text. Use {{year}} for current year.',
          visible: true,
          editable: true,
          order: 1,
        },
      },
      {
        key: 'footer_company_description',
        value: 'Tu plataforma de confianza para el trading profesional. Formación, mentoría y comunidad para traders serios.',
        type: SettingType.STRING,
        category: SettingCategory.FOOTER,
        metadata: {
          label: 'Company Description',
          description: 'Short company description for footer',
          visible: true,
          editable: true,
          order: 2,
        },
      },
      // Trading Settings
      {
        key: 'featured_stocks',
        value: JSON.stringify(['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA']),
        type: SettingType.JSON,
        category: SettingCategory.TRADING,
        metadata: {
          label: 'Featured Stocks',
          description: 'List of featured stock symbols displayed on the platform',
          visible: true,
          editable: true,
          order: 1,
        },
      },
      // Branding
      {
        key: 'company_name',
        value: 'DayTradeDak',
        type: SettingType.STRING,
        category: SettingCategory.BRANDING,
        metadata: {
          label: 'Company Name',
          description: 'Company name used throughout the app',
          visible: true,
          editable: true,
          order: 1,
        },
      },
      {
        key: 'logo_light_url',
        value: '/assets/logos/day_trade_dak_black_logo.png',
        type: SettingType.URL,
        category: SettingCategory.BRANDING,
        metadata: {
          label: 'Logo Light Mode URL',
          description: 'Logo URL for light mode',
          visible: true,
          editable: true,
          order: 2,
        },
      },
      {
        key: 'logo_dark_url',
        value: '/assets/logos/day_trade_dak_white_logo.png',
        type: SettingType.URL,
        category: SettingCategory.BRANDING,
        metadata: {
          label: 'Logo Dark Mode URL',
          description: 'Logo URL for dark mode',
          visible: true,
          editable: true,
          order: 3,
        },
      },
      // Feature Flags
      {
        key: 'enable_referral_code',
        value: false,
        type: SettingType.BOOLEAN,
        category: SettingCategory.FEATURES,
        metadata: {
          label: 'Enable Referral Code System',
          description: 'Show referral code input field in Master Course registration (affiliate system)',
          visible: true,
          editable: true,
          order: 1,
        },
        defaultValue: false,
      },
    ];

    for (const defaultSetting of defaultSettings) {
      try {
        const exists = await this.settingModel.findOne({ key: defaultSetting.key });
        if (!exists) {
          await this.create(defaultSetting as CreateSettingDto);
          this.logger.log(`Initialized default setting: ${defaultSetting.key}`);
        }
      } catch (error) {
        this.logger.error(`Error initializing default setting ${defaultSetting.key}:`, error);
      }
    }
  }
}