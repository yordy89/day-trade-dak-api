import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatConversation,
  ChatConversationDocument,
  MessageRole,
  ChatMessage,
} from './schemas/chat-conversation.schema';
import { VectorStoreService, SearchResult } from './embeddings/vector-store.service';
import { EventsTool } from './tools/events.tool';
import { CoursesTool } from './tools/courses.tool';
import { NavigationTool } from './tools/navigation.tool';
import {
  ChatResponseDto,
  ConversationHistoryDto,
  ConversationListResponseDto,
} from './dto/chat-response.dto';
import { SendMessageDto } from './dto/chat-message.dto';

interface ToolResult {
  name: string;
  result: any;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private openai: OpenAI;
  private readonly model = 'gpt-4o-mini'; // Cost-effective model with good performance
  private readonly maxTokens = 1024;

  constructor(
    @InjectModel(ChatConversation.name)
    private conversationModel: Model<ChatConversationDocument>,
    private readonly configService: ConfigService,
    private readonly vectorStore: VectorStoreService,
    private readonly eventsTool: EventsTool,
    private readonly coursesTool: CoursesTool,
    private readonly navigationTool: NavigationTool,
  ) {
    // Initialize OpenAI client
    const apiKey = this.configService.get<string>('OPENAI_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_KEY not configured');
    }
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    userId: string,
    dto: SendMessageDto,
    isGuest: boolean = false,
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    const { message, conversationId, region = 'es', language = 'es' } = dto;

    try {
      // Get or create conversation
      let conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
        region,
        language,
        isGuest,
      );

      // Add user message to conversation
      const userMessage: ChatMessage = {
        role: MessageRole.USER,
        content: message,
        timestamp: new Date(),
      };
      conversation.messages.push(userMessage);

      // Search for relevant knowledge base content
      // Use low minScore to ensure we find relevant docs, Claude will filter irrelevant ones
      const relevantDocs = await this.vectorStore.searchSimilar(message, {
        region,
        language,
        limit: 5,
        minScore: 0.3,
      });

      // Log RAG search results for debugging
      this.logger.log(
        `RAG Search: query="${message.substring(0, 50)}..." found ${relevantDocs.length} docs`,
      );
      if (relevantDocs.length > 0) {
        relevantDocs.forEach((doc, i) => {
          this.logger.debug(
            `  [${i + 1}] score=${doc.score.toFixed(3)} title="${doc.document.title}"`,
          );
        });
      }

      // Build context from RAG results
      const ragContext = this.buildRagContext(relevantDocs);

      // Generate response using Claude
      const response = await this.generateResponse(
        conversation,
        message,
        ragContext,
        region,
        language,
      );

      // Add assistant message to conversation
      const assistantMessage: ChatMessage = {
        role: MessageRole.ASSISTANT,
        content: response.content,
        timestamp: new Date(),
        metadata: {
          sources: response.sources,
          toolCalls: response.toolsUsed,
        },
      };
      conversation.messages.push(assistantMessage);

      // Save conversation
      await conversation.save();

      const processingTime = Date.now() - startTime;

