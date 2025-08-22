import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../constants';
import { AdminContentSimpleService } from '../services/admin-content-simple.service';

@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminContentTestController {
  constructor(private readonly adminContentService: AdminContentSimpleService) {}

  @Post('videos/upload/initiate')
  async initiateUpload(
    @Body() body: {
      fileName: string;
      fileSize: number;
      contentType: string;
    },
    @Req() req,
  ) {
    return this.adminContentService.initiateVideoUpload(
      body.fileName,
      body.fileSize,
      body.contentType as any,
      req.user,
    );
  }

  @Post('videos/upload/part-url')
  async getPartUploadUrl(
    @Body() body: {
      videoId: string;
      uploadId: string;
      partNumber: number;
    },
  ) {
    return this.adminContentService.getUploadPartUrl(
      body.videoId,
      body.uploadId,
      body.partNumber,
    );
  }

  @Post('videos/upload/complete')
  async completeUpload(
    @Body() body: {
      videoId: string;
      uploadId: string;
      parts: Array<{ partNumber: number; etag: string }>;
    },
  ) {
    return this.adminContentService.completeUpload(
      body.videoId,
      body.uploadId,
      body.parts,
    );
  }

  @Post('videos/upload/progress')
  async updateProgress(
    @Body() body: {
      videoId: string;
      bytesUploaded: number;
      partNumber: number;
      etag: string;
    },
  ) {
    return this.adminContentService.updateUploadProgress(
      body.videoId,
      body.bytesUploaded,
      body.partNumber,
      body.etag,
    );
  }

  @Post('videos/upload/abort')
  async abortUpload(
    @Body() body: {
      videoId: string;
      uploadId: string;
    },
  ) {
    return this.adminContentService.abortUpload(
      body.videoId,
      body.uploadId,
    );
  }

  @Post('videos/upload/batch-part-urls')
  async getBatchPartUrls(
    @Body() body: {
      videoId: string;
      uploadId: string;
      totalParts: number;
    },
  ) {
    return this.adminContentService.getBatchPartUrls(
      body.videoId,
      body.uploadId,
      body.totalParts,
    );
  }

  @Get('stats')
  async getContentStats() {
    return this.adminContentService.getContentStats();
  }

  @Get('videos')
  async getVideos(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('contentType') contentType?: string,
    @Query('status') status?: string,
  ) {
    return this.adminContentService.getVideos({
      page: Number(page),
      limit: Number(limit),
      search,
      contentType,
      status,
    });
  }

  @Put('videos/:id')
  async updateVideo(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      description?: string;
      isPublished?: boolean;
    },
  ) {
    return this.adminContentService.updateVideo(id, body);
  }

  @Post('videos/:id/reprocess')
  async reprocessVideo(@Param('id') id: string) {
    return this.adminContentService.reprocessVideo(id);
  }

  @Get('videos/:id/download-url')
  async getDownloadUrl(@Param('id') id: string) {
    return this.adminContentService.getDownloadUrl(id);
  }

  @Delete('videos/:id')
  async deleteVideo(@Param('id') id: string) {
    return this.adminContentService.deleteVideo(id);
  }

  @Post('videos/:id/publish')
  async publishVideo(@Param('id') id: string) {
    return this.adminContentService.publishVideo(id);
  }

  @Post('videos/:id/unpublish')
  async unpublishVideo(@Param('id') id: string) {
    return this.adminContentService.unpublishVideo(id);
  }
}