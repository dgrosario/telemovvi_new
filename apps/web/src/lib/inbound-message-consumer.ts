import type { Server as SocketIOServer } from "socket.io";
import type {
  RabbitMQConsumerDriver,
  RabbitMQMessage,
} from "@omnichannel/core/infra/drivers/rabbitmq-consumer-driver";
import type { ProcessInboundMessage, ProcessInboundMessageOutput } from "@omnichannel/core/application/command/process-inbound-message";
import type { ProcessDeviceMessage, ProcessDeviceMessageOutput } from "@omnichannel/core/application/command/process-device-message";
import type { UpdateMessageStatus, UpdateMessageStatusOutput } from "@omnichannel/core/application/command/update-message-status";
import type { OnMessageReceivedProps, OnMessageStatusUpdateProps } from "@omnichannel/core/infra/controllers/evolution-event-handler";
import {
  extractEvolutionDeleteEventInfo,
  type EvolutionMessagesDeleteData,
} from "@omnichannel/core/infra/controllers/evolution-event-types";
import { processInboundMessageReaction } from "./message-reaction-processor";
import type { Channel } from "@omnichannel/core/domain/entities/channel";
import { NotificationEmitter } from "./notification-emitter";

const INBOUND_PATTERNS = [
  "whatsapp.*.messages.upsert",
];

const STATUS_UPDATE_PATTERNS = [
  "whatsapp.*.messages.update",
];

const UNSUPPORTED_MESSAGE_PLACEHOLDER = "[Tipo de mensagem não suportado]";
const EMPTY_MESSAGE_PLACEHOLDER = "[Mensagem recebida sem conteúdo renderizável]";

const SKIP_INTERNAL_MESSAGE_TYPES = new Set([
  "protocolMessage",
  "senderKeyDistributionMessage",
  "albumMessage",
]);

// NOTE: Evolution API sends reactions via messages.upsert (with reactionMessage field),
// NOT to dedicated reaction queues. We process them in handleEvolutionInboundMessage.
// Deduplication cache prevents processing the same reaction multiple times.

const EVOLUTION_META_INBOUND_PATTERNS = [
  "evolution.*.messages.upsert",
];

const EVOLUTION_META_STATUS_PATTERNS = [
  "evolution.*.messages.update",
];

const EVOLUTION_DIRECT_QUEUES = {
  inbound: "evolution.messages.upsert",
  statusUpdate: "evolution.messages.update",
  delete: "evolution.messages.delete",
  reaction: "evolution.messages.reaction",
};

interface MetaApiMessageContent {
  conversation?: string;
  imageMessage?: {
    url?: string;
    mimetype?: string;
    caption?: string;
    mediaKey?: string;
  };
  audioMessage?: {
    url?: string;
    mimetype?: string;
    mediaKey?: string;
  };
  videoMessage?: {
    url?: string;
    mimetype?: string;
    caption?: string;
    mediaKey?: string;
  };
  documentMessage?: {
    url?: string;
    mimetype?: string;
    title?: string;
    caption?: string;
    mediaKey?: string;
  };
  stickerMessage?: {
    url?: string;
    mimetype?: string;
    mediaKey?: string;
  };
  reactionMessage?: {
    key: {
      id: string;
      remoteJid: string;
      fromMe: boolean;
    };
    text: string;
  };
  locationMessage?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    url?: string;
  };
}

interface MetaApiMessagesUpsertData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: MetaApiMessageContent;
  messageTimestamp: number;
  pushName: string;
  quotedMessageId?: string;
  editedMessageId?: string;
}

interface MetaApiMessagesUpdateData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: "sent" | "delivered" | "read" | "failed";
  error?: {
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  };
}

interface EvolutionContextInfo {
  stanzaId?: string;
  participant?: string;
  quotedMessage?: unknown;
}

interface WrappedEvolutionEvent {
  instance: string;
  data: EvolutionMessagesUpsertData;
}

function isWrappedEvolutionEvent(data: unknown): data is WrappedEvolutionEvent {
  return (
    typeof data === "object" &&
    data !== null &&
    "instance" in data &&
    "data" in data &&
    !("key" in data)
  );
}

interface EvolutionMessagesUpsertData {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: EvolutionContextInfo;
    };
    imageMessage?: {
      url: string;
      mimetype?: string;
      caption?: string;
      mediaKey?: string;
      contextInfo?: EvolutionContextInfo;
    };
    audioMessage?: {
      url: string;
      mimetype?: string;
      mediaKey?: string;
      contextInfo?: EvolutionContextInfo;
    };
    documentMessage?: {
      url: string;
      mimetype?: string;
      title?: string;
      mediaKey?: string;
      contextInfo?: EvolutionContextInfo;
    };
    stickerMessage?: {
      url: string;
      mimetype?: string;
      mediaKey?: string;
      contextInfo?: EvolutionContextInfo;
    };
    videoMessage?: {
      url: string;
      mimetype?: string;
      caption?: string;
      mediaKey?: string;
      contextInfo?: EvolutionContextInfo;
    };
    reactionMessage?: {
      key: {
        id: string;
        remoteJid: string;
        fromMe: boolean;
      };
      text: string;
    };
    locationMessage?: {
      degreesLatitude: number;
      degreesLongitude: number;
      name?: string;
      address?: string;
      url?: string;
      contextInfo?: EvolutionContextInfo;
    };
  };
  // contextInfo pode vir no nível raiz para mensagens simples (conversation) que são respostas
  contextInfo?: EvolutionContextInfo;
  messageTimestamp: number;
  pushName?: string;
  groupName?: string;
}

interface EvolutionEditedMessageContent {
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
    messageContextInfo?: unknown;
  };
}

interface EvolutionMessagesUpdateData {
  // Formato flat (Evolution API v2)
  keyId?: string;
  remoteJid?: string;
  fromMe?: boolean;
  status?: number | string;
  message?: {
    editedMessage?: EvolutionEditedMessageContent;
  };
  // Formato nested (antigo)
  key?: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  update?: {
    status?: number | string;
    message?: {
      editedMessage?: EvolutionEditedMessageContent;
    };
    messageTimestamp?: number;
  };
}

interface WhatsAppStatusUpdate {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: number;
}

interface EvolutionReactionData {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
  };
  reaction: {
    key: {
      id: string;
      remoteJid: string;
      fromMe: boolean;
    };
    text: string;
  };
  messageTimestamp?: number;
  pushName?: string;
}

type RabbitMQConsumerDriverConstructor = {
  instance(url: string, exchangeName?: string): RabbitMQConsumerDriver;
};

type ProcessInboundMessageConstructor = {
  instance(): ProcessInboundMessage;
};

type ProcessDeviceMessageConstructor = {
  instance(): ProcessDeviceMessage;
};

type UpdateMessageStatusConstructor = {
  instance(): UpdateMessageStatus;
};

export class InboundMessageConsumer {
  private consumer: RabbitMQConsumerDriver | null = null;
  private metaConsumer: RabbitMQConsumerDriver | null = null; // Separate consumer for WhatsApp Meta API
  private io: SocketIOServer;
  private RabbitMQConsumerDriver: RabbitMQConsumerDriverConstructor | null = null;
  private ProcessInboundMessage: ProcessInboundMessageConstructor | null = null;
  private ProcessDeviceMessage: ProcessDeviceMessageConstructor | null = null;
  private UpdateMessageStatus: UpdateMessageStatusConstructor | null = null;
  private isConsuming: boolean = false;
  public registeredInstances: Set<string> = new Set();
  private queueHealthCheckInterval: NodeJS.Timeout | null = null;
  private static readonly QUEUE_HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

  // Reaction deduplication cache - prevents processing same reaction multiple times
  private recentReactions: Map<string, number> = new Map();
  private static readonly REACTION_DEDUP_TTL_MS = 5000; // 5 seconds
  private static readonly REACTION_CACHE_MAX_SIZE = 1000;

  // Message deduplication cache - prevents processing same message from global and instance queues
  private recentMessages: Map<string, number> = new Map();
  private static readonly MESSAGE_DEDUP_TTL_MS = 10000; // 10 seconds
  private static readonly MESSAGE_CACHE_MAX_SIZE = 2000;

  // Delete deduplication cache - delete events arrive from both global and instance queues
  private recentDeleteEvents: Map<string, number> = new Map();
  private static readonly DELETE_EVENT_DEDUP_TTL_MS = 10000; // 10 seconds
  private static readonly DELETE_EVENT_CACHE_MAX_SIZE = 1000;

