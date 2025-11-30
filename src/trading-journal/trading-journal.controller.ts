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
  Header,
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
import { CloseTradeDto } from './dto/close-trade.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FilterTradesDto } from './dto/filter-trades.dto';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { ModuleAccessGuard } from '../guards/module-access.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequireModule } from '../decorators/require-module.decorator';
import { Public } from '../decorators/public.decorator';
import { Role } from '../constants';
import { ModuleType } from '../module-permissions/module-permission.schema';
import { Trade } from './schemas/trade.schema';
import { Feedback } from './schemas/feedback.schema';

@ApiTags('trading-journal')
@Controller('trading-journal')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TradingJournalController {
  constructor(private readonly tradingJournalService: TradingJournalService) {}

  // FIX endpoint - Consolidate all trades to specific user
  @Public()
  @Post('debug/consolidate-trades/:userId')
  @ApiOperation({ summary: 'DEBUG: Consolidate all trades to specific user' })
  async consolidateTrades(@Param('userId') userId: string) {
    console.log('🔧 CONSOLIDATE: Target userId:', userId);
    const Trade = this.tradingJournalService['tradeModel'];

    const allTrades = await Trade.find({}).lean();
    console.log('🔧 Found', allTrades.length, 'total trades');

    // Show current state
    const tradesByUser = {};
    allTrades.forEach(trade => {
      const uid = trade.userId.toString();
      if (!tradesByUser[uid]) tradesByUser[uid] = [];
      tradesByUser[uid].push(trade.symbol);
    });
    console.log('🔧 Current trades by user:', tradesByUser);
    console.log('🔧 Updating all trades to userId:', userId);

    const result = await Trade.updateMany(
      {}, // Update ALL trades
      { $set: { userId: userId } }
    );

    console.log('🔧 Update result:', result);

    return {
      success: true,
      message: `Updated ${result.modifiedCount} trades to user ${userId}`,
      targetUserId: userId,
      modifiedCount: result.modifiedCount,
      totalTrades: allTrades.length,
      tradesByUserBefore: tradesByUser,
    };
  }

  // Debug endpoint - REMOVE IN PRODUCTION
  @Get('debug/all-trades')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'DEBUG: Get all trades and permissions' })
  async debugAllTrades(@Request() req) {
    console.log('🐛 DEBUG: Logged in user:', req.user);
    const Trade = this.tradingJournalService['tradeModel'];
    const allTrades = await Trade.find({}).lean();

    const loggedInUserId = req.user.id || req.user._id;
    const tradesForLoggedInUser = await Trade.find({ userId: loggedInUserId }).countDocuments();

    // Check module permissions
    const ModulePermission = Trade.db.model('ModulePermission');
    const modulePermissions = await ModulePermission.find({ userId: loggedInUserId }).lean();

    console.log('🐛 Logged in userId:', loggedInUserId);
    console.log('🐛 Logged in user._id:', req.user._id);
    console.log('🐛 Trades for logged in user:', tradesForLoggedInUser);
    console.log('🐛 Total trades in DB:', await Trade.countDocuments({}));
    console.log('🐛 Module permissions:', modulePermissions);

    // Show all trades with their userIds
    const tradeDetails = allTrades.map(t => ({
      _id: t._id,
      userId: t.userId.toString(),
      symbol: t.symbol,
      tradeDate: t.tradeDate,
    }));

    return {
      loggedInUser: {
        id: loggedInUserId?.toString(),
        _id: req.user._id?.toString(),
        email: req.user.email,
        role: req.user.role,
      },
      totalTradesInDB: allTrades.length,
      tradesForThisUser: tradesForLoggedInUser,
      modulePermissions: modulePermissions.map(p => ({
        moduleType: p.moduleType,
        hasAccess: p.hasAccess,
        isActive: p.isActive,
      })),
      allTrades: tradeDetails,
      userIdComparison: allTrades.map(t => ({
        tradeUserId: t.userId.toString(),
        loggedInUserId: loggedInUserId?.toString(),
        match: t.userId.toString() === loggedInUserId?.toString(),
      })),
    };
  }

  // Trade Endpoints (Protected by Module Permission)
  @Post('trades')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Create a new trade' })
  @ApiResponse({ status: 201, description: 'Trade created successfully', type: Trade })
  async createTrade(
    @Request() req,
    @Body() createTradeDto: CreateTradeDto,
  ) {
    console.log('\n========== CONTROLLER: CREATE TRADE ==========');
    console.log('📝 req.user:', JSON.stringify(req.user, null, 2));
    console.log('📝 req.user._id:', req.user._id);
    console.log('📝 req.user.id:', req.user.id);
    console.log('📝 Calling service with userId:', req.user._id.toString());
    console.log('==============================================\n');
    return this.tradingJournalService.createTrade(req.user._id.toString(), createTradeDto);
  }

  @Get('trades')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get all trades with filters' })
  @ApiResponse({ status: 200, description: 'Trades retrieved successfully' })
  async findAllTrades(
    @Request() req,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.findAllTrades(req.user._id.toString(), filters);
  }

  @Get('trades/:id')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Get a specific trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Trade retrieved successfully', type: Trade })
  async findOneTrade(
    @Request() req,
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.findOneTrade(req.user._id.toString(), tradeId);
  }

  @Put('trades/:id')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Update a trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Trade updated successfully', type: Trade })
  async updateTrade(
    @Request() req,
    @Param('id') tradeId: string,
    @Body() updateTradeDto: UpdateTradeDto,
  ) {
    return this.tradingJournalService.updateTrade(
      req.user._id.toString(),
      tradeId,
      updateTradeDto,
    );
  }

  @Post('trades/:id/close')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Close an open trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Trade closed successfully', type: Trade })
  async closeTrade(
    @Request() req,
    @Param('id') tradeId: string,
    @Body() closeTradeDto: CloseTradeDto,
  ) {
    return this.tradingJournalService.closeTrade(req.user._id.toString(), tradeId, closeTradeDto);
  }

  @Delete('trades/:id')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Delete a trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 204, description: 'Trade deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrade(
    @Request() req,
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.deleteTrade(req.user._id.toString(), tradeId);
  }

  // Analytics Endpoints (Protected by Module Permission)
  @Get('statistics')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get trading statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @Request() req,
    @Query() filters: FilterTradesDto,
  ) {
    return this.tradingJournalService.getTradeStatistics(req.user._id.toString(), filters);
  }

  @Get('daily-pnl')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Get daily P&L chart data' })
  @ApiResponse({ status: 200, description: 'Daily P&L retrieved successfully' })
  async getDailyPnl(
    @Request() req,
    @Query('days') days: number = 30,
  ) {
    return this.tradingJournalService.getDailyPnL(req.user._id.toString(), days);
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
      req.user._id.toString(),
      createFeedbackDto,
    );
  }

  @Get('trades/:id/feedback')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Get feedback for a specific trade' })
  @ApiParam({ name: 'id', description: 'Trade ID' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved successfully' })
  async getTradeFeedback(
    @Param('id') tradeId: string,
  ) {
    return this.tradingJournalService.getTradeFeedback(tradeId);
  }

  @Get('feedback')
  @UseGuards(ModuleAccessGuard)
  @RequireModule(ModuleType.TRADING_JOURNAL)
  @ApiOperation({ summary: 'Get all feedback for current user' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved successfully' })
  async getMyFeedback(
    @Request() req,
  ) {
    return this.tradingJournalService.getStudentFeedback(req.user._id.toString());
  }

  // Admin Endpoints
  @Get('admin/students')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all students with journals (Admin only)' })
  @ApiResponse({ status: 200, description: 'Students retrieved successfully' })
  async getStudentsWithJournals(@Query('eventId') eventId?: string) {
    return this.tradingJournalService.getStudentsWithJournals(eventId);
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