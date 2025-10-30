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
import { VideoNameMapper } from 'src/utils/video-name-mapper';

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
    console.log(
      'Fetching class videos from S3...',
      VariableKeys.AWS_ClASS_FOLDER,
    );
    const videos = await this.s3Service.listVideos(VariableKeys.AWS_ClASS_FOLDER);
    
    console.log(`Total videos found: ${videos.length}`);
    
    // Group videos by date folder to handle cases where master.m3u8 might not exist
    const videosByDate = new Map<string, any>();
    
    videos.forEach(video => {
      // Extract date from key (format: class-daily/MM:DD:YYYY/...)
      const dateMatch = video.key.match(/(\d{2}:\d{2}:\d{4})/);
      if (dateMatch) {
        const dateKey = dateMatch[1];
        
        // Prefer master.m3u8, but fall back to any playlist.m3u8
        if (!videosByDate.has(dateKey)) {
          videosByDate.set(dateKey, video);
        } else if (video.key.includes('master.m3u8')) {
          // Replace with master if found
          videosByDate.set(dateKey, video);
        } else if (!videosByDate.get(dateKey).key.includes('master.m3u8') && 
                   video.key.endsWith('playlist.m3u8') && 
                   !video.key.includes('/360p/') && 
                   !video.key.includes('/480p/') && 
                   !video.key.includes('/720p/') && 
                   !video.key.includes('/1080p/')) {
          // Use a non-quality-specific playlist if no master exists
          videosByDate.set(dateKey, video);
        }
      }
    });
    
    // Convert map to array and sort by date
    const uniqueVideos = Array.from(videosByDate.values()).sort((a, b) => {
      const dateA = a.key.match(/(\d{2}):(\d{2}):(\d{4})/);
      const dateB = b.key.match(/(\d{2}):(\d{2}):(\d{4})/);
      if (dateA && dateB) {
        // Convert to sortable format YYYY-MM-DD
        const sortA = `${dateA[3]}-${dateA[1]}-${dateA[2]}`;
        const sortB = `${dateB[3]}-${dateB[1]}-${dateB[2]}`;
        return sortB.localeCompare(sortA); // Newest first
      }
      return 0;
    });
    
    console.log(`Found ${uniqueVideos.length} unique class sessions`);
    console.log('Videos by date:', uniqueVideos.map(v => {
      const dateMatch = v.key.match(/(\d{2}:\d{2}:\d{4})/);
      return dateMatch ? `${dateMatch[1]} - ${v.key}` : v.key;
    }));
    
    return uniqueVideos;
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
    const videos = await this.s3Service.listVideos(VariableKeys.AWS_MENTORSHIP_FOLDER);
    
    // Filter to only return master.m3u8 files (one per mentorship)
    // This avoids returning duplicate quality-specific playlist files
    const masterVideos = videos.filter(video => {
      return video.key.includes('master.m3u8');
    });
    
    console.log(`Filtered ${videos.length} videos to ${masterVideos.length} master playlists`);
    
    return masterVideos;
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleAccessGuard)
  @RequiresSubscription(SubscriptionPlan.STOCKS)
  @RequireModule(ModuleType.STOCKS)
  @Get('stockVideos')
  async getAllStocksVideos() {
    console.log(
      'Fetching stock videos from S3...',
      VariableKeys.AWS_S3_STOCK_VIDEO_FOLDER,
    );
    const videos = await this.s3Service.listVideos(VariableKeys.AWS_S3_STOCK_VIDEO_FOLDER);
    
    console.log(`Total stock videos found: ${videos.length}`);
    
    // Extract unique videos from HLS variants
    const uniqueVideos = new Map<string, any>();
    
    videos.forEach(video => {
      // Extract the base video name without quality suffix
      const keyParts = video.key.split('/');
      const baseKey = keyParts.slice(0, -1).join('/');
      
      // Prefer master.m3u8 files
      if (video.key.includes('master.m3u8')) {
        uniqueVideos.set(baseKey, video);
      } else if (!uniqueVideos.has(baseKey) && video.key.endsWith('playlist.m3u8')) {
        uniqueVideos.set(baseKey, video);
      }
    });
    
    return Array.from(uniqueVideos.values()).sort((a, b) => 
      a.key.localeCompare(b.key)
    );
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

    // Apply name mapping and proper sorting
    const processedVideos = VideoNameMapper.processCurso1Videos(videos);

    console.log(`Processed ${processedVideos.length} videos with clean names`);
    
    // Log first few for debugging
    processedVideos.slice(0, 5).forEach(video => {
      console.log(`Order ${video.lessonOrder}: ${video.displayName} (${video.folderName})`);
    });

    return processedVideos;
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

  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleType.SUPPORT_VIDEOS)
  @Get('supportVideos')
  async getAllSupportVideos() {
    console.log(
      'Fetching support videos from S3...',
      VariableKeys.AWS_S3_HELP_VIDEOS,
    );
    const videos = await this.s3Service.listVideos(
      VariableKeys.AWS_S3_HELP_VIDEOS,
    );

    console.log(`Total support videos found: ${videos.length}`);

    // Filter to only return master.m3u8 files for HLS videos
    // Or .mp4 files if they're direct MP4 uploads
    const supportVideos = videos.filter(video => {
      return video.key.includes('master.m3u8') ||
             video.key.endsWith('.mp4') ||
             (video.key.endsWith('playlist.m3u8') &&
              !video.key.includes('/360p/') &&
              !video.key.includes('/480p/') &&
              !video.key.includes('/720p/') &&
              !video.key.includes('/1080p/'));
    });

    console.log(`Filtered to ${supportVideos.length} support videos`);

    // Sort alphabetically by key
    return supportVideos.sort((a, b) => a.key.localeCompare(b.key));
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
