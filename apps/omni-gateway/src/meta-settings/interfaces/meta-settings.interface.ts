export type MetaChannelType = "whatsapp" | "instagram" | "messenger";

export interface MetaAppSetting {
  id: string;
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetaEmbeddedLoginConfig {
  appId: string;
  configId: string;
  channelType: MetaChannelType;
}

export interface SaveMetaSettingsPayload {
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId: string;
}

export interface SaveMetaSettingsPayloadWithOptionalConfigId {
  channelType: MetaChannelType;
  appId: string;
  appSecret: string;
  configId?: string;
}

export interface MetaAppSettingPublic {
  id: string;
  channelType: MetaChannelType;
  appId: string;
  configId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
