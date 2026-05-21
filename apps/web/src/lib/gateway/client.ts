import { connect, ChannelModel, Channel, ConsumeMessage } from "amqplib";
import type {
  GatewayAction,
  GatewayRequest,
  GatewayResponse,
  PendingRequest,
} from "./types";

export class GatewayClient {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly requestQueue = "gateway.requests";
  private readonly responseQueue = "gateway.responses.web";
  private readonly requestTimeout = 30000;
  private connectionPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";

    console.log("[GatewayClient] Attempting to connect to RabbitMQ:", rabbitmqUrl.replace(/:[^:@]+@/, ':****@'));

    try {
      this.connection = await connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(this.requestQueue, { durable: true });
      await this.channel.assertQueue(this.responseQueue, {
        durable: true,
        autoDelete: false,
      });

      await this.channel.consume(
        this.responseQueue,
        (msg: ConsumeMessage | null) => {
          if (!msg) return;
          this.handleResponse(msg);
          this.channel?.ack(msg);
        },
        { noAck: false }
      );

      this.isConnected = true;
      console.log("[GatewayClient] Successfully connected to RabbitMQ");

      this.connection.on("error", (err) => {
        console.error("[GatewayClient] Connection error:", err);
        this.isConnected = false;
        this.connectionPromise = null;
        this.rejectAllPendingRequests("Erro na conexão com o servidor");
      });

      this.connection.on("close", () => {
        console.log("[GatewayClient] Connection closed");
        this.isConnected = false;
        this.connectionPromise = null;
        this.channel = null;
        this.connection = null;
        this.rejectAllPendingRequests("Conexão com o servidor perdida");
      });
    } catch (error) {
      console.error("[GatewayClient] Failed to connect to RabbitMQ:", error);
      this.connectionPromise = null;
      throw error;
    }
  }

  private handleResponse(msg: ConsumeMessage): void {
    try {
      const response: GatewayResponse = JSON.parse(msg.content.toString());
      const pending = this.pendingRequests.get(response.correlationId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.correlationId);
        pending.resolve(response);
      }
    } catch {
      console.error("[GatewayClient] Failed to parse response");
    }
  }

  private rejectAllPendingRequests(reason: string): void {
    for (const [correlationId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(correlationId);
    }
  }

  async request<TPayload, TResponse>(
    action: GatewayAction,
    workspaceId: string,
    channelId: string,
    payload: TPayload
  ): Promise<GatewayResponse<TResponse>> {
    if (!this.isConnected && !this.connectionPromise) {
      this.connectionPromise = this.doConnect();
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Não foi possível conectar ao serviço de mensagens (RabbitMQ)");
    }

    const correlationId = crypto.randomUUID();

    const request: GatewayRequest<TPayload> = {
      action,
      correlationId,
      replyTo: this.responseQueue,
      workspaceId,
      channelId,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout for action: ${action}`));
      }, this.requestTimeout);

      this.pendingRequests.set(correlationId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as GatewayResponse<TResponse>);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        },
        timeout,
      });

      this.channel?.sendToQueue(
        this.requestQueue,
        Buffer.from(JSON.stringify(request)),
        {
          persistent: true,
          contentType: "application/json",
          correlationId,
          replyTo: this.responseQueue,
        }
      );
    });
  }

  async fireAndForget<TPayload>(
    action: GatewayAction,
    workspaceId: string,
    channelId: string,
    payload: TPayload
  ): Promise<void> {
    if (!this.isConnected && !this.connectionPromise) {
      this.connectionPromise = this.doConnect();
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Não foi possível conectar ao serviço de mensagens (RabbitMQ)");
    }

    const correlationId = crypto.randomUUID();

    const request: GatewayRequest<TPayload> = {
      action,
      correlationId,
      replyTo: "",
      workspaceId,
      channelId,
      payload,
    };

    this.channel.sendToQueue(
      this.requestQueue,
      Buffer.from(JSON.stringify(request)),
      {
        persistent: true,
        contentType: "application/json",
        correlationId,
      }
    );
  }

  async close(): Promise<void> {
    for (const [correlationId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
      this.pendingRequests.delete(correlationId);
    }

    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.isConnected = false;
    this.connectionPromise = null;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __gatewayClient: GatewayClient | undefined;
}

export function getGatewayClient(): GatewayClient {
  if (!globalThis.__gatewayClient) {
    globalThis.__gatewayClient = new GatewayClient();
  }
  return globalThis.__gatewayClient;
}
