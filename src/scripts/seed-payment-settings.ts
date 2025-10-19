import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SettingsService } from '../settings/settings.service';
import { SettingCategory, SettingType } from '../settings/interfaces/setting.interface';

async function seedPaymentSettings() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SettingsService);

  const paymentSettings = [
    {
      key: 'master_course_payment_mode',
      value: 'partial_allowed',
      type: SettingType.STRING,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Master Course Payment Mode',
        description: 'Payment mode for Master Course (full_only or partial_allowed)',
        placeholder: 'full_only',
        validation: {
          required: true,
          options: ['full_only', 'partial_allowed'],
        },
        order: 1,
        visible: true,
        editable: true,
      },
      defaultValue: 'partial_allowed',
    },
    {
      key: 'master_course_minimum_deposit',
      value: 500,
      type: SettingType.NUMBER,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Master Course Minimum Deposit',
        description: 'Minimum deposit amount for Master Course in USD',
        placeholder: '500',
        validation: {
          required: true,
          min: 0,
          max: 10000,
        },
        order: 2,
        visible: true,
        editable: true,
      },
      defaultValue: 500,
    },
    {
      key: 'master_course_deposit_percentage',
      value: 20,
      type: SettingType.NUMBER,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Master Course Deposit Percentage',
        description: 'Deposit percentage for Master Course (0-100)',
        placeholder: '20',
        validation: {
          required: false,
          min: 0,
          max: 100,
        },
        order: 3,
        visible: true,
        editable: true,
      },
      defaultValue: 20,
    },
    {
      key: 'master_course_minimum_installment',
      value: 100,
      type: SettingType.NUMBER,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Master Course Minimum Installment',
        description: 'Minimum installment amount for Master Course in USD',
        placeholder: '100',
        validation: {
          required: true,
          min: 10,
          max: 1000,
        },
        order: 4,
        visible: true,
        editable: true,
      },
      defaultValue: 100,
    },
    {
      key: 'master_course_payment_reminder_days',
      value: JSON.stringify([7, 3, 1]),
      type: SettingType.JSON,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Payment Reminder Days',
        description: 'Days before due date to send payment reminders',
        placeholder: '[7, 3, 1]',
        validation: {
          required: false,
        },
        order: 5,
        visible: true,
        editable: true,
      },
      defaultValue: JSON.stringify([7, 3, 1]),
    },
    {
      key: 'master_course_grace_period_days',
      value: 5,
      type: SettingType.NUMBER,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Grace Period Days',
        description: 'Days after due date before marking payment as late',
        placeholder: '5',
        validation: {
          required: false,
          min: 0,
          max: 30,
        },
        order: 6,
        visible: true,
        editable: true,
      },
      defaultValue: 5,
    },
    {
      key: 'master_course_late_fee_amount',
      value: 25,
      type: SettingType.NUMBER,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Late Fee Amount',
        description: 'Fixed late fee amount in USD',
        placeholder: '25',
        validation: {
          required: false,
          min: 0,
          max: 500,
        },
        order: 7,
        visible: true,
        editable: true,
      },
      defaultValue: 25,
    },
    {
      key: 'master_course_allow_custom_plans',
      value: true,
      type: SettingType.BOOLEAN,
      category: SettingCategory.PAYMENTS,
      metadata: {
        label: 'Allow Custom Payment Plans',
        description: 'Allow users to create custom payment schedules',
        placeholder: 'true',
        validation: {
          required: false,
        },
        order: 8,
        visible: true,
        editable: true,
      },
      defaultValue: true,
    },
  ];

  console.log('Seeding payment settings...');

  for (const setting of paymentSettings) {
    try {
      try {
        const existing = await settingsService.findOne(setting.key);
        console.log(`Setting ${setting.key} already exists, updating...`);
        await settingsService.update(setting.key, {
          value: setting.value,
          metadata: setting.metadata,
        });
      } catch (notFoundError) {
        // Setting doesn't exist, create it
        console.log(`Creating setting ${setting.key}...`);
        await settingsService.create(setting as any);
      }
    } catch (error) {
      console.error(`Error creating/updating setting ${setting.key}:`, error);
    }
  }

  console.log('Payment settings seeded successfully!');
  await app.close();
}

// Run the seed function
seedPaymentSettings()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });