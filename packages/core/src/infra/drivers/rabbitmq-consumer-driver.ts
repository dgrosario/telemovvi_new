import amqp, { Channel, ChannelModel, ConsumeMessage } from "amqplib";

const NON_RETRYABLE_ERROR_CODES = new Set([
  "INBOUND_CHANNEL_NOT_FOUND",
  "DEVICE_CHANNEL_NOT_FOUND",
]);

export interface RabbitMQMessage<T = unknown> {
  event: string;
  instance: string;
  source?: "whatsapp" | "instagram" | "evolution" | "meta_api" | "internal";
  data: T;
}

type MessageHandler<T = unknown> = (
  message: RabbitMQMessage<T>
) => Promise<void>;

type MaxReconnectCallback = (info: {
  event: string;
  timestamp: Date;
  attempts: number;
  lastError?: string;
}) => void;

export class RabbitMQConsumerDriver {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly url: string;
  private readonly exchangeName: string;
  private isConnecting = false;
  private isFullyConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;
  private readonly reconnectStabilizationDelay = 2000;
  private boundQueues: Set<string> = new Set();
  private onMaxReconnectAttemptsReached?: MaxReconnectCallback;
  private onReconnected?: () => void;
  private lastError?: string;
  private readonly maxMessageRetries = 5;
  private static readonly DLQ_NAME = "omnichannel.dlq";
  private failedMessageRetries: Map<string, number> = new Map();
  private static readonly FAILED_RETRY_CACHE_MAX_SIZE = 5000;

  constructor(url: string, exchangeName: string) {
    this.url = url;
    this.exchangeName = exchangeName;
  }

  setOnMaxReconnectAttemptsReached(callback: MaxReconnectCallback): void {
    this.onMaxReconnectAttemptsReached = callback;
  }