      return {
        conversationId: conversation._id.toString(),
        message: {
          role: 'assistant',
          content: response.content,
          timestamp: assistantMessage.timestamp,
          sources: response.sources,
        },
        suggestions: this.generateSuggestions(message, response.content, language),
        metadata: {
          toolsUsed: response.toolsUsed,
          sourcesCount: response.sources.length,
          processingTime,
        },
      };
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate response using OpenAI with tools
   */
  private async generateResponse(
    conversation: ChatConversationDocument,
    currentMessage: string,
    ragContext: string,
    region: string,
    language: string,
  ): Promise<{ content: string; sources: string[]; toolsUsed: string[] }> {
    const systemPrompt = this.buildSystemPrompt(region, language, ragContext);

    // Build message history (last 10 messages for context)
    const messageHistory: OpenAI.Chat.ChatCompletionMessageParam[] = conversation.messages
      .slice(-10)
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .map((m) => ({
        role: (m.role === MessageRole.USER ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    // Convert tool definitions to OpenAI format
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      this.convertToOpenAITool(EventsTool.getToolDefinition()),
      this.convertToOpenAITool(CoursesTool.getToolDefinition()),
      this.convertToOpenAITool(NavigationTool.getToolDefinition()),
    ];

    const toolsUsed: string[] = [];
    const sources: string[] = [];
    let finalContent = '';

    // Check if OpenAI client is initialized
    if (!this.openai) {
      this.logger.error('OpenAI client not initialized. Check OPENAI_KEY in environment.');
      return {
        content: this.getFallbackResponse(language),
        sources: [],
        toolsUsed: [],
      };
    }

    try {
      // Build messages with system prompt
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messageHistory,
      ];

      this.logger.debug(`Sending request to OpenAI with ${messages.length} messages`);

      // First API call
      let response = await this.openai.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages,
        tools,
        tool_choice: 'auto',
      });

      let assistantMessage = response.choices[0].message;

      // Process tool calls if any
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        messages.push(assistantMessage);

        // Process each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const toolResult = await this.executeToolCall(
            functionName,
            functionArgs,
            region,
          );
          toolsUsed.push(functionName);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Continue conversation with tool results
        response = await this.openai.chat.completions.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages,
          tools,
          tool_choice: 'auto',
        });

        assistantMessage = response.choices[0].message;
      }

      // Extract final text response
      finalContent = assistantMessage.content || '';

    } catch (error: any) {
      this.logger.error(`OpenAI API error: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error(`OpenAI response error: ${JSON.stringify(error.response.data)}`);
      }
      finalContent = this.getFallbackResponse(language);
    }

    return { content: finalContent, sources, toolsUsed };
  }

  /**
   * Convert Anthropic tool definition to OpenAI format
   */
  private convertToOpenAITool(anthropicTool: any): OpenAI.Chat.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: anthropicTool.name,
        description: anthropicTool.description,
        parameters: anthropicTool.input_schema,
      },
    };
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(
    toolName: string,
    params: any,
    region: string,
  ): Promise<any> {
    switch (toolName) {
      case 'get_events':
        const events = await this.eventsTool.execute({
          ...params,
          region: region as 'us' | 'es',
        });
        return this.eventsTool.formatForContext(events);

      case 'get_courses':
        const courses = await this.coursesTool.execute(params);
        return this.coursesTool.formatForContext(courses);

      case 'get_navigation_help':
        const navResult = await this.navigationTool.execute(params);
        return this.navigationTool.formatForContext(navResult);

      default:
        return 'Tool not found';
    }
  }

  /**
   * Build the system prompt for Claude
   */
  private buildSystemPrompt(
    region: string,
    language: string,
    ragContext: string,
  ): string {
    const regionName = region === 'us' ? 'United States' : 'Spain';
    const currency = region === 'us' ? 'USD' : 'EUR';

    const languageInstruction =
      language === 'es'
        ? 'DEBES responder SIEMPRE en Español.'
        : 'You MUST respond ALWAYS in English.';

    const supportInfo =
      language === 'es'
        ? `Para más ayuda, contacta a soporte:
📧 Email: support@daytradedak.com
📞 Teléfono: +1 (786) 355-1346
🔗 Página de contacto: https://daytradedak.com/contact`
        : `For more help, contact support:
📧 Email: support@daytradedak.com
📞 Phone: +1 (786) 355-1346
🔗 Contact page: https://daytradedak.com/contact`;

    const noInfoResponse =
      language === 'es'
        ? `No tengo información específica sobre eso en mi base de conocimientos. Te recomiendo contactar directamente a nuestro equipo de soporte para obtener ayuda personalizada:\n\n${supportInfo}`
        : `I don't have specific information about that in my knowledge base. I recommend contacting our support team directly for personalized help:\n\n${supportInfo}`;

    return `You are the official AI assistant for DayTradeDak, a trading education platform.

${languageInstruction}

## CRITICAL RULES - YOU MUST FOLLOW THESE:

1. **ONLY use information from the "KNOWLEDGE BASE" section below.** Do NOT make up, invent, or assume ANY information about DayTradeDak, its services, prices, features, contacts, or policies.

2. **If the knowledge base contains relevant information**, use it EXACTLY as provided. Quote the specific details (emails, phone numbers, URLs, prices, etc.) directly from the knowledge base.

3. **If the knowledge base does NOT contain the information needed to answer the question**, respond with this EXACT message:
"${noInfoResponse}"

4. **NEVER provide generic advice** that isn't from the knowledge base. For example, do NOT say things like "check the help section" or "look for the support button" unless that specific information is in the knowledge base.

5. **NEVER hallucinate or invent** contact information, prices, features, procedures, or any other details about DayTradeDak.

6. You may use the provided tools (events, courses, navigation) to get REAL data from DayTradeDak's systems.

## Context:
- Region: ${regionName}
- Currency: ${currency}
- Today's date: ${new Date().toISOString().split('T')[0]}

## KNOWLEDGE BASE:
${ragContext ? ragContext : 'No relevant information found in the knowledge base for this query.'}

## Support Contact (use when redirecting users):
${supportInfo}

Remember: It's better to say "I don't have that information" and redirect to support than to provide inaccurate or made-up information.`;
  }

  /**
   * Build RAG context from search results
   */
  private buildRagContext(results: SearchResult[]): string {
    if (results.length === 0) return '';

    return results
      .map((r) => {
        return `[${r.document.category}] ${r.document.title}:\n${r.document.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate follow-up suggestions
   */
  private generateSuggestions(
    userMessage: string,
    response: string,
    language: string,
  ): string[] {
    // Context-aware suggestions based on the conversation
    const suggestions =
      language === 'es'
        ? [
            '¿Qué cursos están disponibles?',
            '¿Cuándo es el próximo evento?',
            '¿Cómo contacto a soporte?',
          ]
        : [
            'What courses are available?',
            'When is the next event?',
            'How do I contact support?',
          ];

    return suggestions;
  }

  /**
   * Get fallback response when Claude is unavailable
   */
  private getFallbackResponse(language: string): string {
    return language === 'es'
      ? 'Lo siento, estoy experimentando dificultades técnicas. Por favor, intenta de nuevo más tarde o contacta a soporte si el problema persiste.\n\n📧 Email: support@daytradedak.com\n📞 Teléfono: +1 (786) 355-1346\n🔗 Contacto: https://daytradedak.com/contact'
      : "I'm sorry, I'm experiencing technical difficulties. Please try again later or contact support if the issue persists.\n\n📧 Email: support@daytradedak.com\n📞 Phone: +1 (786) 355-1346\n🔗 Contact: https://daytradedak.com/contact";
  }

  /**
   * Get or create a conversation
   */
  private async getOrCreateConversation(
    userId: string,
    conversationId: string | undefined,
    region: string,
    language: string,
    isGuest: boolean = false,
  ): Promise<ChatConversationDocument> {
    if (conversationId) {
      // For guests, we need to search by the guestId stored in userId field
      const existing = await this.conversationModel.findOne({
        _id: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
      });

      if (existing) {
        return existing;
      }
    }

    // Create new conversation
    // For guests, set expiration to 48 hours from now
    const guestExpiresAt = isGuest
      ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      : null;

    const conversation = new this.conversationModel({
      userId: new Types.ObjectId(userId),
      region,
      language,
      messages: [],
      isActive: true,
      isGuest,
      guestExpiresAt,
    });

    return conversation.save();
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    userId: string,
    conversationId: string,
  ): Promise<ConversationHistoryDto | null> {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });

    if (!conversation) {
      return null;
    }

    return {
      conversationId: conversation._id.toString(),
      region: conversation.region,
      language: conversation.language,
      messages: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        sources: m.metadata?.sources,
      })),
      messageCount: conversation.messageCount,
      createdAt: conversation['createdAt'],
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  /**
   * Get user's conversations list
   */
  async getUserConversations(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ConversationListResponseDto> {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.conversationModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.conversationModel.countDocuments({
        userId: new Types.ObjectId(userId),
      }),
    ]);

    return {
      conversations: conversations.map((c) => ({
        conversationId: c._id.toString(),
        preview:
          c.messages.length > 0
            ? c.messages[c.messages.length - 1].content.slice(0, 100)
            : '',
        messageCount: c.messageCount,
        lastMessageAt: c.lastMessageAt || c['createdAt'],
        createdAt: c['createdAt'],
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Clear conversation history
   */
  async clearConversation(userId: string, conversationId: string): Promise<boolean> {
    const result = await this.conversationModel.deleteOne({
      _id: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });

    return result.deletedCount > 0;
  }

  /**
   * Get quick suggestions for new conversations
   */
  getQuickSuggestions(language: string): string[] {
    return language === 'es'
      ? [
          '¿Qué es DayTradeDak?',
          '¿Cómo creo una cuenta?',
          '¿Quién es Mijail Medina?',
        ]
      : [
          'What is DayTradeDak?',
          'How do I create an account?',
          'Who is Mijail Medina?',
        ];
  }
}
