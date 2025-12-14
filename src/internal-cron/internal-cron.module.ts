import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronService } from './internal-cron.service';
import { CronApiKeyGuard } from './guards/cron-api-key.guard';
import { CronModule } from '../cron/cron.module';
import { AnnouncementModule } from '../announcement/announcement.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [ConfigModule, CronModule, AnnouncementModule, MeetingsModule],
  controllers: [InternalCronController],
  providers: [InternalCronService, CronApiKeyGuard],
  exports: [InternalCronService],
})
export class InternalCronModule {}
