import amqp from "amqplib";
import type { FlowExecutorDriver } from "@omnichannel/core/infra/drivers/flow-executor";
import type { FlowExecution } from "@omnichannel/core/domain/entities/flow-execution";
import type { Conversation } from "@omnichannel/core/domain/entities/conversation";
import type { Channel } from "@omnichannel/core/domain/entities/channel";
import { FLOW_RESUME_READY_QUEUE } from "@omnichannel/core/infra/drivers/messaging-driver";

interface FlowResumeMessage {
  executionId: string;
  conversationId: string;
  channelId: string;
  workspaceId: string;
  scheduledAt: string;
}

class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

function isValidFlowResumeMessage(data: unknown): data is FlowResumeMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  return (
    typeof msg.executionId === "string" &&
    typeof msg.conversationId === "string" &&
    typeof msg.channelId === "string" &&
    typeof msg.workspaceId === "string" &&
    msg.executionId.length > 0 &&
    msg.conversationId.length > 0 &&
    msg.channelId.length > 0 &&
    msg.workspaceId.length > 0
  );
}

interface FlowExecutionsRepository {
  retrieve(id: string): Promise<FlowExecution | null>;
  update(execution: FlowExecution): Promise<void>;
}

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
  clearActiveFlowExecution(conversationId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

type FlowExecutorDriverConstructor = {
  instance(): FlowExecutorDriver;
};

type FlowExecutionsRepositoryConstructor = {
  instance(): FlowExecutionsRepository;
};

type ConversationsRepositoryConstructor = {
  instance(): ConversationsRepository;
};

type ChannelsRepositoryConstructor = {
  instance(): ChannelsRepository;
};

export class FlowResumeConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private FlowExecutorDriver: FlowExecutorDriverConstructor | null = null;
  private FlowExecutionsRepository: FlowExecutionsRepositoryConstructor | null = null;
  private ConversationsRepository: ConversationsRepositoryConstructor | null = null;
  private ChannelsRepository: ChannelsRepositoryConstructor | null = null;
  private isConsuming: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 2000;
  private readonly maxRetryMapSize = 1000;
  private readonly maxMessageSize = 100 * 1024; // 100KB
  private messageRetryCount: Map<string, { count: number; timestamp: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private startRetryMapCleanup(): void {
    // Limpa entradas antigas a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutos

      for (const [messageId, data] of this.messageRetryCount.entries()) {
        if (now - data.timestamp > maxAge) {
          this.messageRetryCount.delete(messageId);
        }
      }
    }, 5 * 60 * 1000);
  }

  private stopRetryMapCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private logDiscardedMessage(
    messageId: string | undefined,
    reason: "no_message_id" | "map_full" | "max_retries" | "permanent_error",
    content: string
  ): void {
    const truncatedContent = content.length > 200
      ? `${content.slice(0, 200)}...[truncated]`
      : content;
    console.error(
      `[FlowResumeConsumer] Message sent to DLQ - ID: ${messageId ?? "unknown"}, Reason: ${reason}, Content: ${truncatedContent}`
    );
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const [
        { FlowExecutorDriver },
        { FlowExecutionsDatabaseRepository },
        { ConversationsDatabaseRepository },
        { ChannelsDatabaseRepository },
      ] = await Promise.all([
        import("@omnichannel/core/infra/drivers/flow-executor"),
        import("@omnichannel/core/infra/repositories/flow-executions-repository"),
        import("@omnichannel/core/infra/repositories/conversations-repository"),
        import("@omnichannel/core/infra/repositories/channels-repository"),
      ]);

      this.FlowExecutorDriver = FlowExecutorDriver;
      this.FlowExecutionsRepository = FlowExecutionsDatabaseRepository;
      this.ConversationsRepository = ConversationsDatabaseRepository;
      this.ChannelsRepository = ChannelsDatabaseRepository;

      return true;
    } catch (error) {
      console.error("[FlowResumeConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  private async connect(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      throw new Error("RABBITMQ_URL not set");
    }

    console.log("[FlowResumeConsumer] Connecting to RabbitMQ...");
    this.connection = await amqp.connect(rabbitmqUrl);
    this.channel = await this.connection.createChannel();

    // Main queue - must match messaging-driver.ts configuration to avoid PRECONDITION_FAILED
    // Note: DLQ removed to align queue arguments with messaging-driver
    await this.channel.assertQueue(FLOW_RESUME_READY_QUEUE, {
      durable: true,
    });

    await this.channel.prefetch(1);

    this.connection.on("error", (err) => {
      console.error("[FlowResumeConsumer] Connection error:", err.message);
      this.handleDisconnect();
    });

    this.connection.on("close", () => {
      console.log("[FlowResumeConsumer] Connection closed");
      this.handleDisconnect();
    });

    this.reconnectAttempts = 0;
    console.log("[FlowResumeConsumer] Connected successfully");
  }

  private async handleDisconnect(): Promise<void> {
    if (this.isReconnecting) {
      return;
    }

    this.channel = null;
    this.connection = null;
    this.isConsuming = false;
    this.stopRetryMapCleanup();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.isReconnecting = true;
      this.reconnectAttempts++;
      console.log(
        `[FlowResumeConsumer] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      setTimeout(() => {
        this.isReconnecting = false;
        this.start();
      }, this.reconnectDelay);
    } else {
      console.error(
        "[FlowResumeConsumer] Max reconnect attempts reached. Giving up."
      );
    }
  }

  async start(): Promise<void> {
    console.log("[FlowResumeConsumer] start() called - beginning initialization...");

    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      console.error(
        "[FlowResumeConsumer] CRITICAL: RABBITMQ_URL environment variable not set!"
      );
      console.error(
        "[FlowResumeConsumer] Flow resume scheduling will NOT work until this is configured."
      );
      return;
    }

    console.log("[FlowResumeConsumer] RABBITMQ_URL is set, loading dependencies...");
    const loaded = await this.loadDependencies();
    if (!loaded) {
      console.error("[FlowResumeConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[FlowResumeConsumer] Starting Flow Resume consumer...");

    try {
      await this.connect();

      if (!this.channel) {
        console.error("[FlowResumeConsumer] Channel not available");
        return;
      }

      await this.channel.consume(
        FLOW_RESUME_READY_QUEUE,
        async (msg) => {
          if (!msg) return;

          const messageId = msg.properties.messageId as string | undefined;
          const messageContent = msg.content.toString();

          if (!messageId) {
            this.logDiscardedMessage(undefined, "no_message_id", messageContent);
            this.channel?.nack(msg, false, false);
            return;
          }

          try {
            await this.handleFlowResume(msg);
            this.channel?.ack(msg);
            this.messageRetryCount.delete(messageId);
          } catch (error) {
            if (error instanceof PermanentError) {
              this.logDiscardedMessage(messageId, "permanent_error", messageContent);
              this.channel?.nack(msg, false, false);
              return;
            }

            const retryData = this.messageRetryCount.get(messageId);
            const currentRetries = retryData?.count || 0;

            if (currentRetries < this.maxRetries) {
              // Protect against memory leak: if map is too large, discard message
              if (this.messageRetryCount.size >= this.maxRetryMapSize && !retryData) {
                this.logDiscardedMessage(messageId, "map_full", messageContent);
                this.channel?.nack(msg, false, false);
                return;
              }

              this.messageRetryCount.set(messageId, {
                count: currentRetries + 1,
                timestamp: Date.now(),
              });
              console.warn(
                `[FlowResumeConsumer] Error processing message (retry ${currentRetries + 1}/${this.maxRetries}):`,
                error instanceof Error ? error.message : error
              );
              // Aguarda antes de requeue para evitar loop tight
              await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (currentRetries + 1)));
              this.channel?.nack(msg, false, true);
            } else {
              this.logDiscardedMessage(messageId, "max_retries", messageContent);
              this.channel?.nack(msg, false, false);
              this.messageRetryCount.delete(messageId);
            }
          }
        },
        { noAck: false }
      );

      this.isConsuming = true;
      this.startRetryMapCleanup();
      console.log(
        `[FlowResumeConsumer] Consuming queue: ${FLOW_RESUME_READY_QUEUE}`
      );
    } catch (error) {
      console.error("[FlowResumeConsumer] Failed to start consuming:", error);
      this.handleDisconnect();
    }
  }

  private async handleFlowResume(msg: amqp.ConsumeMessage): Promise<void> {
    if (!this.FlowExecutorDriver || !this.FlowExecutionsRepository ||
        !this.ConversationsRepository || !this.ChannelsRepository) {
      throw new Error("Dependencies not loaded - cannot process message");
    }

    if (msg.content.length > this.maxMessageSize) {
      throw new PermanentError(`Message too large: ${msg.content.length} bytes`);
    }

    let rawData: unknown;
    try {
      rawData = JSON.parse(msg.content.toString());
    } catch {
      throw new PermanentError("Invalid JSON message format");
    }

    if (!isValidFlowResumeMessage(rawData)) {
      throw new Error("Invalid message format: missing or invalid required fields");
    }

    const data = rawData;

    console.log(
      `[FlowResumeConsumer] Processing flow resume for execution: ${data.executionId}`
    );

    const flowExecutionsRepo = this.FlowExecutionsRepository.instance();
    const conversationsRepo = this.ConversationsRepository.instance();
    const channelsRepo = this.ChannelsRepository.instance();

    const [execution, conversation, channel] = await Promise.all([
      flowExecutionsRepo.retrieve(data.executionId),
      conversationsRepo.retrieve(data.conversationId),
      channelsRepo.retrieve(data.channelId, data.workspaceId),
    ]);

    if (!execution) {
      console.log(
        `[FlowResumeConsumer] Execution ${data.executionId} not found, skipping`
      );
      return;
    }

    if (execution.status !== "paused") {
      console.log(
        `[FlowResumeConsumer] Execution ${data.executionId} is not paused (status: ${execution.status}), skipping`
      );
      return;
    }

    if (!conversation) {
      console.log(
        `[FlowResumeConsumer] Conversation ${data.conversationId} not found, skipping`
      );
      return;
    }

    if (conversation.attendant) {
      console.log(
        `[FlowResumeConsumer] Conversation ${data.conversationId} is attended. Cancelling flow resume.`
      );
      execution.complete();
      await flowExecutionsRepo.update(execution);
      await conversationsRepo.clearActiveFlowExecution(conversation.id);
      return;
    }

    if (!channel) {
      console.log(
        `[FlowResumeConsumer] Channel ${data.channelId} not found, skipping`
      );
      return;
    }

    const flowExecutor = this.FlowExecutorDriver.instance();

    await flowExecutor.resumeFlow({
      execution,
      conversation,
      channel,
      workspaceId: data.workspaceId,
      userMessage: undefined,
    });

    // Salvar estado da conversa após execução do fluxo
    // (activeFlowExecutionId pode ter sido limpo se o fluxo terminou)
    await this.ConversationsRepository.instance().upsert(
      conversation,
      data.workspaceId
    );

    console.log(
      `[FlowResumeConsumer] Successfully resumed flow execution: ${data.executionId}`
    );
  }

  async stop(): Promise<void> {
    try {
      this.stopRetryMapCleanup();
      this.isReconnecting = false;
      await this.channel?.close();
      await this.connection?.close();
      this.channel = null;
      this.connection = null;
      this.isConsuming = false;
      this.messageRetryCount.clear();
      console.log("[FlowResumeConsumer] Consumer stopped");
    } catch (error) {
      console.error("[FlowResumeConsumer] Error stopping consumer:", error);
    }
  }

  isRunning(): boolean {
    return this.isConsuming;
  }
}

export async function startFlowResumeConsumer(): Promise<FlowResumeConsumer> {
  const consumer = new FlowResumeConsumer();
  await consumer.start();
  return consumer;
}
