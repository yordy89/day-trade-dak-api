import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { AdminGuard } from '../guards/admin.guard';
import { Public } from '../decorators/public.decorator';

@Controller('auth/announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createAnnouncementDto: CreateAnnouncementDto, @Req() req: any) {
    return this.announcementService.create(createAnnouncementDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query() query: any) {
    return this.announcementService.findAll(query);
  }

  @Get('active')
  @Public()
  async getActiveAnnouncement() {
    const announcement = await this.announcementService.getActiveAnnouncement();
    return { success: true, data: announcement };
  }

  @Get('stats/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAnnouncementStats(@Param('id') id: string) {
    return this.announcementService.getAnnouncementStats(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.announcementService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @Req() req: any
  ) {
    return this.announcementService.update(id, updateAnnouncementDto, req.user.id);
  }

  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setActive(@Param('id') id: string, @Req() req: any) {
    const announcement = await this.announcementService.setActive(id, req.user.id);
    return { success: true, message: 'Announcement activated successfully', data: announcement };
  }

  @Put(':id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deactivate(@Param('id') id: string, @Req() req: any) {
    const announcement = await this.announcementService.deactivate(id, req.user.id);
    return { success: true, message: 'Announcement deactivated successfully', data: announcement };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.announcementService.remove(id);
  }

  @Post(':id/track-click')
  @Public()
  @HttpCode(HttpStatus.OK)
  async trackClick(@Param('id') id: string) {
    await this.announcementService.trackClick(id);
    return { success: true };
  }

  @Post(':id/track-dismiss')
  @Public()
  @HttpCode(HttpStatus.OK)
  async trackDismiss(@Param('id') id: string) {
    await this.announcementService.trackDismiss(id);
    return { success: true };
  }
}