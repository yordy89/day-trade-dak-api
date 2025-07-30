import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose, { Schema as MongooseSchema } from 'mongoose';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import the interfaces
import { SettingCategory, SettingType } from '../src/settings/interfaces/setting.interface';

// Define the Setting schema directly in the script
const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: MongooseSchema.Types.Mixed, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: Object.values(SettingType),
    default: SettingType.STRING 
  },
  category: { 
    type: String, 
    required: true, 
    enum: Object.values(SettingCategory),
    index: true 
  },
  metadata: { type: Object, required: true },
  defaultValue: { type: MongooseSchema.Types.Mixed },
  lastModifiedBy: String,
  lastModifiedAt: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Create the model
const SettingModel = mongoose.model('Setting', SettingSchema);

async function initializeSettings() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

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
      // Notifications
      {
        key: 'notification_emails',
        value: [],
        type: SettingType.JSON,
        category: SettingCategory.NOTIFICATIONS,
        metadata: {
          label: 'Contact Form Notification Emails',
          description: 'Email addresses that will receive notifications when contact form is submitted',
          placeholder: 'Add email addresses',
          visible: true,
          editable: true,
          order: 1,
          validation: {
            required: false,
          },
        },
      },
    ];

    console.log('Initializing default settings...');
    
    for (const settingData of defaultSettings) {
      const exists = await SettingModel.findOne({ key: settingData.key });
      
      if (!exists) {
        const setting = new SettingModel(settingData);
        await setting.save();
        console.log(`✅ Created setting: ${settingData.key}`);
      } else {
        console.log(`⏭️  Setting already exists: ${settingData.key}`);
      }
    }

    console.log('\n✅ Settings initialization complete!');
    console.log(`Total settings in database: ${await SettingModel.countDocuments()}`);
    
  } catch (error) {
    console.error('❌ Error initializing settings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the initialization
initializeSettings();