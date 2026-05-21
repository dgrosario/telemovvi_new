import { Injectable, Logger } from "@nestjs/common";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import { WhatsAppTransformer } from "../transformers/whatsapp.transformer";
import {
  InstagramTransformer,
  InstagramWebhookPayload,
} from "../transformers/instagram.transformer";
import { MainDatabaseService } from "../database/main-database.service";
import { MediaDownloadService } from "../media/media-download.service";
import { MetaMessagesUpsertData } from "../publishers/interfaces/meta-event.interface";
import { WebhookLogsRepository } from "../database/webhook-logs.repository";

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: {
            id: string;
            mime_type: string;
            sha256: string;
            caption?: string;
          };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: {
            id: string;
            mime_type: string;
            filename?: string;
            caption?: string;
          };
          sticker?: { id: string; mime_type: string };
          reaction?: { message_id: string; emoji?: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
          context?: { id?: string; message_id?: string; from?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

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
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly publisher: RabbitMQPublisherService,
    private readonly whatsappTransformer: WhatsAppTransformer,
    private readonly instagramTransformer: InstagramTransformer,
    private readonly mainDatabaseService: MainDatabaseService,
    private readonly mediaDownloadService: MediaDownloadService,
    private readonly webhookLogsRepository: WebhookLogsRepository
  ) {}

  async handleWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    this.logger.debug("Processing WhatsApp webhook");

    const startTime = Date.now();
    const logId = await this.webhookLogsRepository.save({
      channelType: "whatsapp",
      payload: payload as unknown as Record<string, unknown>,
      phoneNumberId:
        payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id,
    });

    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") {
            continue;
          }

          const value = change.value;

          if (value.messages && value.messages.length > 0) {
            const messages =
              this.whatsappTransformer.transformMessagesUpsert(value);

            for (const message of messages) {
              const success = await this.publisher.publish(message);

              if (success) {
                this.logger.log(
                  `Published WhatsApp message: ${message.data.key.id}`
                );

                if (message.event === "messages.upsert") {
                  await this.enqueueMediaDownloadIfNeeded(
                    value,
                    message.data as MetaMessagesUpsertData
                  );
                }
              } else {
                this.logger.error(
                  `Failed to publish WhatsApp message: ${message.data.key.id}`
                );
                throw new Error(`Failed to publish WhatsApp message: ${message.data.key.id}`);
              }
            }
          }

          if (value.statuses && value.statuses.length > 0) {
            const updates =
              this.whatsappTransformer.transformMessagesUpdate(value);

            for (const update of updates) {
              const success = await this.publisher.publish(update);

              if (success) {
                this.logger.log(
                  `Published WhatsApp status update: ${update.data.key.id}`
                );
              } else {
                this.logger.error(
                  `Failed to publish WhatsApp status update: ${update.data.key.id}`
                );
                throw new Error(`Failed to publish WhatsApp status update: ${update.data.key.id}`);
              }
            }
          }
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
      throw error;
    }
  }

  async handleInstagramWebhook(
    payload: InstagramWebhookPayload
  ): Promise<void> {
    this.logger.debug("Processing Instagram webhook");

    const messages =
      await this.instagramTransformer.transformMessagesUpsert(payload);

    for (const message of messages) {
      const success = await this.publisher.publish(message);
      const eventReference = getInstagramEventReference(message);

      if (success) {
        this.logger.log(
          `Published Instagram ${message.event}: ${eventReference}`
        );
      } else {
        this.logger.error(
          `Failed to publish Instagram ${message.event}: ${eventReference}`
        );
        throw new Error(
          `Failed to publish Instagram ${message.event}: ${eventReference}`
        );
      }
    }
  }

  private async enqueueMediaDownloadIfNeeded(
    value: WhatsAppWebhookPayload["entry"][0]["changes"][0]["value"],
    data: MetaMessagesUpsertData
  ): Promise<void> {
    const mediaInfo = this.extractMediaInfo(data);
    if (!mediaInfo) {
      return;
    }

    const { mediaId, mimetype } = mediaInfo;
    const phoneNumberId = value.metadata.phone_number_id;

    this.logger.debug(
      `WhatsApp media message detected: ${data.key.id} (mediaId: ${mediaId}) - triggering download`
    );

    try {
      const channelInfo = await this.getChannelInfoByPhoneNumberId(phoneNumberId);
      if (!channelInfo) {
        this.logger.warn(
          `Could not get channel info for media download: ${data.key.id} (phoneId: ${phoneNumberId})`
        );
        return;
      }

      await this.mediaDownloadService.enqueueDownload({
        messageId: data.key.id,
        content: mediaId,
        remoteJid: data.key.remoteJid,
        mimetype,
        channelId: channelInfo.id,
        channelType: "whatsapp",
        channelPayload: { accessToken: channelInfo.accessToken },
      });

      this.logger.log(`Enqueued WhatsApp media download: ${data.key.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue WhatsApp media download: ${data.key.id}`,
        error
      );
    }
  }

  private extractMediaInfo(
    data: MetaMessagesUpsertData
  ): { mediaId: string; mimetype?: string } | null {
    const { message } = data;

    if (message.imageMessage?.mediaKey) {
      return {
        mediaId: message.imageMessage.mediaKey,
        mimetype: message.imageMessage.mimetype,
      };
    }

    if (message.audioMessage?.mediaKey) {
      return {
        mediaId: message.audioMessage.mediaKey,
        mimetype: message.audioMessage.mimetype,
      };
    }

    if (message.videoMessage?.mediaKey) {
      return {
        mediaId: message.videoMessage.mediaKey,
        mimetype: message.videoMessage.mimetype,
      };
    }

    if (message.documentMessage?.mediaKey) {
      return {
        mediaId: message.documentMessage.mediaKey,
        mimetype: message.documentMessage.mimetype,
      };
    }

    if (message.stickerMessage?.mediaKey) {
      return {
        mediaId: message.stickerMessage.mediaKey,
        mimetype: message.stickerMessage.mimetype,
      };
    }

    return null;
  }

  private async getChannelInfoByPhoneNumberId(
    phoneNumberId: string
  ): Promise<{ id: string; accessToken: string } | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.error("Database connection not available");
      return null;
    }

    try {
      const channels = await sql<
        Array<{ id: string; payload: Record<string, unknown> }>
      >`
        SELECT id, payload
        FROM channels
        WHERE type = 'whatsapp'
          AND status = 'connected'
          AND payload->>'phoneId' = ${phoneNumberId}
        LIMIT 1
      `;

      if (channels.length === 0) {
        this.logger.warn(
          `No WhatsApp channel found for phoneId: ${phoneNumberId}`
        );
        return null;
      }

      const channel = channels[0];
      const accessToken = channel.payload?.accessToken as string | undefined;

      if (!accessToken) {
        this.logger.warn(
          `WhatsApp channel ${channel.id} has no accessToken in payload`
        );
        return null;
      }

      return { id: channel.id, accessToken };
    } catch (error) {
      this.logger.error(
        `Error getting WhatsApp channel info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return null;
    }
  }
}
