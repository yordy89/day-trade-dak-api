import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatConversationDocument = ChatConversation & Document;

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export class ChatMessageMetadata {
  @Prop({ type: [Object], default: [] })
  toolCalls?: any[];

  @Prop({ type: [String], default: [] })
  sources?: string[];
}

export class ChatMessage {
  @Prop({ enum: MessageRole, required: true })
  role: MessageRole;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({ type: ChatMessageMetadata })
  metadata?: ChatMessageMetadata;
}

@Schema({ timestamps: true })
export class ChatConversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ enum: ['us', 'es'], required: true, index: true })
  region: string;

  @Prop({ type: [ChatMessage], default: [] })
  messages: ChatMessage[];

  @Prop({ default: 'en' })
  language: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ default: false, index: true })
  isGuest: boolean;

  @Prop({ type: Date, default: null })
  guestExpiresAt?: Date;
}

export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);

// Indexes for performance
ChatConversationSchema.index({ userId: 1, isActive: 1 });
ChatConversationSchema.index({ userId: 1, createdAt: -1 });
ChatConversationSchema.index({ region: 1, lastMessageAt: -1 });

// TTL index for automatic guest conversation cleanup (48 hours after guestExpiresAt)
// MongoDB will automatically delete documents where guestExpiresAt has passed
ChatConversationSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to update message count and last message time
ChatConversationSchema.pre('save', function (next) {
  if (this.messages && this.messages.length > 0) {
    this.messageCount = this.messages.length;
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});
