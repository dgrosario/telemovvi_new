import type { Server as SocketIOServer } from "socket.io";
import type {
  RabbitMQConsumerDriver,
  RabbitMQMessage,
} from "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver";
import type { MessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/messages-repository";
import type { ConversationsDatabaseRepository } from "@omnichannel/core/infra/repositories/conversations-repository";
import type { ProcessedMessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/processed-messages-repository";
import type { CampaignRecipientsDatabaseRepository } from "@omnichannel/core/infra/repositories/campaign-recipients-repository";
import type { Message } from "@omnichannel/core/domain/entities/message";
import type { Attendant } from "@omnichannel/core/domain/entities/attendant";

const SENT_PATTERNS = [
  "whatsapp.*.messages.sent",
  "instagram.*.messages.sent",
  "evolution.*.messages.sent",
];

interface MessageSentConfirmation {
  conversationId: string;
  channelId: string;
  workspaceId: string;
  messageId: string;
  externalId: string;
  type: Message.Type;
  content?: string;
  sender: { id: string; name: string };
  sentAt: string;
  correlationId?: string;
  localMediaPath?: string;
  quotedMessageId?: string;
  templateName?: string;
  isCampaignMessage?: boolean;
  campaignId?: string;
  campaignRecipientId?: string;
  recipientName?: string;
}

type RabbitMQConsumerDriverConstructor = {
  instance(url: string, exchangeName?: string): RabbitMQConsumerDriver;
};

type MessagesDatabaseRepositoryConstructor = {
  instance(): MessagesDatabaseRepository;
};

type ConversationsDatabaseRepositoryConstructor = {
  instance(): ConversationsDatabaseRepository;
};

type ProcessedMessagesDatabaseRepositoryConstructor = {
  instance(): ProcessedMessagesDatabaseRepository;
};

type CampaignRecipientsDatabaseRepositoryConstructor = {
  instance(): CampaignRecipientsDatabaseRepository;
};

type AttendantConstructor = {
  create(props: Attendant.Props): Attendant;
};

type MessageConstructor = {
  create(props: Message.CreateProps): Message;
};

export class MetaSentConsumer {
  private consumer: RabbitMQConsumerDriver | null = null;
  private io: SocketIOServer;
  private RabbitMQConsumerDriver: RabbitMQConsumerDriverConstructor | null = null;
  private MessagesDatabaseRepository: MessagesDatabaseRepositoryConstructor | null = null;
  private ConversationsDatabaseRepository: ConversationsDatabaseRepositoryConstructor | null = null;
  private ProcessedMessagesDatabaseRepository: ProcessedMessagesDatabaseRepositoryConstructor | null = null;
  private CampaignRecipientsDatabaseRepository: CampaignRecipientsDatabaseRepositoryConstructor | null = null;
  private Attendant: AttendantConstructor | null = null;
  private Message: MessageConstructor | null = null;
  private isConsuming: boolean = false;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  private emitToWorkspace(
    workspaceId: string,
    event: string,
    data: Record<string, unknown>
  ): void {
    this.io.to(`workspace:${workspaceId}`).emit(event, data);
    console.log(
      `[MetaSentConsumer] Emitido ${event} para workspace:${workspaceId}`
    );
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const [
        { RabbitMQConsumerDriver },
        { MessagesDatabaseRepository },
        { ConversationsDatabaseRepository },
        { ProcessedMessagesDatabaseRepository },
        { CampaignRecipientsDatabaseRepository },
        { Attendant },
        { Message },
      ] = await Promise.all([
        import("@omnichannel/core/infra/drivers/rabbitmq-consumer-driver"),
        import("@omnichannel/core/infra/repositories/messages-repository"),
        import("@omnichannel/core/infra/repositories/conversations-repository"),
        import("@omnichannel/core/infra/repositories/processed-messages-repository"),
        import("@omnichannel/core/infra/repositories/campaign-recipients-repository"),
        import("@omnichannel/core/domain/entities/attendant"),
        import("@omnichannel/core/domain/entities/message"),
      ]);

      this.RabbitMQConsumerDriver = RabbitMQConsumerDriver;
      this.MessagesDatabaseRepository = MessagesDatabaseRepository;
      this.ConversationsDatabaseRepository = ConversationsDatabaseRepository;
      this.ProcessedMessagesDatabaseRepository = ProcessedMessagesDatabaseRepository;
      this.CampaignRecipientsDatabaseRepository = CampaignRecipientsDatabaseRepository;
      this.Attendant = Attendant;
      this.Message = Message;

      return true;
    } catch (error) {
      console.error("[MetaSentConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  async start(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    const exchangeName = process.env.EXCHANGE_NAME || "meta_exchange";

    if (!rabbitmqUrl) {
      console.log(
        "[MetaSentConsumer] RABBITMQ_URL not set, skipping RabbitMQ consumer"
      );
      return;
    }

    const loaded = await this.loadDependencies();
    if (!loaded || !this.RabbitMQConsumerDriver) {
      console.error("[MetaSentConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[MetaSentConsumer] Starting Meta Sent consumer...");
    console.log(`[MetaSentConsumer] Using exchange: ${exchangeName}`);

    this.consumer = this.RabbitMQConsumerDriver.instance(rabbitmqUrl, exchangeName);

    try {
      this.consumer.setOnMaxReconnectAttemptsReached(
        (info: {
          event: string;
          timestamp: Date;
          attempts: number;
          lastError?: string;
        }) => {
          console.error(
            "[MetaSentConsumer] CRITICAL: RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", info);
        }
      );

      this.consumer.setOnReconnected(async () => {
        console.log(
          "[MetaSentConsumer] RabbitMQ reconnected, re-subscribing to queues..."
        );
        this.isConsuming = false;
        await this.consumeQueues();
        console.log("[MetaSentConsumer] Re-subscription complete");
      });

      await this.consumer.connect();

      await this.consumeQueues();

      console.log(
        "[MetaSentConsumer] Successfully connected and consuming sent confirmation queues"
      );
    } catch (error) {
      console.error("[MetaSentConsumer] Failed to start:", error);
    }
  }

  private async consumeQueues(): Promise<void> {
    if (this.isConsuming || !this.consumer) {
      return;
    }

    console.log("[MetaSentConsumer] Setting up consumers for sent confirmation queues...");

    for (const pattern of SENT_PATTERNS) {
      try {
        await this.consumer.consumeWithPattern<MessageSentConfirmation>(
          pattern,
          async (event: RabbitMQMessage<MessageSentConfirmation>) => {
            await this.handleMessageSent(event);
          }
        );
        console.log(`[MetaSentConsumer] Consuming pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[MetaSentConsumer] Failed to consume pattern ${pattern}:`,
          error
        );
      }
    }

    this.isConsuming = true;
    console.log("[MetaSentConsumer] Sent confirmation queues setup complete");
  }

  private async handleMessageSent(
    event: RabbitMQMessage<MessageSentConfirmation>
  ): Promise<void> {
    const { data, source } = event;

    if (data.isCampaignMessage) {
      console.log(
        `[MetaSentConsumer] Received campaign sent confirmation for campaign ${data.campaignId}`,
        JSON.stringify({ messageId: data.messageId, recipientId: data.campaignRecipientId, externalId: data.externalId })
      );
      await this.handleCampaignMessageSent(data);
      return;
    }

    console.log(
      `[MetaSentConsumer] Received sent confirmation for conversation ${data.conversationId}`,
      JSON.stringify({ messageId: data.messageId, type: data.type, sender: data.sender, correlationId: data.correlationId, source })
    );

    if (
      !this.MessagesDatabaseRepository ||
      !this.ConversationsDatabaseRepository ||
      !this.ProcessedMessagesDatabaseRepository ||
      !this.Attendant ||
      !this.Message
    ) {
      console.error("[MetaSentConsumer] Dependencies not loaded");
      return;
    }

    try {
      const messagesRepository = this.MessagesDatabaseRepository.instance();
      const conversationsRepository = this.ConversationsDatabaseRepository.instance();
      const processedMessagesRepository = this.ProcessedMessagesDatabaseRepository.instance();

      const instanceName = `sent-${data.channelId}`;
      const alreadyProcessed = await processedMessagesRepository.exists(data.messageId, instanceName);
      if (alreadyProcessed) {
        console.log(`[MetaSentConsumer] Skipping already processed message: ${data.messageId} for channel: ${data.channelId}`);
        return;
      }

      const conversation = await conversationsRepository.retrieve(
        data.conversationId
      );

      if (!conversation) {
        console.error(
          `[MetaSentConsumer] Conversation not found: ${data.conversationId}`
        );
        return;
      }

      const sender = this.Attendant.create({
        id: data.sender.id,
        name: data.sender.name,
      });

      const effectiveType = data.templateName ? "template" : data.type;
      const message = this.Message.create({
        id: data.messageId,
        type: effectiveType,
        content: data.content ?? "",
        sender,
        createdAt: new Date(data.sentAt),
        quotedMessageId: data.quotedMessageId,
        templateName: data.templateName,
      });

      // Instagram API confirms delivery when message is sent successfully
      // WhatsApp sends separate delivery webhooks, so we mark as sent first
      if (source === "instagram") {
        message.markAsDelivered();
        console.log(`[MetaSentConsumer] Instagram message marked as delivered`);
      } else {
        message.markAsSent();
      }

      console.log(`[MetaSentConsumer] Upserting message ${data.messageId} to conversation ${data.conversationId}`);
      await messagesRepository.upsert(message, data.conversationId);

      await processedMessagesRepository.markProcessed(
        data.messageId,
        instanceName,
        "messages.sent"
      );
      console.log(`[MetaSentConsumer] Message upserted and marked as processed`);

      if (data.localMediaPath) {
        console.log(`[MetaSentConsumer] Updating media_path for message ${data.messageId}: ${data.localMediaPath}`);
        await messagesRepository.updateMediaPath(data.messageId, data.localMediaPath);
        console.log(`[MetaSentConsumer] Media path updated successfully`);
      }

      const refreshedConversation = await conversationsRepository.retrieve(
        data.conversationId
      );

      this.emitToWorkspace(data.workspaceId, "message:sent:confirmed", {
        conversationId: data.conversationId,
        conversation: refreshedConversation?.raw(),
        message: message.raw(),
        whatsappMessageId: data.externalId,
        workspaceId: data.workspaceId,
        correlationId: data.correlationId,
      });

      console.log(
        `[MetaSentConsumer] Message persisted and emitted: ${data.messageId} (conversation: ${data.conversationId}, correlationId: ${data.correlationId ?? "none"}, externalId: ${data.externalId})`
      );
    } catch (error) {
      console.error("[MetaSentConsumer] Failed to process sent confirmation:", error);
      throw error;
    }
  }

  private async handleCampaignMessageSent(
    data: MessageSentConfirmation
  ): Promise<void> {
    if (!this.CampaignRecipientsDatabaseRepository) {
      console.error("[MetaSentConsumer] CampaignRecipientsDatabaseRepository not loaded");
      return;
    }

    if (!data.campaignRecipientId) {
      console.error("[MetaSentConsumer] Campaign message missing recipientId");
      return;
    }

    try {
      const recipientsRepository = this.CampaignRecipientsDatabaseRepository.instance();

      await recipientsRepository.updateExternalMessageId(
        data.campaignRecipientId,
        data.externalId
      );

      console.log(
        `[MetaSentConsumer] Updated campaign recipient ${data.campaignRecipientId} with externalMessageId ${data.externalId}`
      );

      this.emitToWorkspace(data.workspaceId, "campaign:message:confirmed", {
        campaignId: data.campaignId,
        recipientId: data.campaignRecipientId,
        externalMessageId: data.externalId,
        recipientName: data.recipientName,
        workspaceId: data.workspaceId,
      });
    } catch (error) {
      console.error("[MetaSentConsumer] Failed to process campaign sent confirmation:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.close();
      console.log("[MetaSentConsumer] Stopped");
    }
    this.isConsuming = false;
  }

  static create(io: SocketIOServer): MetaSentConsumer {
    return new MetaSentConsumer(io);
  }
}

export async function startMetaSentConsumer(
  io: SocketIOServer
): Promise<MetaSentConsumer> {
  const consumer = MetaSentConsumer.create(io);
  await consumer.start();
  return consumer;
}
