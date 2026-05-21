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
import { connect, ChannelModel, Channel } from "amqplib";
import { MetaRabbitMQMessage } from "./interfaces/meta-event.interface";

@Injectable()
export class RabbitMQPublisherService
  extends HealthIndicator
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMQPublisherService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  private readonly rabbitmqUrl: string;
  private readonly exchangeName: string;

  constructor(private configService: ConfigService) {
    super();
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
      this.logger.log("Connecting to RabbitMQ...");

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

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log(
        `Connected to RabbitMQ, exchange: ${this.exchangeName}`
      );

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

  async publish<T>(message: MetaRabbitMQMessage<T>): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      this.logger.error("Cannot publish: not connected to RabbitMQ");
      return false;
    }

    const routingKey = `${message.source}.${message.instance}.${message.event}`;

    this.logger.log(`Publishing to exchange ${this.exchangeName} with routing key: ${routingKey}`);

    try {
      const success = this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: "application/json",
        }
      );

      if (success) {
        this.logger.log(`Published message to ${routingKey} on exchange ${this.exchangeName}`);
      } else {
        this.logger.warn(`Failed to publish message to ${routingKey}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error publishing message to ${routingKey}:`, error);
      return false;
    }
  }

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = this.isConnected && this.channel !== null;

    const result = this.getStatus(key, isHealthy, {
      connected: this.isConnected,
      exchange: this.exchangeName,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError("RabbitMQ check failed", result);
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
      this.logger.log("RabbitMQ connection closed");
    } catch (error) {
      this.logger.error("Error closing RabbitMQ connection:", error);
    }
  }
}
