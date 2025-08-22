import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentVideo, ContentVideoSchema } from './schemas/content-video.schema';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { S3Module } from '../aws/s3/s3.module';
import { BullModule } from '@nestjs/bull';
import { VideoProcessorService } from './services/video-processor.service';
import { VideoUploadService } from './services/video-upload.service';
import { VideoNotificationService } from './services/video-notification.service';
import { ContentVideoProcessor } from './processors/content-video.processor';
import { WebSocketsModule } from '../websockets/websockets.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentVideo.name, schema: ContentVideoSchema },
    ]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    S3Module,
    WebSocketsModule,
    EmailModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [ContentController],
  providers: [
    ContentService,
    VideoProcessorService,
    VideoUploadService,
    VideoNotificationService,
    ContentVideoProcessor,
  ],
  exports: [ContentService, VideoUploadService, VideoNotificationService],
})
export class ContentModule {}