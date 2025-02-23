import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CompanyService } from './company.service';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  getCompanies() {
    return this.companyService.getCompanies();
  }

  @Post()
  addCompany(@Body('symbol') symbol: string) {
    return this.companyService.addCompany(symbol);
  }

  @Delete('/:symbol')
  deleteCompany(@Param('symbol') symbol: string) {
    return this.companyService.deleteCompany(symbol);
  }
}
