import { Inject, Injectable } from '@nestjs/common';
import { AxiosInstance } from 'axios';

@Injectable()
export class YahooFinanceService {
  constructor(
    @Inject('YAHOO_FINANCE_AXIOS') private readonly axios: AxiosInstance,
  ) {}

  async getStockData(symbol: string): Promise<any> {
    try {
      const response = await this.axios.get(
        `/api/yahoo/finance/chart/${symbol}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        'Error fetching stock data from Yahoo Finance:',
        error.message,
      );
      throw new Error('Failed to fetch stock data. Please try again later.');
    }
  }

  async getNews(): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v1/markets/news`);
      return response.data;
    } catch (error) {
      console.error('Error fetching news from Yahoo Finance:', error.message);
      throw new Error('Failed to fetch news. Please try again later.');
    }
  }
}
