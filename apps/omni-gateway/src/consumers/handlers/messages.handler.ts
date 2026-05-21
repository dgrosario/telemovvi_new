import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { EvolutionApiService } from "../../channel-apis/evolution-api.service";
import { WhatsAppApiService } from "../../channel-apis/whatsapp-api.service";
import {
  GatewayRequest,
  GatewayResponse,
  TypingSendPayload,
  MessageDeletePayload,
  MessageEditPayload,
  MessageReactionPayload,
} from "../interfaces/gateway-request.interface";
import { OutboundChannel } from "../interfaces/outbound-message.interface";
import { BaseHandler } from "./base.handler";

@Injectable()
export class MessagesHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly whatsAppApi: WhatsAppApiService
  ) {
    super(mainDatabaseService, MessagesHandler.name);
  }

  async handleTypingSend(request: GatewayRequest<TypingSendPayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    if (channel.type === "whatsapp" || channel.type === "meta_api") {
      const whatsappPayload = channel.payload as { phoneId?: string; accessToken?: string };
      if (!whatsappPayload.phoneId || !whatsappPayload.accessToken) {
        return this.errorResponse(correlationId, "Invalid WhatsApp channel payload");
      }

      await fetch(`https://graph.facebook.com/v23.0/${whatsappPayload.phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappPayload.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: payload.messageId,
          typing_indicator: { type: "text" },
        }),
      });
    }

    return this.successResponse(correlationId);
  }

  async handleDelete(request: GatewayRequest<MessageDeletePayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    try {
      if (channel.type === "evolution") {
        const instanceName = (channel.payload as { instanceName?: string }).instanceName;
        if (!instanceName) {
          this.logger.error(`DELETE MESSAGE - Instance name not found for channel ${channelId}`);
          return this.errorResponse(correlationId, "Instance name not found");
        }

        this.logger.log(
          `DELETE MESSAGE - Calling Evolution API - Instance: ${instanceName}, MessageId: ${payload.messageId}, RemoteJid: ${payload.remoteJid}`
        );
        const participant = payload.remoteJid.endsWith("@g.us")
          ? await this.resolveGroupParticipantJid(
              channel.payload as { phoneNumber?: string | null },
              instanceName
            )
          : undefined;

        await this.evolutionApi.deleteMessage(instanceName, {
          id: payload.messageId,
          remoteJid: payload.remoteJid,
          fromMe: true,
          participant,
        });
        this.logger.log(`DELETE MESSAGE - Success via Evolution API for message ${payload.messageId}`);
      } else {
        this.logger.warn(`DELETE MESSAGE - Channel type ${channel.type} does not support delete via API`);
      }

      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`DELETE MESSAGE - Failed for ${payload.messageId}: ${errorMessage}`);
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  async handleEdit(request: GatewayRequest<MessageEditPayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    this.logger.log(
      `EDIT MESSAGE - Starting - ChannelId: ${channelId}, MessageId: ${payload.messageId}, RemoteJid: ${payload.remoteJid}`
    );

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      this.logger.log(`EDIT MESSAGE - Channel not found: ${channelId}`);
      return this.errorResponse(correlationId, "Channel not found");
    }

    this.logger.log(`EDIT MESSAGE - Channel found - Type: ${channel.type}, Name: ${channel.name}`);

    if (channel.type !== "evolution") {
      this.logger.log(`EDIT MESSAGE - Not supported for channel type: ${channel.type}`);
      return this.errorResponse(correlationId, "Edit message not supported for this channel type");
    }

    if (!payload.remoteJid) {
      this.logger.error(`EDIT MESSAGE - RemoteJid is empty for message ${payload.messageId}`);
      return this.errorResponse(correlationId, "RemoteJid is required");
    }

    if (!payload.remoteJid.includes("@")) {
      this.logger.error(`EDIT MESSAGE - Invalid remoteJid format: ${payload.remoteJid}`);
      return this.errorResponse(correlationId, `Invalid remoteJid format: ${payload.remoteJid}`);
    }

    this.logger.log(`EDIT MESSAGE - RemoteJid validated: ${payload.remoteJid}`);

    try {
      const instanceName = (channel.payload as { instanceName?: string }).instanceName;
      if (!instanceName) {
        this.logger.log(`EDIT MESSAGE - Instance name not found in channel payload`);
        return this.errorResponse(correlationId, "Instance name not found");
      }

      this.logger.log(
        `EDIT MESSAGE - Calling Evolution API - Instance: ${instanceName}, MessageId: ${payload.messageId}`
      );

      await this.evolutionApi.editMessage(instanceName, {
        messageId: payload.messageId,
        remoteJid: payload.remoteJid,
        text: payload.newContent,
      });
      this.logger.log(`EDIT MESSAGE - Success via Evolution API for message ${payload.messageId}`);

      await this.updateMessageContent(payload.messageId, payload.newContent);
      this.logger.log(`EDIT MESSAGE - Database updated for message ${payload.messageId}`);

      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`EDIT MESSAGE - Failed for message ${payload.messageId}: ${errorMessage}`);
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  async handleReaction(request: GatewayRequest<MessageReactionPayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    this.logger.log(
      `SEND REACTION - Starting - ChannelId: ${channelId}, MessageId: ${payload.messageId}, Emoji: ${payload.emoji}`
    );

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      this.logger.log(`SEND REACTION - Channel not found: ${channelId}`);
      return this.errorResponse(correlationId, "Channel not found");
    }

    this.logger.log(`SEND REACTION - Channel found - Type: ${channel.type}, Name: ${channel.name}`);

    if (!payload.remoteJid) {
      this.logger.error(`SEND REACTION - RemoteJid is empty for message ${payload.messageId}`);
      return this.errorResponse(correlationId, "RemoteJid is required");
    }

    if (!payload.remoteJid.includes("@")) {
      this.logger.error(`SEND REACTION - Invalid remoteJid format: ${payload.remoteJid}`);
      return this.errorResponse(correlationId, `Invalid remoteJid format: ${payload.remoteJid}`);
    }

    try {
      if (channel.type === "whatsapp" || channel.type === "meta_api") {
        const to = payload.remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");

        this.logger.log(
          `SEND REACTION - Calling WhatsApp Cloud API - MessageId: ${payload.messageId}, To: ${to}`
        );

        await this.whatsAppApi.sendReaction(
          { id: channel.id, type: channel.type as "whatsapp" | "meta_api", payload: channel.payload as OutboundChannel["payload"] },
          to,
          payload.messageId,
          payload.emoji
        );

        this.logger.log(`SEND REACTION - Success via WhatsApp Cloud API for message ${payload.messageId}`);
      } else if (channel.type === "evolution") {
        const instanceName = (channel.payload as { instanceName?: string }).instanceName;
        if (!instanceName) {
          this.logger.log(`SEND REACTION - Instance name not found in channel payload`);
          return this.errorResponse(correlationId, "Instance name not found");
        }

        this.logger.log(
          `SEND REACTION - Calling Evolution API - Instance: ${instanceName}, MessageId: ${payload.messageId}`
        );

        await this.evolutionApi.sendReaction(instanceName, {
          messageId: payload.messageId,
          remoteJid: payload.remoteJid,
          emoji: payload.emoji,
          fromMe: payload.fromMe,
        });

        this.logger.log(`SEND REACTION - Success via Evolution API for message ${payload.messageId}`);
      } else {
        this.logger.log(`SEND REACTION - Not supported for channel type: ${channel.type}`);
        return this.errorResponse(correlationId, "Send reaction not supported for this channel type");
      }

      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`SEND REACTION - Failed for message ${payload.messageId}: ${errorMessage}`);
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async updateMessageContent(messageId: string, newContent: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return;

    const editedAt = Math.floor(Date.now() / 1000);
    await sql`UPDATE messages SET content = ${newContent}, edited_at = ${editedAt} WHERE id = ${messageId}`;
  }

  private async resolveGroupParticipantJid(
    payload: { phoneNumber?: string | null },
    instanceName: string
  ): Promise<string | undefined> {
    const payloadPhoneNumber = this.normalizePhoneNumber(payload.phoneNumber);
    if (payloadPhoneNumber) {
      return `${payloadPhoneNumber}@s.whatsapp.net`;
    }

    const instances = await this.evolutionApi.fetchInstances(instanceName);
    const instance = instances.find((item) => item.name === instanceName);
    if (!instance) {
      return undefined;
    }

    const instancePhoneNumber = this.normalizePhoneNumber(
      instance.number ?? instance.ownerJid ?? undefined
    );

    return instancePhoneNumber
      ? `${instancePhoneNumber}@s.whatsapp.net`
      : undefined;
  }

  private normalizePhoneNumber(value?: string | null): string {
    if (!value) return "";

    return value
      .replace("@s.whatsapp.net", "")
      .replace(/\D/g, "");
  }
}
