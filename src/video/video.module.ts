import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoSchema, Video } from './video.schema';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { VideoClass, VideoClassSchema } from './videoClass.schema';
import { S3Module } from 'src/aws/s3/s3.module';
import { GuardsModule } from 'src/guards/guards.module';
import { ModulePermissionsModule } from 'src/module-permissions/module-permissions.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    MongooseModule.forFeature([
      { name: VideoClass.name, schema: VideoClassSchema },
    ]),
    UsersModule,
    AuthModule,
    S3Module,
    GuardsModule,
    ModulePermissionsModule,
    SubscriptionsModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
