import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import CircuitBreaker from "opossum";
import { CircuitBreakerService } from "../circuit-breaker";
import { OutboundChannel } from "../consumers/interfaces/outbound-message.interface";
import { MediaDownloadResult } from "./channel-api.interface";

const MEDIA_DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

interface InstagramResponse {
  recipient_id: string;
  message_id: string;
}

interface RequestParams {
  path: string;
  accessToken: string;
  body: unknown;
}

@Injectable()
export class InstagramApiService implements OnModuleInit {
  private readonly logger = new Logger(InstagramApiService.name);
  private readonly baseUrl = "https://graph.instagram.com/v21.0";
  private requestBreaker!: CircuitBreaker<[RequestParams], InstagramResponse>;

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  onModuleInit(): void {
    this.requestBreaker = this.circuitBreakerService.create<
      [RequestParams],
      InstagramResponse
    >("instagram-api", (params: RequestParams) => this.executeRequest(params));
  }

  async sendTextMessage(
    channel: OutboundChannel,
    to: string,
    content: string,
    quotedOrTag?: { key: { id: string; remoteJid: string; fromMe: boolean } } | "HUMAN_AGENT"
  ): Promise<string> {
    const { pageId, accessToken } = this.validatePayload(channel);

    const body: {
      recipient: { id: string };
      message: { text: string };
      tag?: string;
    } = {
      recipient: { id: to },
      message: { text: content },
    };

    if (quotedOrTag === "HUMAN_AGENT") {
      body.tag = quotedOrTag;
    }

    const response = await this.request(`/${pageId}/messages`, accessToken, body);

    return response.message_id;
  }

  async sendMediaMessage(
    channel: OutboundChannel,
    to: string,
    mediaIdOrUrl: string,
    type: "audio" | "image" | "document" | "video",
    _caption?: string,
    _filename?: string,
    _mimeType?: string,
    quotedOrTag?: { key: { id: string; remoteJid: string; fromMe: boolean } } | "HUMAN_AGENT"
  ): Promise<string> {
    const { pageId, accessToken } = this.validatePayload(channel);

    const attachmentType = this.mapMediaType(type);

    // Instagram API aceita tanto URL quanto media_id (do upload)
    // Se começa com http, é URL; caso contrário, é media_id
    const isUrl = mediaIdOrUrl.startsWith("http");
    
    const body: {
      recipient: { id: string };
      message: { attachment: { type: string; payload: { url?: string; attachment_id?: string } } };
      tag?: string;
    } = {
      recipient: { id: to },
      message: {
        attachment: {
          type: attachmentType,
          payload: isUrl ? { url: mediaIdOrUrl } : { attachment_id: mediaIdOrUrl },
        },
      },
    };

    if (quotedOrTag === "HUMAN_AGENT") {
      body.tag = quotedOrTag;
    }

    const response = await this.request(`/${pageId}/messages`, accessToken, body);

    return response.message_id;
  }

  private validatePayload(channel: OutboundChannel): {
    pageId: string;
    accessToken: string;
  } {
    const { pageId, accessToken } = channel.payload;

    if (!pageId) {
      throw new Error("Instagram channel requires pageId");
    }

    if (!accessToken) {
      throw new Error("Instagram channel requires accessToken");
    }

    return { pageId, accessToken };
  }

  private mapMediaType(
    type: "audio" | "image" | "document" | "video"
  ): "image" | "video" | "audio" | "file" {
    if (type === "document") {
      return "file";
    }
    return type;
  }

  private async request(
    path: string,
    accessToken: string,
    body: unknown
  ): Promise<InstagramResponse> {
    return this.requestBreaker.fire({ path, accessToken, body });
  }

