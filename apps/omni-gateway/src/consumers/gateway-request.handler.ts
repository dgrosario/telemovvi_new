import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { GatewayRequestConsumerService } from "./gateway-request-consumer.service";
import {
  GatewayRequest,
  GatewayResponse,
  TemplateListPayload,
  TemplateCreatePayload,
  TemplateDeletePayload,
  TemplateRetrievePayload,
  TypingSendPayload,
  ChannelConnectPayload,
  ChannelDisconnectPayload,
  ChannelRemovePayload,
  MediaDownloadPayload,
  MediaUploadPayload,
  MetaGetEmbeddedLoginConfigPayload,
  MetaSaveSettingsPayload,
  MetaGetSettingsPayload,
  MetaSetActivePayload,
  MetaExchangeCodePayload,
  GroupInfoPayload,
  GroupParticipantsPayload,
  GroupPicturePayload,
  MessageDeletePayload,
  MessageEditPayload,
  MessageReactionPayload,
  ChannelsSyncStatusPayload,
  EvolutionRemoveInstancePayload,
} from "./interfaces/gateway-request.interface";
import {
  TemplatesHandler,
  ChannelsHandler,
  MediaHandler,
  MessagesHandler,
  MetaSettingsHandler,
  GroupsHandler,
  EvolutionHandler,
  InstagramGatewayHandler,
} from "./handlers";

@Injectable()
export class GatewayRequestHandler implements OnModuleInit {
  private readonly logger = new Logger(GatewayRequestHandler.name);

  constructor(
    private readonly consumerService: GatewayRequestConsumerService,
    private readonly templatesHandler: TemplatesHandler,
    private readonly channelsHandler: ChannelsHandler,
    private readonly mediaHandler: MediaHandler,
    private readonly messagesHandler: MessagesHandler,
    private readonly metaSettingsHandler: MetaSettingsHandler,
    private readonly groupsHandler: GroupsHandler,
    private readonly evolutionHandler: EvolutionHandler,
    private readonly instagramGatewayHandler: InstagramGatewayHandler
  ) {}

  onModuleInit(): void {
    this.consumerService.setRequestHandler(this.handleRequest.bind(this));
    this.logger.log("Gateway request handler initialized");
  }

  private async handleRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const { action, correlationId } = request;

    try {
      switch (action) {
        // Templates
        case "templates.list":
          return await this.templatesHandler.handleList(request as GatewayRequest<TemplateListPayload>);
        case "templates.listApproved":
          return await this.templatesHandler.handleListApproved(request as GatewayRequest<TemplateListPayload>);
        case "templates.create":
          return await this.templatesHandler.handleCreate(request as GatewayRequest<TemplateCreatePayload>);
        case "templates.delete":
          return await this.templatesHandler.handleDelete(request as GatewayRequest<TemplateDeletePayload>);
        case "templates.retrieve":
          return await this.templatesHandler.handleRetrieve(request as GatewayRequest<TemplateRetrievePayload>);

        // Channels
        case "channel.connect":
          return await this.channelsHandler.handleConnect(request as GatewayRequest<ChannelConnectPayload>);
        case "channel.disconnect":
          return await this.channelsHandler.handleDisconnect(request as GatewayRequest<ChannelDisconnectPayload>);
        case "channel.remove":
          return await this.channelsHandler.handleRemove(request as GatewayRequest<ChannelRemovePayload>);
        case "channel.info":
          return await this.channelsHandler.handleInfo(request);
        case "channels.syncStatus":
          return await this.channelsHandler.handleSyncStatus(request as GatewayRequest<ChannelsSyncStatusPayload>);

        // Media
        case "media.download":
          return await this.mediaHandler.handleDownload(request as GatewayRequest<MediaDownloadPayload>);
        case "media.upload":
          return await this.mediaHandler.handleUpload(request as GatewayRequest<MediaUploadPayload>);

        // Messages
        case "typing.send":
          return await this.messagesHandler.handleTypingSend(request as GatewayRequest<TypingSendPayload>);
        case "message.delete":
          return await this.messagesHandler.handleDelete(request as GatewayRequest<MessageDeletePayload>);
        case "message.edit":
          return await this.messagesHandler.handleEdit(request as GatewayRequest<MessageEditPayload>);
        case "message.reaction":
          return await this.messagesHandler.handleReaction(request as GatewayRequest<MessageReactionPayload>);

        // Meta Settings
        case "meta.getEmbeddedLoginConfig":
          return await this.metaSettingsHandler.handleGetEmbeddedLoginConfig(
            request as GatewayRequest<MetaGetEmbeddedLoginConfigPayload>
          );
        case "meta.saveSettings":
          return await this.metaSettingsHandler.handleSaveSettings(
            request as GatewayRequest<MetaSaveSettingsPayload>
          );
        case "meta.getSettings":
          return await this.metaSettingsHandler.handleGetSettings(request as GatewayRequest<MetaGetSettingsPayload>);
        case "meta.getAllSettings":
          return await this.metaSettingsHandler.handleGetAllSettings(request);
        case "meta.setActive":
          return await this.metaSettingsHandler.handleSetActive(request as GatewayRequest<MetaSetActivePayload>);
        case "meta.exchangeCode":
          return await this.metaSettingsHandler.handleExchangeCode(
            request as GatewayRequest<MetaExchangeCodePayload>
          );

        // Groups
        case "groups.info":
          return await this.groupsHandler.handleInfo(request as GatewayRequest<GroupInfoPayload>);
        case "groups.participants":
          return await this.groupsHandler.handleParticipants(request as GatewayRequest<GroupParticipantsPayload>);
        case "groups.picture":
          return await this.groupsHandler.handlePicture(request as GatewayRequest<GroupPicturePayload>);

        // Evolution
        case "evolution.healthCheck":
          return await this.evolutionHandler.handleHealthCheck(request);
        case "evolution.listInstances":
          return await this.channelsHandler.handleListEvolutionInstances(request);
        case "evolution.removeInstance":
          return await this.channelsHandler.handleRemoveEvolutionInstance(
            request as GatewayRequest<EvolutionRemoveInstancePayload>
          );

        default:
          return {
            correlationId,
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error handling ${action}: ${errorMessage}`);
      return {
        correlationId,
        success: false,
        error: errorMessage,
      };
    }
  }

  async refreshInstagramToken(channelId: string, accessToken: string): Promise<GatewayResponse> {
    const result = await this.instagramGatewayHandler.refreshToken(channelId, accessToken);

    return {
      correlationId: "",
      success: result.success,
      data: result.success
        ? {
            accessToken: result.accessToken,
            expiresIn: result.expiresAt ? Math.floor((result.expiresAt.getTime() - Date.now()) / 1000) : 0,
          }
        : undefined,
      error: result.error,
    };
  }
}
