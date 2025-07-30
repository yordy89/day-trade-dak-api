import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../constants';
import { AdminSettingsService } from '../services/admin-settings.service';
import { CreateSettingDto } from '../../settings/dto/create-setting.dto';
import { UpdateSettingDto, BulkUpdateSettingsDto } from '../../settings/dto/update-setting.dto';
import { SettingCategory } from '../../settings/interfaces/setting.interface';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  async findAll(
    @Query('category') category?: SettingCategory,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.adminSettingsService.findAll({
      category,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('categories')
  async getCategories() {
    return this.adminSettingsService.getCategories();
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: SettingCategory) {
    return this.adminSettingsService.findByCategory(category);
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return this.adminSettingsService.findOne(key);
  }

  @Post()
  async create(
    @Body() createSettingDto: CreateSettingDto,
    @Request() req: any,
  ) {
    return this.adminSettingsService.create(createSettingDto, req.user);
  }

  @Patch(':key')
  async update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
    @Request() req: any,
  ) {
    return this.adminSettingsService.update(key, updateSettingDto, req.user);
  }

  @Post('bulk-update')
  async bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateSettingsDto,
    @Request() req: any,
  ) {
    return this.adminSettingsService.bulkUpdate(bulkUpdateDto, req.user);
  }

  @Delete(':key')
  async remove(@Param('key') key: string, @Request() req: any) {
    return this.adminSettingsService.remove(key, req.user);
  }

  @Post('reset-defaults')
  async resetDefaults(@Request() req: any) {
    return this.adminSettingsService.resetDefaults(req.user);
  }

  @Get('export/all')
  async exportSettings() {
    return this.adminSettingsService.exportSettings();
  }

  @Post('import')
  async importSettings(
    @Body() settings: any[],
    @Request() req: any,
  ) {
    return this.adminSettingsService.importSettings(settings, req.user);
  }
}