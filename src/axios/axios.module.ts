import { Module } from '@nestjs/common';
import axios from 'axios';

@Module({
  providers: [
    {
      provide: 'YAHOO_FINANCE_AXIOS',
      useValue: axios.create({
        baseURL: process.env.YAHOO_FINANCE_BASE_URL,
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': process.env.YAHOO_FINANCE_X_RAPIDAPI_KEY,
          'x-rapidapi-host': process.env.YAHOO_FINANCE_X_RAPIDAPI_HOST,
        },
      }),
    },
    {
      provide: 'OPEN_AI_AXIOS',
      useValue: axios.create({
        baseURL: process.env.OPENAI_BASE_URL,
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
        },
      }),
    },
  ],
  exports: ['YAHOO_FINANCE_AXIOS', 'OPEN_AI_AXIOS'],
})
export class AxiosModule {}
