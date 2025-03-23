import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoSchema, Video } from './video.schema';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { VideoClass, VideoClassSchema } from './videoClass.schema';
import { S3Module } from 'src/aws/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    MongooseModule.forFeature([
      { name: VideoClass.name, schema: VideoClassSchema },
    ]),
    UsersModule,
    AuthModule,
    S3Module,
  ],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
