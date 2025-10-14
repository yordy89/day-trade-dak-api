import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TradingJournalService } from './trading-journal.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FilterTradesDto } from './dto/filter-trades.dto';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';
import { Trade } from './schemas/trade.schema';
import { Feedback } from './schemas/feedback.schema';

@ApiTags('trading-journal')
@Controller('trading-journal')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TradingJournalController {
  constructor(private readonly tradingJournalService: TradingJournalService) {}

  // Trade Endpoints
  @Post('trades')
  @ApiOperation({ summary: 'Create a new trade' })
  @ApiResponse({ status: 201, description: 'Trade created successfully', type: Trade })
  async createTrade(
    @Request() req,
    @Body() createTradeDto: CreateTradeDto,
  ) {
    return this.tradingJournalService.createTrade(req.user.id, createTradeDto);
  }

  @Get('trades')
  @ApiOperation({ summary: 'Get all trades with filters' })
  @ApiResponse({ status: 200, description: 'Trades retrieved successfully' })
  async findAllTrades(
    @Request() req,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.findAllTrades(req.user.id, filters);
  }

  @Get('trades/:id')
  @ApiOperation({ summary: 'Get a specific trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Trade retrieved successfully', type: Trade })
  async findOneTrade(
    @Request() req,
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.findOneTrade(req.user.id, tradeId);
  }

  @Put('trades/:id')
  @ApiOperation({ summary: 'Update a trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Trade updated successfully', type: Trade })
  async updateTrade(
    @Request() req,
    @Param('id') tradeId: string,
    @Body() updateTradeDto: UpdateTradeDto,
  ) {
    return this.tradingJournalService.updateTrade(
      req.user.id,
      tradeId,
      updateTradeDto,
    );
  }

  @Delete('trades/:id')
  @ApiOperation({ summary: 'Delete a trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 204, description: 'Trade deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrade(
    @Request() req,
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.deleteTrade(req.user.id, tradeId);
  }

  // Analytics Endpoints
  @Get('statistics')
  @ApiOperation({ summary: 'Get trading statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @Request() req,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.getTradeStatistics(req.user.id, filters);
  }

  @Get('daily-pnl')
  @ApiOperation({ summary: 'Get daily P&L chart data' })
  @ApiResponse({ status: 200, description: 'Daily P&L retrieved successfully' })
  async getDailyPnl(
    @Request() req,
    @Query('days') days: number = 30,
  ) {
    return this.tradingJournalService.getDailyPnL(req.user.id, days);
  }

  // Feedback Endpoints (Mentor only)
  @Post('feedback')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create feedback for a trade (Mentor only)' })
  @ApiResponse({ status: 201, description: 'Feedback created successfully', type: Feedback })
  async createFeedback(
    @Request() req,
    @Body() createFeedbackDto: CreateFeedbackDto,
  ) {
    return this.tradingJournalService.createFeedback(
      req.user.id,
      createFeedbackDto,
    );
  }

  @Get('trades/:id/feedback')
  @ApiOperation({ summary: 'Get feedback for a specific trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved successfully' })
  async getTradeFeedback(
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.getTradeFeedback(tradeId);
  }

  @Get('feedback')
  @ApiOperation({ summary: 'Get all feedback for current user' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved successfully' })
  async getMyFeedback(
    @Request() req,
  ) {
    return this.tradingJournalService.getStudentFeedback(req.user.id);
  }

  // Admin Endpoints
  @Get('admin/students')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all students with journals (Admin only)' })
  @ApiResponse({ status: 200, description: 'Students retrieved successfully' })
  async getStudentsWithJournals() {
    return this.tradingJournalService.getStudentsWithJournals();
  }

  @Get('admin/student/:studentId/trades')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get trades for a specific student (Admin only)' })
  @ApiParam({ name: 'studentId', description: 'Student user ID' })
  @ApiResponse({ status: 200, description: 'Student trades retrieved successfully' })
  async getStudentTrades(
    @Param('studentId') studentId: string,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.getAllStudentTrades(studentId, filters);
  }

  @Get('admin/student/:studentId/statistics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get statistics for a specific student (Admin only)' })
  @ApiParam({ name: 'studentId', description: 'Student user ID' })
  @ApiResponse({ status: 200, description: 'Student statistics retrieved successfully' })
  async getStudentStatistics(
    @Param('studentId') studentId: string,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.getTradeStatistics(studentId, filters);
  }
}