import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from 'src/users/user.dto';
import { VideoService } from './video.service';
import { CreateVideoDto, UpdateVideoDto } from './video.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SubscriptionGuard } from 'src/guards/subscription.guard';
import { RequiresSubscription } from 'src/decorators/subscription.decorator';
import { S3ServiceOptimized } from 'src/aws/s3/s3.service.optimized';
import { VariableKeys } from 'src/constants';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    @Inject('S3Service') private readonly s3Service: S3ServiceOptimized,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
  @Get()
  getAllVideos() {
    return this.videoService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createVideo(@Body() createVideoDto: CreateVideoDto) {
    return this.videoService.create(createVideoDto);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
  @Put(':id')
  updateVideo(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videoService.update(id, updateVideoDto);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.LIVE_RECORDED)
  @Get('classVideos')
  async getAllClassVideos() {
    return this.s3Service.listVideos(VariableKeys.AWS_ClASS_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.MASTER_CLASES)
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

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.PSICOTRADING)
  @Get('psicotradingVideos')
  async getAllPsicoTradingVideos() {
    return this.s3Service.listVideos(
      VariableKeys.AWS_S3_PSICOTRADING_VIDEO_FOLDER,
    );
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.PEACE_WITH_MONEY)
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

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.CLASSES)
  @Get('classesVideos')
  async getAllClassesVideos() {
    const videos = await this.s3Service.listVideos(
      VariableKeys.AWS_S3_CLASSES_VIDEO_FOLDER,
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

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.LIVE_RECORDED)
  @Get('videos/:key')
  async getVideo(@Param('key') key: string) {
    return { videoUrl: await this.s3Service.getSignedUrl(`videos/${key}`) };
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.CLASSES)
  @Get('classes/video/:key')
  async getClassVideo(@Param('key') key: string) {
    // Classes videos are stored directly without 'videos/' prefix
    return { videoUrl: await this.s3Service.getSignedUrl(key) };
  }

  // Temporary debug endpoint
  @Get('debug/s3-test')
  async debugS3() {
    const configService = this.configService;
    return {
      bucketName: configService.get<string>('AWS_S3_BUCKET_NAME'),
      mentorshipFolder: configService.get<string>('aws.s3.mentorshipFolder'),
      classFolder: configService.get<string>('aws.s3.classFolder'),
      envMentorshipFolder: configService.get<string>(
        'AWS_S3_MENTORSHIP_FOLDER',
      ),
      envClassFolder: configService.get<string>('AWS_S3_CLASS_VIDEO_FOLDER'),
      variableKeys: VariableKeys,
    };
  }
}
