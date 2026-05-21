import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { connect, ChannelModel, Channel, ConsumeMessage } from "amqplib";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import { MediaDownloadService } from "../media/media-download.service";
import { ChannelsRepository } from "../database/channels.repository";
import { WebhookLogsRepository } from "../database/webhook-logs.repository";
import { GroupMetadataCacheService } from "../cache/group-metadata-cache.service";
import {
  ChannelEvent,
  ConnectionUpdateData,
  QrcodeUpdateData,
  ContactsUpsertData,
  MessageUpdateData,
  MessageStatusData,
  MessageStatus,
} from "./interfaces/channel-event.interface";

interface EvolutionConnectionUpdateData {
  state: "open" | "close" | "connecting";
  statusReason?: number;
}

interface EvolutionQrcodeUpdateData {
  qrcode?: {
    base64?: string;
  };
  base64?: string;
}

interface EvolutionContactsUpsertData {
  contacts?: Array<{
    id: string;
    name?: string;
    notify?: string;
    imgUrl?: string;
  }>;
}

interface EvolutionMessageUpsertData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    imageMessage?: { mimetype?: string; url?: string };
    audioMessage?: { mimetype?: string; url?: string };
    videoMessage?: { mimetype?: string; url?: string };
    documentMessage?: { mimetype?: string; url?: string; fileName?: string };
    stickerMessage?: { mimetype?: string; url?: string };
  };
  messageType?: string;
}

interface EvolutionMessageUpdateData {
  keyId?: string;
  remoteJid?: string;
  fromMe?: boolean;
  status?: string;
  messageId?: string;
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  update?: {
    status?: number;
    editedMessage?: {
      message?: {
        protocolMessage?: {
          editedMessage?: {
            conversation?: string;
            extendedTextMessage?: {
              text?: string;
            };
          };
        };
      };
      timestampMs?: string;
    };
  };
}

interface EvolutionMessage<T = unknown> {
  instance: string;
  data: T;
}

