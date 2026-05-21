import { Injectable } from "@nestjs/common";

const META_API_TIMEOUT_MS = 30000;
import { ConfigService } from "@nestjs/config";
import { MainDatabaseService } from "../../database/main-database.service";
import { EvolutionApiService } from "../../channel-apis/evolution-api.service";
import { WhatsAppApiService } from "../../channel-apis/whatsapp-api.service";
import { MediaStorageService } from "../../media/media-storage.service";
import {
  GatewayRequest,
  GatewayResponse,
  MediaDownloadPayload,
  MediaUploadPayload,
} from "../interfaces/gateway-request.interface";
import { OutboundChannel } from "../interfaces/outbound-message.interface";
import {
  extractMetaChannelPayload,
  isMetaMediaUploadResponse,
} from "../interfaces/channel-payload.interface";
import { BaseHandler } from "./base.handler";

const MIME_ALIAS_MAP: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "audio/mp3": "audio/mpeg",
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  zip: "application/zip",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

@Injectable()
export class MediaHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly whatsappApi: WhatsAppApiService,
    private readonly storageService: MediaStorageService,
    private readonly configService: ConfigService,
  ) {
    super(mainDatabaseService, MediaHandler.name);
  }

  async handleDownload(
    request: GatewayRequest<MediaDownloadPayload>,
  ): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    if (channel.type === "evolution") {
      const remoteJid = await this.getRemoteJidForMessage(payload.messageId);
      const originalInstanceName = await this.getOriginalInstanceName(
        payload.messageId,
      );

      const effectivePayload = originalInstanceName
        ? { ...channel.payload, instanceName: originalInstanceName }
        : channel.payload;

      this.logger.debug(
        `Media download: messageId=${payload.messageId}, originalInstance=${originalInstanceName ?? "not found"}, channelInstance=${channel.payload.instanceName}`,
      );

      let result = await this.evolutionApi.downloadMedia(
        { id: channel.id, type: "evolution", payload: effectivePayload },
        payload.messageId,
        undefined,
        remoteJid ?? undefined,
      );

      if (
        !result.success &&
        originalInstanceName &&
        originalInstanceName !== channel.payload.instanceName
      ) {
        this.logger.debug(
          `Fallback to channel instance: ${channel.payload.instanceName} (original: ${originalInstanceName})`,
        );
        result = await this.evolutionApi.downloadMedia(
          { id: channel.id, type: "evolution", payload: channel.payload },
          payload.messageId,
          undefined,
          remoteJid ?? undefined,
        );
      }

      if (!result.success) {
        return this.errorResponse(
          correlationId,
          result.error ?? "Download failed",
        );
      }

      return this.successResponse(correlationId, {
        content: result.content?.toString("base64"),
        mime: result.mime,
        filename: result.filename,
      });
    }

    if (
      channel.type === "whatsapp" ||
      channel.type === "meta_api" ||
      channel.type === "instagram"
    ) {
      const channelType = channel.type;
      const mediaIdFromMessage = await this.getMediaIdForMessage(
        payload.messageId,
      );

      if (!mediaIdFromMessage) {
        return this.errorResponse(
          correlationId,
          "Media ID not found for message",
        );
      }

      const metaPayload = extractMetaChannelPayload(channel.payload);
      if (!metaPayload) {
        return this.errorResponse(
          correlationId,
          `Invalid ${channelType} channel payload structure`,
        );
      }

      const accessToken = metaPayload.accessToken;
      if (!accessToken) {
        return this.errorResponse(
          correlationId,
          `Invalid ${channelType} channel payload`,
        );
      }

      const phoneNumberId =
        channelType === "instagram" ? metaPayload.pageId : metaPayload.phoneId;
      if (!phoneNumberId) {
        return this.errorResponse(
          correlationId,
          `Missing phoneId/pageId for ${channelType} channel`,
        );
      }

      const channelPayload: OutboundChannel["payload"] = {
        phoneNumberId,
        accessToken,
      };

      const outboundChannel: OutboundChannel = {
        id: channel.id,
        type: channelType,
        payload: channelPayload,
      };

      const result = await this.whatsappApi.downloadMedia(
        outboundChannel,
        mediaIdFromMessage,
      );

      if (!result.success) {
        return this.errorResponse(
          correlationId,
          result.error ?? "Download failed",
        );
      }

      return this.successResponse(correlationId, {
        content: result.content?.toString("base64"),
        mime: result.mime,
        filename: result.filename,
      });
    }

    return this.errorResponse(
      correlationId,
      `Media download not supported for channel type: ${channel.type}`,
    );
  }

  async handleUpload(
    request: GatewayRequest<MediaUploadPayload>,
  ): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    const buffer = Buffer.from(payload.fileBase64, "base64");
    const normalizedMimeType = this.normalizeUploadMimeType(
      payload.mimeType,
      payload.filename,
    );
    let localMediaPath: string | undefined;

    try {
      if (correlationId) {
        try {
          localMediaPath = await this.storageService.save(
            correlationId,
            buffer,
            normalizedMimeType,
          );
          this.logger.debug(
            `Media saved locally: ${localMediaPath} for correlation ${correlationId}`,
          );
        } catch (saveError) {
          this.logger.warn(
            `Failed to save media locally for ${correlationId}:`,
            saveError,
          );
        }
      }

      if (channel.type === "instagram") {
        const gatewayPublicUrl =
          this.configService.get<string>("GATEWAY_PUBLIC_URL");

        if (!gatewayPublicUrl) {
          this.logger.error(
            "GATEWAY_PUBLIC_URL not configured - cannot upload Instagram media",
          );
          await this.cleanupLocalMediaOnError(localMediaPath);
          return this.errorResponse(
            correlationId,
            "Gateway public URL not configured for Instagram media",
          );
        }

        if (!localMediaPath || !correlationId) {
          return this.errorResponse(
            correlationId,
            "Failed to save media locally for Instagram",
          );
        }

        const publicMediaUrl = `${gatewayPublicUrl}/media/public/${correlationId}`;
        this.logger.debug(
          `Instagram media will use public URL: ${publicMediaUrl}`,
        );

        return this.successResponse(correlationId, {
          mediaId: publicMediaUrl,
          localMediaPath,
        });
      }

      if (channel.type === "whatsapp" || channel.type === "meta_api") {
        const metaPayload = extractMetaChannelPayload(channel.payload);
        if (!metaPayload) {
          await this.cleanupLocalMediaOnError(localMediaPath);
          return this.errorResponse(
            correlationId,
            `Invalid ${channel.type} channel payload structure`,
          );
        }

        const phoneId = metaPayload.phoneId;
        const accessToken = metaPayload.accessToken;
        if (!phoneId || !accessToken) {
          await this.cleanupLocalMediaOnError(localMediaPath);
          return this.errorResponse(
            correlationId,
            `Invalid ${channel.type} channel payload`,
          );
        }

        const formData = new FormData();
        formData.append(
          "file",
          new Blob([buffer], { type: normalizedMimeType }),
          payload.filename,
        );
        formData.append("messaging_product", "whatsapp");

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          META_API_TIMEOUT_MS,
        );

        let response: Response;
        try {
          response = await fetch(
            `https://graph.facebook.com/v23.0/${phoneId}/media`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
              body: formData,
              signal: controller.signal,
            },
          );
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = errorText;
          let errorCode: number | undefined;
          let errorSubcode: number | undefined;

          try {
            const parsed = JSON.parse(errorText);
            const parsedError = parsed?.error ?? parsed;
            if (parsedError) {
              errorMessage = parsedError.message ?? errorMessage;
              errorCode = parsedError.code ?? errorCode;
              errorSubcode = parsedError.error_subcode ?? errorSubcode;
            }
          } catch {}

          const isInvalidToken =
            errorCode === 190 ||
            errorSubcode === 463 ||
            errorSubcode === 467 ||
            /Invalid OAuth access token/i.test(errorMessage);

          if (isInvalidToken) {
            this.logger.error(
              `OAuth token invalid for channel ${channelId} (${channel.type}):`,
              errorMessage,
            );
            await this.cleanupLocalMediaOnError(localMediaPath);
            return this.errorResponse(
              correlationId,
              "CHANNEL_TOKEN_INVALID: Token do canal expirado ou invalido. Reconecte o canal.",
            );
          }

          this.logger.error(
            `Media upload failed for channel ${channelId} (${channel.type}).`,
            errorMessage,
          );
          await this.cleanupLocalMediaOnError(localMediaPath);
          return this.errorResponse(
            correlationId,
            `Upload failed: ${errorMessage}`,
          );
        }

        const data: unknown = await response.json();
        if (!isMetaMediaUploadResponse(data)) {
          await this.cleanupLocalMediaOnError(localMediaPath);
          return this.errorResponse(
            correlationId,
            "Invalid response from Meta API",
          );
        }

        return this.successResponse(correlationId, {
          mediaId: data.id,
          localMediaPath,
        });
      }

      if (channel.type === "evolution") {
        return this.successResponse(correlationId, {
          mediaId: `data:${normalizedMimeType};base64,${payload.fileBase64}`,
          localMediaPath,
        });
      }

      await this.cleanupLocalMediaOnError(localMediaPath);
      return this.errorResponse(
        correlationId,
        `Media upload not supported for channel type: ${channel.type}`,
      );
    } catch (error) {
      await this.cleanupLocalMediaOnError(localMediaPath);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async cleanupLocalMediaOnError(
    localMediaPath: string | undefined,
  ): Promise<void> {
    if (!localMediaPath) return;

    const deleted = await this.storageService.deleteIfExists(localMediaPath);
    if (deleted) {
      this.logger.debug(`Cleaned up local media on error: ${localMediaPath}`);
    }
  }

  private normalizeUploadMimeType(mimeType: string, filename: string): string {
    const normalizedMime = mimeType.trim().toLowerCase();
    if (normalizedMime) {
      return MIME_ALIAS_MAP[normalizedMime] ?? normalizedMime;
    }

    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension && EXTENSION_MIME_MAP[extension]) {
      return EXTENSION_MIME_MAP[extension];
    }

    return "application/octet-stream";
  }

  private async getMediaIdForMessage(
    messageId: string,
  ): Promise<string | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return null;

    try {
      const result = await sql<{ media_id: string | null }[]>`
        SELECT media_id FROM messages WHERE id = ${messageId}
      `;
      return result.length === 0 ? null : result[0].media_id;
    } catch (error) {
      this.logger.error(
        `Error getting media ID for message ${messageId}:`,
        error,
      );
      return null;
    }
  }

  private async getRemoteJidForMessage(
    messageId: string,
  ): Promise<string | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return null;

    try {
      const result = await sql<{ remote_jid: string | null }[]>`
        SELECT COALESCE(c.group_jid, pc.value || '@s.whatsapp.net') as remote_jid
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        LEFT JOIN partner_contacts pc ON pc.id = c.contact
        WHERE m.id = ${messageId}
        LIMIT 1
      `;
      return result.length === 0 ? null : result[0].remote_jid;
    } catch (error) {
      this.logger.error(
        `Error getting remoteJid for message: ${messageId}`,
        error,
      );
      return null;
    }
  }

  private async getOriginalInstanceName(
    messageId: string,
  ): Promise<string | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return null;

    try {
      const result = await sql<{ instance_name: string }[]>`
        SELECT instance_name FROM processed_messages WHERE message_id = ${messageId} LIMIT 1
      `;
      return result.length === 0 ? null : result[0].instance_name;
    } catch (error) {
      this.logger.warn(
        `Failed to get original instance for message ${messageId}:`,
        error,
      );
      return null;
    }
  }
}
