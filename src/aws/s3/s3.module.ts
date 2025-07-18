import { Module } from '@nestjs/common';
import { S3ServiceOptimized } from './s3.service.optimized';
import { CacheModule } from '../../cache/cache.module';
import { LoggerModule } from '../../logger/logger.module';

@Module({
  imports: [CacheModule, LoggerModule],
  providers: [
    {
      provide: 'S3Service',
      useClass: S3ServiceOptimized,
    },
    S3ServiceOptimized,
  ],
  exports: ['S3Service', S3ServiceOptimized],
})
export class S3Module {}
