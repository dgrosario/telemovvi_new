import type { Server as SocketIOServer } from "socket.io";
import type {
  RabbitMQConsumerDriver,
  RabbitMQMessage,
} from "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver";

const INTERNAL_MESSAGE_PATTERN = "internal.*.messages";

interface InternalMessageSender {
  id: string;
  name: string;
}

interface InternalMessageData {
  message: {
    id: string;
    conversationId: string;
    content: string;
    type: "text" | "audio" | "image" | "document" | "video";
    mediaUrl?: string;
    caption?: string;
    filename?: string;
    mimeType?: string;
    sender: InternalMessageSender;
    recipients: string[];
    createdAt: string;
    correlationId?: string;
    status?: "senting" | "sent" | "delivered" | "viewed" | "failed";
  };
  delivered: {
    messageId: string;
    conversationId: string;
    workspaceId: string;
    sender: InternalMessageSender;
    recipients: string[];
    deliveredAt: string;
    correlationId?: string;
  };
  workspaceId: string;
}

type RabbitMQConsumerDriverConstructor = {
  instance(url: string, exchangeName?: string): RabbitMQConsumerDriver;
};

export class InternalMessageConsumer {
  private consumer: RabbitMQConsumerDriver | null = null;
  private io: SocketIOServer;
  private RabbitMQConsumerDriver: RabbitMQConsumerDriverConstructor | null = null;
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
      `[InternalMessageConsumer] Emitted ${event} to workspace:${workspaceId}`
    );
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const { RabbitMQConsumerDriver } = await import(
        "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver"
      );

      this.RabbitMQConsumerDriver = RabbitMQConsumerDriver;

      return true;
    } catch (error) {
      console.error("[InternalMessageConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  async start(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      console.log(
        "[InternalMessageConsumer] RABBITMQ_URL not set, skipping RabbitMQ consumer"
      );
      return;
    }

    const loaded = await this.loadDependencies();
    if (!loaded || !this.RabbitMQConsumerDriver) {
      console.error("[InternalMessageConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[InternalMessageConsumer] Starting Internal Message consumer...");

    this.consumer = this.RabbitMQConsumerDriver.instance(rabbitmqUrl);

    try {
      this.consumer.setOnMaxReconnectAttemptsReached(
        (info: {
          event: string;
          timestamp: Date;
          attempts: number;
          lastError?: string;
        }) => {
          console.error(
            "[InternalMessageConsumer] CRITICAL: RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", {
            error: "Internal message consumer connection lost",
            ...info,
          });
        }
      );

      this.consumer.setOnReconnected(async () => {
        console.log(
          "[InternalMessageConsumer] RabbitMQ reconnected, re-subscribing to queues..."
        );
        this.isConsuming = false;
        await this.consumeQueues();
        console.log("[InternalMessageConsumer] Re-subscription complete");
      });

      await this.consumer.connect();

      await this.consumeQueues();

      console.log(
        "[InternalMessageConsumer] Successfully connected and consuming internal message queues"
      );
    } catch (error) {
      console.error("[InternalMessageConsumer] Failed to start:", error);
    }
  }

  private async consumeQueues(): Promise<void> {
    if (this.isConsuming || !this.consumer) {
      return;
    }

    console.log("[InternalMessageConsumer] Setting up consumers for internal message queues...");

    try {
      await this.consumer.consumeWithPattern<InternalMessageData>(
        INTERNAL_MESSAGE_PATTERN,
        async (event: RabbitMQMessage<InternalMessageData>) => {
          await this.handleInternalMessage(event);
        }
      );

      console.log(`[InternalMessageConsumer] Consuming pattern: ${INTERNAL_MESSAGE_PATTERN}`);
    } catch (error) {
      console.error(
        `[InternalMessageConsumer] Failed to consume pattern ${INTERNAL_MESSAGE_PATTERN}:`,
        error
      );
    }

    this.isConsuming = true;
    console.log("[InternalMessageConsumer] Internal message queues setup complete");
  }

  private async handleInternalMessage(
    event: RabbitMQMessage<InternalMessageData>
  ): Promise<void> {
    const { data } = event;

    if (!data || !data.message || !data.workspaceId) {
      console.warn("[InternalMessageConsumer] Invalid internal message data:", event);
      return;
    }

    console.log(
      `[InternalMessageConsumer] Processing internal message ${data.message.id} ` +
      `from ${data.message.sender.name} to ${data.message.recipients.length} recipient(s)`
    );

    try {
      this.emitToWorkspace(data.workspaceId, "internal:message:received", {
        conversationId: data.message.conversationId,
        message: {
          id: data.message.id,
          content: data.message.content,
          type: data.message.type,
          mediaUrl: data.message.mediaUrl,
          caption: data.message.caption,
          filename: data.message.filename,
          mimeType: data.message.mimeType,
          sender: data.message.sender,
          recipients: data.message.recipients,
          createdAt: data.message.createdAt,
          correlationId: data.message.correlationId,
          status: data.message.status ?? "sent",
        },
        workspaceId: data.workspaceId,
      });

      console.log(
        `[InternalMessageConsumer] Internal message ${data.message.id} emitted to workspace ${data.workspaceId}`
      );
    } catch (error) {
      console.error("[InternalMessageConsumer] Error handling internal message:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.close();
      this.consumer = null;
      this.isConsuming = false;
      console.log("[InternalMessageConsumer] Consumer stopped");
    }
  }
}

export async function startInternalMessageConsumer(
  io: SocketIOServer
): Promise<void> {
  const consumer = new InternalMessageConsumer(io);
  await consumer.start();
}
