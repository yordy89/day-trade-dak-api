import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';

@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  async listRecordings(
    @Query('type') type?: 'raw' | 'edited',
  ): Promise<any> {
    return this.recordingsService.listRecordings(type || 'raw');
  }

  @Get(':key/download-url')
  @Roles(Role.ADMIN)
  async getDownloadUrl(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('Recording key is required');
    }
    return this.recordingsService.getDownloadUrl(key);
  }

  @Delete(':key')
  @Roles(Role.ADMIN)
  async deleteRecording(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('Recording key is required');
    }
    return this.recordingsService.deleteRecording(key);
  }

  @Post('upload-edited')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadEditedRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Req() req,
    @Body('originalRecordingKey') originalRecordingKey?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const uploadedBy = `${req.user.firstName} ${req.user.lastName}`;

    return this.recordingsService.uploadEditedRecording(
      file,
      name,
      uploadedBy,
      originalRecordingKey,
    );
  }

  @Get(':key/watch-url')
  @Roles(Role.ADMIN)
  async getWatchUrl(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('Recording key is required');
    }
    return this.recordingsService.getWatchUrl(key);
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getRecordingsStats() {
    return this.recordingsService.getRecordingsStats();
  }
}