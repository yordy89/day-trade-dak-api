export enum SettingCategory {
  GENERAL = 'general',
  SOCIAL_MEDIA = 'social_media',
  CONTACT = 'contact',
  FOOTER = 'footer',
  FEATURES = 'features',
  PAYMENTS = 'payments',
  EMAIL = 'email',
  NOTIFICATIONS = 'notifications',
  TRADING = 'trading',
  BRANDING = 'branding',
}

export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
}

export interface SettingMetadata {
  label: string;
  description?: string;
  placeholder?: string;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  order?: number;
  visible?: boolean;
  editable?: boolean;
}

export interface ISetting {
  key: string;
  value: any;
  type: SettingType;
  category: SettingCategory;
  metadata: SettingMetadata;
  defaultValue?: any;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  isActive?: boolean;
}