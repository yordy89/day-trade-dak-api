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
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto, UpdateSettingValueDto, BulkUpdateSettingsDto } from './dto/update-setting.dto';
import { SettingCategory } from './interfaces/setting.interface';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';
import { Public } from '../decorators/public.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get()
  findAll(
    @Query('category') category?: SettingCategory,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBoolean = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.settingsService.findAll(category, isActiveBoolean);
  }

  @Get('public')
  @Public()
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: SettingCategory) {
    return this.settingsService.findByCategory(category);
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Get(':key/value')
  getValue(@Param('key') key: string) {
    return this.settingsService.getValue(key);
  }

  @Patch(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.update(key, updateSettingDto);
  }

  @Patch(':key/value')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateValue(@Param('key') key: string, @Body() updateValueDto: UpdateSettingValueDto) {
    return this.settingsService.updateValue(key, updateValueDto);
  }

  @Post('bulk-update')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  bulkUpdate(@Body() bulkUpdateDto: BulkUpdateSettingsDto) {
    return this.settingsService.bulkUpdate(bulkUpdateDto);
  }

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}