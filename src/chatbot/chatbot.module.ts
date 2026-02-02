import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Schemas
import {
  ChatConversation,
  ChatConversationSchema,
} from './schemas/chat-conversation.schema';
import {
  KnowledgeDocument,
  KnowledgeDocumentSchema,
} from './schemas/knowledge-document.schema';
import {
  UrlSource,
  UrlSourceSchema,
} from './schemas/url-source.schema';

// Services
import { ChatbotService } from './chatbot.service';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { VectorStoreService } from './embeddings/vector-store.service';
import { QdrantService } from './embeddings/qdrant.service';
import { KnowledgeBaseSeedService } from './seeds/seed.service';
import { UrlCrawlerService } from './services/url-crawler.service';
import { UrlRefreshCronService } from './services/url-refresh-cron.service';

// Tools
import { EventsTool } from './tools/events.tool';
import { CoursesTool } from './tools/courses.tool';
import { NavigationTool } from './tools/navigation.tool';

// Controller & Gateway
import { ChatbotController } from './chatbot.controller';
import { ChatbotGateway } from './chatbot.gateway';

// External modules
import { AxiosModule } from '../axios/axios.module';
import { UsersModule } from '../users/users.module';
import { Event, EventSchema } from '../event/schemas/event.schema';
import { Video, VideoSchema } from '../video/video.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatConversation.name, schema: ChatConversationSchema },
      { name: KnowledgeDocument.name, schema: KnowledgeDocumentSchema },
      { name: UrlSource.name, schema: UrlSourceSchema },
      { name: Event.name, schema: EventSchema },
      { name: 'Video', schema: VideoSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
    AxiosModule,
    UsersModule,
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    ChatbotGateway,
    EmbeddingsService,
    QdrantService,
    VectorStoreService,
    KnowledgeBaseSeedService,
    UrlCrawlerService,
    UrlRefreshCronService,
    EventsTool,
    CoursesTool,
    NavigationTool,
  ],
  exports: [ChatbotService, ChatbotGateway, VectorStoreService],
})
export class ChatbotModule {}
