import { getGatewayClient } from "./client";
import type {
  TemplateListPayload,
  TemplateCreatePayload,
  TemplateDeletePayload,
  TemplateRetrievePayload,
  GatewayTemplate,
  TypingSendPayload,
  ChannelConnectPayload,
  ChannelInfoResponse,
  ChannelsSyncStatusPayload,
  ChannelsSyncStatusResponse,
  MediaDownloadPayload,
  MediaUploadPayload,
  MetaChannelType,
  MetaEmbeddedLoginConfig,
  MetaSaveSettingsPayload,
  MetaAppSetting,
  MetaAppSettingFull,
  MetaExchangeCodeResponse,
  GroupInfoPayload,
  GroupInfoResponse,
  MessageDeletePayload,
  MessageEditPayload,
  MessageReactionPayload,
  EvolutionListInstancesResponse,
  EvolutionRemoveInstancePayload,
  EvolutionRemoveInstanceResponse,
} from "./types";

export const gatewayActions = {
  // Template Actions
  async listTemplates(
    workspaceId: string,
    channelType: TemplateListPayload["channelType"] = "whatsapp"
  ) {
    const client = getGatewayClient();
    return client.request<TemplateListPayload, GatewayTemplate[]>(
      "templates.list",
      workspaceId,
      "",
      { channelType }
    );
  },

  async listApprovedTemplates(workspaceId: string, channelId: string) {
    const client = getGatewayClient();
    return client.request<TemplateListPayload, GatewayTemplate[]>(
      "templates.listApproved",
      workspaceId,
      channelId,
      {}
    );
  },

  async createTemplate(
    workspaceId: string,
    channelId: string,
    payload: TemplateCreatePayload
  ) {
    const client = getGatewayClient();
    return client.request<TemplateCreatePayload, void>(
      "templates.create",
      workspaceId,
      channelId,
      payload
    );
  },

  async deleteTemplate(
    workspaceId: string,
    channelId: string,
    templateName: string
  ) {
    const client = getGatewayClient();
    return client.request<TemplateDeletePayload, void>(
      "templates.delete",
      workspaceId,
      channelId,
      { templateName }
    );
  },

  async retrieveTemplate(
    workspaceId: string,
    channelId: string,
    templateName: string
  ) {
    const client = getGatewayClient();
    return client.request<TemplateRetrievePayload, GatewayTemplate>(
      "templates.retrieve",
      workspaceId,
      channelId,
      { templateName }
    );
  },

  // Channel Actions
  async connectChannel(workspaceId: string, payload: ChannelConnectPayload) {
    const client = getGatewayClient();
    return client.request<ChannelConnectPayload, unknown>(
      "channel.connect",
      workspaceId,
      "",
      payload
    );
  },

  async disconnectChannel(workspaceId: string, channelId: string) {
    const client = getGatewayClient();
    return client.request<{ channelId: string }, void>(
      "channel.disconnect",
      workspaceId,
      channelId,
      { channelId }
    );
  },

  async removeChannel(workspaceId: string, channelId: string) {
    const client = getGatewayClient();
    return client.request<{ channelId: string }, void>(
      "channel.remove",
      workspaceId,
      channelId,
      { channelId }
    );
  },

  async getChannelInfo(workspaceId: string, channelId: string) {
    const client = getGatewayClient();
    return client.request<Record<string, never>, ChannelInfoResponse>(
      "channel.info",
      workspaceId,
      channelId,
      {}
    );
  },

  async syncChannelStatuses(
    workspaceId: string,
    channels: Array<{ channelId: string; instanceName: string }>
  ) {
    const client = getGatewayClient();
    return client.request<
      ChannelsSyncStatusPayload,
      ChannelsSyncStatusResponse
    >("channels.syncStatus", workspaceId, "", { channels });
  },

  // Media Actions
  async downloadMedia(
    workspaceId: string,
    channelId: string,
    messageId: string
  ) {
    const client = getGatewayClient();
    return client.request<
      MediaDownloadPayload,
      { content: string; mime: string; filename?: string }
    >("media.download", workspaceId, channelId, { messageId });
  },

  async uploadMedia(
    workspaceId: string,
    channelId: string,
    payload: MediaUploadPayload
  ) {
    const client = getGatewayClient();
    return client.request<
      MediaUploadPayload,
      { mediaId: string; localMediaPath?: string }
    >("media.upload", workspaceId, channelId, payload);
  },

  // Message Actions
  async sendTyping(workspaceId: string, channelId: string, messageId: string) {
    const client = getGatewayClient();
    return client.fireAndForget<TypingSendPayload>(
      "typing.send",
      workspaceId,
      channelId,
      { messageId }
    );
  },

  async deleteMessage(
    workspaceId: string,
    channelId: string,
    messageId: string,
    remoteJid: string
  ) {
    const client = getGatewayClient();
    return client.request<MessageDeletePayload, void>(
      "message.delete",
      workspaceId,
      channelId,
      { messageId, remoteJid }
    );
  },

  async editMessage(
    workspaceId: string,
    channelId: string,
    messageId: string,
    remoteJid: string,
    newContent: string
  ) {
    const client = getGatewayClient();
    return client.request<MessageEditPayload, void>(
      "message.edit",
      workspaceId,
      channelId,
      { messageId, remoteJid, newContent }
    );
  },

  async sendReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    remoteJid: string,
    emoji: string,
    fromMe: boolean
  ) {
    const client = getGatewayClient();
    return client.request<MessageReactionPayload, void>(
      "message.reaction",
      workspaceId,
      channelId,
      { messageId, remoteJid, emoji, fromMe }
    );
  },

  // Meta Actions
  async getMetaEmbeddedLoginConfig(channelType: MetaChannelType) {
    const client = getGatewayClient();
    return client.request<
      { channelType: MetaChannelType },
      MetaEmbeddedLoginConfig
    >("meta.getEmbeddedLoginConfig", "", "", { channelType });
  },

  async saveMetaSettings(payload: MetaSaveSettingsPayload) {
    const client = getGatewayClient();
    return client.request<MetaSaveSettingsPayload, MetaAppSetting>(
      "meta.saveSettings",
      "",
      "",
      payload
    );
  },

  async getMetaSettings(channelType: MetaChannelType) {
    const client = getGatewayClient();
    return client.request<
      { channelType: MetaChannelType },
      MetaAppSettingFull | null
    >("meta.getSettings", "", "", { channelType });
  },

  async getAllMetaSettings() {
    const client = getGatewayClient();
    return client.request<Record<string, never>, MetaAppSetting[]>(
      "meta.getAllSettings",
      "",
      "",
      {}
    );
  },

  async setMetaActive(channelType: MetaChannelType, isActive: boolean) {
    const client = getGatewayClient();
    return client.request<
      { channelType: MetaChannelType; isActive: boolean },
      void
    >("meta.setActive", "", "", { channelType, isActive });
  },

  async exchangeMetaCode(channelType: MetaChannelType, code: string) {
    const client = getGatewayClient();
    return client.request<
      { channelType: MetaChannelType; code: string },
      MetaExchangeCodeResponse
    >("meta.exchangeCode", "", "", { channelType, code });
  },

  // Group Actions
  async getGroupInfo(
    workspaceId: string,
    channelId: string,
    groupJid: string
  ) {
    const client = getGatewayClient();
    return client.request<GroupInfoPayload, GroupInfoResponse>(
      "groups.info",
      workspaceId,
      channelId,
      { groupJid }
    );
  },

  async getGroupParticipants(
    workspaceId: string,
    channelId: string,
    groupJid: string
  ) {
    const client = getGatewayClient();
    return client.request<GroupInfoPayload, { participants: Array<{ id: string; admin: string | null }> }>(
      "groups.participants",
      workspaceId,
      channelId,
      { groupJid }
    );
  },

  async getGroupPicture(
    workspaceId: string,
    channelId: string,
    groupJid: string
  ) {
    const client = getGatewayClient();
    return client.request<GroupInfoPayload, { pictureUrl: string | null }>(
      "groups.picture",
      workspaceId,
      channelId,
      { groupJid }
    );
  },

  // Evolution Health Check
  async checkEvolutionHealth() {
    const client = getGatewayClient();
    return client.request<Record<string, never>, { healthy: boolean; error?: string }>(
      "evolution.healthCheck",
      "",
      "",
      {}
    );
  },

  async listEvolutionInstances() {
    const client = getGatewayClient();
    return client.request<Record<string, never>, EvolutionListInstancesResponse>(
      "evolution.listInstances",
      "",
      "",
      {}
    );
  },

  async removeEvolutionInstance(instanceName: string) {
    const client = getGatewayClient();
    return client.request<
      EvolutionRemoveInstancePayload,
      EvolutionRemoveInstanceResponse
    >("evolution.removeInstance", "", "", { instanceName });
  },
};
