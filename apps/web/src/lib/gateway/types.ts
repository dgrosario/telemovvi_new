// Gateway Types and Interfaces

export type GatewayAction =
  | "templates.list"
  | "templates.listApproved"
  | "templates.create"
  | "templates.delete"
  | "templates.retrieve"
  | "typing.send"
  | "channel.connect"
  | "channel.disconnect"
  | "channel.info"
  | "channel.remove"
  | "channels.syncStatus"
  | "media.download"
  | "media.upload"
  | "meta.getEmbeddedLoginConfig"
  | "meta.saveSettings"
  | "meta.getSettings"
  | "meta.getAllSettings"
  | "meta.setActive"
  | "meta.exchangeCode"
  | "groups.info"
  | "groups.participants"
  | "groups.picture"
  | "message.delete"
  | "message.edit"
  | "message.reaction"
  | "evolution.healthCheck"
  | "evolution.listInstances"
  | "evolution.removeInstance";

export interface GatewayRequest<T = unknown> {
  action: GatewayAction;
  correlationId: string;
  replyTo: string;
  workspaceId: string;
  channelId: string;
  payload: T;
}

export interface GatewayResponse<T = unknown> {
  correlationId: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface PendingRequest<T = unknown> {
  resolve: (value: GatewayResponse<T>) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

// Template Types
export interface TemplateListPayload {
  channelType?: "whatsapp" | "instagram" | "evolution" | "meta_api";
}

export interface TemplateCreatePayload {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  text: string;
  variables: Array<{ name: string; example: string }>;
}

export interface TemplateDeletePayload {
  templateName: string;
}

export interface TemplateRetrievePayload {
  templateName: string;
}

export interface GatewayTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  text: string;
  channelId: string;
  channel: {
    id: string;
    name: string;
    type: string;
    payload: Record<string, unknown>;
  };
  variables: Array<{ name: string }>;
}

// Channel Types
export interface ChannelConnectPayload {
  channelId: string;
  channelName: string;
  channelType: "whatsapp" | "instagram" | "evolution" | "meta_api";
  code?: string;
  wabaId?: string;
  redirectUri?: string;
  forceNewInstance?: boolean;
  metaApiConfig?: {
    appId: string;
    appSecret: string;
    accessToken: string;
    wabaId: string;
    phoneId: string;
    businessId?: string;
    verifyToken?: string;
  };
}

export interface ChannelRemovePayload {
  channelId: string;
}

export interface ChannelInfoResponse {
  instanceId: string;
  instanceName: string;
  phoneNumber: string | null;
  connected: boolean;
}

export interface EvolutionListInstancesResponse {
  instances: Array<{
    id: string;
    name: string;
    connectionStatus: string;
    number: string | null;
    ownerJid: string | null;
  }>;
}

export interface EvolutionRemoveInstancePayload {
  instanceName: string;
}

export interface EvolutionRemoveInstanceResponse {
  instanceName: string;
  disconnected: boolean;
  deleted: boolean;
  queuesCleaned: boolean;
}

export interface ChannelsSyncStatusPayload {
  channels: Array<{
    channelId: string;
    instanceName: string;
  }>;
}

export interface ChannelsSyncStatusResponse {
  statuses: Array<{
    channelId: string;
    status: "connected" | "disconnected";
  }>;
}

// Media Types
export interface MediaDownloadPayload {
  messageId: string;
}

export interface MediaUploadPayload {
  fileBase64: string;
  filename: string;
  mimeType: string;
}

// Message Types
export interface TypingSendPayload {
  messageId: string;
}

export interface MessageDeletePayload {
  messageId: string;
  remoteJid: string;
}

export interface MessageEditPayload {
  messageId: string;
  remoteJid: string;
  newContent: string;
}

export interface MessageReactionPayload {
  messageId: string;
  remoteJid: string;
  emoji: string;
  fromMe: boolean;
}

// Meta Types
export type MetaChannelType = "whatsapp" | "instagram" | "messenger";

export interface MetaEmbeddedLoginConfig {
  appId: string;
  configId: string;
  channelType: MetaChannelType;
}

export interface MetaAppSetting {
  id: string;
  channelType: MetaChannelType;
  appId: string;
  configId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAppSettingFull extends MetaAppSetting {
  appSecret: string;
}

export interface MetaSaveSettingsPayload {
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId: string;
}

export interface MetaExchangeCodeResponse {
  accessToken: string;
  expiresIn: number;
}

// Group Types
export interface GroupInfoPayload {
  groupJid: string;
}

export interface GroupParticipant {
  id: string;
  admin: string | null;
  name?: string;
  thumbnail?: string;
}

export interface GroupInfoResponse {
  id: string;
  subject: string;
  description: string | null;
  owner: string | null;
  size: number;
  creation: number | null;
  pictureUrl: string | null;
  participants: GroupParticipant[];
}

export interface GroupParticipantsResponse {
  participants: GroupParticipant[];
}

export interface GroupPictureResponse {
  pictureUrl: string | null;
}
