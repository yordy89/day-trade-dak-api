import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Inject,
  Response,
  Header,
  Headers,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response as ExpressResponse } from 'express';
import { SubscriptionPlan } from 'src/users/user.dto';
import { VideoService } from './video.service';
import { CreateVideoDto, UpdateVideoDto } from './video.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SubscriptionGuard } from 'src/guards/subscription.guard';
import { RequiresSubscription } from 'src/decorators/subscription.decorator';
import { S3ServiceOptimized } from 'src/aws/s3/s3.service.optimized';
import { VariableKeys } from 'src/constants';
import { ModuleAccessGuard } from 'src/guards/module-access.guard';
import { RequireModule } from 'src/decorators/require-module.decorator';
import { ModuleType } from 'src/module-permissions/module-permission.schema';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    @Inject('S3Service') private readonly s3Service: S3ServiceOptimized,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
  @RequireModule(ModuleType.MASTER_CLASSES)
  @Get()
  getAllVideos() {
    return this.videoService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createVideo(@Body() createVideoDto: CreateVideoDto) {
    return this.videoService.create(createVideoDto);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
  @RequireModule(ModuleType.MASTER_CLASSES)
  @Put(':id')
  updateVideo(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videoService.update(id, updateVideoDto);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.LIVE_RECORDED)
  @RequireModule(ModuleType.LIVE_RECORDED)
  @Get('classVideos')
  async getAllClassVideos() {
    return this.s3Service.listVideos(VariableKeys.AWS_ClASS_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
  @RequireModule(ModuleType.MASTER_CLASSES)
  @Get('mentorshipVideos')
  async getAllMentorshipVideos() {
    console.log(
      'Fetching mentorship videos from S3...',
      VariableKeys.AWS_MENTORSHIP_FOLDER,
    );
    return this.s3Service.listVideos(VariableKeys.AWS_MENTORSHIP_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  // @RequiresSubscription(SubscriptionPlan.STOCK) // STOCK plan removed
  @Get('stockVideos')
  async getAllStocksVideos() {
    return this.s3Service.listVideos(VariableKeys.AWS_S3_STOCK_VIDEO_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.PSICOTRADING)
  @RequireModule(ModuleType.PSICOTRADING)
  @Get('psicotradingVideos')
  async getAllPsicoTradingVideos() {
    return this.s3Service.listVideos(
      VariableKeys.AWS_S3_PSICOTRADING_VIDEO_FOLDER,
    );
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.PEACE_WITH_MONEY)
  @RequireModule(ModuleType.PEACE_WITH_MONEY)
  @Get('cursos/curso1')
  async getAllCurso1Videos() {
    const videos = await this.s3Service.listVideos(
      VariableKeys.AWS_S3_CURSO_1_FOLDER,
    );

    const sorted = videos.sort((a, b) => {
      const extractOrder = (key: string): number => {
        const filename = key.split('/').pop(); // get only the filename
        const match = filename?.match(/^(\d+)_/); // ✅ match number before underscore
        return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
      };

      return extractOrder(a.key) - extractOrder(b.key);
    });

    return sorted;
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.CLASSES)
  @RequireModule(ModuleType.CLASSES)
  @Get('classesVideos')
  async getAllClassesVideos() {
    const videos = await this.s3Service.listVideos(
      VariableKeys.AWS_S3_CLASSES_VIDEO_FOLDER,
    );

    // Filter to only return master playlist.m3u8 files (not quality-specific ones)
    const masterPlaylists = videos.filter(video => {
      // Match pattern: clase_X/playlist.m3u8 (not in subdirectories like 720p/, 480p/, etc.)
      return video.key.match(/clase_\d+\/playlist\.m3u8$/);
    });

    // Sort by class number
    const sorted = masterPlaylists.sort((a, b) => {
      const extractClassNumber = (key: string): number => {
        const match = key.match(/clase_(\d+)/);
        return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
      };

      return extractClassNumber(a.key) - extractClassNumber(b.key);
    });

    // Add friendly titles to each video
    const videosWithTitles = sorted.map(video => {
      const classMatch = video.key.match(/clase_(\d+)/);
      const classNumber = classMatch ? classMatch[1] : '1';
      
      return {
        ...video,
        title: `Clase ${classNumber}`,
        classNumber: parseInt(classNumber, 10)
      };
    });

    return videosWithTitles;
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.LIVE_RECORDED)
  @RequireModule(ModuleType.LIVE_RECORDED)
  @Get('videos/:key')
  async getVideo(@Param('key') key: string) {
    return { videoUrl: await this.s3Service.getSignedUrl(`videos/${key}`) };
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.CLASSES)
  @RequireModule(ModuleType.CLASSES)
  @Get('classes/video/:key')
  async getClassVideo(@Param('key') key: string) {
    // Classes videos are stored directly without 'videos/' prefix
    return { videoUrl: await this.s3Service.getSignedUrl(key) };
  }

  // HLS Manifest endpoints
  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.LIVE_RECORDED)
  @RequireModule(ModuleType.LIVE_RECORDED)
  @Get('hls/:key(*)')
  @Header('Content-Type', 'application/x-mpegURL')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getHLSManifest(
    @Param('key') key: string,
    @Response() res: ExpressResponse,
  ) {
    try {
      // Check if it's a .m3u8 manifest file
      if (key.endsWith('.m3u8')) {
        const manifest = await this.s3Service.getHLSManifest(key);
        res.send(manifest);
      } else {
        // For other files (.ts segments), redirect to signed URL
        const signedUrl = await this.s3Service.getSignedUrl(key);
        res.redirect(signedUrl);
      }
    } catch (error) {
      console.error('HLS manifest error:', error);
      res.status(404).send('HLS content not found');
    }
  }

  // Public HLS endpoint for video players (no auth required, uses temporary token)
  @Get('hls-public/:key(*)')
  @Header('Content-Type', 'application/x-mpegURL')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Access-Control-Allow-Origin', '*')
  async getPublicHLSManifest(
    @Param('key') key: string,
    @Query('token') token: string,
    @Response() res: ExpressResponse,
  ) {
    try {
      // Validate the token (you should implement proper token validation)
      // For now, we'll skip validation for testing
      
      if (key.endsWith('.m3u8')) {
        const manifest = await this.s3Service.getHLSManifest(key);
        res.send(manifest);
      } else {
        const signedUrl = await this.s3Service.getSignedUrl(key);
        res.redirect(signedUrl);
      }
    } catch (error) {
      console.error('HLS manifest error:', error);
      res.status(404).send('HLS content not found');
    }
  }

}