  // Circuit breaker for gateway contact name fetch
  private gatewayContactFailures = 0;
  private static readonly GATEWAY_CIRCUIT_BREAKER_THRESHOLD = 10;
  private static readonly GATEWAY_CIRCUIT_BREAKER_RESET_MS = 60000;
  private gatewayCircuitBreakerResetAt = 0;

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
      `[InboundMessageConsumer] Emitted ${event} to workspace:${workspaceId}`
    );
  }

  private async loadDependencies(): Promise<boolean> {
    try {
      const [
        { RabbitMQConsumerDriver },
        { ProcessInboundMessage },
        { ProcessDeviceMessage },
        { UpdateMessageStatus },
      ] = await Promise.all([
        import("@omnichannel/core/infra/drivers/rabbitmq-consumer-driver"),
        import("@omnichannel/core/application/command/process-inbound-message"),
        import("@omnichannel/core/application/command/process-device-message"),
        import("@omnichannel/core/application/command/update-message-status"),
      ]);

      this.RabbitMQConsumerDriver = RabbitMQConsumerDriver;
      this.ProcessInboundMessage = ProcessInboundMessage;
      this.ProcessDeviceMessage = ProcessDeviceMessage;
      this.UpdateMessageStatus = UpdateMessageStatus;

      return true;
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to load dependencies:", error);
      return false;
    }
  }

  async start(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      console.log(
        "[InboundMessageConsumer] RABBITMQ_URL not set, skipping RabbitMQ consumer"
      );
      return;
    }

    const loaded = await this.loadDependencies();
    if (!loaded || !this.RabbitMQConsumerDriver) {
      console.error("[InboundMessageConsumer] Could not load dependencies, skipping");
      return;
    }

    console.log("[InboundMessageConsumer] Starting Inbound Message consumer...");

    // Evolution API consumer (default exchange: evolution_exchange)
    this.consumer = this.RabbitMQConsumerDriver.instance(rabbitmqUrl);

    // WhatsApp Meta API consumer (uses meta_exchange)
    const metaExchangeName = process.env.EXCHANGE_NAME || "meta_exchange";
    console.log(`[InboundMessageConsumer] Creating Meta API consumer with exchange: ${metaExchangeName}`);
    const metaConsumer = this.RabbitMQConsumerDriver.instance(rabbitmqUrl, metaExchangeName);
    this.metaConsumer = metaConsumer;

    try {
      this.consumer.setOnMaxReconnectAttemptsReached(
        (info: {
          event: string;
          timestamp: Date;
          attempts: number;
          lastError?: string;
        }) => {
          console.error(
            "[InboundMessageConsumer] CRITICAL: RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", {
            error: "Inbound message consumer connection lost",
            ...info,
          });
        }
      );

      this.consumer.setOnReconnected(async () => {
        console.log(
          "[InboundMessageConsumer] RabbitMQ reconnected, re-subscribing to queues..."
        );
        this.isConsuming = false;
        this.registeredInstances.clear();
        console.log("[InboundMessageConsumer] Cleared registered instances for re-subscription");
        await this.consumeQueues();
        console.log("[InboundMessageConsumer] Re-subscription complete");
      });

      await this.consumer.connect();

      metaConsumer.setOnMaxReconnectAttemptsReached(
        (info: {
          event: string;
          timestamp: Date;
          attempts: number;
          lastError?: string;
        }) => {
          console.error(
            "[InboundMessageConsumer] CRITICAL: Meta API RabbitMQ reconnection exhausted",
            info
          );
          this.io.emit("rabbitmq:critical:error", {
            error: "Meta API consumer connection lost",
            ...info,
          });
        }
      );

      metaConsumer.setOnReconnected(async () => {
        console.log(
          "[InboundMessageConsumer] Meta API RabbitMQ reconnected, re-subscribing to meta queues..."
        );
        await this.consumeWhatsAppMetaQueues();
        await this.consumeEvolutionMetaQueues();
        console.log("[InboundMessageConsumer] Meta API re-subscription complete");
      });

      await metaConsumer.connect();
      console.log(`[InboundMessageConsumer] Meta API consumer connected (exchange: ${metaExchangeName})`);

      await this.consumeQueues();

      // Diagnostic: log Meta queue status after setup
      await this.logMetaQueueDiagnostics();

      // Start periodic health check to catch queues created after consumer started
      this.startQueueHealthCheck();

      console.log(
        "[InboundMessageConsumer] Successfully connected and consuming inbound message queues"
      );
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to start:", error);
      throw error;
    }
  }

  private startQueueHealthCheck(): void {
    if (this.queueHealthCheckInterval) {
      clearInterval(this.queueHealthCheckInterval);
    }

    this.queueHealthCheckInterval = setInterval(async () => {
      try {
        // Silent health check - only log errors
        await this.consumeEvolutionInstanceQueues(true); // Force recheck
      } catch (error) {
        console.error("[InboundMessageConsumer] Queue health check failed:", error);
      }
    }, InboundMessageConsumer.QUEUE_HEALTH_CHECK_INTERVAL_MS);

    console.log(
      `[InboundMessageConsumer] Queue health check scheduled every ${InboundMessageConsumer.QUEUE_HEALTH_CHECK_INTERVAL_MS / 1000}s`
    );
  }

  private async consumeQueues(): Promise<void> {
    if (this.isConsuming || !this.consumer) {
      return;
    }

    console.log("[InboundMessageConsumer] Setting up consumers for inbound message queues...");

    // Consume global Evolution inbound queue (when RABBITMQ_GLOBAL_ENABLED=true)
    try {
      await this.consumer.consume<EvolutionMessagesUpsertData>(
        EVOLUTION_DIRECT_QUEUES.inbound,
        async (event: RabbitMQMessage<EvolutionMessagesUpsertData>) => {
          await this.handleEvolutionInboundMessage(event);
        }
      );
      console.log(`[InboundMessageConsumer] Consuming queue: ${EVOLUTION_DIRECT_QUEUES.inbound}`);
    } catch (error) {
      console.error(`[InboundMessageConsumer] Failed to consume ${EVOLUTION_DIRECT_QUEUES.inbound}:`, error);
    }

    // Also try to consume instance-specific queues (when RABBITMQ_GLOBAL_ENABLED=false)
    await this.consumeEvolutionInstanceQueues();

    for (const pattern of INBOUND_PATTERNS) {
      console.log(`[InboundMessageConsumer] Processing INBOUND pattern: ${pattern}`);
      try {
        const channelType = this.getChannelTypeFromPattern(pattern);

        console.log(`[InboundMessageConsumer] Registering pattern: ${pattern} (type: ${channelType})`);

        // WhatsApp Meta API patterns are handled by metaConsumer in consumeWhatsAppMetaQueues()
        if (channelType === "whatsapp") {
          console.log(`[InboundMessageConsumer] Skipping WhatsApp pattern here, will use metaConsumer`);
          continue;
        }

        console.log(`[InboundMessageConsumer] Consuming pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume pattern ${pattern}:`,
          error
        );
        console.error(`[InboundMessageConsumer] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
    }

    for (const pattern of STATUS_UPDATE_PATTERNS) {
      try {
        const channelType = this.getChannelTypeFromPattern(pattern);

        // WhatsApp Meta API patterns are handled by metaConsumer in consumeWhatsAppMetaQueues()
        if (channelType === "whatsapp") {
          console.log(`[InboundMessageConsumer] Skipping WhatsApp status pattern here, will use metaConsumer`);
          continue;
        }

        console.log(`[InboundMessageConsumer] Consuming pattern: ${pattern}`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume pattern ${pattern}:`,
          error
        );
      }
    }

    // Consume WhatsApp Meta API queues using the meta_exchange consumer
    await this.consumeWhatsAppMetaQueues();

    // Consume Evolution API queues via meta_exchange (for messages forwarded by gateway)
    await this.consumeEvolutionMetaQueues();

    // Consume Evolution reactions from the generic queue
    // NOTE: Evolution API sends reactions to evolution.messages.reaction, not instance-specific queues
    try {
      await this.consumer.consume<EvolutionReactionData>(
        EVOLUTION_DIRECT_QUEUES.reaction,
        async (event: RabbitMQMessage<EvolutionReactionData>) => {
          await this.handleReactionEvent(event);
        }
      );
      console.log(`[InboundMessageConsumer] Consuming queue: ${EVOLUTION_DIRECT_QUEUES.reaction}`);
    } catch (error) {
      console.error(
        `[InboundMessageConsumer] Failed to consume ${EVOLUTION_DIRECT_QUEUES.reaction}:`,
        error
      );
    }

    // Consume generic Evolution delete queue
    try {
      await this.consumer.consume<EvolutionMessagesDeleteData>(
        EVOLUTION_DIRECT_QUEUES.delete,
        async (event: RabbitMQMessage<EvolutionMessagesDeleteData>) => {
          await this.handleEvolutionMessageDelete(event);
        }
      );
      console.log(`[InboundMessageConsumer] Consuming queue: ${EVOLUTION_DIRECT_QUEUES.delete}`);
    } catch (error) {
      console.error(`[InboundMessageConsumer] Failed to consume ${EVOLUTION_DIRECT_QUEUES.delete}:`, error);
    }

    // Consume generic Evolution status update queue (for edit events from all instances)
    try {
      await this.consumer.consume<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>(
        EVOLUTION_DIRECT_QUEUES.statusUpdate,
        async (event: RabbitMQMessage<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>) => {
          await this.handleEvolutionStatusUpdate(event);
        }
      );
      console.log(`[InboundMessageConsumer] Consuming queue: ${EVOLUTION_DIRECT_QUEUES.statusUpdate}`);
    } catch (error) {
      console.error(`[InboundMessageConsumer] Failed to consume ${EVOLUTION_DIRECT_QUEUES.statusUpdate}:`, error);
    }

    this.isConsuming = true;
    console.log("[InboundMessageConsumer] Inbound message queues setup complete");
  }

  /**
   * Consume WhatsApp Meta API queues using the meta_exchange consumer.
   * This is separate from Evolution API queues which use evolution_exchange.
   */
  private async consumeWhatsAppMetaQueues(): Promise<void> {
    if (!this.metaConsumer) {
      console.error("[InboundMessageConsumer] Meta consumer not initialized, skipping WhatsApp Meta queues");
      return;
    }

    console.log("[InboundMessageConsumer] Setting up WhatsApp Meta API consumers (meta_exchange)...");

    // Consume inbound messages from WhatsApp Meta API
    for (const pattern of INBOUND_PATTERNS) {
      const channelType = this.getChannelTypeFromPattern(pattern);
      if (channelType !== "whatsapp") continue;

      try {
        console.log(`[InboundMessageConsumer] Setting up WhatsApp Meta handler for pattern: ${pattern}`);
        await this.metaConsumer.consumeWithPattern<MetaApiMessagesUpsertData>(
          pattern,
          async (event: RabbitMQMessage<MetaApiMessagesUpsertData>) => {
            await this.handleWhatsAppInboundMessage(event);
          }
        );
        console.log(`[InboundMessageConsumer] WhatsApp Meta handler registered for pattern: ${pattern} (meta_exchange)`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume WhatsApp Meta pattern ${pattern}:`,
          error
        );
      }
    }

    // Consume status updates from WhatsApp Meta API
    for (const pattern of STATUS_UPDATE_PATTERNS) {
      const channelType = this.getChannelTypeFromPattern(pattern);
      if (channelType !== "whatsapp") continue;

      try {
        console.log(`[InboundMessageConsumer] Setting up WhatsApp Meta status handler for pattern: ${pattern}`);
        await this.metaConsumer.consumeWithPattern<MetaApiMessagesUpdateData>(
          pattern,
          async (event: RabbitMQMessage<MetaApiMessagesUpdateData>) => {
            await this.handleWhatsAppStatusUpdate(event);
          }
        );
        console.log(`[InboundMessageConsumer] WhatsApp Meta status handler registered for pattern: ${pattern} (meta_exchange)`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume WhatsApp Meta status pattern ${pattern}:`,
          error
        );
      }
    }

    console.log("[InboundMessageConsumer] WhatsApp Meta API queues setup complete");
  }

  /**
   * Consume Evolution API inbound queues via meta_exchange.
   * When the gateway consumes from instance queues (round-robin), it forwards
   * messages to meta_exchange. This ensures the web app receives them.
   */
  private async consumeEvolutionMetaQueues(): Promise<void> {
    if (!this.metaConsumer) {
      console.error("[InboundMessageConsumer] Meta consumer not initialized, skipping Evolution Meta queues");
      return;
    }

    console.log("[InboundMessageConsumer] Setting up Evolution Meta API consumers (meta_exchange)...");

    for (const pattern of EVOLUTION_META_INBOUND_PATTERNS) {
      try {
        await this.metaConsumer.consumeWithPattern<EvolutionMessagesUpsertData>(
          pattern,
          async (event: RabbitMQMessage<EvolutionMessagesUpsertData>) => {
            await this.handleEvolutionInboundMessage(event);
          }
        );
        console.log(`[InboundMessageConsumer] Evolution Meta handler registered for pattern: ${pattern} (meta_exchange)`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume Evolution Meta pattern ${pattern}:`,
          error
        );
      }
    }

    for (const pattern of EVOLUTION_META_STATUS_PATTERNS) {
      try {
        await this.metaConsumer.consumeWithPattern<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>(
          pattern,
          async (event: RabbitMQMessage<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>) => {
            await this.handleEvolutionStatusUpdate(event);
          }
        );
        console.log(`[InboundMessageConsumer] Evolution Meta status handler registered for pattern: ${pattern} (meta_exchange)`);
      } catch (error) {
        console.error(
          `[InboundMessageConsumer] Failed to consume Evolution Meta status pattern ${pattern}:`,
          error
        );
      }
    }

    console.log("[InboundMessageConsumer] Evolution Meta API queues setup complete");
  }

  private async logMetaQueueDiagnostics(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL;
      if (!rabbitmqUrl) return;

      const urlObj = new URL(rabbitmqUrl);
      const managementPort = process.env.EVOLUTION_RABBITMQ_MANAGEMENT_PORT || "15672";
      const useHttps = process.env.EVOLUTION_RABBITMQ_MANAGEMENT_HTTPS === "true" || managementPort === "443";
      const protocol = useHttps ? "https" : "http";
      const portSuffix = (useHttps && managementPort === "443") || (!useHttps && managementPort === "80") ? "" : `:${managementPort}`;
      const auth = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString("base64");

      const metaQueueName = "omnichannel.whatsapp.all.messages.upsert";
      const managementUrl = `${protocol}://${urlObj.hostname}${portSuffix}/api/queues/%2F/${encodeURIComponent(metaQueueName)}`;

      const response = await fetch(managementUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (response.ok) {
        const queueInfo = await response.json() as { messages?: number; consumers?: number; message_stats?: { publish_details?: { rate?: number } } };
        console.log(
          `[InboundMessageConsumer] DIAGNOSTIC - Meta queue "${metaQueueName}": messages=${queueInfo.messages ?? "N/A"}, consumers=${queueInfo.consumers ?? "N/A"}`
        );
        if ((queueInfo.messages ?? 0) > 0) {
          console.warn(
            `[InboundMessageConsumer] WARNING: Meta queue has ${queueInfo.messages} pending messages - consumer may have been disconnected`
          );
        }
      } else if (response.status === 404) {
        console.warn(
          `[InboundMessageConsumer] DIAGNOSTIC - Meta queue "${metaQueueName}" NOT FOUND. Exchange may not be publishing messages yet.`
        );
      } else {
        console.warn(
          `[InboundMessageConsumer] DIAGNOSTIC - Could not check Meta queue status: HTTP ${response.status}`
        );
      }
    } catch (error) {
      console.warn("[InboundMessageConsumer] DIAGNOSTIC - Failed to check Meta queue status:", error);
    }
  }

  private async consumeEvolutionInstanceQueues(forceRecheck = false): Promise<void> {
    if (!this.consumer) return;

    try {
      const { createDatabaseConnection, eq } = await import(
        "@omnichannel/core/infra/database"
      );
      const { channels } = await import(
        "@omnichannel/core/infra/database/schemas"
      );

      const db = createDatabaseConnection();
      const evolutionChannels = await db
        .select({
          id: channels.id,
          payload: channels.payload,
        })
        .from(channels)
        .where(eq(channels.type, "evolution"));

      console.log(`[InboundMessageConsumer] Found ${evolutionChannels.length} Evolution channels`);

      for (const channel of evolutionChannels) {
        const payload = channel.payload as { instanceName?: string };
        const instanceName = payload?.instanceName;
        if (!instanceName) continue;

        await this.registerInstanceQueues(instanceName, forceRecheck);
      }
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to setup Evolution instance queues:", error);
    }
  }

  private async registerInstanceQueues(instanceName: string, forceRecheck = false): Promise<void> {
    if (!this.consumer) {
      return;
    }

    if (this.registeredInstances.has(instanceName) && !forceRecheck) {
      return;
    }

    const instanceQueueInbound = `${instanceName}.messages.upsert`;
    const instanceQueueUpdate = `${instanceName}.messages.update`;
    const instanceQueueReaction = `${instanceName}.messages.reaction`;
    const instanceQueueDelete = `${instanceName}.messages.delete`;

    let inboundSuccess = false;
    let updateSuccess = false;
    let reactionSuccess = false;
    let deleteSuccess = false;

    try {
      await this.consumer.consume<EvolutionMessagesUpsertData>(
        instanceQueueInbound,
        async (event: RabbitMQMessage<EvolutionMessagesUpsertData>) => {
          await this.handleEvolutionInboundMessage(event);
        }
      );
      inboundSuccess = true;
    } catch (error) {
      if (error instanceof Error && !error.message.includes("NOT_FOUND") && !error.message.includes("no queue")) {
        console.error(`[InboundMessageConsumer] Unexpected error consuming ${instanceQueueInbound}:`, error);
      }
    }

    try {
      await this.consumer.consume<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>(
        instanceQueueUpdate,
        async (event: RabbitMQMessage<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>) => {
          await this.handleEvolutionStatusUpdate(event);
        }
      );
      updateSuccess = true;
    } catch (error) {
      if (error instanceof Error && !error.message.includes("NOT_FOUND") && !error.message.includes("no queue")) {
        console.error(`[InboundMessageConsumer] Unexpected error consuming ${instanceQueueUpdate}:`, error);
      }
    }

    try {
      await this.consumer.consume<EvolutionReactionData>(
        instanceQueueReaction,
        async (event: RabbitMQMessage<EvolutionReactionData>) => {
          await this.handleReactionEvent(event);
        }
      );
      reactionSuccess = true;
    } catch (error) {
      if (error instanceof Error && !error.message.includes("NOT_FOUND") && !error.message.includes("no queue")) {
        console.error(`[InboundMessageConsumer] Unexpected error consuming ${instanceQueueReaction}:`, error);
      }
    }

    try {
      await this.consumer.consume<EvolutionMessagesDeleteData>(
        instanceQueueDelete,
        async (event: RabbitMQMessage<EvolutionMessagesDeleteData>) => {
          await this.handleEvolutionMessageDelete(event);
        }
      );
      deleteSuccess = true;
    } catch (error) {
      if (error instanceof Error && !error.message.includes("NOT_FOUND") && !error.message.includes("no queue")) {
        console.error(`[InboundMessageConsumer] Unexpected error consuming ${instanceQueueDelete}:`, error);
      }
    }

    if (inboundSuccess || updateSuccess || reactionSuccess || deleteSuccess) {
      if (!this.registeredInstances.has(instanceName)) {
        this.registeredInstances.add(instanceName);
        console.log(`[InboundMessageConsumer] Registered instance: ${instanceName} (queues: ${[inboundSuccess && 'upsert', updateSuccess && 'update', reactionSuccess && 'reaction', deleteSuccess && 'delete'].filter(Boolean).join(', ')})`);
      }
    }
  }

  async registerEvolutionInstance(instanceName: string): Promise<void> {
    if (!instanceName) {
      console.warn("[InboundMessageConsumer] Cannot register instance: instanceName is empty");
      return;
    }

    console.log(`[InboundMessageConsumer] Dynamically registering Evolution instance: ${instanceName}`);

    // Retry with exponential backoff - queues may not be ready immediately after instance creation
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.registerInstanceQueues(instanceName);
        console.log(`[InboundMessageConsumer] Successfully registered ${instanceName} on attempt ${attempt}`);
        return;
      } catch (error) {
        console.error(`[InboundMessageConsumer] Failed to register ${instanceName} (attempt ${attempt}/${maxAttempts}):`, error);
        if (attempt < maxAttempts) {
          const delay = 1000 * attempt; // 1s, 2s, 3s
          console.log(`[InboundMessageConsumer] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.error(`[InboundMessageConsumer] All ${maxAttempts} attempts failed to register ${instanceName}`);
  }

  private getChannelTypeFromPattern(pattern: string): Channel.Type {
    if (pattern.startsWith("evolution.")) return "evolution";
    if (pattern.startsWith("whatsapp.")) return "whatsapp";
    if (pattern.startsWith("instagram.")) return "instagram";
    return "whatsapp";
  }

  private mapEvolutionStatus(
    status: number | string
  ): "sent" | "delivered" | "viewed" | "failed" {
    if (typeof status === "string") {
      switch (status.toUpperCase()) {
        case "SERVER_ACK":
        case "PENDING":
          return "sent";
        case "DELIVERY_ACK":
          return "delivered";
        case "READ":
        case "PLAYED":
          return "viewed";
        case "ERROR":
        case "FAILED":
          return "failed";
        default:
          return "sent";
      }
    }
    switch (status) {
      case 2:
        return "sent";
      case 3:
        return "delivered";
      case 4:
        return "viewed";
      case 5:
        return "failed";
      default:
        return "sent";
    }
  }

  private detectMessageSubtype(message: MetaApiMessageContent | EvolutionMessagesUpsertData["message"]): string | null {
    const knownIgnoredKeys = new Set(["messageContextInfo", "contextInfo"]);
    for (const [key, value] of Object.entries(message)) {
      if (knownIgnoredKeys.has(key)) continue;
      if (value === undefined || value === null) continue;
      return key;
    }
    return null;
  }

  private normalizeMediaKey(mediaKey: unknown): string | undefined {
    if (!mediaKey) return undefined;

    if (typeof mediaKey === "string") {
      return mediaKey;
    }

    if (Buffer.isBuffer(mediaKey)) {
      return mediaKey.toString("base64");
    }

    if (mediaKey instanceof Uint8Array) {
      return Buffer.from(mediaKey).toString("base64");
    }

    if (typeof mediaKey === "object" && mediaKey !== null) {
      const obj = mediaKey as Record<string, unknown>;
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return Buffer.from(obj.data as number[]).toString("base64");
      }
    }

    return undefined;
  }

  private extractEvolutionMessageContent(
    message: EvolutionMessagesUpsertData["message"],
    rootContextInfo?: EvolutionContextInfo
  ): {
    content: string;
    type: "text" | "audio" | "image" | "document" | "sticker" | "video" | "location";
    mediaUrl?: string;
    mimetype?: string;
    caption?: string;
    filename?: string;
    mediaKey?: string;
    quotedMessageId?: string;
  } {
    if (message.conversation) {
      // Para mensagens simples (conversation), o contextInfo pode vir no nível raiz
      return {
        content: message.conversation,
        type: "text",
        quotedMessageId: rootContextInfo?.stanzaId,
      };
    }

    if (message.extendedTextMessage) {
      return {
        content: message.extendedTextMessage.text,
        type: "text",
        quotedMessageId: message.extendedTextMessage.contextInfo?.stanzaId,
      };
    }

    if (message.imageMessage) {
      return {
        content: message.imageMessage.url,
        type: "image",
        mediaUrl: message.imageMessage.url,
        mimetype: message.imageMessage.mimetype,
        caption: message.imageMessage.caption,
        mediaKey: this.normalizeMediaKey(message.imageMessage.mediaKey),
        quotedMessageId: message.imageMessage.contextInfo?.stanzaId,
      };
    }

    if (message.audioMessage) {
      return {
        content: message.audioMessage.url,
        type: "audio",
        mediaUrl: message.audioMessage.url,
        mimetype: message.audioMessage.mimetype,
        mediaKey: this.normalizeMediaKey(message.audioMessage.mediaKey),
        quotedMessageId: message.audioMessage.contextInfo?.stanzaId,
      };
    }

    if (message.documentMessage) {
      return {
        content: message.documentMessage.url,
        type: "document",
        mediaUrl: message.documentMessage.url,
        mimetype: message.documentMessage.mimetype,
        filename: message.documentMessage.title,
        mediaKey: this.normalizeMediaKey(message.documentMessage.mediaKey),
        quotedMessageId: message.documentMessage.contextInfo?.stanzaId,
      };
    }

    if (message.stickerMessage) {
      return {
        content: message.stickerMessage.url,
        type: "sticker",
        mediaUrl: message.stickerMessage.url,
        mimetype: message.stickerMessage.mimetype,
        mediaKey: this.normalizeMediaKey(message.stickerMessage.mediaKey),
        quotedMessageId: message.stickerMessage.contextInfo?.stanzaId,
      };
    }

    if (message.videoMessage) {
      return {
        content: message.videoMessage.url,
        type: "video",
        mediaUrl: message.videoMessage.url,
        mimetype: message.videoMessage.mimetype,
        caption: message.videoMessage.caption,
        mediaKey: this.normalizeMediaKey(message.videoMessage.mediaKey),
        quotedMessageId: message.videoMessage.contextInfo?.stanzaId,
      };
    }

    if (message.locationMessage) {
      const loc = message.locationMessage;
      const locationData = JSON.stringify({
        latitude: loc.degreesLatitude,
        longitude: loc.degreesLongitude,
        name: loc.name || null,
        address: loc.address || null,
      });
      return {
        content: locationData,
        type: "location",
        quotedMessageId: loc.contextInfo?.stanzaId,
      };
    }

    return { content: "", type: "text" };
  }

  private extractMetaApiMessageContent(
    message: MetaApiMessageContent
  ): {
    content: string;
    type: "text" | "audio" | "image" | "document" | "sticker" | "video" | "location";
    mediaUrl?: string;
    mimetype?: string;
    caption?: string;
    filename?: string;
    mediaKey?: string;
  } {
    if (message.conversation) {
      return { content: message.conversation, type: "text" };
    }

    if (message.imageMessage) {
      return {
        content: message.imageMessage.url || message.imageMessage.mediaKey || "",
        type: "image",
        mediaUrl: message.imageMessage.url,
        mimetype: message.imageMessage.mimetype,
        caption: message.imageMessage.caption,
        mediaKey: message.imageMessage.mediaKey,
      };
    }

    if (message.audioMessage) {
      return {
        content: message.audioMessage.url || message.audioMessage.mediaKey || "",
        type: "audio",
        mediaUrl: message.audioMessage.url,
        mimetype: message.audioMessage.mimetype,
        mediaKey: message.audioMessage.mediaKey,
      };
    }

    if (message.documentMessage) {
      return {
        content: message.documentMessage.url || message.documentMessage.mediaKey || "",
        type: "document",
        mediaUrl: message.documentMessage.url,
        mimetype: message.documentMessage.mimetype,
        filename: message.documentMessage.title,
        caption: message.documentMessage.caption,
        mediaKey: message.documentMessage.mediaKey,
      };
    }

    if (message.stickerMessage) {
      return {
        content: message.stickerMessage.url || message.stickerMessage.mediaKey || "",
        type: "sticker",
        mediaUrl: message.stickerMessage.url,
        mimetype: message.stickerMessage.mimetype,
        mediaKey: message.stickerMessage.mediaKey,
      };
    }

    if (message.videoMessage) {
      return {
        content: message.videoMessage.url || message.videoMessage.mediaKey || "",
        type: "video",
        mediaUrl: message.videoMessage.url,
        mimetype: message.videoMessage.mimetype,
        caption: message.videoMessage.caption,
        mediaKey: message.videoMessage.mediaKey,
      };
    }

    if (message.locationMessage) {
      const loc = message.locationMessage;
      const locationData = JSON.stringify({
        latitude: loc.latitude,
        longitude: loc.longitude,
        name: loc.name || null,
        address: loc.address || null,
      });
      return { content: locationData, type: "location" };
    }

    return { content: "", type: "text" };
  }

  private async logInboundMessage(
    source: string,
    event: RabbitMQMessage<unknown>
  ): Promise<void> {
    try {
      const { InboundMessageLogDatabaseRepository } = await import(
        "@omnichannel/core/infra/repositories/inbound-message-log-repository"
      );
      await InboundMessageLogDatabaseRepository.instance().save({
        source,
        instanceName: event.instance,
        messageId: (event.data as Record<string, Record<string, string>>)?.key
          ?.id,
        event: event.event,
        rawPayload: event,
      });
    } catch (error) {
      console.error(
        `[InboundMessageConsumer] Failed to log inbound message:`,
        error
      );
    }
  }

  private async handleEvolutionInboundMessage(
    event: RabbitMQMessage<EvolutionMessagesUpsertData>
  ): Promise<void> {
    await this.logInboundMessage("evolution", event);

    const { instance } = event;
    const rawData: unknown = event.data;
    const data: EvolutionMessagesUpsertData = isWrappedEvolutionEvent(rawData)
      ? rawData.data
      : event.data;

    // Deduplication check - prevent processing same message from global and instance queues
    const messageKey = `${instance}:${data.key.id}`;
    const now = Date.now();

    if (this.recentMessages.has(messageKey)) {
      const lastProcessed = this.recentMessages.get(messageKey)!;
      if (now - lastProcessed < InboundMessageConsumer.MESSAGE_DEDUP_TTL_MS) {
        console.log(
          `[InboundMessageConsumer] Dedup: skipping message ${data.key.id} (processed ${now - lastProcessed}ms ago)`
        );
        return;
      }
    }

    // Cleanup old entries if cache is too large
    if (this.recentMessages.size > InboundMessageConsumer.MESSAGE_CACHE_MAX_SIZE) {
      const cutoff = now - InboundMessageConsumer.MESSAGE_DEDUP_TTL_MS;
      for (const [key, timestamp] of this.recentMessages.entries()) {
        if (timestamp < cutoff) {
          this.recentMessages.delete(key);
        }
      }
    }

    const messageKeys = Object.keys(data.message || {}).filter(
      k => !["messageContextInfo", "contextInfo"].includes(k) && data.message[k as keyof typeof data.message] != null
    );

    if (messageKeys.length === 1 && SKIP_INTERNAL_MESSAGE_TYPES.has(messageKeys[0])) {
      console.log(`[InboundMessageConsumer] Skipping internal message type: ${messageKeys[0]}`);
      this.recentMessages.set(messageKey, now);
      return;
    }

    // Process reactions that arrive via messages.upsert
    // NOTE: Evolution API sends reactions via messages.upsert (not dedicated reaction queue)
    if (data.message.reactionMessage) {
      const reactionMsg = data.message.reactionMessage;
      console.log(
        `[InboundMessageConsumer] Processing reaction via messages.upsert: ${reactionMsg.key.id} -> ${reactionMsg.text} (fromMe: ${data.key.fromMe})`
      );
      await this.processReaction({
        instanceName: instance,
        targetMessageId: reactionMsg.key.id,
        emoji: reactionMsg.text || "",
        reactorJid: data.key.remoteJid,
        fromMe: data.key.fromMe,
        reactorName: data.pushName,
        isRemoval: !reactionMsg.text || reactionMsg.text === "",
      });
      this.recentMessages.set(messageKey, now);
      return;
    }

    let { content, type, mediaUrl, mimetype, caption, filename, mediaKey, quotedMessageId } =
      this.extractEvolutionMessageContent(data.message, data.contextInfo);

    if (!content && !mediaUrl) {
      const subtype = this.detectMessageSubtype(data.message);
      content = subtype
        ? `${UNSUPPORTED_MESSAGE_PLACEHOLDER} (${subtype})`
        : EMPTY_MESSAGE_PLACEHOLDER;
      type = "text";
      console.warn(
        `[InboundMessageConsumer] Evolution message without renderizable content. Using placeholder for ${data.key.id} (subtype: ${subtype || "unknown"})`
      );
    }

    const isGroup = data.key.remoteJid.endsWith("@g.us");
    const participantJid = data.key.participant;

    // Para mensagens fromMe, nao usar pushName pois seria o nome do canal, nao do destinatario
    let contactName = data.key.fromMe
      ? data.key.remoteJid.split("@")[0]
      : (data.pushName || data.key.remoteJid.split("@")[0]);

    if (!data.pushName && !data.key.fromMe && !isGroup) {
      const fetched = await this.fetchContactNameFromGateway(instance, data.key.remoteJid);
      if (fetched) contactName = fetched;
    }

    const messageProps: OnMessageReceivedProps = {
      instanceName: instance,
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      fromMe: data.key.fromMe,
      content,
      type,
      timestamp: data.messageTimestamp,
      contactName,
      mediaUrl,
      mimetype,
      caption,
      filename,
      mediaKey,
      quotedMessageId,
      expectedChannelType: "evolution",
      isGroup,
      groupJid: isGroup ? data.key.remoteJid : undefined,
      groupName: isGroup ? data.groupName : undefined,
      participantJid: isGroup ? participantJid : undefined,
      participantName: isGroup ? (data.pushName || participantJid?.split("@")[0]) : undefined,
    };

    if (data.key.fromMe) {
      console.log(
        "[InboundMessageConsumer] Processing device-sent message:",
        data.key.id
      );
      await this.processDeviceMessage(messageProps);
      this.recentMessages.set(messageKey, now);
      return;
    }

    await this.processInboundMessage(messageProps);
    this.recentMessages.set(messageKey, now);
  }

  private async handleWhatsAppInboundMessage(
    event: RabbitMQMessage<MetaApiMessagesUpsertData>
  ): Promise<void> {
    await this.logInboundMessage("whatsapp", event);

    const { instance, data } = event;

    console.log(
      `[InboundMessageConsumer] WhatsApp Meta message received - instance: ${instance}, messageId: ${data.key.id}, fromMe: ${data.key.fromMe}`
    );

    if (data.editedMessageId) {
      const newContent = data.message.conversation;
      if (newContent) {
        console.log(
          `[InboundMessageConsumer] WhatsApp edit: updating message ${data.editedMessageId}`
        );
        await this.processMessageEdit({
          instanceName: instance,
          messageId: data.editedMessageId,
          remoteJid: data.key.remoteJid,
          editedMessage: { message: { conversation: newContent } },
          messageTimestamp: data.messageTimestamp,
        });
      }
      return;
    }

    if (data.message.reactionMessage) {
      const reactionMsg = data.message.reactionMessage;
      console.log(
        `[InboundMessageConsumer] Processing WhatsApp reaction via messages.upsert: ${reactionMsg.key.id} -> ${reactionMsg.text}`
      );
      await this.processReaction({
        instanceName: instance,
        targetMessageId: reactionMsg.key.id,
        emoji: reactionMsg.text || "",
        reactorJid: data.key.remoteJid,
        fromMe: data.key.fromMe,
        reactorName: data.pushName,
        isRemoval: !reactionMsg.text || reactionMsg.text === "",
      });
      return;
    }

    let { content, type, mediaUrl, mimetype, caption, filename, mediaKey } =
      this.extractMetaApiMessageContent(data.message);

    if (!content && !mediaUrl) {
      const subtype = this.detectMessageSubtype(data.message);
      content = subtype
        ? `${UNSUPPORTED_MESSAGE_PLACEHOLDER} (${subtype})`
        : EMPTY_MESSAGE_PLACEHOLDER;
      type = "text";
      console.warn(
        `[InboundMessageConsumer] WhatsApp Meta message without renderizable content. Using placeholder for ${data.key.id} (subtype: ${subtype || "unknown"})`
      );
    }

    const contactName = data.key.fromMe
      ? data.key.remoteJid.split("@")[0]
      : (data.pushName || data.key.remoteJid.split("@")[0]);

    if (data.quotedMessageId) {
      console.log(
        `[InboundMessageConsumer] WhatsApp message ${data.key.id} has quotedMessageId: ${data.quotedMessageId}`
      );
    }

    const messageProps: OnMessageReceivedProps = {
      instanceName: instance,
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      fromMe: data.key.fromMe,
      content,
      type,
      timestamp: data.messageTimestamp,
      contactName,
      mediaUrl,
      mimetype,
      caption,
      filename,
      mediaKey,
      expectedChannelType: "whatsapp",
      quotedMessageId: data.quotedMessageId,
      isGroup: false,
      groupJid: undefined,
      participantJid: undefined,
      participantName: undefined,
    };

    if (data.key.fromMe) {
      console.log(
        "[InboundMessageConsumer] Processing WhatsApp device-sent message:",
        data.key.id
      );
      await this.processDeviceMessage(messageProps);
      return;
    }

    await this.processInboundMessage(messageProps);
  }

  private async processInboundMessage(props: OnMessageReceivedProps): Promise<void> {
    if (!this.ProcessInboundMessage) {
      console.error("[InboundMessageConsumer] ProcessInboundMessage not loaded");
      return;
    }

    try {
      const processInboundMessage = this.ProcessInboundMessage.instance();

      console.log(
        `[InboundMessageConsumer] Processing inbound message: ${props.messageId}`
      );

      const result: ProcessInboundMessageOutput | null = await processInboundMessage.execute(props);

      if (!result) {
        console.log(
          `[InboundMessageConsumer] Message already processed: ${props.messageId}`
        );
        return;
      }

      const { conversation, message, workspaceId, isNewConversation } = result;

      let groupNameEnriched = false;
      if (
        conversation.conversationType === "whatsapp-group" &&
        !conversation.name &&
        props.groupJid
      ) {
        groupNameEnriched = await this.enrichGroupName(result, props.groupJid);
      }

      this.emitToWorkspace(workspaceId, "message:received", {
        conversationId: conversation.id,
        message: message.raw(),
        conversation: conversation.raw(),
        isNewConversation,
        workspaceId,
      });

      if (isNewConversation) {
        this.emitToWorkspace(workspaceId, "conversation:created", {
          conversation: conversation.raw(),
          workspaceId,
        });
      }

      if ((result.groupNameChanged || groupNameEnriched) && conversation.name) {
        this.emitToWorkspace(workspaceId, "conversation:updated", {
          conversationId: conversation.id,
          name: conversation.name,
        });
      }

      await this.sendChannelNotifications(conversation, message, workspaceId);

      console.log(
        `[InboundMessageConsumer] Message processed and emitted: ${props.messageId}`
      );
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : undefined;

      if (errorCode === "INBOUND_CHANNEL_NOT_FOUND") {
        console.error(
          `[InboundMessageConsumer] Channel not found while processing inbound message ${props.messageId}. Message will be retried.`,
          error
        );
      } else {
        console.error("[InboundMessageConsumer] Failed to process inbound message:", error);
      }
      throw error;
    }
  }

  private async sendChannelNotifications(
    conversation: ProcessInboundMessageOutput["conversation"],
    message: ProcessInboundMessageOutput["message"],
    workspaceId: string
  ): Promise<void> {
    try {
      const [
        { CreateNotification },
        { NotificationsDatabaseRepository },
        { NotificationsCacheDriver },
        { UsersDatabaseRepository },
      ] = await Promise.all([
        import("@omnichannel/core/application/command/create-notification"),
        import("@omnichannel/core/infra/repositories/notifications-repository"),
        import("@omnichannel/core/infra/drivers/notifications-cache-driver"),
        import("@omnichannel/core/infra/repositories/users-repository"),
      ]);

      const notificationsRepository = NotificationsDatabaseRepository.instance();
      const notificationsCacheDriver = NotificationsCacheDriver.instance();
      const usersRepository = UsersDatabaseRepository.instance();

      const createNotificationCommand = CreateNotification.instance(
        notificationsRepository,
        notificationsCacheDriver
      );

      const users = await usersRepository.list(workspaceId);

      if (!users.length) {
        console.log(
          "[InboundMessageConsumer] No users found in workspace for channel notification"
        );
        return;
      }

      const channelId = conversation.channel?.id;
      const sectorId = conversation.sector?.id;
      const contactName =
        conversation.contact?.name ||
        conversation.contact?.value ||
        "Contato desconhecido";

      const messagePreview =
        message.type === "text"
          ? message.content.substring(0, 100)
          : `[${message.type}]`;

      for (const user of users) {
        const notification = await createNotificationCommand.execute({
          workspaceId,
          type: "channel:new-message",
          title: "Nova mensagem no canal",
          content: `${contactName}: ${messagePreview}${message.content.length > 100 ? "..." : ""}`,
          metadata: {
            conversationId: conversation.id,
            messageId: message.id,
            channelId,
            sectorId,
            contactName,
          },
          recipientType: "user",
          recipientId: user.id,
          priority: "normal",
        });

        NotificationEmitter.emitToUser(
          this.io,
          user.id,
          workspaceId,
          notification
        );
      }

      console.log(
        `[InboundMessageConsumer] Sent channel notifications to ${users.length} users`
      );
    } catch (error) {
      console.error(
        "[InboundMessageConsumer] Failed to send channel notifications:",
        error
      );
    }
  }

  private async fetchContactNameFromGateway(
    instanceName: string,
    remoteJid: string
  ): Promise<string | null> {
    const now = Date.now();
    if (this.gatewayContactFailures >= InboundMessageConsumer.GATEWAY_CIRCUIT_BREAKER_THRESHOLD) {
      if (now < this.gatewayCircuitBreakerResetAt) {
        return null;
      }
      this.gatewayContactFailures = 0;
    }

    try {
      const gatewayUrl =
        process.env.OMNI_GATEWAY_URL ||
        process.env.NEXT_PUBLIC_GATEWAY_URL ||
        "http://localhost:3001";

      const number = remoteJid.split("@")[0];
      if (!/^[\d+\-]+$/.test(number)) {
        console.warn(`[InboundMessageConsumer] Invalid number format in remoteJid: ${remoteJid}`);
        return null;
      }
      const url = `${gatewayUrl}/api/contacts/${encodeURIComponent(number)}/name?instanceName=${encodeURIComponent(instanceName)}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      });

      this.gatewayContactFailures = 0;

      if (!response.ok) {
        console.warn(
          `[InboundMessageConsumer] Gateway returned ${response.status} for contact name fetch`
        );
        return null;
      }

      const data = (await response.json()) as { name: string | null };
      if (data.name) {
        console.log(
          `[InboundMessageConsumer] Contact name fetched from gateway: ${data.name}`
        );
      }
      return data.name;
    } catch (error) {
      this.gatewayContactFailures++;
      this.gatewayCircuitBreakerResetAt = Date.now() + InboundMessageConsumer.GATEWAY_CIRCUIT_BREAKER_RESET_MS;

      if (error instanceof Error && error.name === "AbortError") {
        console.warn(
          `[InboundMessageConsumer] Gateway contact name fetch timed out for ${remoteJid}`
        );
      } else {
        console.error(
          "[InboundMessageConsumer] Gateway contact name fetch failed:",
          error instanceof Error ? error.message : error
        );
      }
      return null;
    }
  }

  private async enrichGroupName(
    result: { conversation: ProcessInboundMessageOutput["conversation"]; workspaceId: string },
    groupJid: string
  ): Promise<boolean> {
    try {
      const channelId = result.conversation.channel?.id;
      if (!channelId) return false;

      const { gatewayActions } = await import("@/lib/gateway");
      const response = await gatewayActions.getGroupInfo(
        result.workspaceId,
        channelId,
        groupJid
      );

      if (response.success && response.data?.subject) {
        const { ConversationsDatabaseRepository } = await import(
          "@omnichannel/core/infra/repositories/conversations-repository"
        );
        const repo = ConversationsDatabaseRepository.instance();
        await repo.updateName(result.conversation.id, response.data.subject);
        result.conversation.name = response.data.subject;
        return true;
      }
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to enrich group name:", error);
    }
    return false;
  }

  private async processDeviceMessage(props: OnMessageReceivedProps): Promise<void> {
    if (!this.ProcessDeviceMessage) {
      console.error("[InboundMessageConsumer] ProcessDeviceMessage not loaded");
      return;
    }

    try {
      const processDeviceMessage = this.ProcessDeviceMessage.instance();

      console.log(
        `[InboundMessageConsumer] Processing device message: ${props.messageId}`
      );

      const result: ProcessDeviceMessageOutput | null = await processDeviceMessage.execute(props);

      if (!result) {
        console.log(
          `[InboundMessageConsumer] Device message already processed: ${props.messageId}`
        );
        return;
      }

      const { conversation, message, workspaceId, isNewConversation } = result;

      if (
        conversation.conversationType === "whatsapp-group" &&
        !conversation.name &&
        props.groupJid
      ) {
        await this.enrichGroupName(result, props.groupJid);
      }

      this.emitToWorkspace(workspaceId, "message:received", {
        conversationId: conversation.id,
        message: message.raw(),
        conversation: conversation.raw(),
        isNewConversation,
        workspaceId,
        fromDevice: true,
      });

      if (isNewConversation) {
        this.emitToWorkspace(workspaceId, "conversation:created", {
          conversation: conversation.raw(),
          workspaceId,
        });
      }

      console.log(
        `[InboundMessageConsumer] Device message processed and emitted: ${props.messageId}`
      );
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : undefined;

      if (errorCode === "DEVICE_CHANNEL_NOT_FOUND") {
        console.error(
          `[InboundMessageConsumer] Channel not found while processing device message ${props.messageId}. Message will be retried.`,
          error
        );
      } else {
        console.error("[InboundMessageConsumer] Failed to process device message:", error);
      }
      throw error;
    }
  }

  private async handleEvolutionStatusUpdate(
    event: RabbitMQMessage<EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]>
  ): Promise<void> {
    const { instance, data } = event;

    const updates = Array.isArray(data) ? data : [data];

    for (const update of updates) {
      const messageId = update.keyId ?? update?.key?.id;
      const remoteJid = update.remoteJid ?? update?.key?.remoteJid;

      if (!messageId) continue;

      // Verificar edição de mensagem em ambos os formatos:
      // Formato flat (novo): update.message.editedMessage
      // Formato nested (antigo): update.update.message.editedMessage
      const flatEditedMessage = update.message?.editedMessage;
      const nestedEditedMessage = update.update?.message?.editedMessage;
      const editedMessage = flatEditedMessage ?? nestedEditedMessage;

      if (editedMessage) {
        console.log(
          "[InboundMessageConsumer] Detected message edit:",
          messageId,
          "-> new content:",
          editedMessage.message?.conversation?.substring(0, 50)
        );
        await this.processMessageEdit({
          instanceName: instance,
          messageId,
          remoteJid: remoteJid ?? "",
          editedMessage,
          messageTimestamp: update.update?.messageTimestamp ?? Date.now(),
        });
        continue;
      }

      const rawFromMe = update.fromMe ?? update?.key?.fromMe;

      if (!remoteJid) continue;

      const rawStatus = update.status ?? update?.update?.status;
      if (!rawStatus) continue;

      const status = this.mapEvolutionStatus(rawStatus);

      console.log(
        "[InboundMessageConsumer] Accepting status update candidate:",
        JSON.stringify({
          messageId,
          remoteJid,
          rawFromMe,
          rawStatus,
        }),
      );

      await this.processStatusUpdate({
        instanceName: instance,
        messageId,
        remoteJid,
        status,
      });
    }
  }

  private async handleWhatsAppStatusUpdate(
    event: RabbitMQMessage<MetaApiMessagesUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    const status = data.status === "read" ? "viewed" : data.status;

    if (status === "failed" && data.error) {
      console.warn(
        "[InboundMessageConsumer] WhatsApp status failed details:",
        JSON.stringify({
          messageId: data.key.id,
          remoteJid: data.key.remoteJid,
          ...data.error,
        })
      );
    }

    await this.processStatusUpdate({
      instanceName: instance,
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      status,
      error: data.error,
    });
  }

  private async handleReactionEvent(
    event: RabbitMQMessage<EvolutionReactionData>
  ): Promise<void> {
    const { instance, data } = event;

    console.log(
      `[InboundMessageConsumer] handleReactionEvent raw data:`,
      JSON.stringify(data, null, 2)
    );

    const targetMessageId = data.reaction?.key?.id;
    const emoji = data.reaction?.text;
    const reactorJid = data.key?.remoteJid;
    const fromMe = data.key?.fromMe;
    const reactorName = data.pushName;

    console.log(
      `[InboundMessageConsumer] handleReactionEvent extracted:`,
      JSON.stringify({ targetMessageId, emoji, reactorJid, fromMe, reactorName })
    );

    if (!targetMessageId) {
      console.log("[InboundMessageConsumer] Reaction without target message ID, skipping");
      return;
    }

    const isRemoval = !emoji || emoji === "";

    await this.processReaction({
      instanceName: instance,
      targetMessageId,
      emoji: emoji || "",
      reactorJid: reactorJid || "",
      fromMe: fromMe || false,
      reactorName,
      isRemoval,
    });
  }

  private shouldSkipDeleteEvent(dedupKey: string): boolean {
    const now = Date.now();
    const lastProcessed = this.recentDeleteEvents.get(dedupKey);

    if (
      typeof lastProcessed === "number" &&
      now - lastProcessed < InboundMessageConsumer.DELETE_EVENT_DEDUP_TTL_MS
    ) {
      return true;
    }

    if (
      this.recentDeleteEvents.size >
      InboundMessageConsumer.DELETE_EVENT_CACHE_MAX_SIZE
    ) {
      const cutoff = now - InboundMessageConsumer.DELETE_EVENT_DEDUP_TTL_MS;
      for (const [key, timestamp] of this.recentDeleteEvents.entries()) {
        if (timestamp < cutoff) {
          this.recentDeleteEvents.delete(key);
        }
      }
    }

    this.recentDeleteEvents.set(dedupKey, now);
    return false;
  }

  private async handleEvolutionMessageDelete(
    event: RabbitMQMessage<EvolutionMessagesDeleteData>
  ): Promise<void> {
    const { data } = event;

    const { rawDeleteEventId, targetMessageId, remoteJid } =
      extractEvolutionDeleteEventInfo(data);
    const dedupId = rawDeleteEventId ?? targetMessageId;

    if (!targetMessageId) {
      console.log(
        "[InboundMessageConsumer] Delete event without target message ID, skipping",
        JSON.stringify({
          instance: event.instance ?? "unknown",
          rawDeleteEventId,
          directId: data?.id ?? null,
          keyId: data?.key?.id ?? null,
          messageId: data?.messageId ?? null,
          protocolTargetId:
            data?.message?.protocolMessage?.key?.id ??
            data?.protocolMessage?.key?.id ??
            null,
          remoteJid,
        })
      );
      return;
    }

    if (dedupId) {
      const dedupKey = `${event.instance ?? "unknown"}:${dedupId}`;
      if (this.shouldSkipDeleteEvent(dedupKey)) {
        console.log(
          `[InboundMessageConsumer] Dedup: skipping delete event ${dedupId} (target: ${targetMessageId})`
        );
        return;
      }
    }

    console.log(
      `[InboundMessageConsumer] Processing message delete: ${targetMessageId} (raw: ${rawDeleteEventId ?? "none"})`
    );

    try {
      const { MessagesDatabaseRepository } = await import(
        "@omnichannel/core/infra/repositories/messages-repository"
      );
      const { ConversationsDatabaseRepository } = await import(
        "@omnichannel/core/infra/repositories/conversations-repository"
      );

      const messagesRepository = MessagesDatabaseRepository.instance();
      const conversationsRepository = ConversationsDatabaseRepository.instance();

      const resolvedMessage = await messagesRepository.resolveMessageReference(
        targetMessageId,
        event.instance
      );

      if (!resolvedMessage?.conversationId) {
        console.log(
          "[InboundMessageConsumer] Message not found for delete:",
          JSON.stringify({
            instance: event.instance ?? "unknown",
            rawDeleteEventId,
            targetMessageId,
            remoteJid,
          })
        );
        return;
      }

      if (resolvedMessage.id !== targetMessageId) {
        console.log(
          `[InboundMessageConsumer] Resolved delete message ID ${targetMessageId} -> ${resolvedMessage.id}`
        );
      }

      const deletedAt = new Date();

      // Soft delete a mensagem
      await messagesRepository.softDelete(resolvedMessage.id, deletedAt);

      const updatedConversation = await conversationsRepository.retrieve(
        resolvedMessage.conversationId
      );

      // Emitir evento via socket
      this.emitToWorkspace(resolvedMessage.workspaceId, "message:deleted", {
        messageId: resolvedMessage.id,
        conversationId: resolvedMessage.conversationId,
        deletedAt: deletedAt.toISOString(),
        conversation: updatedConversation?.raw() ?? null,
      });

      console.log(
        `[InboundMessageConsumer] Message delete processed and emitted: ${resolvedMessage.id}`
      );
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to process message delete:", error);
      throw error;
    }
  }

  private async processReaction(props: {
    instanceName: string;
    targetMessageId: string;
    emoji: string;
    reactorJid: string;
    fromMe: boolean | string;
    reactorName?: string;
    isRemoval: boolean;
  }): Promise<void> {
    // Normalize fromMe to strict boolean (can come as string "true"/"false" from some sources)
    const isFromMe = props.fromMe === true || props.fromMe === "true";

    console.log(
      `[InboundMessageConsumer] processReaction called:`,
      JSON.stringify({
        targetMessageId: props.targetMessageId,
        emoji: props.emoji,
        reactorJid: props.reactorJid,
        fromMe: props.fromMe,
        fromMeType: typeof props.fromMe,
        isFromMe,
        isRemoval: props.isRemoval,
      })
    );

    // Deduplication check - prevent processing the same reaction multiple times
    // Include reactorJid in key so different people can react with the same emoji
    const dedupKey = `${props.targetMessageId}:${props.emoji}:${props.reactorJid}`;
    const now = Date.now();
    const lastProcessed = this.recentReactions.get(dedupKey);
    if (lastProcessed && now - lastProcessed < InboundMessageConsumer.REACTION_DEDUP_TTL_MS) {
      console.log(
        `[InboundMessageConsumer] Skipping duplicate reaction (same message+emoji+reactor within TTL): ${dedupKey}`
      );
      return;
    }

    if (isFromMe) {
      // Mark as processed so if Evolution sends a duplicate with fromMe: false, it gets caught
      this.recentReactions.set(dedupKey, now);
      console.log(
        `[InboundMessageConsumer] Skipping fromMe reaction (already saved from UI): ${props.targetMessageId} -> ${props.emoji} from ${props.reactorJid}`
      );
      return;
    }

    this.recentReactions.set(dedupKey, now);

    // Clean up old entries if cache is too large
    if (this.recentReactions.size > InboundMessageConsumer.REACTION_CACHE_MAX_SIZE) {
      for (const [key, time] of this.recentReactions) {
        if (now - time > InboundMessageConsumer.REACTION_DEDUP_TTL_MS) {
          this.recentReactions.delete(key);
        }
      }
      console.log(
        `[InboundMessageConsumer] Cleaned reaction cache, size: ${this.recentReactions.size}`
      );
    }

    try {
      const reactorType = isFromMe ? "attendant" : "contact";
      const reactorId = props.reactorJid.split("@")[0];

      await processInboundMessageReaction({
        io: this.io,
        targetMessageId: props.targetMessageId,
        emoji: props.emoji,
        reactorId,
        reactorName: props.reactorName || reactorId,
        reactorType,
        isRemoval: props.isRemoval,
      });
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to process reaction:", error);
      throw error;
    }
  }

  private async processStatusUpdate(props: OnMessageStatusUpdateProps): Promise<void> {
    if (!this.UpdateMessageStatus) {
      console.error("[InboundMessageConsumer] UpdateMessageStatus not loaded");
      return;
    }

    try {
      const updateMessageStatus = this.UpdateMessageStatus.instance();

      console.log(
        `[InboundMessageConsumer] Processing status update: ${props.messageId} -> ${props.status}`
      );

      const result: UpdateMessageStatusOutput = await updateMessageStatus.execute(props);

      if (!result) {
        console.log(
          `[InboundMessageConsumer] Status update skipped for message: ${props.messageId} (status: ${props.status}, remoteJid: ${props.remoteJid})`
        );
        return;
      }

      const { message, conversationId, workspaceId } = result;

      this.emitToWorkspace(workspaceId, "message:status:update", {
        messageId: message.id,
        status: message.status,
        conversationId,
        workspaceId,
        error: props.error,
      });

      console.log(
        `[InboundMessageConsumer] Status update processed and emitted: ${props.messageId} -> ${props.status}`
      );
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to process status update:", error);
      throw error;
    }
  }

  private async processMessageEdit(props: {
    instanceName: string;
    messageId: string;
    remoteJid: string;
    editedMessage: EvolutionEditedMessageContent;
    messageTimestamp?: number;
  }): Promise<void> {
    const { messageId, editedMessage, messageTimestamp } = props;

    if (!editedMessage) return;

    const newContent =
      editedMessage.message?.conversation ??
      editedMessage.message?.extendedTextMessage?.text;

    if (!newContent) {
      console.log(
        `[InboundMessageConsumer] Message edit without new content: ${messageId}`
      );
      return;
    }

    console.log(
      `[InboundMessageConsumer] Processing message edit: ${messageId} -> "${newContent.substring(0, 50)}"`
    );

    // Se messageTimestamp > 10^12, já está em milissegundos (13 dígitos)
    // Caso contrário, está em segundos (10 dígitos) e precisa multiplicar
    const editedAt = messageTimestamp
      ? new Date(messageTimestamp > 1e12 ? messageTimestamp : messageTimestamp * 1000)
      : new Date();

    try {
      const { MessagesDatabaseRepository } = await import(
        "@omnichannel/core/infra/repositories/messages-repository"
      );
      const { createDatabaseConnection, eq } = await import(
        "@omnichannel/core/infra/database"
      );

      const messagesRepository = MessagesDatabaseRepository.instance();
      const result = await messagesRepository.updateContent(messageId, newContent, editedAt);

      if (!result) {
        console.log(
          `[InboundMessageConsumer] Message not found for edit: ${messageId}`
        );
        return;
      }

      const { conversationId } = result;

      const db = createDatabaseConnection();
      const { conversations } = await import(
        "@omnichannel/core/infra/database/schemas"
      );
      const [conversation] = await db
        .select({ workspaceId: conversations.workspaceId })
        .from(conversations)
        .where(eq(conversations.id, conversationId));

      if (!conversation?.workspaceId) {
        console.log(
          `[InboundMessageConsumer] Workspace not found for conversation: ${conversationId}`
        );
        return;
      }

      this.emitToWorkspace(conversation.workspaceId, "message:edited", {
        messageId,
        conversationId,
        newContent,
        editedAt: editedAt.toISOString(),
      });

      console.log(
        `[InboundMessageConsumer] Message edit processed and emitted: ${messageId}`
      );
    } catch (error) {
      console.error("[InboundMessageConsumer] Failed to process message edit:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.queueHealthCheckInterval) {
      clearInterval(this.queueHealthCheckInterval);
      this.queueHealthCheckInterval = null;
      console.log("[InboundMessageConsumer] Queue health check stopped");
    }
    if (this.consumer) {
      await this.consumer.close();
      console.log("[InboundMessageConsumer] Evolution consumer stopped");
    }
    if (this.metaConsumer) {
      await this.metaConsumer.close();
      console.log("[InboundMessageConsumer] Meta API consumer stopped");
    }
    this.isConsuming = false;
  }

  static create(io: SocketIOServer): InboundMessageConsumer {
    return new InboundMessageConsumer(io);
  }
}

export async function startInboundMessageConsumer(
  io: SocketIOServer
): Promise<InboundMessageConsumer> {
  const consumer = InboundMessageConsumer.create(io);
  await consumer.start();
  return consumer;
}
