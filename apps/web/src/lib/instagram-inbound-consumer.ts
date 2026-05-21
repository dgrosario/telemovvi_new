import type { Server as SocketIOServer } from "socket.io";
import type {
  RabbitMQConsumerDriver,
  RabbitMQMessage,
} from "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver";
import type { ProcessInboundMessage, ProcessInboundMessageOutput } from "@omnichannel/core/application/command/process-inbound-message";
import type { OnMessageReceivedProps } from "@omnichannel/core/infra/controllers/evolution-event-handler";
import { processInboundMessageReaction } from "./message-reaction-processor";

const INSTAGRAM_INBOUND_PATTERNS = [
  "instagram.*.messages.upsert",
];

const INSTAGRAM_STATUS_UPDATE_PATTERNS = [
  "instagram.*.messages.update",
];

const INSTAGRAM_REACTION_PATTERNS = [
  "instagram.*.messages.reaction",
];

interface InstagramInboundMessage {
  messageId: string;
  senderId: string;
  content: string;
  type: "text" | "audio" | "image" | "document" | "sticker" | "video";
  timestamp: number;
  contactName?: string;
  username?: string;
  pageId: string;
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
}

interface InstagramStatusUpdate {
  messageId: string;
  status: "sent" | "delivered" | "read";
  timestamp: number;
}

interface InstagramReactionEvent {
  targetMessageId: string;
  reactorInstagramScopedId: string;
  recipientInstagramAccountId: string;
  action: "react" | "unreact";
  reaction: string | null;
  emoji: string | null;
  timestamp: number;
}

type RabbitMQConsumerDriverConstructor = {
  instance(url: string, exchangeName?: string): RabbitMQConsumerDriver;
};

type ProcessInboundMessageConstructor = {
  instance(): ProcessInboundMessage;
};

