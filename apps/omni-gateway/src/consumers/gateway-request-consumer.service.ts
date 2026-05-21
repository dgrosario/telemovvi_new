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
import {
  GatewayRequest,
  GatewayResponse,
} from "./interfaces/gateway-request.interface";

export type GatewayRequestHandler = (
  request: GatewayRequest
) => Promise<GatewayResponse>;

@Injectable()
export class GatewayRequestConsumerService
  extends HealthIndicator
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GatewayRequestConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  private readonly rabbitmqUrl: string;
  private readonly requestQueueName = "gateway.requests";
  private readonly responseQueueName = "gateway.responses";

  private requestHandler: GatewayRequestHandler | null = null;

  constructor(private configService: ConfigService) {
    super();
    this.rabbitmqUrl = this.configService.get<string>("rabbitmq.url") ?? "";
  }

  setRequestHandler(handler: GatewayRequestHandler): void {
    this.requestHandler = handler;
  }

  async onModuleInit(): Promise<void> {
    await this.connectToRabbitMQ();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      this.logger.log("Connecting to RabbitMQ for gateway requests...");

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

      await this.channel.assertQueue(this.requestQueueName, {
        durable: true,
      });

      await this.channel.assertQueue(this.responseQueueName, {
        durable: true,
      });

      await this.channel.prefetch(5);

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log(
        `Connected to RabbitMQ, consuming from: ${this.requestQueueName}`
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
      this.requestQueueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const startTime = Date.now();
        let request: GatewayRequest | null = null;

        try {
          const content = msg.content.toString();
          request = JSON.parse(content) as GatewayRequest;

          this.logger.log(
            `Received gateway request: ${request.action} [${request.correlationId}]`
          );

          if (this.requestHandler) {
            const response = await this.requestHandler(request);
            await this.publishResponse(response, request.replyTo);
          } else {
            this.logger.warn("No request handler registered");
            await this.publishResponse(
              {
                correlationId: request.correlationId,
                success: false,
                error: "No handler registered",
              },
              request.replyTo
            );
          }

          this.channel?.ack(msg);

          const duration = Date.now() - startTime;
          this.logger.log(
            `Processed ${request.action} [${request.correlationId}] in ${duration}ms`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          this.logger.error(
            `Error processing request ${request?.correlationId}:`,
            error
          );

          if (request) {
            await this.publishResponse(
              {
                correlationId: request.correlationId,
                success: false,
                error: errorMessage,
              },
              request.replyTo
            );
          }

          this.channel?.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.logger.log("Started consuming gateway requests");
  }

  private async publishResponse(
    response: GatewayResponse,
    replyTo?: string
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      this.logger.error("Cannot publish response: not connected");
      return;
    }

    const queueName = replyTo || this.responseQueueName;

    try {
      this.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(response)),
        {
          persistent: true,
          contentType: "application/json",
          correlationId: response.correlationId,
        }
      );

      this.logger.debug(
        `Published response to ${queueName} [${response.correlationId}]`
      );
    } catch (error) {
      this.logger.error(`Error publishing response:`, error);
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

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = this.isConnected && this.channel !== null;

    const result = this.getStatus(key, isHealthy, {
      connected: this.isConnected,
      queue: this.requestQueueName,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError("Gateway request consumer check failed", result);
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
      this.logger.log("Gateway request consumer connection closed");
    } catch (error) {
      this.logger.error(
        "Error closing gateway request consumer connection:",
        error
      );
    }
  }
}
