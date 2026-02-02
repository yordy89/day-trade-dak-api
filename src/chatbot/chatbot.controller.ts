import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { ChatbotService } from './chatbot.service';
import { VectorStoreService } from './embeddings/vector-store.service';
import { KnowledgeBaseSeedService, SeedResult } from './seeds/seed.service';
import {
  SendMessageDto,
  ChatHistoryQueryDto,
  CreateKnowledgeDocumentDto,
  UpdateKnowledgeDocumentDto,
  UploadPdfDto,
  AddUrlDocumentDto,
  UpdateUrlSourceDto,
} from './dto/chat-message.dto';
import {
  ChatResponseDto,
  ConversationHistoryDto,
  ConversationListResponseDto,
  KnowledgeDocumentResponseDto,
  ChatAnalyticsDto,
} from './dto/chat-response.dto';
import {
  KnowledgeCategory,
  LanguageType,
  RegionType,
} from './schemas/knowledge-document.schema';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly vectorStore: VectorStoreService,
    private readonly seedService: KnowledgeBaseSeedService,
  ) {}

  // ==================== Public Endpoints ====================

  @Get('public/suggestions')
  @ApiOperation({ summary: 'Get quick suggestions (public)' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions retrieved',
    type: [String],
  })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['en', 'es'],
    description: 'Language for suggestions',
  })
  getPublicSuggestions(@Query('language') language: string = 'es'): string[] {
    return this.chatbotService.getQuickSuggestions(language);
  }

  @Post('public/message')
  @ApiOperation({ summary: 'Send a message to the chatbot (public/guest)' })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendPublicMessage(
    @Body() dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    // Use provided guestId from frontend session, or generate new one as fallback
    // This allows guests to maintain conversation context within a browser session
    const guestId = dto.guestId || new Types.ObjectId().toString();
    return this.chatbotService.processMessage(guestId, dto, true); // isGuest = true
  }

  // ==================== User Endpoints (Authenticated) ====================

  @Post('message')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message to the chatbot' })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendMessage(
    @Request() req,
    @Body() dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    return this.chatbotService.processMessage(req.user._id.toString(), dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get conversation list' })
  @ApiResponse({
    status: 200,
    description: 'Conversation list retrieved',
    type: ConversationListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getConversations(
    @Request() req,
    @Query() query: ChatHistoryQueryDto,
  ): Promise<ConversationListResponseDto> {
    return this.chatbotService.getUserConversations(
      req.user._id.toString(),
      query.page || 1,
      query.limit || 20,
    );
  }

  @Get('history/:conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific conversation history' })
  @ApiResponse({
    status: 200,
    description: 'Conversation history retrieved',
    type: ConversationHistoryDto,
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async getConversationHistory(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationHistoryDto | null> {
    return this.chatbotService.getConversationHistory(
      req.user._id.toString(),
      conversationId,
    );
  }

  @Delete('history/:conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async deleteConversation(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.chatbotService.clearConversation(
      req.user._id.toString(),
      conversationId,
    );
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get quick suggestions for starting a conversation' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions retrieved',
    type: [String],
  })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['en', 'es'],
    description: 'Language for suggestions',
  })
  getSuggestions(@Query('language') language: string = 'es'): string[] {
    return this.chatbotService.getQuickSuggestions(language);
  }

  // ==================== Admin Endpoints ====================

  @Get('admin/documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all knowledge base documents (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Documents retrieved',
    type: [KnowledgeDocumentResponseDto],
  })
  @ApiQuery({ name: 'region', required: false, enum: ['us', 'es', 'both'] })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['faq', 'academy', 'mentorship', 'navigation', 'pricing', 'general'],
  })
  @ApiQuery({ name: 'language', required: false, enum: ['en', 'es'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getDocuments(
    @Query('region') region?: string,
    @Query('category') category?: string,
    @Query('language') language?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filter: any = {};
    if (region) filter.region = region;
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    return this.vectorStore.getAllDocuments(filter);
  }

  @Post('admin/documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new knowledge base document (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Document created',
    type: KnowledgeDocumentResponseDto,
  })
  async createDocument(@Body() dto: CreateKnowledgeDocumentDto) {
    return this.vectorStore.addDocument(dto.title, dto.content, {
      region: dto.region as RegionType,
      category: dto.category as KnowledgeCategory,
      language: dto.language as LanguageType,
      tags: dto.tags,
      isActive: dto.isActive,
    });
  }

  @Post('admin/documents/upload-pdf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a PDF document to the knowledge base (Admin)',
    description:
      'Extracts text from PDF, chunks it, generates embeddings, and stores in the knowledge base',
  })
  @ApiResponse({
    status: 201,
    description: 'PDF processed and documents created',
    schema: {
      type: 'object',
      properties: {
        documentsCreated: { type: 'number' },
        title: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or parameters' })
  async uploadPdfDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPdfDto,
  ) {
    if (!file) {
      throw new BadRequestException('No PDF file provided');
    }

    if (!file.mimetype.includes('pdf')) {
      throw new BadRequestException('File must be a PDF');
    }

    // Max file size: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    return this.vectorStore.addDocumentFromPdf(file, dto);
  }

  @Put('admin/documents/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a knowledge base document (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Document updated',
    type: KnowledgeDocumentResponseDto,
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    return this.vectorStore.updateDocument(id, dto);
  }

  @Delete('admin/documents/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a knowledge base document (Admin)' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async deleteDocument(@Param('id') id: string): Promise<void> {
    await this.vectorStore.deleteDocument(id);
  }

  @Post('admin/reindex')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reindex all knowledge base documents (Admin)',
    description: 'Regenerates embeddings for all active documents',
  })
  @ApiResponse({
    status: 200,
    description: 'Reindexing completed',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        errors: { type: 'number' },
      },
    },
  })
  async reindexDocuments() {
    return this.vectorStore.reindexAll();
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get knowledge base statistics (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved',
  })
  async getStats() {
    return this.vectorStore.getDocumentStats();
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chatbot analytics (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics retrieved',
    type: ChatAnalyticsDto,
  })
  async getAnalytics(): Promise<ChatAnalyticsDto> {
    // Placeholder - implement based on your analytics needs
    return {
      totalConversations: 0,
      totalMessages: 0,
      averageMessagesPerConversation: 0,
      activeConversationsToday: 0,
      commonTopics: [],
      userSatisfactionRating: undefined,
    };
  }

  @Post('admin/seed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Seed the knowledge base with FAQ content (Admin)',
    description:
      'Populates the knowledge base with predefined FAQ and documentation content. This may take several minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seeding completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        totalDocuments: { type: 'number' },
        successCount: { type: 'number' },
        errorCount: { type: 'number' },
        duration: { type: 'number' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async seedKnowledgeBase(): Promise<SeedResult> {
    return this.seedService.seedAll();
  }

  @Get('admin/seed/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seed data statistics (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Seed statistics retrieved',
  })
  async getSeedStats() {
    return this.seedService.getStats();
  }

  // ==================== URL Source Endpoints ====================

  @Get('admin/url-sources')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all URL sources (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'URL sources retrieved',
  })
  async getUrlSources() {
    return this.vectorStore.getAllUrlSources();
  }

  @Post('admin/url-sources')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a URL source to the knowledge base (Admin)',
    description:
      'Fetches content from a URL, extracts text, chunks it, and stores in the knowledge base',
  })
  @ApiResponse({
    status: 201,
    description: 'URL processed and documents created',
    schema: {
      type: 'object',
      properties: {
        documentsCreated: { type: 'number' },
        title: { type: 'string' },
        urlSourceId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid URL or parameters' })
  async addUrlSource(@Body() dto: AddUrlDocumentDto) {
    return this.vectorStore.addDocumentFromUrl(dto);
  }

  @Put('admin/url-sources/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a URL source configuration (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'URL source updated',
  })
  @ApiParam({ name: 'id', description: 'URL Source ID' })
  async updateUrlSource(
    @Param('id') id: string,
    @Body() dto: UpdateUrlSourceDto,
  ) {
    return this.vectorStore.updateUrlSource(id, dto);
  }

  @Post('admin/url-sources/:id/refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh content from a URL source (Admin)',
    description: 'Re-crawls the URL and updates the knowledge base documents',
  })
  @ApiResponse({
    status: 200,
    description: 'URL source refreshed',
    schema: {
      type: 'object',
      properties: {
        documentsCreated: { type: 'number' },
        documentsDeleted: { type: 'number' },
        title: { type: 'string' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'URL Source ID' })
  async refreshUrlSource(@Param('id') id: string) {
    return this.vectorStore.refreshUrlSource(id);
  }

  @Delete('admin/url-sources/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a URL source and its documents (Admin)',
    description: 'Removes the URL source and all associated knowledge base documents',
  })
  @ApiResponse({
    status: 200,
    description: 'URL source deleted',
    schema: {
      type: 'object',
      properties: {
        documentsDeleted: { type: 'number' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'URL Source ID' })
  async deleteUrlSource(@Param('id') id: string) {
    return this.vectorStore.deleteUrlSource(id);
  }

  // ==================== Diagnostic Endpoints ====================

  @Get('admin/diagnostics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Run diagnostics on the knowledge base (Admin)',
    description: 'Check document embeddings and test search functionality',
  })
  @ApiQuery({ name: 'testQuery', required: false, description: 'Test query to search' })
  @ApiQuery({ name: 'region', required: false, description: 'Region filter (us/es)' })
  @ApiQuery({ name: 'language', required: false, description: 'Language filter (en/es)' })
  @ApiResponse({
    status: 200,
    description: 'Diagnostics completed',
  })
  async runDiagnostics(
    @Query('testQuery') testQuery?: string,
    @Query('region') region?: string,
    @Query('language') language?: string,
  ) {
    return this.vectorStore.runDiagnostics(testQuery, region, language);
  }

  // Quick debug endpoint (remove in production)
  @Get('debug/status')
  @ApiOperation({ summary: 'Quick debug check (no auth required)' })
  async debugStatus(@Query('q') testQuery?: string) {
    return this.vectorStore.runDiagnostics(testQuery);
  }
}
