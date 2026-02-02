import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageResponseDto {
  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'system'] })
  role: string;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiProperty({ description: 'Message timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Sources used for the response' })
  sources?: string[];
}

export class ChatResponseDto {
  @ApiProperty({ description: 'Conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'The assistant response message' })
  message: ChatMessageResponseDto;

  @ApiPropertyOptional({
    description: 'Suggested follow-up questions',
    type: [String],
  })
  suggestions?: string[];

  @ApiPropertyOptional({ description: 'Processing metadata' })
  metadata?: {
    toolsUsed?: string[];
    sourcesCount?: number;
    processingTime?: number;
  };
}

export class ConversationHistoryDto {
  @ApiProperty({ description: 'Conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'User region' })
  region: string;

  @ApiProperty({ description: 'Conversation language' })
  language: string;

  @ApiProperty({
    description: 'List of messages',
    type: [ChatMessageResponseDto],
  })
  messages: ChatMessageResponseDto[];

  @ApiProperty({ description: 'Total message count' })
  messageCount: number;

  @ApiProperty({ description: 'Conversation creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last message timestamp' })
  lastMessageAt?: Date;
}

export class ConversationListItemDto {
  @ApiProperty({ description: 'Conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'Preview of the last message' })
  preview: string;

  @ApiProperty({ description: 'Message count' })
  messageCount: number;

  @ApiProperty({ description: 'Last activity date' })
  lastMessageAt: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}

export class ConversationListResponseDto {
  @ApiProperty({
    description: 'List of conversations',
    type: [ConversationListItemDto],
  })
  conversations: ConversationListItemDto[];

  @ApiProperty({ description: 'Total number of conversations' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class KnowledgeDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Document region' })
  region: string;

  @ApiProperty({ description: 'Document category' })
  category: string;

  @ApiProperty({ description: 'Document title' })
  title: string;

  @ApiProperty({ description: 'Document content' })
  content: string;

  @ApiProperty({ description: 'Document language' })
  language: string;

  @ApiProperty({ description: 'Document tags', type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Whether document is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Last update date' })
  lastUpdated: Date;

  @ApiProperty({ description: 'Document version' })
  version: number;
}

export class ChatAnalyticsDto {
  @ApiProperty({ description: 'Total conversations' })
  totalConversations: number;

  @ApiProperty({ description: 'Total messages' })
  totalMessages: number;

  @ApiProperty({ description: 'Average messages per conversation' })
  averageMessagesPerConversation: number;

  @ApiProperty({ description: 'Active conversations today' })
  activeConversationsToday: number;

  @ApiProperty({ description: 'Most common topics', type: [String] })
  commonTopics: string[];

  @ApiProperty({ description: 'User satisfaction rating' })
  userSatisfactionRating?: number;
}
