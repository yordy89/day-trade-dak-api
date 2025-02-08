import { Module } from '@nestjs/common';
import axios from 'axios';

@Module({
  providers: [
    {
      provide: 'YAHOO_FINANCE_AXIOS',
      useValue: axios.create({
        baseURL: 'https://yahoo-finance15.p.rapidapi.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key':
            '62f6897179msh1c8bbf1c306fe14p1a7ae7jsnf971cd3d1d01', // Replace with your RapidAPI key
          'x-rapidapi-host': 'yahoo-finance15.p.rapidapi.com',
        },
      }),
    },
  ],
  exports: ['YAHOO_FINANCE_AXIOS'],
})
export class AxiosModule {}
