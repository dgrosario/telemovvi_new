import type { Server as SocketIOServer } from "socket.io";
import type { RabbitMQConsumerDriver, RabbitMQMessage } from "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver";
import type { Channel } from "@omnichannel/core/domain/entities/channel";

type ChannelSource = "evolution" | "whatsapp" | "instagram" | "messenger";

interface ChannelEvent<T = unknown> {
  type: "connection.update" | "qrcode.update" | "contacts.upsert";
  instanceName: string;
  timestamp: Date;
  source: ChannelSource;
  data: T;
}

interface ConnectionUpdateData {
  state: "open" | "close" | "connecting";
  phoneNumber?: string;
  statusReason?: number;
}

interface QrcodeUpdateData {
  qrcode: string;
}

interface ContactsUpsertData {
  phoneNumber?: string;
}

type RabbitMQConsumerDriverConstructor = {
  instance(url: string, exchangeName?: string): RabbitMQConsumerDriver & {
    consumeWithBindings<T>(
      queueName: string,
      routingPatterns: string[],
      handler: (message: RabbitMQMessage<T>) => Promise<void>
    ): Promise<void>;
  };
};

type ChannelsDatabaseRepositoryConstructor = {
  instance(): {
    retrieveByPayloadField(
      fieldName: string,
      fieldValue: string
    ): Promise<{ channel: Channel; workspaceId: string } | null>;
    upsert(channel: Channel, workspaceId: string): Promise<void>;
  };
};

