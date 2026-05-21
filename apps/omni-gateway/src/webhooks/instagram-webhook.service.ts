import { Injectable, Logger } from "@nestjs/common";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import {
  InstagramTransformer,
  InstagramWebhookPayload,
} from "../transformers/instagram.transformer";
import { MainDatabaseService } from "../database/main-database.service";
import { MediaDownloadService } from "../media/media-download.service";
import { WebhookLogsRepository } from "../database/webhook-logs.repository";

function getInstagramEventReference(
  message: Awaited<ReturnType<InstagramTransformer["transformMessagesUpsert"]>>[number]
): string {
  if ("messageId" in message.data) {
    return message.data.messageId;
  }

  if ("targetMessageId" in message.data) {
    return message.data.targetMessageId;
  }

  return "unknown";
}

@Injectable()
export class InstagramWebhookService {
  private readonly logger = new Logger(InstagramWebhookService.name);

  constructor(
    private readonly publisher: RabbitMQPublisherService,
    private readonly instagramTransformer: InstagramTransformer,
    private readonly mainDatabaseService: MainDatabaseService,
    private readonly mediaDownloadService: MediaDownloadService,
    private readonly webhookLogsRepository: WebhookLogsRepository
  ) {}

  async handleWebhook(payload: InstagramWebhookPayload): Promise<void> {
    this.logger.log("Processing Instagram webhook");
    this.logger.debug(`Full webhook payload: ${JSON.stringify(payload, null, 2)}`);

    const pageIds = payload.entry?.map(e => e.id).join(', ') || 'none';
    this.logger.log(`Webhook received for pageId(s): ${pageIds}`);

    const startTime = Date.now();
    const logId = await this.webhookLogsRepository.save({
      channelType: "instagram",
      payload: payload as unknown as Record<string, unknown>,
    });

    try {
      const messages = await this.instagramTransformer.transformMessagesUpsert(payload);

      this.logger.debug(`Transformed ${messages.length} messages from webhook`);

      for (const message of messages) {
        const senderId = 'senderId' in message.data ? message.data.senderId : 'unknown';
        const eventReference = getInstagramEventReference(message);
        
        this.logger.debug(
          `Processing Instagram event - instance: ${message.instance}, senderId: ${senderId}, reference: ${eventReference}, event: ${message.event}`
        );

        // Validate that the Instagram channel exists
        let channelExists = await this.validateInstagramChannel(message.instance);

        if (!channelExists) {
          // Try to auto-update channel with the correct pageId from webhook
          this.logger.warn(
            `Instagram channel not found for pageId: ${message.instance}. Attempting auto-update...`
          );
          
          const updated = await this.autoUpdateChannelPageId(message.instance);
          
          if (updated) {
            this.logger.log(`✓ Auto-updated channel with pageId: ${message.instance}`);
            channelExists = true;
          } else {
            this.logger.warn(
              `Could not auto-update channel. Skipping message.`
            );
            continue;
          }
        }

        const success = await this.publisher.publish(message);

        if (success) {
          const senderId = 'senderId' in message.data ? message.data.senderId : 'unknown';
          this.logger.log(
            `Published Instagram ${message.event}: ${eventReference} from ${senderId}`
          );

          // Enqueue media download for non-text messages
          if (
            message.event === "messages.upsert" &&
            "mediaUrl" in message.data &&
            "senderId" in message.data
          ) {
            await this.enqueueMediaDownloadIfNeeded(message.instance, message.data);
          }
        } else {
          this.logger.error(
            `Failed to publish Instagram ${message.event}: ${eventReference}`
          );
        }
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
      this.logger.error(
        `Error processing Instagram webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  private async autoUpdateChannelPageId(webhookPageId: string): Promise<boolean> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      return false;
    }

    try {
      // Find a connected Instagram channel that doesn't have this pageId
      // but has a recent connection (within last hour)
      const recentChannels = await sql<Array<{ id: string; payload: Record<string, unknown> }>>`
        SELECT id, payload
        FROM channels
        WHERE type = 'instagram'
          AND status = 'connected'
          AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (recentChannels.length === 0) {
        this.logger.warn("No recent Instagram channels found for auto-update");
        return false;
      }

      const channel = recentChannels[0];
      const updatedPayload = {
        ...channel.payload,
        pageId: webhookPageId,
        instagramBusinessAccountId: webhookPageId,
        autoUpdated: true,
        autoUpdatedAt: new Date().toISOString(),
      };

      await sql`
        UPDATE channels
        SET payload = ${sql.json(updatedPayload)}
        WHERE id = ${channel.id}
      `;

      this.logger.log(
        `Auto-updated channel ${channel.id} with pageId from webhook: ${webhookPageId}`
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Error auto-updating channel pageId: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return false;
    }
  }

  private async validateInstagramChannel(pageId: string): Promise<boolean> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.error("Database connection not available");
      return false;
    }

    try {
      // Try to find channel by pageId or igUserId
      // Instagram can send different IDs in webhooks
      const channels = await sql<Array<{ id: string; payload: Record<string, unknown> }>>`
        SELECT id, payload
        FROM channels
        WHERE type = 'instagram'
          AND status = 'connected'
          AND (
            payload->>'pageId' = ${pageId}
            OR payload->>'igUserId' = ${pageId}
          )
        LIMIT 1
      `;

      if (channels.length > 0) {
        this.logger.debug(
          `Found Instagram channel ${channels[0].id} for pageId/igUserId: ${pageId}`
        );
        return true;
      }

      this.logger.warn(
        `No Instagram channel found for pageId/igUserId: ${pageId}. Available channels should be checked.`
      );
      return false;
    } catch (error) {
      this.logger.error(
        `Error validating Instagram channel: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return false;
    }
  }

  private async enqueueMediaDownloadIfNeeded(
    pageId: string,
    data: {
      messageId: string;
      senderId: string;
      type: string;
      mediaUrl?: string;
      mimetype?: string;
    }
  ): Promise<void> {
    const { type: messageType, mediaUrl, messageId, senderId, mimetype } = data;

    // Only enqueue for media messages
    if (messageType === "text" || !mediaUrl) {
      return;
    }

    this.logger.debug(
      `Media message detected: ${messageId} (${messageType}) - triggering download`
    );

    try {
      // Get channel info for accessToken
      const channelInfo = await this.getChannelInfo(pageId);
      if (!channelInfo) {
        this.logger.warn(
          `Could not get channel info for media download: ${messageId}`
        );
        return;
      }

      await this.mediaDownloadService.enqueueDownload({
        messageId,
        content: mediaUrl,
        remoteJid: senderId,
        mimetype,
        channelId: channelInfo.id,
        channelType: "instagram",
        channelPayload: { accessToken: channelInfo.accessToken },
      });

      this.logger.log(`Enqueued Instagram media download: ${messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue Instagram media download: ${messageId}`,
        error
      );
    }
  }

  private async getChannelInfo(
    pageId: string
  ): Promise<{ id: string; accessToken: string } | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      return null;
    }

    try {
      const channels = await sql<
        Array<{ id: string; payload: Record<string, unknown> }>
      >`
        SELECT id, payload
        FROM channels
        WHERE type = 'instagram'
          AND status = 'connected'
          AND (
            payload->>'pageId' = ${pageId}
            OR payload->>'igUserId' = ${pageId}
          )
        LIMIT 1
      `;

      if (channels.length === 0) {
        return null;
      }

      const channel = channels[0];
      const accessToken = channel.payload?.accessToken as string | undefined;

      if (!accessToken) {
        return null;
      }

      return { id: channel.id, accessToken };
    } catch (error) {
      this.logger.error(
        `Error getting channel info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return null;
    }
  }
}
