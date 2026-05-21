import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import CircuitBreaker from "opossum";
import { CircuitBreakerService } from "../circuit-breaker";
import {
  OutboundChannel,
  OutboundMessageVariable,
  InteractivePayload,
} from "../consumers/interfaces/outbound-message.interface";
import { MediaDownloadResult, QuotedMessage } from "./channel-api.interface";

const MEDIA_DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface MediaInfoResponse {
  id: string;
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  messaging_product: string;
}

interface RequestParams {
  path: string;
  accessToken: string;
  body: unknown;
}

type TemplateParameter = {
  type: "text";
  text: string;
  parameter_name?: string;
};

@Injectable()
export class WhatsAppApiService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly baseUrl = "https://graph.facebook.com/v23.0";
  private requestBreaker!: CircuitBreaker<[RequestParams], WhatsAppResponse>;

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  onModuleInit(): void {
    this.requestBreaker = this.circuitBreakerService.create<
      [RequestParams],
      WhatsAppResponse
    >("whatsapp-api", (params: RequestParams) => this.executeRequest(params));
  }

  async sendTextMessage(
    channel: OutboundChannel,
    to: string,
    content: string,
    quoted?: QuotedMessage
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.validatePayload(channel);

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: content },
    };

    if (quoted?.key?.id) {
      payload.context = {
        message_id: quoted.key.id,
      };
    }

    const response = await this.request(
      `/${phoneNumberId}/messages`,
      accessToken,
      payload
    );

    return response.messages[0].id;
  }

  async sendTemplateMessage(
    channel: OutboundChannel,
    to: string,
    templateName: string,
    variables: OutboundMessageVariable[],
    language?: string
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.validatePayload(channel);

    const components = this.buildTemplateComponents(variables);
    const languageCode = this.normalizeTemplateLanguage(language);

    const response = await this.request(
      `/${phoneNumberId}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }
    );

    return response.messages[0].id;
  }

  async sendMediaMessage(
    channel: OutboundChannel,
    to: string,
    mediaId: string,
    type: "audio" | "image" | "document" | "video",
    caption?: string,
    filename?: string,
    _mimeType?: string,
    quoted?: QuotedMessage
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.validatePayload(channel);

    const mediaPayload: Record<string, unknown> = { id: mediaId };

    if (
      caption &&
      (type === "image" || type === "video" || type === "document")
    ) {
      mediaPayload.caption = caption;
    }

    if (filename && type === "document") {
      mediaPayload.filename = filename;
    }

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type,
      [type]: mediaPayload,
    };

    if (quoted?.key?.id) {
      payload.context = {
        message_id: quoted.key.id,
      };
    }

    const response = await this.request(
      `/${phoneNumberId}/messages`,
      accessToken,
      payload
    );

    return response.messages[0].id;
  }

  async sendInteractiveMessage(
    channel: OutboundChannel,
    to: string,
    interactive: InteractivePayload
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.validatePayload(channel);

    const response = await this.request(
      `/${phoneNumberId}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: interactive.type,
          header: interactive.header,
          body: interactive.body,
          footer: interactive.footer,
          action: interactive.action,
        },
      }
    );

    return response.messages[0].id;
  }

  async sendReaction(
    channel: OutboundChannel,
    to: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const { phoneNumberId, accessToken } = this.validatePayload(channel);

    await this.request(
      `/${phoneNumberId}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "reaction",
        reaction: {
          message_id: messageId,
          emoji,
        },
      }
    );
  }

  async downloadMedia(
    channel: OutboundChannel,
    mediaId: string
  ): Promise<MediaDownloadResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

    try {
      const { accessToken } = this.validatePayload(channel);

      const mediaInfoUrl = `${this.baseUrl}/${mediaId}`;
      this.logger.debug(`Fetching media info: ${mediaInfoUrl}`);

      const infoResponse = await fetch(mediaInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      if (!infoResponse.ok) {
        const error = await infoResponse.text();
        this.logger.error(`Failed to get media info: ${error}`);
        return { success: false, error: `Failed to get media info: ${infoResponse.status}` };
      }

      const mediaInfo = (await infoResponse.json()) as MediaInfoResponse;

      if (!mediaInfo.url) {
        this.logger.debug(`Media URL not found in response for mediaId: ${mediaId}`);
        return { success: false, error: "Media URL not found in response" };
      }

      if (mediaInfo.file_size && mediaInfo.file_size > MAX_MEDIA_SIZE_BYTES) {
        this.logger.error(
          `Media too large: ${mediaInfo.file_size} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
        );
        return { success: false, error: `Media too large: ${mediaInfo.file_size} bytes` };
      }

      this.logger.debug(`Downloading media from: ${mediaInfo.url}`);

      const downloadResponse = await fetch(mediaInfo.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      if (!downloadResponse.ok) {
        const error = await downloadResponse.text();
        this.logger.error(`Failed to download media: ${error}`);
        return { success: false, error: `Failed to download media: ${downloadResponse.status}` };
      }

      const contentLength = downloadResponse.headers.get("content-length");
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_MEDIA_SIZE_BYTES) {
          this.logger.error(
            `Media too large: ${size} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
          );
          return { success: false, error: `Media too large: ${size} bytes` };
        }
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();
      const content = Buffer.from(arrayBuffer);

      if (content.length > MAX_MEDIA_SIZE_BYTES) {
        this.logger.error(
          `Downloaded media too large: ${content.length} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
        );
        return { success: false, error: `Media too large: ${content.length} bytes` };
      }

      return {
        success: true,
        content,
        mime: mediaInfo.mime_type,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error(`Media download timeout after ${MEDIA_DOWNLOAD_TIMEOUT_MS}ms`);
        return { success: false, error: "Download timeout" };
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error downloading media: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validatePayload(channel: OutboundChannel): {
    phoneNumberId: string;
    accessToken: string;
  } {
    // Support both phoneNumberId (meta_api) and phoneId (whatsapp embedded signup)
    const payload = channel.payload as Record<string, unknown>;
    const phoneNumberId = (payload.phoneNumberId ?? payload.phoneId) as string | undefined;
    const accessToken = payload.accessToken as string | undefined;

    if (!phoneNumberId) {
      throw new Error("WhatsApp channel requires phoneNumberId or phoneId");
    }

    if (!accessToken) {
      throw new Error("WhatsApp channel requires accessToken");
    }

    return { phoneNumberId, accessToken };
  }

  private buildTemplateComponents(
    variables: OutboundMessageVariable[]
  ): Array<{ type: string; parameters: TemplateParameter[] }> {
    if (variables.length === 0) {
      return [];
    }

    return [
      {
        type: "body",
        parameters: variables.map((v) => {
          const parameterName = v.name?.replace(/[{}]/g, "").trim();
          const isPositional = /^\d+$/.test(parameterName);

          return {
            type: "text",
            text: v.value,
            ...(parameterName && !isPositional
              ? { parameter_name: parameterName }
              : {}),
          };
        }),
      },
    ];
  }

  private normalizeTemplateLanguage(language?: string): string {
    if (!language) {
      return "pt_BR";
    }

    const sanitized = language.trim().replace("-", "_");
    if (!sanitized) {
      return "pt_BR";
    }

    const [base, region] = sanitized.split("_");
    if (!base) {
      return "pt_BR";
    }

    if (!region) {
      return base.toLowerCase();
    }

    return `${base.toLowerCase()}_${region.toUpperCase()}`;
  }

  private async request(
    path: string,
    accessToken: string,
    body: unknown
  ): Promise<WhatsAppResponse> {
    return this.requestBreaker.fire({ path, accessToken, body });
  }

  private async executeRequest(params: RequestParams): Promise<WhatsAppResponse> {
    const url = `${this.baseUrl}${params.path}`;

    this.logger.debug(`POST ${url}`);
    this.logger.debug(`Token prefix: ${params.accessToken.substring(0, 20)}...`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.body),
      });

      this.logger.debug(`Response status: ${response.status}`);

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`WhatsApp API error (${response.status}): ${error}`);
        throw new Error(`WhatsApp API error: ${response.status} ${error}`);
      }

      return response.json() as Promise<WhatsAppResponse>;
    } catch (error) {
      this.logger.error(`Fetch error:`, error);
      if (error instanceof Error) {
        this.logger.error(`Error name: ${error.name}, message: ${error.message}`);
      }
      throw error;
    }
  }
}
