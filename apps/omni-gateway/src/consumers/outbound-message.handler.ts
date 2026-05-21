import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RabbitMQConsumerService } from "./rabbitmq-consumer.service";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import { WhatsAppApiService } from "../channel-apis/whatsapp-api.service";
import { InstagramApiService } from "../channel-apis/instagram-api.service";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";
import { ChannelApiService } from "../channel-apis/channel-api.interface";
import {
  OutboundMessage,
  OutboundChannel,
  MessageSentConfirmation,
} from "./interfaces/outbound-message.interface";

@Injectable()
export class OutboundMessageHandler implements OnModuleInit {
  private readonly logger = new Logger(OutboundMessageHandler.name);

  constructor(
    private readonly consumerService: RabbitMQConsumerService,
    private readonly publisherService: RabbitMQPublisherService,
    private readonly whatsAppApiService: WhatsAppApiService,
    private readonly instagramApiService: InstagramApiService,
    private readonly evolutionApiService: EvolutionApiService
  ) {}

  private resolveChannelApi(channel: OutboundChannel): ChannelApiService {
    switch (channel.type) {
      case "whatsapp":
      case "meta_api":
        return this.whatsAppApiService;
      case "instagram":
        return this.instagramApiService;
      case "evolution":
        return this.evolutionApiService;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  onModuleInit(): void {
    this.consumerService.setMessageHandler(this.handleMessage.bind(this));
  }

  private async handleMessage(message: OutboundMessage): Promise<void> {
    this.logger.log(
      `Processing ${message.type} message for channel ${message.channel.type}`
    );

    try {
      const channelApi = this.resolveChannelApi(message.channel);

      await this.validateRecipientNumber(message, channelApi);

      let externalId: string;

      let contentOverride: string | undefined;

      switch (message.type) {
        case "text":
          externalId = await this.handleTextMessage(message, channelApi);
          break;
        case "template":
          externalId = await this.handleTemplateMessage(message, channelApi);
          break;
        case "audio":
        case "image":
        case "document":
        case "video":
          externalId = await this.handleMediaMessage(message, channelApi);
          break;
        case "interactive":
          externalId = await this.handleInteractiveMessage(message, channelApi);
          contentOverride = this.interactiveToText(message.interactive);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      await this.publishConfirmation(message, externalId, contentOverride);

      this.logger.log(
        `Message sent successfully. External ID: ${externalId}`
      );
    } catch (error) {
      this.logger.error(`Failed to send message:`, error);
      throw error;
    }
  }

  private async validateRecipientNumber(
    message: OutboundMessage,
    channelApi: ChannelApiService
  ): Promise<void> {
    if (!channelApi.validateNumbers) {
      return;
    }

    if (message.to.endsWith("@g.us")) {
      this.logger.debug("Skipping validation for group message");
      return;
    }

    this.logger.debug(`Validating recipient number: ${message.to}`);

    const results = await channelApi.validateNumbers(message.channel, [
      message.to,
    ]);

    if (results.length === 0) {
      this.logger.warn(`No validation results returned for: ${message.to}`);
      return;
    }

    const result = results[0];

    if (!result.exists) {
      this.logger.error(
        `Recipient number does not have WhatsApp: ${message.to}`
      );
      throw new Error(
        `O numero ${message.to} nao possui WhatsApp ativo. Verifique se o numero esta correto.`
      );
    }

    this.logger.debug(`Recipient number validated: ${message.to} -> ${result.jid}`);
  }

  private shouldUseHumanAgentTag(message: OutboundMessage): boolean {
    if (message.channel.type !== "instagram") {
      return false;
    }

    if (message.isAutomated) {
      return false;
    }

    if (!message.lastClientMessageCreatedAt) {
      return false;
    }

    const lastClientMessageTime = new Date(message.lastClientMessageCreatedAt).getTime();
    const now = Date.now();
    const timeSinceLastMessage = now - lastClientMessageTime;

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const isAfter24Hours = timeSinceLastMessage > TWENTY_FOUR_HOURS_MS;
    const isBefore7Days = timeSinceLastMessage < SEVEN_DAYS_MS;

    return isAfter24Hours && isBefore7Days;
  }

  private async handleTextMessage(
    message: OutboundMessage,
    channelApi: ChannelApiService
  ): Promise<string> {
    if (!message.content) {
      throw new Error("Text message requires content");
    }

    const quoted = this.buildQuotedMessage(message);
    const useHumanAgentTag = this.shouldUseHumanAgentTag(message);

    if (message.channel.type === "instagram" && channelApi === this.instagramApiService) {
      const tag = useHumanAgentTag ? ("HUMAN_AGENT" as const) : undefined;

      if (tag) {
        this.logger.log(
          `Using HUMAN_AGENT tag for Instagram message (last client message: ${message.lastClientMessageCreatedAt})`
        );
      }

      return this.instagramApiService.sendTextMessage(
        message.channel,
        message.to,
        message.content,
        tag
      );
    }

    return channelApi.sendTextMessage(
      message.channel,
      message.to,
      message.content,
      quoted
    );
  }

  private buildQuotedMessage(
    message: OutboundMessage
  ): { key: { id: string; remoteJid: string; fromMe: boolean } } | undefined {
    if (!message.quotedMessageId) {
      return undefined;
    }

    const remoteJid = message.isGroup
      ? message.to
      : message.to.includes("@")
        ? message.to
        : `${message.to}@s.whatsapp.net`;

    return {
      key: {
        id: message.quotedMessageId,
        remoteJid,
        fromMe: false,
      },
    };
  }

  private async handleTemplateMessage(
    message: OutboundMessage,
    channelApi: ChannelApiService
  ): Promise<string> {
    if (!message.templateName) {
      throw new Error("Template message requires templateName");
    }

    if (!channelApi.sendTemplateMessage) {
      throw new Error(
        `Template messages not supported for channel ${message.channel.type}`
      );
    }

    return channelApi.sendTemplateMessage(
      message.channel,
      message.to,
      message.templateName,
      message.variables ?? [],
      message.templateLanguage ?? message.language
    );
  }

  private async handleMediaMessage(
    message: OutboundMessage,
    channelApi: ChannelApiService
  ): Promise<string> {
    if (!message.mediaId) {
      throw new Error("Media message requires mediaId");
    }

    const quoted = this.buildQuotedMessage(message);
    const useHumanAgentTag = this.shouldUseHumanAgentTag(message);

    if (message.channel.type === "instagram" && channelApi === this.instagramApiService) {
      const tag = useHumanAgentTag ? ("HUMAN_AGENT" as const) : undefined;

      if (tag) {
        this.logger.log(
          `Using HUMAN_AGENT tag for Instagram media message (last client message: ${message.lastClientMessageCreatedAt})`
        );
      }

      return this.instagramApiService.sendMediaMessage(
        message.channel,
        message.to,
        message.mediaId,
        message.type as "audio" | "image" | "document" | "video",
        message.caption,
        message.filename,
        message.mimeType,
        tag
      );
    }

    if (message.type === "audio" && channelApi.sendAudioMessage) {
      return channelApi.sendAudioMessage(
        message.channel,
        message.to,
        message.mediaId,
        quoted
      );
    }

    return channelApi.sendMediaMessage(
      message.channel,
      message.to,
      message.mediaId,
      message.type as "audio" | "image" | "document" | "video",
      message.caption,
      message.filename,
      message.mimeType,
      quoted
    );
  }

  private async handleInteractiveMessage(
    message: OutboundMessage,
    channelApi: ChannelApiService
  ): Promise<string> {
    if (!message.interactive) {
      throw new Error("Interactive message requires interactive payload");
    }

    if (!channelApi.sendInteractiveMessage) {
      this.logger.warn(
        `Channel ${message.channel.type} does not support interactive messages, falling back to text`
      );
      return this.handleTextMessage(
        {
          ...message,
          type: "text",
          content: this.interactiveToText(message.interactive),
        },
        channelApi
      );
    }

    return channelApi.sendInteractiveMessage(
      message.channel,
      message.to,
      message.interactive
    );
  }

  private interactiveToText(interactive: OutboundMessage["interactive"]): string {
    if (!interactive) {
      return "";
    }

    const lines: string[] = [];

    if (interactive.header?.text) {
      lines.push(`*${interactive.header.text}*`);
      lines.push("");
    }

    lines.push(interactive.body.text);

    if (interactive.type === "button" && interactive.action.buttons) {
      lines.push("");
      interactive.action.buttons.forEach((btn, index) => {
        const title = btn.reply?.title || btn.buttonText?.displayText || "";
        lines.push(`${index + 1}) ${title}`);
      });
    }

    if (interactive.type === "list" && interactive.action.sections) {
      lines.push("");
      let optionIndex = 1;
      for (const section of interactive.action.sections) {
        if (section.title) {
          lines.push(`*${section.title}*`);
        }
        for (const row of section.rows) {
          const title = row.title;
          lines.push(`${optionIndex}) ${title}`);
          optionIndex++;
        }
      }
    }

    if (interactive.footer?.text) {
      lines.push("");
      lines.push(`_${interactive.footer.text}_`);
    }

    return lines.join("\n");
  }

  private async publishConfirmation(
    message: OutboundMessage,
    externalId: string,
    contentOverride?: string
  ): Promise<void> {
    const confirmation: MessageSentConfirmation = {
      conversationId: message.conversationId,
      channelId: message.channelId,
      workspaceId: message.workspaceId,
      messageId: externalId,
      externalId,
      type: message.type,
      content: contentOverride ?? message.content,
      sender: message.sender,
      sentAt: new Date().toISOString(),
      correlationId: message.correlationId,
      localMediaPath: message.localMediaPath,
      quotedMessageId: message.quotedMessageId,
      templateName: message.templateName,
      isCampaignMessage: message.isCampaignMessage,
      campaignId: message.campaignId,
      campaignRecipientId: message.campaignRecipientId,
      recipientName: message.recipientName,
    };

    const instance =
      message.channel.payload.phoneNumberId ??
      message.channel.payload.phoneId ??
      message.channel.payload.pageId ??
      message.channel.payload.instanceName ??
      message.channelId;

    this.logger.log(
      `Publishing confirmation for ${message.isCampaignMessage ? "campaign" : "conversation"} ${message.isCampaignMessage ? message.campaignId : message.conversationId} with routing key ${message.channel.type}.${instance}.messages.sent`
    );

    await this.publisherService.publish({
      event: "messages.sent",
      instance,
      source: message.channel.type,
      data: confirmation,
    });
  }
}