export class GatewayChannelConsumer {
  private consumer: RabbitMQConsumerDriver | null = null;
  private io: SocketIOServer;
  private RabbitMQConsumerDriver: RabbitMQConsumerDriverConstructor | null = null;
  private ChannelsDatabaseRepository: ChannelsDatabaseRepositoryConstructor | null = null;
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
      `[GatewayChannelConsumer] Emitted ${event} to workspace:${workspaceId}`
    );
  }

  private emitGlobal(event: string, data: Record<string, unknown>): void {
    this.io.emit(event, data);
    console.log(`[GatewayChannelConsumer] Emitted global ${event}`);
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const [
        { RabbitMQConsumerDriver },
        { ChannelsDatabaseRepository },
      ] = await Promise.all([
        import("@omnichannel/core/infra/drivers/rabbitmq-consumer-driver"),
        import("@omnichannel/core/infra/repositories/channels-repository"),
      ]);

      this.RabbitMQConsumerDriver = RabbitMQConsumerDriver;
      this.ChannelsDatabaseRepository = ChannelsDatabaseRepository;

      return true;
    } catch (error) {
      console.error("[GatewayChannelConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  async start(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      console.log(
        "[GatewayChannelConsumer] RABBITMQ_URL not set, skipping"
      );
      return;
    }

    const loaded = await this.loadDependencies();
    if (!loaded || !this.RabbitMQConsumerDriver) {
      console.error("[GatewayChannelConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[GatewayChannelConsumer] Starting gateway channel consumer...");

    const exchangeName = process.env.EXCHANGE_NAME || "meta_exchange";
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
            "[GatewayChannelConsumer] CRITICAL: RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", {
            error: "Gateway channel consumer connection lost",
            ...info,
          });
        }
      );

      this.consumer.setOnReconnected(async () => {
        console.log(
          "[GatewayChannelConsumer] RabbitMQ reconnected, re-subscribing to queues..."
        );
        this.isConsuming = false;
        await this.consumeQueues();
        console.log("[GatewayChannelConsumer] Re-subscription complete");
      });

      await this.consumer.connect();
      await this.consumeQueues();

      console.log(
        "[GatewayChannelConsumer] Successfully connected and consuming gateway channel event queues"
      );
    } catch (error) {
      console.error("[GatewayChannelConsumer] Failed to start:", error);
      throw error;
    }
  }

  private async consumeQueues(): Promise<void> {
    if (this.isConsuming || !this.consumer) {
      return;
    }

    console.log("[GatewayChannelConsumer] Setting up consumer for channel events...");

    try {
      await this.consumer.consumeWithBindings<ChannelEvent<unknown>>(
        "channel.events",
        [
          "*.*.connection.update",
          "*.*.qrcode.update",
          "*.*.contacts.upsert",
        ],
        async (event) => {
          await this.handleChannelEvent(event);
        }
      );
      console.log("[GatewayChannelConsumer] Consuming channel.events queue with generic bindings");
    } catch (error) {
      console.error("[GatewayChannelConsumer] Failed to consume channel.events:", error);
    }

    this.isConsuming = true;
    console.log("[GatewayChannelConsumer] Channel events setup complete");
  }

  private async handleChannelEvent(
    message: RabbitMQMessage<ChannelEvent<unknown>>
  ): Promise<void> {
    const channelEvent = message.data as ChannelEvent<unknown>;

    console.log(`[GatewayChannelConsumer] Processing ${channelEvent.type} from ${channelEvent.source} for ${channelEvent.instanceName}`);

    switch (channelEvent.type) {
      case "connection.update":
        await this.handleConnectionUpdate(channelEvent as ChannelEvent<ConnectionUpdateData>);
        break;
      case "qrcode.update":
        await this.handleQrcodeUpdate(channelEvent as ChannelEvent<QrcodeUpdateData>);
        break;
      case "contacts.upsert":
        await this.handleContactsUpsert(channelEvent as ChannelEvent<ContactsUpsertData>);
        break;
    }
  }

  private async handleConnectionUpdate(
    event: ChannelEvent<ConnectionUpdateData>
  ): Promise<void> {
    const { instanceName, data, source } = event;

    console.log(
      `[GatewayChannelConsumer] Connection update from ${source} for ${instanceName}: ${data.state}`
    );

    if (data.state === "close" && await this.isInReconnectionGracePeriod(instanceName)) {
      return;
    }

    this.emitGlobal("channel:connection:update", {
      instanceName,
      state: data.state,
      source,
    });

    if (data.state === "open" && source === "evolution") {
      await this.registerDynamicConsumer(instanceName);
    }

    await this.updateChannelStatus(instanceName, data.state, data.phoneNumber, source);

    if (source === "evolution" && data.state === "open") {
      await this.subscribeToEvolutionInstanceQueues(instanceName);
    }
  }

  private async isInReconnectionGracePeriod(instanceName: string): Promise<boolean> {
    if (!this.ChannelsDatabaseRepository) return false;

    try {
      const channelsRepository = this.ChannelsDatabaseRepository.instance();
      const result = await channelsRepository.retrieveByPayloadField(
        "instanceName",
        instanceName
      );

      if (!result) return false;

      const { channel } = result;
      const RECONNECTION_GRACE_MS = 30_000;
      const reconnectedAt = (channel.payload as Record<string, unknown>)?.reconnectedAt;

      if (typeof reconnectedAt === "number" && Date.now() - reconnectedAt < RECONNECTION_GRACE_MS) {
        console.log(
          `[GatewayChannelConsumer] Ignoring close event for ${instanceName} - channel ${channel.id} in reconnection grace period`
        );
        return true;
      }
    } catch (error) {
      console.error(
        `[GatewayChannelConsumer] Error checking grace period for ${instanceName}:`,
        error
      );
    }

    return false;
  }

  private async subscribeToEvolutionInstanceQueues(instanceName: string): Promise<void> {
    if (!global.inboundMessageConsumer) {
      console.warn(
        `[GatewayChannelConsumer] InboundMessageConsumer not available, skipping subscription for ${instanceName}`
      );
      return;
    }

    try {
      await global.inboundMessageConsumer.registerEvolutionInstance(instanceName);
      console.log(
        `[GatewayChannelConsumer] Subscribed to Evolution instance queues: ${instanceName}`
      );
    } catch (error) {
      console.error(
        `[GatewayChannelConsumer] Failed to subscribe to Evolution instance queues for ${instanceName}:`,
        error
      );
    }
  }

  private async registerDynamicConsumer(instanceName: string): Promise<void> {
    try {
      if (global.inboundMessageConsumer) {
        await global.inboundMessageConsumer.registerEvolutionInstance(instanceName);
        console.log(
          `[GatewayChannelConsumer] Dynamically registered consumer for Evolution instance: ${instanceName}`
        );
      } else {
        console.warn(
          `[GatewayChannelConsumer] InboundMessageConsumer not available for dynamic registration of: ${instanceName}`
        );
      }
    } catch (error) {
      console.error(
        `[GatewayChannelConsumer] Failed to register dynamic consumer for ${instanceName}:`,
        error
      );
    }
  }

  private async handleQrcodeUpdate(
    event: ChannelEvent<QrcodeUpdateData>
  ): Promise<void> {
    const { instanceName, data, source } = event;

    console.log(`[GatewayChannelConsumer] QR code update from ${source} for ${instanceName}`);

    await this.updateChannelQrcode(instanceName, data.qrcode);

    this.emitGlobal("channel:qrcode:update", {
      instanceName,
      qrcode: data.qrcode,
      source,
    });
  }

  private async updateChannelQrcode(
    instanceName: string,
    qrcode: string
  ): Promise<void> {
    if (!this.ChannelsDatabaseRepository) {
      console.error("[GatewayChannelConsumer] ChannelsDatabaseRepository not loaded");
      return;
    }

    try {
      const channelsRepository = this.ChannelsDatabaseRepository.instance();
      const result = await channelsRepository.retrieveByPayloadField(
        "instanceName",
        instanceName
      );

      if (!result) {
        console.log(
          `[GatewayChannelConsumer] Channel not found for instance: ${instanceName}`
        );
        return;
      }

      const { channel, workspaceId } = result;
      const updatedPayload = { ...channel.payload, qrcode } as typeof channel.payload;

      channel.payload = updatedPayload;
      await channelsRepository.upsert(channel, workspaceId);

      console.log(
        `[GatewayChannelConsumer] QR code saved for channel ${channel.id}`
      );
    } catch (error) {
      console.error(
        `[GatewayChannelConsumer] Failed to save QR code for ${instanceName}:`,
        error
      );
    }
  }

  private async handleContactsUpsert(
    event: ChannelEvent<ContactsUpsertData>
  ): Promise<void> {
    const { instanceName, data, source } = event;

    console.log(
      `[GatewayChannelConsumer] Contacts upsert from ${source} for ${instanceName}, marking as connected`
    );

    this.emitGlobal("channel:connection:update", {
      instanceName,
      state: "open",
      source,
    });

    if (source === "evolution") {
      await this.registerDynamicConsumer(instanceName);
    }

    await this.updateChannelStatus(instanceName, "open", data.phoneNumber, source);

    if (source === "evolution") {
      await this.subscribeToEvolutionInstanceQueues(instanceName);
    }
  }

  private async updateChannelStatus(
    instanceName: string,
    state: "open" | "close" | "connecting",
    phoneNumber?: string,
    source?: ChannelSource
  ): Promise<void> {
    if (!this.ChannelsDatabaseRepository) {
      console.error("[GatewayChannelConsumer] ChannelsDatabaseRepository not loaded");
      return;
    }

    try {
      const channelsRepository = this.ChannelsDatabaseRepository.instance();
      const result = await channelsRepository.retrieveByPayloadField(
        "instanceName",
        instanceName
      );

      if (!result) {
        console.log(
          `[GatewayChannelConsumer] Channel not found for instance: ${instanceName}`
        );
        return;
      }

      const { channel, workspaceId } = result;

      const newStatus: "connected" | "disconnected" = state === "open" ? "connected" : "disconnected";

      const updatedPayload = { ...channel.payload };
      let needsUpdate = false;

      if (state === "open" && "qrcode" in updatedPayload) {
        updatedPayload.qrcode = null;
        needsUpdate = true;
      }

      if (state === "open" && phoneNumber && "instanceName" in updatedPayload) {
        const currentPhone = (updatedPayload as { phoneNumber?: string | null }).phoneNumber;
        if (currentPhone !== phoneNumber) {
          (updatedPayload as { phoneNumber?: string | null }).phoneNumber = phoneNumber;
          needsUpdate = true;
          console.log(
            `[GatewayChannelConsumer] Updating phoneNumber for channel ${channel.id}: ${phoneNumber}`
          );
        }
      }

      if (channel.status !== newStatus) {
        needsUpdate = true;
      }

      if (needsUpdate) {
        channel.connected(updatedPayload, state === "open");
        await channelsRepository.upsert(channel, workspaceId);

        console.log(
          `[GatewayChannelConsumer] Channel ${channel.id} updated - status: ${newStatus}, phone: ${phoneNumber ?? "unchanged"}, source: ${source ?? "unknown"}`
        );

        this.emitToWorkspace(workspaceId, "channel:status:update", {
          channelId: channel.id,
          status: newStatus,
          instanceName,
          workspaceId,
          phoneNumber,
          source,
        });
      }
    } catch (error) {
      console.error(
        `[GatewayChannelConsumer] Failed to update channel status for ${instanceName}:`,
        error
      );
    }
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.close();
      console.log("[GatewayChannelConsumer] Stopped");
    }
    this.isConsuming = false;
  }

  static create(io: SocketIOServer): GatewayChannelConsumer {
    return new GatewayChannelConsumer(io);
  }
}

export async function startGatewayChannelConsumer(
  io: SocketIOServer
): Promise<GatewayChannelConsumer> {
  const consumer = GatewayChannelConsumer.create(io);
  await consumer.start();
  return consumer;
}
