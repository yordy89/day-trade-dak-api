import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FinnhubService } from './finnhub.service';
import { FinnhubWebSocketService } from './finnhub-websocket.service';
import { EnhancedWebSocketService } from './enhanced-websocket.service';
import { FinnhubController } from './finnhub.controller';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule],
  providers: [FinnhubService, FinnhubWebSocketService, EnhancedWebSocketService],
  controllers: [FinnhubController],
  exports: [FinnhubService, FinnhubWebSocketService, EnhancedWebSocketService],
})
export class FinnhubModule {}
