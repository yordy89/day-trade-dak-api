import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { CreateSettingDto } from '../../settings/dto/create-setting.dto';
import { UpdateSettingDto, BulkUpdateSettingsDto } from '../../settings/dto/update-setting.dto';
import { SettingCategory } from '../../settings/interfaces/setting.interface';
import { AdminService } from '../admin.service';
import { UserDocument } from '../../users/user.schema';

interface FindAllParams {
  category?: SettingCategory;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly adminService: AdminService,
  ) {}

  async findAll(params: FindAllParams) {
    const { category, search, page, limit } = params;
    
    let settings = await this.settingsService.findAll(category);
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      settings = settings.filter(setting => 
        setting.key.toLowerCase().includes(searchLower) ||
        setting.metadata.label.toLowerCase().includes(searchLower) ||
        (setting.metadata.description && setting.metadata.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply pagination
    const total = settings.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSettings = settings.slice(startIndex, endIndex);
    
    return {
      settings: paginatedSettings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCategories() {
    const categories = Object.values(SettingCategory).map(category => ({
      value: category,
      label: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
      count: 0,
    }));
    
    const settings = await this.settingsService.findAll();
    
    settings.forEach(setting => {
      const categoryIndex = categories.findIndex(cat => cat.value === setting.category);
      if (categoryIndex !== -1) {
        categories[categoryIndex].count++;
      }
    });
    
    return categories;
  }

  async findByCategory(category: SettingCategory) {
    const settings = await this.settingsService.findByCategory(category);
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: 'system',
      adminEmail: 'system',
      action: 'view_settings_category',
      resource: 'settings',
      details: { category },
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return settings;
  }

  async findOne(key: string) {
    const setting = await this.settingsService.findOne(key);
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: 'system',
      adminEmail: 'system',
      action: 'view_setting',
      resource: 'settings',
      resourceId: key,
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return setting;
  }

  async create(createSettingDto: CreateSettingDto, admin: UserDocument) {
    const setting = await this.settingsService.create(createSettingDto);
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'create_setting',
      resource: 'settings',
      resourceId: setting.key,
      newValue: setting,
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return setting;
  }

  async update(key: string, updateSettingDto: UpdateSettingDto, admin: UserDocument) {
    const previousSetting = await this.settingsService.findOne(key);
    
    const updatedSetting = await this.settingsService.update(key, {
      ...updateSettingDto,
      lastModifiedBy: admin.email,
    });
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'update_setting',
      resource: 'settings',
      resourceId: key,
      previousValue: previousSetting,
      newValue: updatedSetting,
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return updatedSetting;
  }

  async bulkUpdate(bulkUpdateDto: BulkUpdateSettingsDto, admin: UserDocument) {
    const updatedSettings = await this.settingsService.bulkUpdate({
      ...bulkUpdateDto,
      lastModifiedBy: admin.email,
    });
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'bulk_update_settings',
      resource: 'settings',
      details: {
        count: updatedSettings.length,
        keys: updatedSettings.map(s => s.key),
      },
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return updatedSettings;
  }

  async remove(key: string, admin: UserDocument) {
    const setting = await this.settingsService.findOne(key);
    
    await this.settingsService.remove(key);
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'delete_setting',
      resource: 'settings',
      resourceId: key,
      previousValue: setting,
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return { message: `Setting "${key}" has been deleted` };
  }

  async resetDefaults(admin: UserDocument) {
    // This would reset all settings to their default values
    const settings = await this.settingsService.findAll();
    const resetCount = 0;
    
    for (const setting of settings) {
      if (setting.defaultValue !== undefined && setting.value !== setting.defaultValue) {
        await this.settingsService.updateValue(setting.key, {
          value: setting.defaultValue,
          lastModifiedBy: admin.email,
        });
      }
    }
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'reset_default_settings',
      resource: 'settings',
      details: { resetCount },
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return { message: `Reset ${resetCount} settings to default values` };
  }

  async exportSettings() {
    const settings = await this.settingsService.findAll();
    
    return {
      exportDate: new Date(),
      version: '1.0',
      settings: settings.map(setting => ({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: setting.category,
        metadata: setting.metadata,
        defaultValue: setting.defaultValue,
        isActive: setting.isActive,
      })),
    };
  }

  async importSettings(settings: any[], admin: UserDocument) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    for (const settingData of settings) {
      try {
        const existing = await this.settingsService.findOne(settingData.key).catch(() => null);
        
        if (existing) {
          await this.settingsService.update(settingData.key, {
            ...settingData,
            lastModifiedBy: admin.email,
          });
          results.updated++;
        } else {
          await this.settingsService.create({
            ...settingData,
            lastModifiedBy: admin.email,
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to import setting "${settingData.key}": ${error.message}`);
      }
    }
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: admin._id.toString(),
      adminEmail: admin.email,
      action: 'import_settings',
      resource: 'settings',
      details: results,
      ipAddress: '0.0.0.0',
      status: 'success',
    });
    
    return results;
  }
}