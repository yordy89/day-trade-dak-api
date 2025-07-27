export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  httpUrl?: string;
}

export interface LiveKitTokenOptions {
  identity: string;
  name?: string;
  metadata?: string;
  permissions?: LiveKitPermissions;
}

export interface LiveKitPermissions {
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

export interface LiveKitRoomOptions {
  name: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
}

export interface LiveKitParticipant {
  sid: string;
  identity: string;
  name?: string;
  state: string;
  metadata?: string;
  joinedAt: number;
  permission?: LiveKitPermissions;
}