import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FinnhubService } from './finnhub.service';
import { FinnhubController } from './finnhub.controller';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule],
  providers: [FinnhubService],
  controllers: [FinnhubController],
  exports: [FinnhubService],
})
export class FinnhubModule {}
