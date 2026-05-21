import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MainDatabaseService } from "../database/main-database.service";
import { MessagesRepository } from "../database/messages.repository";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";
import { WhatsAppApiService } from "../channel-apis/whatsapp-api.service";
import { InstagramApiService } from "../channel-apis/instagram-api.service";
import { MediaStorageService } from "./media-storage.service";
import { MediaDownloadResult } from "../channel-apis/channel-api.interface";
import { OutboundChannel } from "../consumers/interfaces/outbound-message.interface";

type ChannelType = OutboundChannel["type"];

interface ChannelInfo {
  id: string;
  type: ChannelType;
  payload: Record<string, unknown>;
}

interface MessageWithBothChannels {
  messageId: string;
  messageType: string;
  content: string;
  mimetype: string | null;
  filename: string | null;
  senderType: "attendant" | "contact";
  remoteJid: string | null;
  mediaPath: string | null;
  receivedChannel: ChannelInfo | null;
  responseChannel: ChannelInfo | null;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly mainDatabaseService: MainDatabaseService,
    private readonly messagesRepository: MessagesRepository,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly whatsAppApiService: WhatsAppApiService,
    private readonly instagramApiService: InstagramApiService,
    private readonly storageService: MediaStorageService
  ) {}

  async downloadMedia(
    messageId: string,
    _channelId: string,
    force?: boolean
  ): Promise<MediaDownloadResult> {
    const message = await this.findMessageWithBothChannels(messageId);

    if (!message) {
      this.logger.warn(`[media:${messageId}] Message not found in database`);
      throw new NotFoundException("Message not found");
    }

    if (!force) {
      const localResult = await this.tryLocalStorage(
        messageId,
        message.mediaPath,
        message.mimetype
      );
      if (localResult) {
        this.logger.log(`[media:${messageId}] Served from local storage`);

        if (localResult.foundViaFallback && localResult.content) {
          this.logger.log(
            `[media:${messageId}] Found via originalId fallback, recaching with compound ID`
          );
          void this.recacheMedia(
            messageId,
            localResult.content,
            localResult.mime ?? "application/octet-stream"
          );
        }

        return localResult;
      }
    } else {
      this.logger.log(
        `[media:${messageId}] Force download requested, skipping local storage`
      );
    }

    this.logger.log(
      `[media:${messageId}] ${force ? "Force re-download" : "Local storage miss"} (mediaPath=${message.mediaPath ?? "null"}), trying channel download`
    );

    const channels = this.getChannelPriorityOrder(message);

    if (channels.length === 0) {
      this.logger.warn(`[media:${messageId}] No channels available for download`);
      return {
        success: false,
        error: "No channels available for media download",
      };
    }

    for (const channel of channels) {
      this.logger.debug(
        `[media:${messageId}] Trying channel ${channel.type} (${channel.id})`
      );

      const result = await this.downloadFromChannel(channel, message);

      if (result.success && result.content) {
        const mime = result.mime ?? message.mimetype ?? "application/octet-stream";
        if (!this.storageService.validateBuffer(result.content, mime)) {
          this.logger.warn(
            `[media:${messageId}] Downloaded buffer is corrupted from ${channel.type} (magic: ${result.content.subarray(0, 4).toString("hex")})`
          );
          continue;
        }

        this.logger.log(
          `[media:${messageId}] Downloaded from ${channel.type}`
        );

        void this.recacheMedia(
          messageId,
          result.content,
          result.mime ?? "application/octet-stream"
        );

        return result;
      }

      this.logger.warn(
        `[media:${messageId}] Failed from ${channel.type}: ${result.error}`
      );
    }

    this.logger.error(
      `[media:${messageId}] All download attempts failed (channels: ${channels.map((c) => c.type).join(", ")})`
    );

    return {
      success: false,
      error: "Failed to download media from all available channels",
    };
  }

  private getChannelPriorityOrder(
    message: MessageWithBothChannels
  ): ChannelInfo[] {
    const channels: ChannelInfo[] = [];

    if (message.senderType === "contact") {
      if (message.receivedChannel) channels.push(message.receivedChannel);
      if (message.responseChannel) channels.push(message.responseChannel);
    } else {
      if (message.responseChannel) channels.push(message.responseChannel);
      if (message.receivedChannel) channels.push(message.receivedChannel);
    }

    const uniqueChannels = channels.filter(
      (channel, index, self) =>
        index === self.findIndex((c) => c.id === channel.id)
    );

    return uniqueChannels;
  }

  private async downloadFromChannel(
    channel: ChannelInfo,
    message: MessageWithBothChannels
  ): Promise<MediaDownloadResult> {
    const outboundChannel: OutboundChannel = {
      id: channel.id,
      type: channel.type,
      payload: channel.payload,
    };

    try {
      switch (channel.type) {
        case "evolution":
          return await this.evolutionApiService.downloadMedia(
            outboundChannel,
            this.extractOriginalMessageId(message.messageId),
            message.mimetype ?? undefined,
            message.remoteJid ?? undefined,
            message.content ?? undefined,
            message.senderType === "attendant"
          );

        case "meta_api":
          return await this.whatsAppApiService.downloadMedia(
            outboundChannel,
            message.content
          );

        case "whatsapp":
          return await this.whatsAppApiService.downloadMedia(
            outboundChannel,
            message.content
          );

        case "instagram":
          return await this.instagramApiService.downloadMedia(
            outboundChannel,
            message.content,
            message.mimetype ?? undefined
          );

        default:
          return {
            success: false,
            error: `Unsupported channel type: ${channel.type}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error downloading from ${channel.type}: ${errorMessage}`
      );
      return { success: false, error: errorMessage };
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

  private async tryLocalStorage(
    messageId: string,
    mediaPath: string | null,
    mimetype: string | null
  ): Promise<(MediaDownloadResult & { foundViaFallback?: boolean }) | null> {
    try {
      let filepath: string | null = null;
      let staleMediaPath = false;

      if (mediaPath) {
        try {
          const content = await this.storageService.read(mediaPath);
          const mime =
            mimetype ?? this.storageService.getMimetypeFromPath(mediaPath);
          return { success: true, content, mime };
        } catch {
          this.logger.log(
            `[media:${messageId}] media_path "${mediaPath}" not found on disk, trying fallback`
          );
          staleMediaPath = true;
        }
      }

      filepath = await this.storageService.exists(messageId);

      if (!filepath) {
        const originalId = this.extractOriginalMessageId(messageId);
        if (originalId !== messageId) {
          filepath = await this.storageService.exists(originalId);
        }
      }

      if (!filepath) {
        return null;
      }

      const content = await this.storageService.read(filepath);
      const mime =
        mimetype ?? this.storageService.getMimetypeFromPath(filepath);

      if (staleMediaPath) {
        this.logger.log(
          `[media:${messageId}] Clearing stale media_path and updating to "${filepath}"`
        );
        void this.messagesRepository
          .updateMediaPath(messageId, filepath)
          .catch((err: unknown) =>
            this.logger.warn(
              `[media:${messageId}] Failed to update stale media_path:`,
              err
            )
          );
      }

      const originalId = this.extractOriginalMessageId(messageId);
      const foundViaFallback = originalId !== messageId && !mediaPath;

      return {
        success: true,
        content,
        mime,
        foundViaFallback,
      };
    } catch (error) {
      this.logger.debug(`Local storage check failed for ${messageId}:`, error);
      return null;
    }
  }

  private async recacheMedia(
    messageId: string,
    buffer: Buffer,
    mimetype: string
  ): Promise<void> {
    try {
      const filepath = await this.storageService.save(messageId, buffer, mimetype);
      await this.messagesRepository.updateMediaPath(messageId, filepath);

      const originalId = this.extractOriginalMessageId(messageId);
      if (originalId !== messageId) {
        await this.messagesRepository.updateMediaPathForSiblings(originalId, filepath);
      }

      this.logger.debug(`Re-cached media on disk: ${messageId}`);
    } catch (error) {
      this.logger.warn(`Failed to re-cache media ${messageId}:`, error);
    }
  }

  private async findMessageWithBothChannels(
    messageId: string
  ): Promise<MessageWithBothChannels | null> {
    const sql = this.mainDatabaseService.getConnection();

    if (!sql) {
      this.logger.warn("Database not available");
      return null;
    }

    try {
      const result = await sql<
        {
          message_id: string;
          message_type: string;
          content: string;
          mimetype: string | null;
          filename: string | null;
          sender_type: string;
          media_path: string | null;
          remote_jid: string | null;
          received_channel_id: string | null;
          received_channel_type: string | null;
          received_channel_payload: Record<string, unknown> | null;
          response_channel_id: string | null;
          response_channel_type: string | null;
          response_channel_payload: Record<string, unknown> | null;
        }[]
      >`
        SELECT
          m.id as message_id,
          m.type as message_type,
          m.content,
          m.mimetype,
          m.filename,
          m.sender_type,
          m.media_path,
          COALESCE(
            c.group_jid,
            pc.value || '@s.whatsapp.net'
          ) as remote_jid,
          ch_recv.id as received_channel_id,
          ch_recv.type as received_channel_type,
          ch_recv.payload as received_channel_payload,
          ch_resp.id as response_channel_id,
          ch_resp.type as response_channel_type,
          ch_resp.payload as response_channel_payload
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        LEFT JOIN partner_contacts pc ON pc.id = c.contact
        LEFT JOIN channels ch_recv ON ch_recv.id = c.received_channel_id
        LEFT JOIN channels ch_resp ON ch_resp.id = c.channel
        WHERE m.id = ${messageId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      const validChannelTypes: ChannelType[] = [
        "whatsapp",
        "instagram",
        "evolution",
        "meta_api",
      ];

      const parseChannelType = (type: string | null): ChannelType => {
        if (type && validChannelTypes.includes(type as ChannelType)) {
          return type as ChannelType;
        }
        return "evolution";
      };

      let receivedChannel: ChannelInfo | null = null;
      if (row.received_channel_id && row.received_channel_payload) {
        receivedChannel = {
          id: row.received_channel_id,
          type: parseChannelType(row.received_channel_type),
          payload: row.received_channel_payload,
        };
      }

      let responseChannel: ChannelInfo | null = null;
      if (row.response_channel_id && row.response_channel_payload) {
        responseChannel = {
          id: row.response_channel_id,
          type: parseChannelType(row.response_channel_type),
          payload: row.response_channel_payload,
        };
      }

      const senderType =
        row.sender_type === "attendant" ? "attendant" : "contact";

      return {
        messageId: row.message_id,
        messageType: row.message_type,
        content: row.content,
        mimetype: row.mimetype,
        filename: row.filename,
        senderType,
        remoteJid: row.remote_jid,
        mediaPath: row.media_path,
        receivedChannel,
        responseChannel,
      };
    } catch (error) {
      this.logger.error(`Error finding message: ${messageId}`, error);
      return null;
    }
  }
}
