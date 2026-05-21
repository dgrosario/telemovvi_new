import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InternalMessageConsumerService } from "./internal-message-consumer.service";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import {
  InternalMessage,
  InternalMessageDelivered,
} from "./interfaces/internal-message.interface";
import { MessagesRepository } from "../database/messages.repository";

@Injectable()
export class InternalMessageHandler implements OnModuleInit {
  private readonly logger = new Logger(InternalMessageHandler.name);

  constructor(
    private readonly consumerService: InternalMessageConsumerService,
    private readonly publisherService: RabbitMQPublisherService,
    private readonly messagesRepository: MessagesRepository
  ) {}

  onModuleInit(): void {
    this.consumerService.setMessageHandler(this.handleMessage.bind(this));
  }

  private async handleMessage(message: InternalMessage): Promise<void> {
    this.logger.log(
      `Processing internal ${message.type} message from ${message.sender.name} to ${message.recipients.length} recipient(s)`
    );

    try {
      await this.publishToWorkspace(message);

      await this.messagesRepository.updateStatus(message.id, "sent");

      this.logger.log(
        `Internal message ${message.id} routed successfully to workspace ${message.workspaceId}`
      );
    } catch (error) {
      this.logger.error(`Failed to route internal message:`, error);
      throw error;
    }
  }

  private async publishToWorkspace(message: InternalMessage): Promise<void> {
    const deliveredPayload: InternalMessageDelivered = {
      messageId: message.id,
      conversationId: message.conversationId,
      workspaceId: message.workspaceId,
      sender: message.sender,
      recipients: message.recipients,
      deliveredAt: new Date().toISOString(),
      correlationId: message.correlationId,
    };

    const routingKey = `internal.${message.workspaceId}.messages`;

    this.logger.log(
      `Publishing internal message to exchange with routing key: ${routingKey}`
    );

    await this.publisherService.publish({
      event: "messages",
      instance: message.workspaceId,
      source: "internal",
      data: {
        message: {
          id: message.id,
          conversationId: message.conversationId,
          content: message.content,
          type: message.type,
          mediaUrl: message.mediaUrl,
          caption: message.caption,
          filename: message.filename,
          mimeType: message.mimeType,
          sender: message.sender,
          recipients: message.recipients,
          createdAt: message.createdAt,
          correlationId: message.correlationId,
          status: "sent",
        },
        delivered: deliveredPayload,
        workspaceId: message.workspaceId,
      },
    });
  }
}
