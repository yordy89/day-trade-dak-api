import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { CommunityGalleryController } from './community-gallery.controller';
import { CommunityGalleryService } from './community-gallery.service';
import { GalleryItem, GalleryItemSchema } from './gallery-item.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: GalleryItem.name, schema: GalleryItemSchema },
    ]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
  ],
  controllers: [CommunityGalleryController],
  providers: [CommunityGalleryService],
  exports: [CommunityGalleryService],
})
export class CommunityGalleryModule {}
