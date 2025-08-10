import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { RateLimiterService } from './rate-limiter.service';
import { MarketController } from './market.controller';
import { FinnhubModule } from '../finnhub/finnhub.module';
import { CacheModule } from '../../cache/cache.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [FinnhubModule, CacheModule, AuthModule, UsersModule, SettingsModule],
  providers: [MarketDataService, RateLimiterService],
  controllers: [MarketController],
  exports: [MarketDataService, RateLimiterService],
})
export class MarketModule {}