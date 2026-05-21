export type GatewayRequestAction =
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
  action: GatewayRequestAction;
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

export interface TemplateListPayload {
  channelType: "whatsapp" | "instagram" | "evolution" | "meta_api";
}

export interface TemplateCreatePayload {
  name: string;
  language: string;
  text: string;
  variables: Array<{ name: string; example: string }>;
}

export interface TemplateDeletePayload {
  templateName: string;
}

export interface TypingSendPayload {
  messageId: string;
}

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

export interface ChannelDisconnectPayload {
  channelId: string;
}

export interface MediaDownloadPayload {
  messageId: string;
}

export interface MediaUploadPayload {
  fileBase64: string;
  filename: string;
  mimeType: string;
}

export interface TemplateRetrievePayload {
  templateName: string;
}

export interface ChannelInfoResponse {
  instanceId: string;
  instanceName: string;
  phoneNumber: string | null;
  connected: boolean;
}

export type MetaChannelType = "whatsapp" | "instagram" | "messenger";

export interface MetaGetEmbeddedLoginConfigPayload {
  channelType: MetaChannelType;
}

export interface MetaGetEmbeddedLoginConfigResponse {
  appId: string;
  configId: string;
  channelType: MetaChannelType;
}

export interface MetaSaveSettingsPayload {
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId: string;
}

export interface MetaSaveSettingsPayloadWithOptionalConfigId {
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId?: string;
}

export interface MetaGetSettingsPayload {
  channelType: MetaChannelType;
}

export interface MetaSetActivePayload {
  channelType: MetaChannelType;
  isActive: boolean;
}

export interface MetaExchangeCodePayload {
  channelType: MetaChannelType;
  code: string;
}

export interface MetaExchangeCodeResponse {
  accessToken: string;
  expiresIn: number;
}

export interface MetaAppSettingResponse {
  id: string;
  channelType: MetaChannelType;
  appId: string;
  configId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAppSettingFullResponse extends MetaAppSettingResponse {
  appSecret: string;
}

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

export interface GroupParticipantsPayload {
  groupJid: string;
}

export interface GroupParticipantsResponse {
  participants: GroupParticipant[];
}

export interface GroupPicturePayload {
  groupJid: string;
}

export interface GroupPictureResponse {
  pictureUrl: string | null;
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

export interface ChannelRemovePayload {
  channelId: string;
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