export class InstagramInboundConsumer {
  private consumer: RabbitMQConsumerDriver | null = null;
  private io: SocketIOServer;
  private RabbitMQConsumerDriver: RabbitMQConsumerDriverConstructor | null = null;
  private ProcessInboundMessage: ProcessInboundMessageConstructor | null = null;
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
      `[InstagramInboundConsumer] Emitted ${event} to workspace:${workspaceId}`
    );
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const [
        { RabbitMQConsumerDriver },
        { ProcessInboundMessage },
      ] = await Promise.all([
        import("@omnichannel/core/infra/drivers/rabbitmq-consumer-driver"),
        import("@omnichannel/core/application/command/process-inbound-message"),
      ]);

      this.RabbitMQConsumerDriver = RabbitMQConsumerDriver;
      this.ProcessInboundMessage = ProcessInboundMessage;

      return true;
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  async start(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      console.log(
        "[InstagramInboundConsumer] RABBITMQ_URL not set, skipping Instagram consumer"
      );
      return;
    }

    const loaded = await this.loadDependencies();
    if (!loaded || !this.RabbitMQConsumerDriver) {
      console.error("[InstagramInboundConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[InstagramInboundConsumer] Starting Instagram Inbound consumer...");

    // Instagram uses meta_exchange, not evolution_exchange
    const exchangeName = process.env.EXCHANGE_NAME || "meta_exchange";
    console.log(`[InstagramInboundConsumer] Using exchange: ${exchangeName}`);

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
            "[InstagramInboundConsumer] CRITICAL: RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", {
            error: "Instagram consumer connection lost",
            ...info,
          });
        }
      );

      this.consumer.setOnReconnected(async () => {
        console.log(
          "[InstagramInboundConsumer] RabbitMQ reconnected, re-subscribing to queues..."
        );
        this.isConsuming = false;
        await this.consumeQueues();
        console.log("[InstagramInboundConsumer] Re-subscription complete");
      });

      await this.consumer.connect();

      await this.consumeQueues();

      console.log(
        "[InstagramInboundConsumer] Successfully connected and consuming Instagram queues"
      );
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to start:", error);
    }
  }

  private async consumeQueues(): Promise<void> {
    if (this.isConsuming || !this.consumer) {
      return;
    }

    console.log("[InstagramInboundConsumer] Setting up consumers for Instagram queues...");

    // Consume inbound messages
    for (const pattern of INSTAGRAM_INBOUND_PATTERNS) {
      try {
        console.log(`[InstagramInboundConsumer] Registering pattern: ${pattern}`);
        
        await this.consumer.consumeWithPattern<InstagramInboundMessage>(
          pattern,
          async (event: RabbitMQMessage<InstagramInboundMessage>) => {
            await this.handleInstagramInboundMessage(event);
          }
        );

        console.log(`[InstagramInboundConsumer] Consuming pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[InstagramInboundConsumer] Failed to consume pattern ${pattern}:`,
          error
        );
      }
    }

    // Consume status updates
    for (const pattern of INSTAGRAM_STATUS_UPDATE_PATTERNS) {
      try {
        console.log(`[InstagramInboundConsumer] Registering status pattern: ${pattern}`);
        
        await this.consumer.consumeWithPattern<InstagramStatusUpdate>(
          pattern,
          async (event: RabbitMQMessage<InstagramStatusUpdate>) => {
            await this.handleInstagramStatusUpdate(event);
          }
        );

        console.log(`[InstagramInboundConsumer] Consuming status pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[InstagramInboundConsumer] Failed to consume status pattern ${pattern}:`,
          error
        );
      }
    }

    for (const pattern of INSTAGRAM_REACTION_PATTERNS) {
      try {
        console.log(`[InstagramInboundConsumer] Registering reaction pattern: ${pattern}`);

        await this.consumer.consumeWithPattern<InstagramReactionEvent>(
          pattern,
          async (event: RabbitMQMessage<InstagramReactionEvent>) => {
            await this.handleInstagramReaction(event);
          }
        );

        console.log(`[InstagramInboundConsumer] Consuming reaction pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[InstagramInboundConsumer] Failed to consume reaction pattern ${pattern}:`,
          error
        );
      }
    }

    this.isConsuming = true;
    console.log("[InstagramInboundConsumer] Instagram queues setup complete");
  }

  private async handleInstagramInboundMessage(
    event: RabbitMQMessage<InstagramInboundMessage>
  ): Promise<void> {
    console.log("[InstagramInboundConsumer] ========== INSTAGRAM MESSAGE RECEIVED ==========");
    console.log("[InstagramInboundConsumer] Full event:", JSON.stringify(event, null, 2));
    
    const { instance, data } = event;

    console.log("[InstagramInboundConsumer] Instance:", instance);
    console.log("[InstagramInboundConsumer] Data:", JSON.stringify(data, null, 2));
    console.log("[InstagramInboundConsumer] =============================================");

    // Instagram timestamps come in milliseconds, convert to seconds
    const timestampInSeconds = Math.floor(data.timestamp / 1000);

    await this.processInboundMessage({
      instanceName: data.pageId || instance,
      messageId: data.messageId,
      remoteJid: data.senderId,
      fromMe: false,
      content: data.content,
      type: data.type,
      timestamp: timestampInSeconds,
      contactName: data.contactName || data.senderId,
      username: data.username || "",
      mediaUrl: data.mediaUrl,
      mimetype: data.mimetype,
      caption: data.caption,
      expectedChannelType: "instagram",
      isGroup: false,
      groupJid: undefined,
      participantJid: undefined,
      participantName: undefined,
    });
  }

  private async handleInstagramStatusUpdate(
    event: RabbitMQMessage<InstagramStatusUpdate>
  ): Promise<void> {
    console.log("[InstagramInboundConsumer] Instagram status update received:", JSON.stringify(event, null, 2));
    
    const { data } = event;
    const { messageId, status } = data;

    try {
      const { MessagesDatabaseRepository } = await import(
        "@omnichannel/core/infra/repositories/messages-repository"
      );
      const { createDatabaseConnection, eq } = await import(
        "@omnichannel/core/infra/database"
      );
      const { conversations } = await import(
        "@omnichannel/core/infra/database/schemas"
      );

      const messagesRepository = MessagesDatabaseRepository.instance();

      // Instagram message IDs are the same as our internal IDs
      const messageData = await messagesRepository.retrieveConversationId(messageId);

      if (!messageData?.conversationId) {
        console.log(`[InstagramInboundConsumer] Message not found for status update: ${messageId}`);
        return;
      }

      // Update message status
      const newStatus = status === "delivered" ? "delivered" : status === "read" ? "read" : null;
      
      if (!newStatus) {
        console.log(`[InstagramInboundConsumer] Unknown status: ${status}`);
        return;
      }

      // Get workspaceId from conversation
      const db = createDatabaseConnection();
      const [conversation] = await db
        .select({ workspaceId: conversations.workspaceId })
        .from(conversations)
        .where(eq(conversations.id, messageData.conversationId));

      if (!conversation?.workspaceId) {
        console.log(`[InstagramInboundConsumer] Workspace not found for conversation: ${messageData.conversationId}`);
        return;
      }

      // Emit status update to frontend
      this.emitToWorkspace(conversation.workspaceId, "message:status:update", {
        messageId: messageId,
        status: newStatus,
        conversationId: messageData.conversationId,
        workspaceId: conversation.workspaceId,
      });

      console.log(
        `[InstagramInboundConsumer] Status update emitted for message ${messageId}: ${newStatus}`
      );
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to process status update:", error);
    }
  }

  private async handleInstagramReaction(
    event: RabbitMQMessage<InstagramReactionEvent>
  ): Promise<void> {
    console.log(
      "[InstagramInboundConsumer] Instagram reaction received:",
      JSON.stringify(event, null, 2)
    );

    const { data } = event;

    if (!data.targetMessageId) {
      console.log(
        "[InstagramInboundConsumer] Missing targetMessageId for Instagram reaction"
      );
      return;
    }

    try {
      await processInboundMessageReaction({
        io: this.io,
        targetMessageId: data.targetMessageId,
        emoji: data.emoji || "",
        reactorId: data.reactorInstagramScopedId,
        reactorName: data.reactorInstagramScopedId,
        reactorType: "contact",
        isRemoval: data.action === "unreact",
      });
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to process reaction:", error);
      throw error;
    }
  }

  private async processInboundMessage(props: OnMessageReceivedProps): Promise<void> {
    if (!this.ProcessInboundMessage) {
      console.error("[InstagramInboundConsumer] ProcessInboundMessage not loaded");
      return;
    }

    try {
      const processInboundMessage = this.ProcessInboundMessage.instance();

      console.log(
        `[InstagramInboundConsumer] Processing inbound message: ${props.messageId}`
      );

      const result: ProcessInboundMessageOutput | null = await processInboundMessage.execute(props);

      if (!result) {
        console.log(
          `[InstagramInboundConsumer] Message already processed or channel not found: ${props.messageId}`
        );
        return;
      }

      const { conversation, message, workspaceId, isNewConversation } = result;

      this.emitToWorkspace(workspaceId, "message:received", {
        conversationId: conversation.id,
        message: message.raw(),
        conversation: conversation.raw(),
        isNewConversation,
        workspaceId,
      });

      if (isNewConversation) {
        this.emitToWorkspace(workspaceId, "conversation:created", {
          conversation: conversation.raw(),
          workspaceId,
        });
      }

      await this.sendChannelNotifications(conversation, message, workspaceId);

      console.log(
        `[InstagramInboundConsumer] Message processed and emitted: ${props.messageId}`
      );
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to process inbound message:", error);
      throw error;
    }
  }

  private async sendChannelNotifications(
    conversation: ProcessInboundMessageOutput["conversation"],
    message: ProcessInboundMessageOutput["message"],
    workspaceId: string
  ): Promise<void> {
    try {
      const [
        { CreateNotification },
        { NotificationsDatabaseRepository },
        { NotificationsCacheDriver },
        { UsersDatabaseRepository },
      ] = await Promise.all([
        import("@omnichannel/core/application/command/create-notification"),
        import("@omnichannel/core/infra/repositories/notifications-repository"),
        import("@omnichannel/core/infra/drivers/notifications-cache-driver"),
        import("@omnichannel/core/infra/repositories/users-repository"),
      ]);

      const notificationsRepository = NotificationsDatabaseRepository.instance();
      const notificationsCacheDriver = NotificationsCacheDriver.instance();
      const usersRepository = UsersDatabaseRepository.instance();

      const createNotificationCommand = CreateNotification.instance(
        notificationsRepository,
        notificationsCacheDriver
      );

      const users = await usersRepository.list(workspaceId);

      if (!users.length) {
        console.log(
          "[InstagramInboundConsumer] No users found in workspace for channel notification"
        );
        return;
      }

      const channelId = conversation.channel?.id;
      const sectorId = conversation.sector?.id;
      const contactName =
        conversation.contact?.name ||
        conversation.contact?.value ||
        "Contato desconhecido";

      const messagePreview =
        message.type === "text"
          ? message.content.substring(0, 100)
          : `[${message.type}]`;

      for (const user of users) {
        const notification = await createNotificationCommand.execute({
          workspaceId,
          type: "channel:new-message",
          title: "Nova mensagem no Instagram",
          content: `${contactName}: ${messagePreview}${message.content.length > 100 ? "..." : ""}`,
          metadata: {
            conversationId: conversation.id,
            messageId: message.id,
            channelId,
            sectorId,
            contactName,
          },
          recipientType: "user",
          recipientId: user.id,
          priority: "normal",
        });

        const { NotificationEmitter } = await import("./notification-emitter");
        NotificationEmitter.emitToUser(
          this.io,
          user.id,
          workspaceId,
          notification
        );
      }
    } catch (error) {
      console.error("[InstagramInboundConsumer] Failed to send notifications:", error);
    }
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.close();
      this.consumer = null;
      this.isConsuming = false;
      console.log("[InstagramInboundConsumer] Stopped");
    }
  }

  static create(io: SocketIOServer): InstagramInboundConsumer {
    return new InstagramInboundConsumer(io);
  }
}

export async function startInstagramInboundConsumer(
  io: SocketIOServer
): Promise<InstagramInboundConsumer> {
  const consumer = InstagramInboundConsumer.create(io);
  await consumer.start();
  return consumer;
}
