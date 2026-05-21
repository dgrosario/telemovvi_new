import { MetaChannelType } from "./meta-settings.interface";

export interface InstagramSaveSettingsPayload {
  channelType: Extract<MetaChannelType, "instagram">;
  appId: string;
  appSecret: string;
  configId?: string;
}

export interface InstagramGetSettingsPayload {
  channelType: Extract<MetaChannelType, "instagram">;
}

export interface InstagramSetActivePayload {
  channelType: Extract<MetaChannelType, "instagram">;
  isActive: boolean;
}

export interface InstagramExchangeCodePayload {
  channelType: Extract<MetaChannelType, "instagram">;
  code: string;
}

export interface InstagramGetEmbeddedLoginConfigPayload {
  channelType: Extract<MetaChannelType, "instagram">;
}