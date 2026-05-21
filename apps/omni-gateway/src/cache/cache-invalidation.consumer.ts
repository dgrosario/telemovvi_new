import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { connect, ChannelModel, Channel, ConsumeMessage } from "amqplib";
import { ChannelSecretsCacheService } from "./channel-secrets-cache.service";

interface CacheInvalidationEvent {
  type: "channel.credentials.updated" | "channel.credentials.deleted";
  phoneId: string;
  channelId: string;
  timestamp: string;
}

@Injectable()
export class CacheInvalidationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheInvalidationConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  private readonly rabbitmqUrl: string;
  private readonly exchangeName: string;
  private readonly queueName = "omnichannel.cache-invalidation";
  private readonly routingKey = "channel.credentials.updated";

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly cacheService: ChannelSecretsCacheService
  ) {
    this.rabbitmqUrl = this.configService.get<string>("rabbitmq.url") ?? "";
    this.exchangeName =
      this.configService.get<string>("rabbitmq.exchangeName") ?? "meta_exchange";
  }

  async onModuleInit(): Promise<void> {
    await this.connectToRabbitMQ();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      this.logger.log("Connecting to RabbitMQ for cache invalidation...");

      this.connection = await connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      this.channel.on("error", (error: Error) => {
        this.logger.error("Channel error:", error);
        this.isConnected = false;
      });

      this.channel.on("close", () => {
        this.logger.warn("Channel closed unexpectedly");
        this.isConnected = false;
        this.scheduleReconnect();
      });

      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      await this.channel.assertQueue(this.queueName, {
        durable: true,
        autoDelete: false,
      });

      await this.channel.bindQueue(
        this.queueName,
        this.exchangeName,
        this.routingKey
      );

      await this.channel.prefetch(10);

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log(
        `Connected to RabbitMQ, consuming cache invalidation events from: ${this.queueName}`
      );

      await this.startConsuming();

      this.connection.on("error", (error: Error) => {
        this.logger.error("RabbitMQ connection error:", error);
        this.isConnected = false;
      });

      this.connection.on("close", () => {
        if (this.isConnected) {
          this.logger.warn("RabbitMQ connection closed");
          this.isConnected = false;
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.logger.error("Failed to connect to RabbitMQ:", error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      this.logger.error("Cannot start consuming: channel not available");
      return;
    }

    await this.channel.consume(
      this.queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const event: CacheInvalidationEvent = JSON.parse(content);

          this.logger.debug(
            `Received cache invalidation event: ${event.type} for phoneId: ${event.phoneId}`
          );

          this.cacheService.invalidate(event.phoneId);

          this.channel?.ack(msg);
        } catch (error) {
          this.logger.error("Error processing cache invalidation message:", error);
          this.channel?.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.logger.log("Started consuming cache invalidation events");
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached for cache invalidation consumer`
      );
      return;
    }

    this.reconnectAttempts++;
    this.logger.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    setTimeout(() => {
      void this.connectToRabbitMQ();
    }, this.reconnectDelay);
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      this.logger.log("Cache invalidation consumer connection closed");
    } catch (error) {
      this.logger.error("Error closing cache invalidation consumer:", error);
    }
  }
}
