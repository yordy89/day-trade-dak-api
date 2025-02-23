import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { YahooFinanceModule } from 'src/services/yahoo-finance/yahoo-finance.module';
import { Company, CompanySchema } from './company.schema';

@Module({
  imports: [
    YahooFinanceModule,
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
