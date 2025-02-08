import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { TradeModule } from './trade/trade.module';
import { MissionModule } from './mission/mission.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AxiosModule } from './axios/axios.module';
import { YahooFinanceModule } from './services/yahoo-finance/yahoo-finance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule accessible globally
    }),
    DatabaseModule,
    TradeModule,
    MissionModule,
    UsersModule,
    AuthModule,
    AxiosModule,
    YahooFinanceModule,
  ],
})
export class AppModule {}
