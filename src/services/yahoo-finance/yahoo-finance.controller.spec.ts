import { Test, TestingModule } from '@nestjs/testing';
import { YahooFinanceController } from './yahoo-finance.controller';

describe('YahooFinanceController', () => {
  let controller: YahooFinanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [YahooFinanceController],
    }).compile();

    controller = module.get<YahooFinanceController>(YahooFinanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
