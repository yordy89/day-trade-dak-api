import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionPlan } from 'src/users/user.dto';
import { VideoService } from './video.service';
import { CreateVideoDto, UpdateVideoDto } from './video.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SubscriptionGuard } from 'src/guards/subscription.guard';
import { RequiresSubscription } from 'src/decorators/subscription.decorator';
import { S3Service } from 'src/aws/s3/s3.service';
import { VariableKeys } from 'src/constants';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly s3Service: S3Service,
  ) {}

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.MENTORSHIP)
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
  @RequiresSubscription(SubscriptionPlan.MENTORSHIP)
  @Put(':id')
  updateVideo(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videoService.update(id, updateVideoDto);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.CLASS)
  @Get('classVideos')
  async getAllClassVideos() {
    return this.s3Service.listVideos(VariableKeys.AWS_ClASS_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.MENTORSHIP)
  @Get('mentorshipVideos')
  async getAllMentorshipVideos() {
    return this.s3Service.listVideos(VariableKeys.AWS_MENTORSHIP_FOLDER);
  }

  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequiresSubscription(SubscriptionPlan.STOCK)
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
  @RequiresSubscription(SubscriptionPlan.CLASS)
  @Get('videos/:key')
  async getVideo(@Param('key') key: string) {
    return { videoUrl: await this.s3Service.getSignedUrl(`videos/${key}`) };
  }
}