  setOnReconnected(callback: () => void): void {
    this.onReconnected = callback;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log("[RabbitMQ Consumer] Connecting to:", this.url);
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      await this.channel.assertQueue(RabbitMQConsumerDriver.DLQ_NAME, {
        durable: true,
        autoDelete: false,
      });

      this.isFullyConnected = true;

      this.connection.on("error", (err) => {
        console.error("[RabbitMQ Consumer] Connection error:", err.message);
        this.lastError = err.message;
        this.isFullyConnected = false;
        this.handleDisconnect();
      });

      this.connection.on("close", () => {
        console.log("[RabbitMQ Consumer] Connection closed");
        this.isFullyConnected = false;
        this.handleDisconnect();
      });

      const wasReconnection = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0;
      console.log("[RabbitMQ Consumer] Connected successfully");

      if (wasReconnection && this.onReconnected) {
        console.log("[RabbitMQ Consumer] Reconnection successful, waiting for stabilization...");
        await new Promise((resolve) => setTimeout(resolve, this.reconnectStabilizationDelay));
        console.log("[RabbitMQ Consumer] Connection stabilized, notifying consumer");
        this.onReconnected();
      }
    } catch (error) {
      console.error("[RabbitMQ Consumer] Failed to connect:", error);
      this.lastError = error instanceof Error ? error.message : String(error);
      this.handleDisconnect();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleDisconnect(): Promise<void> {
    this.channel = null;
    this.connection = null;
    this.isFullyConnected = false;
    this.boundQueues.clear();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `[RabbitMQ Consumer] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      console.error(
        "[RabbitMQ Consumer] Max reconnect attempts reached. Giving up."
      );

      if (this.onMaxReconnectAttemptsReached) {
        this.onMaxReconnectAttemptsReached({
          event: "MAX_RECONNECT_ATTEMPTS_EXHAUSTED",
          timestamp: new Date(),
          attempts: this.maxReconnectAttempts,
          lastError: this.lastError,
        });
      }
    }
  }

  async consume<T = unknown>(
    queueName: string,
    handler: MessageHandler<T>
  ): Promise<void> {
    if (!this.channel || !this.isFullyConnected) {
      console.warn(`[RabbitMQ Consumer] Connection not ready, skipping queue: ${queueName}`);
      return;
    }

    if (this.boundQueues.has(queueName)) {
      return;
    }

    const exists = await this.queueExists(queueName);
    if (!exists) {
      // Queue doesn't exist yet - this is normal for Evolution instances that haven't received messages
      return;
    }

    console.log(`[RabbitMQ Consumer] Consuming queue: ${queueName}`);

    await this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const message = JSON.parse(content) as RabbitMQMessage<T>;

          if (!message.instance) {
            const match = queueName.match(/^(.+?)\.messages\./);
            if (match?.[1]) {
              message.instance = match[1];
            }
          }

          console.log(`[RabbitMQ Consumer] Received event: ${message.event}`);

          await handler(message);

          this.channel?.ack(msg);
        } catch (error) {
          this.handleMessageFailure(msg, error);
        }
      },
      { noAck: false }
    );

    this.boundQueues.add(queueName);
  }

  async consumeWithPattern<T = unknown>(
    routingPattern: string,
    handler: MessageHandler<T>
  ): Promise<void> {
    console.log(`[RabbitMQ Consumer] consumeWithPattern called with pattern: ${routingPattern}`);
    
    if (!this.channel || !this.isFullyConnected) {
      console.warn(`[RabbitMQ Consumer] Connection not ready, skipping pattern: ${routingPattern}`);
      return;
    }

    const consumerQueueName = `omnichannel.${routingPattern.replace(/\*/g, "all")}`;

    console.log(`[RabbitMQ Consumer] Queue name for pattern ${routingPattern}: ${consumerQueueName}`);

    if (this.boundQueues.has(consumerQueueName)) {
      console.log(
        `[RabbitMQ Consumer] Queue ${consumerQueueName} already bound, skipping`
      );
      return;
    }

    console.log(`[RabbitMQ Consumer] Asserting queue: ${consumerQueueName}`);
    await this.channel.assertQueue(consumerQueueName, {
      durable: true,
      autoDelete: false,
    });

    console.log(`[RabbitMQ Consumer] Binding queue ${consumerQueueName} to exchange ${this.exchangeName} with pattern ${routingPattern}`);
    await this.channel.bindQueue(
      consumerQueueName,
      this.exchangeName,
      routingPattern
    );

    this.boundQueues.add(consumerQueueName);

    console.log(
      `[RabbitMQ Consumer] Consuming pattern: ${routingPattern} via queue: ${consumerQueueName}`
    );

    await this.channel.consume(
      consumerQueueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const message = JSON.parse(content) as RabbitMQMessage<T>;
          const routingKey = msg.fields.routingKey;

          console.log(
            `[RabbitMQ Consumer] RAW MESSAGE RECEIVED - Routing Key: ${routingKey}`
          );
          console.log(
            `[RabbitMQ Consumer] RAW MESSAGE CONTENT: ${content.substring(0, 200)}...`
          );

          if (!message.instance && routingKey) {
            const parts = routingKey.split(".");
            console.log(
              `[RabbitMQ Consumer] Routing key parts: ${JSON.stringify(parts)}`
            );
            // Routing key format: source.instance.event (e.g., instagram.17841408789972589.messages.upsert)
            // parts[0] = source (instagram, whatsapp, evolution)
            // parts[1] = instance (pageId, phoneId, instanceName)
            // parts[2+] = event (messages.upsert, messages.update, etc.)
            const sourceFromKey = parts[0] as RabbitMQMessage["source"];
            const instanceFromKey = parts[1]; // ← FIX: Use parts[1] instead of parts[0]
            if (parts.length >= 2 && instanceFromKey) {
              message.instance = instanceFromKey;
              if (!message.source && sourceFromKey) {
                message.source = sourceFromKey;
              }
              console.log(
                `[RabbitMQ Consumer] Extracted instance from routing key: ${instanceFromKey}, source: ${sourceFromKey}`
              );
            }
          }

          console.log(
            `[RabbitMQ Consumer] Received event: ${message.event} from instance: ${message.instance} (routing key: ${routingKey})`
          );

          await handler(message);

          this.channel?.ack(msg);
        } catch (error) {
          this.handleMessageFailure(msg, error);
        }
      },
      { noAck: false }
    );
  }

  async consumeInstanceQueue<T = unknown>(
    instanceName: string,
    eventType: string,
    handler: MessageHandler<T>
  ): Promise<boolean> {
    if (!this.channel || !this.isFullyConnected) {
      console.warn(`[RabbitMQ Consumer] Connection not ready, skipping instance queue: ${instanceName}.${eventType}`);
      return false;
    }

    const queueName = `${instanceName}.${eventType}`;

    if (this.boundQueues.has(queueName)) {
      return true;
    }

    const queueExists = await this.queueExists(queueName);
    if (!queueExists) {
      // Queue doesn't exist yet - this is normal for Evolution instances that haven't received messages
      return false;
    }

    await this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const message = JSON.parse(content) as RabbitMQMessage<T>;

          if (!message.instance) {
            message.instance = instanceName;
          }

          console.log(
            `[RabbitMQ Consumer] Received event: ${message.event} from instance: ${message.instance}`
          );

          await handler(message);

          this.channel?.ack(msg);
        } catch (error) {
          this.handleMessageFailure(msg, error);
        }
      },
      { noAck: false }
    );

    this.boundQueues.add(queueName);
    console.log(`[RabbitMQ Consumer] Consuming instance queue: ${queueName}`);
    return true;
  }

  private getMessageId(msg: ConsumeMessage): string {
    const headers = msg.properties.headers;
    const messageId = msg.properties.messageId || headers?.["x-message-id"];
    if (messageId) return String(messageId);
    return `${msg.fields.consumerTag}:${msg.fields.deliveryTag}`;
  }

  private getDeliveryCount(msg: ConsumeMessage): number {
    const headers = msg.properties.headers;
    if (headers?.["x-delivery-count"] !== undefined) {
      return Number(headers["x-delivery-count"]);
    }
    const msgId = this.getMessageId(msg);
    return this.failedMessageRetries.get(msgId) || 0;
  }

  private trackFailedMessage(msg: ConsumeMessage): number {
    const msgId = this.getMessageId(msg);
    const count = (this.failedMessageRetries.get(msgId) || 0) + 1;
    this.failedMessageRetries.set(msgId, count);

    if (this.failedMessageRetries.size > RabbitMQConsumerDriver.FAILED_RETRY_CACHE_MAX_SIZE) {
      const entries = Array.from(this.failedMessageRetries.entries());
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      for (const [key] of toRemove) {
        this.failedMessageRetries.delete(key);
      }
    }

    return count;
  }

  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const code = "code" in error ? (error as { code: unknown }).code : undefined;
      if (typeof code === "string" && NON_RETRYABLE_ERROR_CODES.has(code)) {
        return true;
      }
    }
    return false;
  }

  private handleMessageFailure(msg: ConsumeMessage, error: unknown): void {
    if (this.isNonRetryableError(error)) {
      console.error(`[RabbitMQ Consumer] Non-retryable error, sending directly to DLQ:`, error);
      this.sendToDlq(msg, error, 0);
      const msgId = this.getMessageId(msg);
      this.failedMessageRetries.delete(msgId);
      return;
    }

    const deliveryCount = this.getDeliveryCount(msg);
    const retryCount = this.trackFailedMessage(msg);
    const totalRetries = Math.max(deliveryCount, retryCount);

    if (totalRetries >= this.maxMessageRetries) {
      this.sendToDlq(msg, error, totalRetries);
      const msgId = this.getMessageId(msg);
      this.failedMessageRetries.delete(msgId);
    } else {
      console.error(`[RabbitMQ Consumer] Error processing message (retry ${totalRetries}/${this.maxMessageRetries}):`, error);
      this.channel?.nack(msg, false, true);
    }
  }

  private sendToDlq(msg: ConsumeMessage, error: unknown, retryCount: number): void {
    try {
      const existingHeaders = msg.properties.headers || {};
      this.channel?.publish("", RabbitMQConsumerDriver.DLQ_NAME, msg.content, {
        persistent: true,
        headers: {
          ...existingHeaders,
          "x-original-queue": msg.fields.routingKey,
          "x-original-routing-key": msg.fields.routingKey,
          "x-original-exchange": msg.fields.exchange,
          "x-failure-reason": String(error),
          "x-failure-timestamp": new Date().toISOString(),
          "x-first-failure-timestamp": existingHeaders["x-first-failure-timestamp"] || new Date().toISOString(),
          "x-retry-count": retryCount,
        },
      });
      this.channel?.ack(msg);
      console.error(`[RabbitMQ Consumer] Message sent to DLQ after ${retryCount} retries:`, {
        routingKey: msg.fields.routingKey,
        error: String(error),
      });
    } catch (dlqError) {
      console.error("[RabbitMQ Consumer] Failed to send message to DLQ, nacking without requeue:", dlqError);
      this.channel?.nack(msg, false, false);
    }
  }

  private async queueExists(queueName: string): Promise<boolean> {
    try {
      const urlObj = new URL(this.url);
      const managementPort = process.env.EVOLUTION_RABBITMQ_MANAGEMENT_PORT || "15672";
      const useHttps = process.env.EVOLUTION_RABBITMQ_MANAGEMENT_HTTPS === "true" || managementPort === "443";
      const protocol = useHttps ? "https" : "http";
      const portSuffix = (useHttps && managementPort === "443") || (!useHttps && managementPort === "80") ? "" : `:${managementPort}`;
      const managementUrl = `${protocol}://${urlObj.hostname}${portSuffix}/api/queues/%2F/${encodeURIComponent(queueName)}`;
      const auth = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString("base64");

      const response = await fetch(managementUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });

      return response.ok;
    } catch (error) {
      console.error(`[RabbitMQ Consumer] Error checking queue ${queueName}:`, error);
      return false;
    }
  }

  async consumeAllInstanceQueues<T = unknown>(
    instanceNames: string[],
    eventTypes: string[],
    handlers: Record<string, MessageHandler<T>>
  ): Promise<void> {
    for (const instanceName of instanceNames) {
      for (const eventType of eventTypes) {
        const handler = handlers[eventType];
        if (handler) {
          await this.consumeInstanceQueue(instanceName, eventType, handler);
        }
      }
    }
  }

  async consumeMultiple(
    queues: Array<{ queue: string; handler: MessageHandler }>
  ): Promise<void> {
    for (const { queue, handler } of queues) {
      await this.consume(queue, handler);
    }
  }

  async consumeMultiplePatterns(
    patterns: Array<{ pattern: string; handler: MessageHandler }>
  ): Promise<void> {
    for (const { pattern, handler } of patterns) {
      await this.consumeWithPattern(pattern, handler);
    }
  }

  async consumeWithBindings<T = unknown>(
    queueName: string,
    routingPatterns: string[],
    handler: MessageHandler<T>
  ): Promise<void> {
    if (!this.channel || !this.isFullyConnected) {
      console.warn(`[RabbitMQ Consumer] Connection not ready, skipping queue with bindings: ${queueName}`);
      return;
    }

    if (this.boundQueues.has(queueName)) {
      console.log(
        `[RabbitMQ Consumer] Queue ${queueName} already bound, skipping`
      );
      return;
    }

    await this.channel.assertQueue(queueName, {
      durable: true,
      autoDelete: false,
    });

    for (const pattern of routingPatterns) {
      await this.channel.bindQueue(queueName, this.exchangeName, pattern);
      console.log(
        `[RabbitMQ Consumer] Bound queue ${queueName} to pattern: ${pattern}`
      );
    }

    this.boundQueues.add(queueName);

    console.log(
      `[RabbitMQ Consumer] Consuming queue: ${queueName} with ${routingPatterns.length} bindings`
    );

    await this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const message = JSON.parse(content) as RabbitMQMessage<T>;
          const routingKey = msg.fields.routingKey;

          if (!message.instance && routingKey) {
            const parts = routingKey.split(".");
            if (parts.length >= 2 && parts[1]) {
              message.instance = parts[1];
            }
          }

          console.log(
            `[RabbitMQ Consumer] Received event: ${message.event} from routing key: ${routingKey}`
          );

          await handler(message);

          this.channel?.ack(msg);
        } catch (error) {
          this.handleMessageFailure(msg, error);
        }
      },
      { noAck: false }
    );
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.channel = null;
      this.connection = null;
      this.boundQueues.clear();
      console.log("[RabbitMQ Consumer] Disconnected");
    } catch (error) {
      console.error("[RabbitMQ Consumer] Error closing connection:", error);
    }
  }

  isConnected(): boolean {
    return this.channel !== null && this.connection !== null;
  }

  static instance(
    url: string = process.env.EVOLUTION_RABBITMQ_URL || "",
    exchangeName: string = process.env.EVOLUTION_RABBITMQ_EXCHANGE ||
      "evolution_exchange"
  ): RabbitMQConsumerDriver {
    return new RabbitMQConsumerDriver(url, exchangeName);
  }
}
