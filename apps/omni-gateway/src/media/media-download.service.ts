import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";
import { InstagramApiService } from "../channel-apis/instagram-api.service";
import { WhatsAppApiService } from "../channel-apis/whatsapp-api.service";
import { MessagesRepository } from "../database/messages.repository";
import { ChannelsRepository } from "../database/channels.repository";
import { RedisService } from "../database/redis.service";
import { MediaStorageService } from "./media-storage.service";
import { OutboundChannel } from "../consumers/interfaces/outbound-message.interface";
import { MediaDownloadResult } from "../channel-apis/channel-api.interface";

interface DownloadRequest {
  messageId: string;
  content?: string;
  remoteJid: string;
  mimetype?: string;
  channelId?: string;
  channelType?: string;
  channelPayload?: Record<string, unknown>;
  instanceName?: string;
  fromMe?: boolean;
  attempt?: number;
  enqueuedAt?: number;
}

const DOWNLOAD_QUEUE_KEY = "media:download:queue";
const PROCESSING_SET_KEY = "media:download:processing";
const FAILED_SET_KEY = "media:download:failed";

@Injectable()
export class MediaDownloadService implements OnModuleInit {
  private readonly logger = new Logger(MediaDownloadService.name);
  private readonly inMemoryQueue: Map<string, Promise<void>> = new Map();
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly autoDownloadEnabled: boolean;
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly instagramApi: InstagramApiService,
    private readonly whatsAppApi: WhatsAppApiService,
    private readonly storageService: MediaStorageService,
    private readonly messagesRepository: MessagesRepository,
    private readonly redisService: RedisService,
  ) {
    this.maxRetries = this.configService.get<number>("media.maxRetries") ?? 3;
    this.retryDelayMs =
      this.configService.get<number>("media.retryDelayMs") ?? 2000;
    this.autoDownloadEnabled =
      this.configService.get<boolean>("media.autoDownload") ?? true;
  }

  async onModuleInit(): Promise<void> {
    await this.recoverStuckProcessing();
  }

  private async recoverStuckProcessing(): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const stuckItems = await redis.smembers(PROCESSING_SET_KEY);

      if (stuckItems.length > 0) {
        this.logger.log(
          `Recovering ${stuckItems.length} stuck downloads from previous run`,
        );

        for (const item of stuckItems) {
          const request = JSON.parse(item) as DownloadRequest;
          const nextRetryTime = Date.now();
          await redis.zadd(
            DOWNLOAD_QUEUE_KEY,
            nextRetryTime,
            JSON.stringify(request),
          );
        }

        await redis.del(PROCESSING_SET_KEY);
      }
    } catch (error) {
      this.logger.error("Error recovering stuck downloads:", error);
    }
  }

  async enqueueDownload(request: DownloadRequest): Promise<void> {
    if (!this.autoDownloadEnabled) {
      this.logger.debug(
        `Auto-download disabled, skipping: ${request.messageId}`,
      );
      return;
    }

    if (this.inMemoryQueue.has(request.messageId)) {
      this.logger.debug(
        `Download already in memory queue for: ${request.messageId}`,
      );
      return;
    }

    const existingPath = await this.storageService.exists(request.messageId);
    if (existingPath) {
      this.logger.debug(`Media already exists locally: ${request.messageId}`);
      return;
    }

    const downloadRequest: DownloadRequest = {
      ...request,
      attempt: request.attempt ?? 0,
      enqueuedAt: Date.now(),
    };

    try {
      const redis = this.redisService.getClient();
      const nextRetryTime = Date.now();
      await redis.zadd(
        DOWNLOAD_QUEUE_KEY,
        nextRetryTime,
        JSON.stringify(downloadRequest),
      );
      this.logger.debug(`Enqueued download for: ${request.messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue download to Redis: ${request.messageId}`,
        error,
      );
      this.processImmediately(downloadRequest);
    }
  }

  private processImmediately(request: DownloadRequest): void {
    const downloadPromise = this.processDownload(request);
    this.inMemoryQueue.set(request.messageId, downloadPromise);

    downloadPromise.finally(() => {
      this.inMemoryQueue.delete(request.messageId);
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const redis = this.redisService.getClient();
      const now = Date.now();

      const items = await redis.zrangebyscore(
        DOWNLOAD_QUEUE_KEY,
        "-inf",
        now,
        "LIMIT",
        0,
        5,
      );

      if (items.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${items.length} downloads from queue`);

      for (const item of items) {
        const request = JSON.parse(item) as DownloadRequest;

        await redis.zrem(DOWNLOAD_QUEUE_KEY, item);
        await redis.sadd(PROCESSING_SET_KEY, item);

        try {
          await this.processDownload(request);
          await redis.srem(PROCESSING_SET_KEY, item);
        } catch (error) {
          await redis.srem(PROCESSING_SET_KEY, item);

          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const newAttempt = (request.attempt ?? 0) + 1;

          // TODO: Future enhancement - for Evolution channels, could try alternative
          // instances from the same workspace before giving up. Would require:
          // 1. Injecting ChannelsRepository or MainDatabaseService
          // 2. Query: SELECT instance_name FROM channels WHERE workspace_id = ? AND type = 'evolution' AND status = 'connected'
          // 3. Update request.channelPayload.instanceName with alternative instance
          // This would improve resilience when one Evolution instance is down but others work.

          if (newAttempt < this.maxRetries) {
            const backoffDelay = this.retryDelayMs * Math.pow(2, newAttempt);
            const nextRetryTime = Date.now() + backoffDelay;

            const retryRequest: DownloadRequest = {
              ...request,
              attempt: newAttempt,
            };

            await redis.zadd(
              DOWNLOAD_QUEUE_KEY,
              nextRetryTime,
              JSON.stringify(retryRequest),
            );

            const channelInfo =
              request.channelType === "evolution"
                ? ` (Evolution instance: ${request.channelPayload?.instanceName ?? request.instanceName ?? "unknown"})`
                : "";

            this.logger.warn(
              `Scheduled retry ${newAttempt}/${this.maxRetries} for ${request.messageId}${channelInfo} in ${backoffDelay}ms - Error: ${errorMessage}`,
            );
          } else {
            await redis.sadd(FAILED_SET_KEY, item);

            const channelInfo =
              request.channelType === "evolution"
                ? ` via Evolution instance: ${request.channelPayload?.instanceName ?? request.instanceName ?? "unknown"}`
                : "";

            this.logger.error(
              `Media download permanently failed after ${this.maxRetries} attempts: ${request.messageId}${channelInfo} - Last error: ${errorMessage}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error("Error processing download queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDownload(request: DownloadRequest): Promise<void> {
    const { messageId, remoteJid, mimetype } = request;

    const effectiveChannelType = request.channelType ?? "evolution";
    const effectivePayload = request.channelPayload ?? {
      instanceName: request.instanceName,
    };
    const effectiveContent = request.content ?? "";

    if (!request.channelType) {
      this.logger.debug(
        `Using default channelType "evolution" for message: ${messageId}`,
      );
    }

    this.logger.debug(
      `Downloading media: ${messageId} via ${effectiveChannelType} (attempt ${(request.attempt ?? 0) + 1}/${this.maxRetries})`,
    );

    const channel: OutboundChannel = {
      id: request.channelId ?? "",
      type: effectiveChannelType as OutboundChannel["type"],
      payload: effectivePayload,
    };

    let result: MediaDownloadResult;

    switch (effectiveChannelType) {
      case "evolution":
        result = await this.evolutionApi.downloadMedia(
          channel,
          messageId,
          mimetype,
          remoteJid,
          effectiveContent || undefined,
          request.fromMe ?? false,
        );
        break;

      case "meta_api":
      case "whatsapp":
        result = await this.whatsAppApi.downloadMedia(
          channel,
          effectiveContent,
        );
        break;

      case "instagram":
        result = await this.instagramApi.downloadMedia(
          channel,
          effectiveContent,
          mimetype,
        );
        break;

      default:
        throw new Error(`Unsupported channel type: ${effectiveChannelType}`);
    }

    if (!result.success || !result.content) {
      throw new Error(result.error ?? "Download failed");
    }

    const filepath = await this.storageService.save(
      messageId,
      result.content,
      result.mime ?? mimetype ?? "application/octet-stream",
    );

    await this.updateMessageMediaPath(messageId, filepath);
    await this.updateSiblingsMediaPath(messageId, filepath);

    this.logger.log(
      `Media downloaded successfully: ${messageId} -> ${filepath}`,
    );
  }

  private async updateMessageMediaPath(
    messageId: string,
    filepath: string,
  ): Promise<void> {
    await this.messagesRepository.updateMediaPath(messageId, filepath);
  }

  private async updateSiblingsMediaPath(
    messageId: string,
    filepath: string,
  ): Promise<void> {
    const originalId = this.extractOriginalMessageId(messageId);
    if (originalId === messageId) return;

    try {
      await this.messagesRepository.updateMediaPathForSiblings(
        originalId,
        filepath,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to update siblings media_path for ${messageId}:`,
        error,
      );
    }
  }

  private extractOriginalMessageId(messageId: string): string {
    const colonIndex = messageId.indexOf(":");
    if (colonIndex > 0) {
      const suffix = messageId.substring(colonIndex + 1);
      if (suffix.includes("-")) {
        return messageId.substring(0, colonIndex);
      }
    }
    return messageId;
  }

  async getQueueSize(): Promise<number> {
    try {
      const redis = this.redisService.getClient();
      return await redis.zcard(DOWNLOAD_QUEUE_KEY);
    } catch {
      return this.inMemoryQueue.size;
    }
  }

  async getFailedCount(): Promise<number> {
    try {
      const redis = this.redisService.getClient();
      return await redis.scard(FAILED_SET_KEY);
    } catch {
      return 0;
    }
  }

  isInQueue(messageId: string): boolean {
    return this.inMemoryQueue.has(messageId);
  }

  async retryFailed(): Promise<number> {
    try {
      const redis = this.redisService.getClient();
      const failedItems = await redis.smembers(FAILED_SET_KEY);

      if (failedItems.length === 0) {
        return 0;
      }

      const now = Date.now();

      for (const item of failedItems) {
        const request = JSON.parse(item) as DownloadRequest;
        const resetRequest: DownloadRequest = {
          ...request,
          attempt: 0,
          enqueuedAt: now,
        };

        await redis.zadd(DOWNLOAD_QUEUE_KEY, now, JSON.stringify(resetRequest));
        await redis.srem(FAILED_SET_KEY, item);
      }

      this.logger.log(`Re-queued ${failedItems.length} failed downloads`);
      return failedItems.length;
    } catch (error) {
      this.logger.error("Error retrying failed downloads:", error);
      return 0;
    }
  }

  async recoverExistingMedia(limit = 50): Promise<{
    found: number;
    enqueued: number;
    skipped: number;
  }> {
    this.logger.log(`Starting media recovery scan (limit: ${limit})`);

    const messages =
      await this.messagesRepository.findMessagesNeedingMediaRecovery(limit);

    if (messages.length === 0) {
      this.logger.log("No messages found needing media recovery");
      return { found: 0, enqueued: 0, skipped: 0 };
    }

    this.logger.log(`Found ${messages.length} messages needing media recovery`);

    let enqueued = 0;
    let skipped = 0;

    for (const msg of messages) {
      if (!msg.channelId || !msg.channelPayload) {
        this.logger.warn(`Skipping ${msg.id}: no channel info found`);
        skipped++;
        continue;
      }

      const existingPath = await this.storageService.exists(msg.id);
      if (existingPath) {
        this.logger.debug(`Media already exists locally: ${msg.id}`);
        await this.messagesRepository.updateMediaPath(msg.id, existingPath);
        skipped++;
        continue;
      }

      const downloadRequest: DownloadRequest = {
        messageId: msg.id,
        content: msg.content ?? "",
        remoteJid: msg.remoteJid ?? "",
        mimetype: msg.mimetype ?? undefined,
        channelId: msg.channelId,
        channelType: msg.channelType,
        channelPayload: msg.channelPayload,
        attempt: 0,
        enqueuedAt: Date.now(),
      };

      try {
        const redis = this.redisService.getClient();
        await redis.zadd(
          DOWNLOAD_QUEUE_KEY,
          Date.now(),
          JSON.stringify(downloadRequest),
        );
        enqueued++;
        this.logger.debug(
          `Enqueued recovery for: ${msg.id} via ${msg.channelType}`,
        );
      } catch (error) {
        this.logger.error(`Failed to enqueue recovery: ${msg.id}`, error);
        skipped++;
      }
    }

    this.logger.log(
      `Media recovery complete: found=${messages.length}, enqueued=${enqueued}, skipped=${skipped}`,
    );

    return { found: messages.length, enqueued, skipped };
  }
}
