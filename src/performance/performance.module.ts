import { Module } from '@nestjs/common';
import { PerformanceMonitoringService } from './performance.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [PerformanceMonitoringService],
  exports: [PerformanceMonitoringService],
})
export class PerformanceModule {}
