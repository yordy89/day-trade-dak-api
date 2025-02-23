import { Injectable } from '@nestjs/common';
import { YahooFinanceService } from 'src/services/yahoo-finance/yahoo-finance.service';
import { Company } from './company.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class CompanyService {
  constructor(
    private readonly yahooFinanceService: YahooFinanceService,
    @InjectModel(Company.name) private companyModel: Model<Company>,
  ) {}

  async getCompanies() {
    const companies = await this.companyModel.find().exec();

    const companiesWithStockSummary = await Promise.all(
      companies.map(async (company) => {
        try {
          const stockData = await this.yahooFinanceService.getStockSummary(
            company.symbol,
          );
          return {
            name: company.name,
            symbol: company.symbol,
            currentPrice: stockData.financialData.currentPrice,
          };
        } catch (error) {
          console.error(
            `Error fetching stock summary for ${company.symbol}:`,
            error.message,
          );
          return {
            name: company.name,
            symbol: company.symbol,
            error: 'Failed to fetch stock summary',
          };
        }
      }),
    );

    return companiesWithStockSummary;
  }

  async addCompany(symbol: string) {
    const stockData = await this.yahooFinanceService.getStockSummary(symbol);
    // Add company to database
    const company = {
      name: stockData.price.shortName,
      symbol: stockData.symbol,
    };

    await this.companyModel.create(company);
    return stockData;
  }

  async deleteCompany(symbol: string) {
    await this.companyModel.deleteOne({ symbol }).exec();
    return { message: 'Company deleted' };
  }
}
