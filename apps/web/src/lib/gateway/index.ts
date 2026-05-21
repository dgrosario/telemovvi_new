// Main export file for gateway module
export { GatewayClient, getGatewayClient } from "./client";
export { gatewayActions } from "./actions";
export type {
  // Core types
  GatewayAction,
  GatewayRequest,
  GatewayResponse,
  PendingRequest,
  // Template types
  TemplateListPayload,
  TemplateCreatePayload,
  TemplateDeletePayload,
  TemplateRetrievePayload,
  GatewayTemplate,
  // Channel types
  ChannelConnectPayload,
  ChannelInfoResponse,
  ChannelsSyncStatusPayload,
  ChannelsSyncStatusResponse,
  // Media types
  MediaDownloadPayload,
  MediaUploadPayload,
  // Message types
  TypingSendPayload,
  MessageDeletePayload,
  MessageEditPayload,
  MessageReactionPayload,
  // Meta types
  MetaChannelType,
  MetaEmbeddedLoginConfig,
  MetaAppSetting,
  MetaAppSettingFull,
  MetaSaveSettingsPayload,
  MetaExchangeCodeResponse,
  // Group types
  GroupInfoPayload,
  GroupParticipant,
  GroupInfoResponse,
} from "./types";