  private async executeRequest(params: RequestParams): Promise<InstagramResponse> {
    const url = `${this.baseUrl}${params.path}`;

    this.logger.debug(`POST ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Instagram API error: ${error}`);
      throw new Error(`Instagram API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<InstagramResponse>;
  }

  /**
   * Downloads media from Instagram CDN URL
   * Instagram media URLs (lookaside.fbsbx.com) are directly accessible
   * but expire after some time
   * @param _channel - Channel (not used for Instagram direct CDN downloads)
   * @param mediaUrl - Instagram CDN URL (lookaside.fbsbx.com)
   * @param mimetype - Optional mimetype hint
   */
  async downloadMedia(
    _channel: OutboundChannel,
    mediaUrl: string,
    mimetype?: string
  ): Promise<MediaDownloadResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

    try {
      if (!mediaUrl || !mediaUrl.startsWith("http")) {
        this.logger.debug(`Invalid or missing media URL for Instagram download`);
        return {
          success: false,
          error: "MEDIA_UNAVAILABLE",
        };
      }

      this.logger.debug(`Downloading Instagram media from: ${mediaUrl.substring(0, 100)}...`);

      const response = await fetch(mediaUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/*,video/*,audio/*,*/*",
          "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          this.logger.warn(`Instagram media unavailable (${response.status}): ${mediaUrl.substring(0, 80)}...`);
          return {
            success: false,
            error: "MEDIA_UNAVAILABLE",
          };
        }

        this.logger.error(`Failed to download Instagram media: ${response.status}`);
        return {
          success: false,
          error: "MEDIA_UNAVAILABLE",
        };
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_MEDIA_SIZE_BYTES) {
          this.logger.error(
            `Instagram media too large: ${size} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
          );
          return { success: false, error: `Media too large: ${size} bytes` };
        }
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/html")) {
        this.logger.warn(`Instagram returned HTML instead of media (likely expired): ${mediaUrl.substring(0, 80)}...`);
        return {
          success: false,
          error: "MEDIA_UNAVAILABLE",
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length < 100) {
        this.logger.warn(`Instagram media too small (${buffer.length} bytes), likely invalid`);
        return {
          success: false,
          error: "MEDIA_UNAVAILABLE",
        };
      }

      if (buffer.length > MAX_MEDIA_SIZE_BYTES) {
        this.logger.error(
          `Downloaded Instagram media too large: ${buffer.length} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
        );
        return { success: false, error: `Media too large: ${buffer.length} bytes` };
      }

      let finalMimeType = contentType || mimetype || "application/octet-stream";
      if (finalMimeType === "application/octet-stream" || !finalMimeType) {
        finalMimeType = this.detectMimeFromMagicBytes(buffer) ?? mimetype ?? "application/octet-stream";
      }

      const filename = this.extractFilenameFromUrl(mediaUrl, finalMimeType);

      this.logger.log(`Successfully downloaded Instagram media: ${buffer.length} bytes, type: ${finalMimeType}`);

      return {
        success: true,
        content: buffer,
        mime: finalMimeType,
        filename,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error(`Instagram media download timeout after ${MEDIA_DOWNLOAD_TIMEOUT_MS}ms`);
        return { success: false, error: "Download timeout" };
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error downloading Instagram media: ${errorMessage}`);

      return {
        success: false,
        error: "MEDIA_UNAVAILABLE",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Detect MIME type from magic bytes (file signature)
   */
  private detectMimeFromMagicBytes(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return "image/jpeg";
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return "image/png";
    }

    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return "image/gif";
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return "image/webp";
    }

    // MP4: ftyp at offset 4
    if (buffer.length > 11 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return "video/mp4";
    }

    // MP3: ID3 or FF FB/FA/F3/F2
    if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
        (buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xFA || buffer[1] === 0xF3 || buffer[1] === 0xF2))) {
      return "audio/mpeg";
    }

    // OGG: 4F 67 67 53
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return "audio/ogg";
    }

    return null;
  }

  private extractFilenameFromUrl(url: string, contentType: string): string {
    // Try to extract asset_id from Instagram CDN URL
    const assetIdMatch = url.match(/asset_id=(\d+)/);
    const assetId = assetIdMatch ? assetIdMatch[1] : Date.now().toString();

    // Determine extension from content type
    const extensionMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/mp4": "m4a",
    };

    const extension = extensionMap[contentType] ?? "bin";
    return `instagram_${assetId}.${extension}`;
  }
}
