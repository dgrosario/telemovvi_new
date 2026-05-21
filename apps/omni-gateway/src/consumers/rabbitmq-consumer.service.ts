import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { connect, ChannelModel, Channel, ConsumeMessage } from "amqplib";
import { OutboundMessage } from "./interfaces/outbound-message.interface";

export type MessageHandler = (message: OutboundMessage) => Promise<void>;

@Injectable()
export class RabbitMQConsumerService
  extends HealthIndicator
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  private readonly rabbitmqUrl: string;
  private readonly queueName: string;
  private readonly dlqName: string;

  private messageHandler: MessageHandler | null = null;

  constructor(private configService: ConfigService) {
    super();
    this.rabbitmqUrl = this.configService.get<string>("rabbitmq.url") ?? "";
    this.queueName =
      this.configService.get<string>("rabbitmq.outboundQueue") ?? "outbound-messages";
    this.dlqName =
      this.configService.get<string>("rabbitmq.outboundDlq") ??
      "outbound-messages.dlq";
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async onModuleInit(): Promise<void> {
    await this.connectToRabbitMQ();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      this.logger.log("Connecting to RabbitMQ consumer...");

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

      await this.channel.assertQueue(this.dlqName, {
        durable: true,
      });

      await this.channel.assertQueue(this.queueName, {
        durable: true,
        deadLetterExchange: "",
        deadLetterRoutingKey: this.dlqName,
      });

      await this.channel.prefetch(1);

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log(`Connected to RabbitMQ, consuming from: ${this.queueName}`);

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
          const message: OutboundMessage = JSON.parse(content);

          this.logger.debug(
            `Received message: ${message.type} for conversation ${message.conversationId}`
          );

          if (this.messageHandler) {
            await this.messageHandler(message);
          } else {
            this.logger.warn("No message handler registered");
          }

          this.channel?.ack(msg);
        } catch (error) {
          this.logger.error("Error processing message:", error);
          this.channel?.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.logger.log("Started consuming messages");
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached`
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

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = this.isConnected && this.channel !== null;

    const result = this.getStatus(key, isHealthy, {
      connected: this.isConnected,
      queue: this.queueName,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError("RabbitMQ consumer check failed", result);
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
      this.logger.log("RabbitMQ consumer connection closed");
    } catch (error) {
      this.logger.error("Error closing RabbitMQ consumer connection:", error);
    }
  }
}
