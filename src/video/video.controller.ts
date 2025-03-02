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

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

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
}
