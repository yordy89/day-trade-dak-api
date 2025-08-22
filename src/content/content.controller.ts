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
  BadRequestException,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ContentType, VideoStatus } from './schemas/content-video.schema';
import { Role } from '../constants';

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('upload/initiate')
  @Roles(Role.ADMIN)
  async initiateUpload(
    @Body() body: {
      fileName: string;
      fileSize: number;
      contentType: ContentType;
    },
    @Req() req,
  ) {
    if (!body.fileName || !body.fileSize || !body.contentType) {
      throw new BadRequestException('Missing required fields');
    }

    if (body.fileSize > 10 * 1024 * 1024 * 1024) { // 10GB limit
      throw new BadRequestException('File size exceeds maximum limit of 10GB');
    }

    const uploadedBy = `${req.user.firstName} ${req.user.lastName}`;
    
    return this.contentService.initiateMultipartUpload(
      body.fileName,
      body.fileSize,
      body.contentType,
      uploadedBy,
    );
  }

  @Post('upload/part-url')
  @Roles(Role.ADMIN)
  async getPartUploadUrl(
    @Body() body: {
      videoId: string;
      uploadId: string;
      partNumber: number;
    },
  ) {
    return this.contentService.getUploadPartUrl(
      body.videoId,
      body.uploadId,
      body.partNumber,
    );
  }

  @Post('upload/complete')
  @Roles(Role.ADMIN)
  async completeUpload(
    @Body() body: {
      videoId: string;
      uploadId: string;
      parts: Array<{ partNumber: number; etag: string }>;
    },
  ) {
    return this.contentService.completeMultipartUpload(
      body.videoId,
      body.uploadId,
      body.parts,
    );
  }

  @Post('upload/abort')
  @Roles(Role.ADMIN)
  async abortUpload(
    @Body() body: {
      videoId: string;
      uploadId: string;
    },
  ) {
    return this.contentService.abortMultipartUpload(
      body.videoId,
      body.uploadId,
    );
  }

  @Post('upload/progress')
  @Roles(Role.ADMIN)
  async updateProgress(
    @Body() body: {
      videoId: string;
      bytesUploaded: number;
      partNumber?: number;
      etag?: string;
    },
  ) {
    return this.contentService.updateUploadProgress(
      body.videoId,
      body.bytesUploaded,
      body.partNumber,
      body.etag,
    );
  }

  @Get('videos')
  @Roles(Role.ADMIN)
  async getVideos(
    @Query('contentType') contentType: ContentType,
    @Query('status') status?: VideoStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!contentType) {
      throw new BadRequestException('Content type is required');
    }

    return this.contentService.getVideosByContentType(
      contentType,
      status,
      parseInt(page || '1'),
      parseInt(limit || '20'),
    );
  }

  @Get('videos/:id')
  @Roles(Role.ADMIN)
  async getVideo(@Param('id') id: string) {
    return this.contentService.getVideoById(id);
  }

  @Put('videos/:id')
  @Roles(Role.ADMIN)
  async updateVideo(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      description?: string;
      tags?: string[];
      isPublished?: boolean;
    },
  ) {
    return this.contentService.updateVideoMetadata(id, body);
  }

  @Delete('videos/:id')
  @Roles(Role.ADMIN)
  async deleteVideo(@Param('id') id: string) {
    return this.contentService.deleteVideo(id);
  }
}