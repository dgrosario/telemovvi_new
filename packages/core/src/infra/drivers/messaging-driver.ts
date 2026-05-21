import amqp from "amqplib";

type SendMessageToQueueProps = {
  queueUrl: string;
  body: object;
  groupId: string;
  messageId: string;
  delay?: number;
};

export type ScheduleFlowResumeProps = {
  executionId: string;
  conversationId: string;
  channelId: string;
  workspaceId: string;
  delayMs: number;
};

export const FLOW_RESUME_READY_QUEUE = "flow-resume-ready";

interface MessagingDriver {
  sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean>;
  scheduleFlowResume(data: ScheduleFlowResumeProps): Promise<boolean>;
}

export class RabbitMQMessagingDriver implements MessagingDriver {
  private static _instance: RabbitMQMessagingDriver | null = null;
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private initPromise?: Promise<void>;

  // Intervalos de delay normalizados (em ms) para evitar proliferação de filas
  private static readonly DELAY_BUCKETS = [
    5000,      // 5s
    10000,     // 10s
    30000,     // 30s
    60000,     // 1min
    300000,    // 5min
    600000,    // 10min
    1800000,   // 30min
    3600000,   // 1h
    7200000,   // 2h
    14400000,  // 4h
    28800000,  // 8h
    43200000,  // 12h
    86400000,  // 24h
  ];

  private normalizeDelay(delayMs: number): number {
    const buckets = RabbitMQMessagingDriver.DELAY_BUCKETS;
    const minBucket = buckets[0] ?? 5000;
    const maxBucket = buckets[buckets.length - 1] ?? 86400000;

    if (delayMs <= 0) {
      console.warn(
        `[RabbitMQMessagingDriver] Invalid delay ${delayMs}ms, using minimum ${minBucket}ms`
      );
      return minBucket;
    }

    for (const bucket of buckets) {
      if (delayMs <= bucket) {
        return bucket;
      }
    }

    return maxBucket;
  }

  private async init(): Promise<void> {
    if (this.channel && this.connection) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.connect();
    return this.initPromise;
  }

  private async connect(): Promise<void> {
    let tempConnection: amqp.ChannelModel | null = null;

    try {
      const url = process.env.RABBITMQ_URL;
      if (!url) {
        throw new Error("RABBITMQ_URL environment variable not set");
      }

      tempConnection = await amqp.connect(url);
      const channel = await tempConnection.createChannel();

      // Only assign after both operations succeed
      this.connection = tempConnection;
      this.channel = channel;

      this.connection.on("error", (err) => {
        console.error("[RabbitMQMessagingDriver] Connection error:", err);
        this.channel = undefined;
        this.connection = undefined;
        this.initPromise = undefined;
      });

      this.connection.on("close", () => {
        console.log("[RabbitMQMessagingDriver] Connection closed");
        this.channel = undefined;
        this.connection = undefined;
        this.initPromise = undefined;
      });
    } catch (error) {
      console.error("[RabbitMQMessagingDriver] Failed to connect:", error);

      // Close connection if channel creation failed
      if (tempConnection && !this.connection) {
        try {
          await tempConnection.close();
        } catch (closeError) {
          console.error(
            "[RabbitMQMessagingDriver] Failed to close connection on init error:",
            closeError
          );
        }
      }

      this.initPromise = undefined;

      // Clear singleton instance on connection failure to allow retry
      RabbitMQMessagingDriver._instance = null;

      throw error;
    }
  }

  async sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean> {
    try {
      await this.init();

      if (!this.channel) {
        console.error("[RabbitMQMessagingDriver] Channel not available");
        return false;
      }

      const DLQ_NAME = `${data.queueUrl}.dlq`;

      await this.channel.assertQueue(DLQ_NAME, { durable: true });

      await this.channel.assertQueue(data.queueUrl, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": DLQ_NAME,
        },
      });

      const messageBuffer = Buffer.from(JSON.stringify(data.body));

      const result = this.channel.sendToQueue(data.queueUrl, messageBuffer, {
        persistent: true,
      });

      if (result) {
        console.log(`[RabbitMQMessagingDriver] Message sent to ${data.queueUrl}`);
      } else {
        console.warn(`[RabbitMQMessagingDriver] Failed to send message to ${data.queueUrl}`);
      }

      return result;
    } catch (error) {
      console.error("[RabbitMQMessagingDriver] Error sending message:", error);
      return false;
    }
  }

  async scheduleFlowResume(data: ScheduleFlowResumeProps): Promise<boolean> {
    try {
      await this.init();

      if (!this.channel) {
        console.error("[RabbitMQMessagingDriver] Channel not available for flow resume scheduling");
        return false;
      }

      const normalizedDelay = this.normalizeDelay(data.delayMs);
      const delayQueueName = `flow-resume-delay-${normalizedDelay}`;

      await this.channel.assertQueue(FLOW_RESUME_READY_QUEUE, {
        durable: true,
      });

      await this.channel.assertQueue(delayQueueName, {
        durable: true,
        arguments: {
          "x-message-ttl": normalizedDelay,
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": FLOW_RESUME_READY_QUEUE,
        },
      });

      const message = {
        executionId: data.executionId,
        conversationId: data.conversationId,
        channelId: data.channelId,
        workspaceId: data.workspaceId,
        scheduledAt: new Date().toISOString(),
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const uniqueMessageId = `${data.executionId}-${Date.now()}`;

      const result = this.channel.sendToQueue(delayQueueName, messageBuffer, {
        persistent: true,
        messageId: uniqueMessageId,
      });

      if (result) {
        console.log(
          `[RabbitMQMessagingDriver] Flow resume scheduled for execution ${data.executionId} in ${normalizedDelay}ms (requested: ${data.delayMs}ms)`
        );
      } else {
        console.warn(
          `[RabbitMQMessagingDriver] Failed to schedule flow resume for execution ${data.executionId}`
        );
      }

      return result;
    } catch (error) {
      console.error("[RabbitMQMessagingDriver] Error scheduling flow resume:", error);
      return false;
    }
  }

  static instance(): RabbitMQMessagingDriver {
    if (!RabbitMQMessagingDriver._instance) {
      RabbitMQMessagingDriver._instance = new RabbitMQMessagingDriver();
    }
    return RabbitMQMessagingDriver._instance;
  }

  static async resetInstance(): Promise<void> {
    if (RabbitMQMessagingDriver._instance) {
      await RabbitMQMessagingDriver._instance.close();
      RabbitMQMessagingDriver._instance = null;
    }
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      console.error("[RabbitMQMessagingDriver] Error closing connection:", error);
    } finally {
      this.channel = undefined;
      this.connection = undefined;
      this.initPromise = undefined;
    }
  }
}
