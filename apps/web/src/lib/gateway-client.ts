// Legacy export file - re-exports from new modular structure
// This file maintains backward compatibility
export { GatewayClient, getGatewayClient } from "./gateway/client";
export { gatewayActions } from "./gateway/actions";

// Re-export all types
export type {
  GatewayAction,
  GatewayRequest,
  GatewayResponse,
  PendingRequest,
} from "./gateway/types";

export type {
  TemplateListPayload,
  TemplateCreatePayload,
  TemplateDeletePayload,
  TemplateRetrievePayload,
  GatewayTemplate,
} from "./gateway/types";

export type {
  ChannelConnectPayload,
  ChannelInfoResponse,
  ChannelsSyncStatusPayload,
  ChannelsSyncStatusResponse,
} from "./gateway/types";

export type {
  MediaDownloadPayload,
  MediaUploadPayload,
} from "./gateway/types";

export type {
  TypingSendPayload,
  MessageDeletePayload,
  MessageEditPayload,
  MessageReactionPayload,
} from "./gateway/types";

export type {
  MetaChannelType,
  MetaEmbeddedLoginConfig,
  MetaAppSetting,
  MetaAppSettingFull,
  MetaSaveSettingsPayload,
  MetaExchangeCodeResponse,
} from "./gateway/types";

export type {
  GroupInfoPayload,
  GroupParticipant,
  GroupInfoResponse,
} from "./gateway/types";