@Injectable()
export class EvolutionEventConsumerService
  extends HealthIndicator
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EvolutionEventConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private isConsuming = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  private readonly rabbitmqUrl: string;
  private readonly exchangeName: string;

  // Only include queues that Evolution actually creates
  private readonly queues = [
    "evolution.connection.update",
    "evolution.qrcode.updated",
    "evolution.contacts.upsert",
    "evolution.messages.upsert",
    "evolution.messages.update",
  ] as const;

  private readonly instanceEventTypes = [
    "messages.upsert",
    "messages.update",
    "messages.reaction",
    "connection.update",
  ] as const;

  private registeredInstances: Set<string> = new Set();
  private instanceHealthCheckInterval: NodeJS.Timeout | null = null;
  private static readonly INSTANCE_HEALTH_CHECK_INTERVAL_MS = 30000;

  constructor(
    private readonly configService: ConfigService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly publisher: RabbitMQPublisherService,
    @Inject(forwardRef(() => MediaDownloadService))
    private readonly mediaDownloadService: MediaDownloadService,
    private readonly channelsRepository: ChannelsRepository,
    private readonly groupMetadataCache: GroupMetadataCacheService,
    private readonly webhookLogsRepository: WebhookLogsRepository
  ) {
    super();
    this.rabbitmqUrl =
      this.configService.get<string>("evolutionRabbitmq.url") ?? "";
    this.exchangeName =
      this.configService.get<string>("evolutionRabbitmq.exchangeName") ??
      "evolution_exchange";
  }

  async onModuleInit(): Promise<void> {
    if (!this.rabbitmqUrl) {
      this.logger.warn(
        "EVOLUTION_RABBITMQ_URL not configured, skipping Evolution event consumer"
      );
      return;
    }

    await this.connectToRabbitMQ();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      this.logger.log("Connecting to Evolution RabbitMQ...");

      this.connection = await connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      this.channel.on("error", (error: Error) => {
        this.logger.error("Channel error:", error);
        this.isConnected = false;
        this.isConsuming = false;
      });

      this.channel.on("close", () => {
        this.logger.warn("Channel closed unexpectedly");
        this.isConnected = false;
        this.isConsuming = false;
        this.scheduleReconnect();
      });

      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log(
        `Connected to Evolution RabbitMQ, exchange: ${this.exchangeName}`
      );

      await this.setupConsumers();

      this.connection.on("error", (error: Error) => {
        this.logger.error("Evolution RabbitMQ connection error:", error);
        this.isConnected = false;
        this.isConsuming = false;
      });

      this.connection.on("close", () => {
        if (this.isConnected) {
          this.logger.warn("Evolution RabbitMQ connection closed");
          this.isConnected = false;
          this.isConsuming = false;
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.logger.error("Failed to connect to Evolution RabbitMQ:", error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached for Evolution RabbitMQ`
      );
      return;
    }

    this.reconnectAttempts++;
    this.logger.log(
      `Scheduling Evolution RabbitMQ reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    setTimeout(() => {
      void this.connectToRabbitMQ();
    }, this.reconnectDelay);
  }

  private async setupConsumers(): Promise<void> {
    if (this.isConsuming || !this.channel) {
      return;
    }

    this.logger.log("Setting up Evolution event consumers...");

    // Note: We don't assert queues here because Evolution creates them with quorum type
    // and asserting with different options causes conflicts. We just consume from existing queues.
    for (const queue of this.queues) {
      try {
        // Check if queue exists before consuming
        const queueExists = await this.checkQueueExists(queue);
        if (!queueExists) {
          this.logger.warn(`Queue ${queue} does not exist yet, will retry on next reconnect`);
          continue;
        }

        await this.channel.consume(
          queue,
          (msg: ConsumeMessage | null) => {
            if (!msg) return;
            void this.handleMessage(queue, msg);
          },
          { noAck: false }
        );

        this.logger.log(`Consuming: ${queue}`);
      } catch (error) {
        this.logger.error(`Failed to setup consumer for ${queue}:`, error);
      }
    }

    this.isConsuming = true;
    this.logger.log(`Evolution event consumers setup complete (${this.queues.length} queues)`);

    await this.setupInstanceConsumers();
    this.startInstanceHealthCheck();
  }

  private async setupInstanceConsumers(): Promise<void> {
    if (!this.channel) return;

    try {
      const instances = await this.channelsRepository.findEvolutionInstances();
      this.logger.log(`Found ${instances.length} Evolution instances in database`);

      for (const instance of instances) {
        if (instance.instanceName) {
          await this.registerInstanceQueues(instance.instanceName);
        }
      }
    } catch (error) {
      this.logger.error("Failed to setup instance consumers:", error);
    }
  }

  private startInstanceHealthCheck(): void {
    if (this.instanceHealthCheckInterval) {
      clearInterval(this.instanceHealthCheckInterval);
    }

    this.instanceHealthCheckInterval = setInterval(() => {
      void this.setupInstanceConsumers();
    }, EvolutionEventConsumerService.INSTANCE_HEALTH_CHECK_INTERVAL_MS);

    this.logger.log(
      `Instance health check scheduled every ${EvolutionEventConsumerService.INSTANCE_HEALTH_CHECK_INTERVAL_MS / 1000}s`
    );
  }

  private async registerInstanceQueues(instanceName: string): Promise<void> {
    if (!this.channel || !this.isConnected) {
      this.logger.warn(`Cannot register instance ${instanceName}: channel not connected`);
      return;
    }

    if (this.registeredInstances.has(instanceName)) {
      return;
    }

    this.logger.log(`Registering instance queues for: ${instanceName}`);

    for (const eventType of this.instanceEventTypes) {
      const queueName = `${instanceName}.${eventType}`;

      try {
        const queueExists = await this.checkQueueExists(queueName);
        if (!queueExists) {
          this.logger.debug(`Queue ${queueName} does not exist, skipping`);
          continue;
        }

        await this.channel.consume(
          queueName,
          (msg: ConsumeMessage | null) => {
            if (!msg) return;
            void this.handleInstanceMessage(instanceName, eventType, msg);
          },
          { noAck: false }
        );

        this.logger.log(`Consuming instance queue: ${queueName}`);
      } catch (error) {
        this.logger.error(`Failed to consume ${queueName}:`, error);
      }
    }

    this.registeredInstances.add(instanceName);
    this.logger.log(`Registered instance: ${instanceName}`);
  }

  async registerInstance(instanceName: string): Promise<boolean> {
    if (!instanceName) {
      this.logger.warn("Cannot register instance: instanceName is empty");
      return false;
    }

    this.logger.log(`Dynamically registering instance: ${instanceName}`);
    await this.registerInstanceQueues(instanceName);
    return this.registeredInstances.has(instanceName);
  }

  async rescanInstances(): Promise<string[]> {
    this.logger.log("Rescanning all Evolution instances...");
    this.registeredInstances.clear();
    await this.setupInstanceConsumers();
    return Array.from(this.registeredInstances);
  }

  getRegisteredInstances(): string[] {
    return Array.from(this.registeredInstances);
  }

  private async checkQueueExists(queueName: string): Promise<boolean> {
    if (!this.connection) return false;

    // Use a temporary channel to check queue existence
    // This prevents the main channel from being closed on error
    let tempChannel: Channel | null = null;
    try {
      tempChannel = await this.connection.createChannel();
      // Add error handler to prevent unhandled error events
      tempChannel.on("error", () => {
        // Silently handle - we expect errors for non-existent queues
      });
      await tempChannel.checkQueue(queueName);
      await tempChannel.close();
      return true;
    } catch {
      // Channel is automatically closed on error, but try to close if still open
      try {
        if (tempChannel) await tempChannel.close();
      } catch {
        // Ignore close errors
      }
      return false;
    }
  }

  private async handleInstanceMessage(
    instanceName: string,
    eventType: string,
    msg: ConsumeMessage
  ): Promise<void> {
    try {
      const content = JSON.parse(msg.content.toString());

      const logId = await this.logEvolutionEvent(
        `${instanceName}.${eventType}`,
        content,
        instanceName
      );
      const startTime = Date.now();

      const message: EvolutionMessage<unknown> = {
        instance: instanceName,
        data: content.data ?? content,
      };

      try {
        switch (eventType) {
          case "messages.upsert":
            await this.handleMessagesUpsert(
              message as EvolutionMessage<EvolutionMessageUpsertData>
            );
            await this.enrichGroupMetadata(instanceName, content);
            await this.forwardToOmnichannel(instanceName, eventType, content);
            break;
          case "messages.update":
            await this.handleMessagesUpdate(
              message as EvolutionMessage<EvolutionMessageUpdateData>
            );
            await this.forwardToOmnichannel(instanceName, eventType, content);
            break;
          case "messages.reaction":
            await this.handleReactionEvent(message);
            break;
          case "connection.update":
            await this.handleConnectionUpdate(
              message as EvolutionMessage<EvolutionConnectionUpdateData>
            );
            break;
        }

        if (logId) {
          await this.webhookLogsRepository.markProcessed(
            logId,
            Date.now() - startTime
          );
        }
      } catch (error) {
        if (logId) {
          await this.webhookLogsRepository.markFailed(logId, String(error));
        }
        throw error;
      }

      this.safeAck(msg);
    } catch (error) {
      this.logger.error(
        `Error processing instance message ${instanceName}.${eventType}:`,
        error
      );
      this.safeNack(msg);
    }
  }

  private async forwardToOmnichannel(
    instanceName: string,
    eventType: string,
    content: unknown
  ): Promise<void> {
    // Normalize: if content is wrapped as { instance, data }, extract data to avoid double-wrapping
    const raw = content as Record<string, unknown>;
    const payload = (raw?.instance && raw?.data) ? raw.data : content;

    const published = await this.publisher.publish({
      source: "evolution",
      instance: instanceName,
      event: eventType,
      data: payload,
    });

    if (published) {
      this.logger.debug(`Forwarded ${eventType} from ${instanceName} to omnichannel`);
    } else {
      this.logger.error(`Failed to forward ${eventType} from ${instanceName} to omnichannel`);
      throw new Error(`Failed to forward ${eventType} from ${instanceName} to omnichannel`);
    }
  }

  private async enrichGroupMetadata(
    instanceName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const key = data.key as { remoteJid?: string } | undefined;
    const remoteJid = key?.remoteJid;

    if (!remoteJid?.endsWith("@g.us")) {
      return;
    }

    if (data.groupName) {
      return;
    }

    try {
      const metadata = await this.groupMetadataCache.getGroupMetadata(
        instanceName,
        remoteJid,
        async () => {
          const groupInfo = await this.evolutionApi.fetchGroupInfo(
            instanceName,
            remoteJid
          );

          if (!groupInfo) {
            return null;
          }

          return {
            groupJid: groupInfo.id,
            groupName: groupInfo.subject,
            participants: groupInfo.participants.map((p) => p.id),
          };
        }
      );

      if (metadata?.groupName) {
        data.groupName = metadata.groupName;
        this.logger.debug(
          `Enriched group name: ${metadata.groupName} for ${remoteJid}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to enrich group metadata for ${remoteJid}:`,
        error
      );
    }
  }

  private async logEvolutionEvent(
    queue: string,
    payload: unknown,
    instanceName?: string
  ): Promise<string | null> {
    try {
      return await this.webhookLogsRepository.save({
        channelType: "evolution",
        payload: payload as Record<string, unknown>,
        phoneNumberId: instanceName,
      });
    } catch (error) {
      this.logger.error(`Failed to log Evolution event (${queue}):`, error);
      return null;
    }
  }

  private async handleMessage(
    queue: string,
    msg: ConsumeMessage
  ): Promise<void> {
    try {
      const content = JSON.parse(msg.content.toString());

      const logId = await this.logEvolutionEvent(
        queue,
        content,
        content?.instance
      );
      const startTime = Date.now();

      try {
        await this.processQueueMessage(queue, content);

        if (logId) {
          await this.webhookLogsRepository.markProcessed(
            logId,
            Date.now() - startTime
          );
        }
      } catch (error) {
        if (logId) {
          await this.webhookLogsRepository.markFailed(logId, String(error));
        }
        throw error;
      }

      this.safeAck(msg);
    } catch (error) {
      this.logger.error(`Error processing message from ${queue}:`, error);
      this.safeNack(msg);
    }
  }

  private async processQueueMessage(
    queue: string,
    content: unknown
  ): Promise<void> {
      switch (queue) {
        case "evolution.connection.update":
          await this.handleConnectionUpdate(
            content as EvolutionMessage<EvolutionConnectionUpdateData>
          );
          break;
        case "evolution.qrcode.updated":
          await this.handleQrcodeUpdate(
            content as EvolutionMessage<EvolutionQrcodeUpdateData>
          );
          break;
        case "evolution.contacts.upsert":
          await this.handleContactsUpsert(
            content as EvolutionMessage<EvolutionContactsUpsertData>
          );
          break;
        case "evolution.messages.upsert": {
          const msg = content as EvolutionMessage<EvolutionMessageUpsertData>;
          await this.handleMessagesUpsert(msg);
          const instanceName = msg.instance;
          if (instanceName) {
            await this.forwardToOmnichannel(instanceName, "messages.upsert", content);
          }
          break;
        }
        case "evolution.messages.update": {
          const msg = content as EvolutionMessage<EvolutionMessageUpdateData>;
          await this.handleMessagesUpdate(msg);
          const instanceName = msg.instance;
          if (instanceName) {
            await this.forwardToOmnichannel(instanceName, "messages.update", content);
          }
          break;
        }
        case "evolution.messages.reaction":
          await this.handleReactionEvent(content as EvolutionMessage<unknown>);
          break;
      }
  }

  private safeAck(msg: ConsumeMessage): void {
    try {
      if (this.channel && this.isConnected) {
        this.channel.ack(msg);
      }
    } catch (error) {
      this.logger.warn("Failed to ack message, channel may be closed:", error);
    }
  }

  private safeNack(msg: ConsumeMessage): void {
    try {
      if (this.channel && this.isConnected) {
        this.channel.nack(msg, false, false);
      }
    } catch (error) {
      this.logger.warn("Failed to nack message, channel may be closed:", error);
    }
  }

  private async handleConnectionUpdate(
    event: EvolutionMessage<EvolutionConnectionUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    this.logger.log(`Connection update for ${instance}: ${data.state}`);

    let phoneNumber: string | undefined;

    if (data.state === "open") {
      phoneNumber = await this.fetchPhoneNumber(instance);
    }

    const channelEvent: ChannelEvent<ConnectionUpdateData> = {
      type: "connection.update",
      instanceName: instance,
      timestamp: new Date(),
      source: "evolution",
      data: {
        state: data.state,
        phoneNumber,
        statusReason: data.statusReason,
      },
    };

    await this.publishChannelEvent(channelEvent);
  }

  private async handleQrcodeUpdate(
    event: EvolutionMessage<EvolutionQrcodeUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    const qrcodeBase64 = data?.qrcode?.base64 ?? data?.base64;

    if (!qrcodeBase64) {
      this.logger.debug(`QR code update without base64, skipping: ${instance}`);
      return;
    }

    this.logger.log(`QR code update for ${instance}`);

    const channelEvent: ChannelEvent<QrcodeUpdateData> = {
      type: "qrcode.update",
      instanceName: instance,
      timestamp: new Date(),
      source: "evolution",
      data: {
        qrcode: qrcodeBase64,
      },
    };

    await this.publishChannelEvent(channelEvent);
  }

  private async handleContactsUpsert(
    event: EvolutionMessage<EvolutionContactsUpsertData>
  ): Promise<void> {
    const { instance } = event;

    this.logger.log(
      `Contacts upsert received for ${instance}, treating as connection confirmation`
    );

    const phoneNumber = await this.fetchPhoneNumber(instance);

    const channelEvent: ChannelEvent<ContactsUpsertData> = {
      type: "contacts.upsert",
      instanceName: instance,
      timestamp: new Date(),
      source: "evolution",
      data: {
        phoneNumber,
      },
    };

    await this.publishChannelEvent(channelEvent);
  }

  private async handleMessagesUpsert(
    event: EvolutionMessage<EvolutionMessageUpsertData>
  ): Promise<void> {
    const { instance, data } = event;

    if (!data?.key?.id || !data?.message) {
      return;
    }

    const messageId = data.key.id;
    const remoteJid = data.key.remoteJid;
    const mimetype = this.extractMimetype(data);

    if (!mimetype) {
      return;
    }

    const mediaUrl = this.extractMediaUrl(data);

    this.logger.debug(
      `Media message detected: ${messageId} (${mimetype}) - triggering download${mediaUrl ? " with direct URL" : " via Evolution API"}`
    );

    try {
      await this.mediaDownloadService.enqueueDownload({
        messageId,
        instanceName: instance,
        remoteJid,
        mimetype,
        content: mediaUrl ?? undefined,
        channelType: "evolution",
        channelPayload: { instanceName: instance },
        fromMe: data.key.fromMe ?? false,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue media download: ${messageId}`, error);
    }
  }

  private async handleMessagesUpdate(
    event: EvolutionMessage<EvolutionMessageUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    if (data?.keyId && data?.status) {
      const statusCode = this.mapStatusStringToCode(data.status);
      await this.handleMessageStatusUpdate(
        instance,
        data.keyId,
        data.remoteJid ?? "",
        data.fromMe ?? true,
        statusCode
      );
      return;
    }

    if (data?.key?.id && data?.update?.status !== undefined) {
      await this.handleMessageStatusUpdate(
        instance,
        data.key.id,
        data.key.remoteJid,
        data.key.fromMe,
        data.update.status
      );
      return;
    }

    if (data?.key?.id && data?.update?.editedMessage) {
      await this.handleMessageEditUpdate(
        instance,
        data.key.id,
        data.key.remoteJid,
        data.update.editedMessage
      );
      return;
    }

    this.logger.debug(`Message update with unrecognized format`);
  }

  private mapStatusStringToCode(status: string): number {
    switch (status) {
      case "PENDING":
        return 0;
      case "SERVER_ACK":
        return 1;
      case "DELIVERY_ACK":
        return 2;
      case "READ":
        return 3;
      case "PLAYED":
        return 4;
      case "ERROR":
      case "FAILED":
        return 5;
      default:
        return 1;
    }
  }

  private async handleMessageStatusUpdate(
    instance: string,
    messageId: string,
    remoteJid: string,
    fromMe: boolean,
    statusCode: number
  ): Promise<void> {
    const status = this.mapStatusCodeToStatus(statusCode);

    this.logger.log(
      `Message status update: ${messageId} -> ${status} (code: ${statusCode}) from ${remoteJid}`
    );

    const channelEvent: ChannelEvent<MessageStatusData> = {
      type: "messages.status",
      instanceName: instance,
      timestamp: new Date(),
      source: "evolution",
      data: {
        messageId,
        remoteJid,
        fromMe,
        status,
        statusCode,
      },
    };

    await this.publishChannelEvent(channelEvent);
  }

  private mapStatusCodeToStatus(statusCode: number): MessageStatus {
    switch (statusCode) {
      case 1:
        return "sent";
      case 2:
        return "delivered";
      case 3:
        return "read";
      case 4:
        return "played";
      case 5:
        return "failed";
      default:
        return "sent";
    }
  }

  private async handleReactionEvent(
    event: EvolutionMessage<unknown>
  ): Promise<void> {
    const { instance, data } = event;

    this.logger.log(`Reaction event received for ${instance}`);

    const published = await this.publisher.publish({
      source: "evolution",
      instance,
      event: "messages.reaction",
      data,
    });

    if (published) {
      this.logger.log(`Published reaction event for ${instance}`);
    } else {
      this.logger.error(`Failed to publish reaction event for ${instance}`);
    }
  }

  private async handleMessageEditUpdate(
    instance: string,
    messageId: string,
    remoteJid: string,
    editedMessage: NonNullable<NonNullable<EvolutionMessageUpdateData["update"]>["editedMessage"]>
  ): Promise<void> {
    const newContent =
      editedMessage.message?.protocolMessage?.editedMessage?.conversation ??
      editedMessage.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text;

    if (!newContent) {
      this.logger.debug(`Message update without new content: ${messageId}`);
      return;
    }

    const editedAt = editedMessage.timestampMs
      ? new Date(parseInt(editedMessage.timestampMs, 10))
      : new Date();

    this.logger.log(`Message edited: ${messageId} from ${remoteJid}`);

    const channelEvent: ChannelEvent<MessageUpdateData> = {
      type: "messages.update",
      instanceName: instance,
      timestamp: new Date(),
      source: "evolution",
      data: {
        messageId,
        remoteJid,
        newContent,
        editedAt,
      },
    };

    await this.publishChannelEvent(channelEvent);
  }

  private extractMimetype(data: EvolutionMessageUpsertData): string | null {
    const { message } = data;
    if (!message) return null;

    if (message.imageMessage?.mimetype) return message.imageMessage.mimetype;
    if (message.audioMessage?.mimetype) return message.audioMessage.mimetype;
    if (message.videoMessage?.mimetype) return message.videoMessage.mimetype;
    if (message.documentMessage?.mimetype) return message.documentMessage.mimetype;
    if (message.stickerMessage?.mimetype) return message.stickerMessage.mimetype;

    return null;
  }

  private extractMediaUrl(data: EvolutionMessageUpsertData): string | null {
    const { message } = data;
    if (!message) return null;

    if (message.imageMessage?.url) return message.imageMessage.url;
    if (message.audioMessage?.url) return message.audioMessage.url;
    if (message.videoMessage?.url) return message.videoMessage.url;
    if (message.documentMessage?.url) return message.documentMessage.url;
    if (message.stickerMessage?.url) return message.stickerMessage.url;

    const messageType = data.messageType ?? "unknown";
    this.logger.debug(
      `No direct media URL found in message payload (type: ${messageType}), will use Evolution API fallback`
    );

    return null;
  }

  private async fetchPhoneNumber(instanceName: string): Promise<string | undefined> {
    try {
      const instances = await this.evolutionApi.fetchInstances(instanceName);
      const instance = instances.find((i) => i.name === instanceName);

      if (instance?.number) {
        this.logger.log(`Got phoneNumber for ${instanceName}: ${instance.number}`);
        return instance.number;
      }

      if (instance?.ownerJid) {
        const phoneNumber = instance.ownerJid.replace("@s.whatsapp.net", "");
        this.logger.log(`Got phoneNumber from ownerJid for ${instanceName}: ${phoneNumber}`);
        return phoneNumber;
      }

      this.logger.debug(`No phoneNumber found for instance ${instanceName}`);
      return undefined;
    } catch (error) {
      this.logger.error(
        `Failed to fetch phoneNumber for ${instanceName}:`,
        error
      );
      return undefined;
    }
  }

  private async publishChannelEvent<T>(event: ChannelEvent<T>): Promise<void> {
    const published = await this.publisher.publish({
      source: "evolution",
      instance: event.instanceName,
      event: event.type,
      data: event,
    });

    if (published) {
      this.logger.log(
        `Published ${event.type} event for ${event.instanceName}`
      );
    } else {
      this.logger.error(
        `Failed to publish ${event.type} event for ${event.instanceName}`
      );
    }
  }

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = this.isConnected && this.isConsuming;

    const result = this.getStatus(key, isHealthy, {
      connected: this.isConnected,
      consuming: this.isConsuming,
      exchange: this.exchangeName,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError("Evolution RabbitMQ check failed", result);
  }

  async close(): Promise<void> {
    try {
      if (this.instanceHealthCheckInterval) {
        clearInterval(this.instanceHealthCheckInterval);
        this.instanceHealthCheckInterval = null;
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
      this.isConsuming = false;
      this.registeredInstances.clear();
      this.logger.log("Evolution RabbitMQ connection closed");
    } catch (error) {
      this.logger.error("Error closing Evolution RabbitMQ connection:", error);
    }
  }
}
