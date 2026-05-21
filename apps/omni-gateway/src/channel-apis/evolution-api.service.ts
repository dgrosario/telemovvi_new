import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import CircuitBreaker from "opossum";
import { CircuitBreakerService } from "../circuit-breaker";
import {
  OutboundChannel,
  InteractivePayload,
} from "../consumers/interfaces/outbound-message.interface";
import {
  ChannelApiService,
  MediaDownloadResult,
  MediaType,
  NumberValidationResult,
} from "./channel-api.interface";

interface EvolutionResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: number;
  status: string;
}

interface RequestParams {
  path: string;
  body: unknown;
}

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string;
  number: string | null;
  ownerJid: string | null;
}

export interface EvolutionGroupInfo {
  id: string;
  subject: string;
  subjectOwner?: string;
  subjectTime?: number;
  size: number;
  creation?: number;
  owner?: string;
  desc?: string;
  descId?: string;
  restrict?: boolean;
  announce?: boolean;
  participants: Array<{
    id: string;
    admin?: string | null;
  }>;
}

export interface WhatsAppNumberCheck {
  exists: boolean;
  jid: string;
  number: string;
}

const WHATSAPP_USER_AGENT = "WhatsApp/2.23.0";
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

@Injectable()
export class EvolutionApiService implements ChannelApiService, OnModuleInit {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private requestBreaker!: CircuitBreaker<[RequestParams], EvolutionResponse>;

  constructor(
    private configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService
  ) {
    this.baseUrl = this.configService.get<string>("evolution.url") ?? "";
    this.apiKey = this.configService.get<string>("evolution.apiKey") ?? "";
  }

  onModuleInit(): void {
    this.requestBreaker = this.circuitBreakerService.create<
      [RequestParams],
      EvolutionResponse
    >("evolution-api", (params: RequestParams) => this.executeRequest(params));
  }

  async sendTextMessage(
    channel: OutboundChannel,
    to: string,
    content: string,
    quoted?: { key: { id: string; remoteJid: string; fromMe: boolean } }
  ): Promise<string> {
    const instanceName = channel.payload.instanceName;
    if (!instanceName) {
      throw new Error("Evolution channel requires instanceName");
    }

    const number = this.extractPhoneNumber(to);

    const payload: Record<string, unknown> = {
      number,
      text: content,
      delay: 100,
      linkPreview: true,
    };

    if (quoted) {
      payload.quoted = quoted;
    }

    const response = await this.request(`/message/sendText/${instanceName}`, payload);

    return response.key.id;
  }

  async sendMediaMessage(
    channel: OutboundChannel,
    to: string,
    media: string,
    type: MediaType,
    caption?: string,
    filename?: string,
    mimeType?: string,
    quoted?: { key: { id: string; remoteJid: string; fromMe: boolean } }
  ): Promise<string> {
    const instanceName = channel.payload.instanceName;
    if (!instanceName) {
      throw new Error("Evolution channel requires instanceName");
    }

    const number = this.extractPhoneNumber(to);

    const mediaContent = this.extractBase64FromDataUri(media);

    const payload: Record<string, unknown> = {
      number,
      mediatype: type,
      mimetype: mimeType,
      media: mediaContent,
      caption: caption ?? "",
      fileName: filename ?? "",
      delay: 100,
    };

    if (quoted) {
      payload.quoted = quoted;
    }

    const response = await this.request(`/message/sendMedia/${instanceName}`, payload);

    return response.key.id;
  }

  private extractBase64FromDataUri(media: string): string {
    if (media.startsWith("data:")) {
      const base64Index = media.indexOf(",");
      if (base64Index !== -1) {
        return media.substring(base64Index + 1);
      }
    }
    return media;
  }

  async sendAudioMessage(
    channel: OutboundChannel,
    to: string,
    audioBase64: string,
    quoted?: { key: { id: string; remoteJid: string; fromMe: boolean } }
  ): Promise<string> {
    const instanceName = channel.payload.instanceName;
    if (!instanceName) {
      throw new Error("Evolution channel requires instanceName");
    }

    const number = this.extractPhoneNumber(to);

    const audioContent = this.extractBase64FromDataUri(audioBase64);

    const payload: Record<string, unknown> = {
      number,
      audio: audioContent,
      delay: 100,
      encoding: true,
    };

    if (quoted) {
      payload.quoted = quoted;
    }

    const response = await this.request(
      `/message/sendWhatsAppAudio/${instanceName}`,
      payload
    );

    return response.key.id;
  }

  // TODO: Evolution API sendButtons e sendList não funcionam corretamente no WhatsApp.
  // Aguardar correção da equipe do Evolution API para habilitar mensagens interativas nativas.
  // Por enquanto, convertemos para texto formatado.
  async sendInteractiveMessage(
    channel: OutboundChannel,
    to: string,
    interactive: InteractivePayload
  ): Promise<string> {
    this.logger.log(
      "Evolution API: Converting interactive message to formatted text (buttons/lists not supported)"
    );

    const formattedText = this.interactiveToFormattedText(interactive);

    return this.sendTextMessage(channel, to, formattedText);
  }

  private interactiveToFormattedText(interactive: InteractivePayload): string {
    const lines: string[] = [];

    if (interactive.header?.text) {
      lines.push(`*${interactive.header.text}*`);
      lines.push("");
    }

    lines.push(interactive.body.text);

    if (interactive.type === "button" && interactive.action.buttons) {
      lines.push("");
      interactive.action.buttons.forEach((btn, index) => {
        const title = btn.buttonText?.displayText ?? btn.reply?.title ?? "";
        lines.push(`${index + 1}) ${title}`);
      });
    }

    if (interactive.type === "list" && interactive.action.sections) {
      lines.push("");
      let optionIndex = 1;
      for (const section of interactive.action.sections) {
        if (section.title) {
          lines.push(`*${section.title}*`);
        }
        for (const row of section.rows) {
          lines.push(`${optionIndex}) ${row.title}`);
          if (row.description) {
            lines.push(`   _${row.description}_`);
          }
          optionIndex++;
        }
        lines.push("");
      }
    }

    if (interactive.footer?.text) {
      lines.push(`_${interactive.footer.text}_`);
    }

    return lines.join("\n");
  }

  async downloadMedia(
    channel: OutboundChannel,
    messageId: string,
    mimetype?: string,
    remoteJid?: string,
    mediaUrl?: string,
    fromMe?: boolean
  ): Promise<MediaDownloadResult> {
    const instanceName = channel.payload.instanceName;
    if (!instanceName) {
      return { success: false, error: "Evolution channel requires instanceName" };
    }

    try {
      const apiResult = await this.downloadMediaFromEvolutionApi(
        instanceName as string,
        messageId,
        mimetype,
        remoteJid,
        fromMe
      );
      if (apiResult.success) {
        return apiResult;
      }
      this.logger.warn(
        `Evolution API download failed for ${messageId}: ${apiResult.error}, falling back to direct URL`
      );

      if (mediaUrl) {
        const urlResult = await this.downloadMediaFromUrl(mediaUrl, mimetype, messageId);
        if (urlResult.success) {
          return urlResult;
        }
        this.logger.warn(
          `Direct URL download also failed for ${messageId}: ${urlResult.error}`
        );
      }

      return { success: false, error: "All download methods failed" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to download media: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private isUrlAllowed(url: string): boolean {
    try {
      const parsed = new URL(url);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        this.logger.warn(`Blocked URL with invalid protocol: ${parsed.protocol}`);
        return false;
      }

      const hostname = parsed.hostname.toLowerCase();

      const blockedPatterns = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "[::1]",
      ];

      const blockedPrefixes = [
        "169.254.",
        "10.",
        "172.16.",
        "172.17.",
        "172.18.",
        "172.19.",
        "172.20.",
        "172.21.",
        "172.22.",
        "172.23.",
        "172.24.",
        "172.25.",
        "172.26.",
        "172.27.",
        "172.28.",
        "172.29.",
        "172.30.",
        "172.31.",
        "192.168.",
      ];

      if (blockedPatterns.includes(hostname)) {
        this.logger.warn(`Blocked URL with private hostname: ${hostname}`);
        return false;
      }

      for (const prefix of blockedPrefixes) {
        if (hostname.startsWith(prefix)) {
          this.logger.warn(`Blocked URL with private IP range: ${hostname}`);
          return false;
        }
      }

      return true;
    } catch {
      this.logger.warn(`Blocked URL with invalid format: ${url}`);
      return false;
    }
  }

  private async downloadMediaFromUrl(
    url: string,
    mimetype?: string,
    messageId?: string
  ): Promise<MediaDownloadResult> {
    this.logger.debug(
      `Downloading media directly from URL for message: ${messageId ?? "unknown"}`
    );

    if (!this.isUrlAllowed(url)) {
      return { success: false, error: "URL blocked by security policy (SSRF protection)" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": WHATSAPP_USER_AGENT,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(`Direct download error: ${response.status} ${response.statusText}`);
        return { success: false, error: `Direct download error: ${response.status}` };
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_MEDIA_SIZE_BYTES) {
          this.logger.error(
            `Media too large: ${size} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
          );
          return { success: false, error: `Media too large: ${size} bytes` };
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_MEDIA_SIZE_BYTES) {
        this.logger.error(
          `Downloaded media too large: ${buffer.length} bytes (max: ${MAX_MEDIA_SIZE_BYTES})`
        );
        return { success: false, error: `Media too large: ${buffer.length} bytes` };
      }

      const contentType = response.headers.get("content-type");
      const effectiveMimetype = mimetype ?? contentType ?? "application/octet-stream";

      this.logger.debug(
        `Downloaded ${buffer.length} bytes from direct URL (${effectiveMimetype})`
      );

      return {
        success: true,
        content: buffer,
        mime: effectiveMimetype,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error(`Direct download timeout after ${MEDIA_DOWNLOAD_TIMEOUT_MS}ms`);
        return { success: false, error: "Download timeout" };
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async downloadMediaFromEvolutionApi(
    instanceName: string,
    messageId: string,
    mimetype?: string,
    remoteJid?: string,
    fromMe?: boolean
  ): Promise<MediaDownloadResult> {
    const originalMessageId = this.extractOriginalMessageId(messageId);

    this.logger.debug(
      `Downloading media via Evolution API for message: ${messageId} (original: ${originalMessageId}), remoteJid: ${remoteJid ?? "not provided"}, fromMe: ${fromMe ?? "not provided"}`
    );

    const url = `${this.baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;

    const messageKey: Record<string, string | boolean> = { id: originalMessageId };
    if (remoteJid) {
      messageKey.remoteJid = remoteJid;
    }
    if (fromMe !== undefined) {
      messageKey.fromMe = fromMe;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          key: messageKey,
        },
        convertToMp4: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Evolution API download error: ${error}`);
      return { success: false, error: `Evolution API error: ${response.status}` };
    }

    const data = (await response.json()) as { base64?: string };

    if (!data.base64) {
      this.logger.error("No base64 in Evolution API response");
      return { success: false, error: "No base64 data in response" };
    }

    const rawBase64 = this.extractBase64FromDataUri(data.base64);
    const buffer = Buffer.from(rawBase64, "base64");

    return {
      success: true,
      content: buffer,
      mime: mimetype ?? "application/octet-stream",
    };
  }

  async fetchInstances(instanceName: string): Promise<EvolutionInstance[]> {
    const url = `${this.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`;

    try {
      const response = await fetch(url, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch instances: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();

      if (Array.isArray(data)) {
        return data as EvolutionInstance[];
      }

      if (data && typeof data === "object" && "name" in data) {
        return [data as EvolutionInstance];
      }

      this.logger.warn(`Unexpected response format from fetchInstances: ${typeof data}`);
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch instances: ${errorMessage}`);
      return [];
    }
  }

  async fetchAllInstances(): Promise<EvolutionInstance[]> {
    const url = `${this.baseUrl}/instance/fetchInstances`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: { apikey: this.apiKey },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.error(`Failed to fetch all instances: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();

      if (Array.isArray(data)) {
        return data as EvolutionInstance[];
      }

      this.logger.warn(`Unexpected response format from fetchAllInstances: ${typeof data}`);
      return [];
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error("Timeout fetching all instances from Evolution API");
        return [];
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch all instances: ${errorMessage}`);
      return [];
    }
  }

  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    const url = `${this.baseUrl}/instance/fetchInstances`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: { apikey: this.apiKey },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        return { healthy: false, error: "API Key inválida ou não autorizada" };
      }

      if (response.status === 403) {
        return { healthy: false, error: "Acesso negado à Evolution API" };
      }

      if (!response.ok) {
        return { healthy: false, error: `Evolution API retornou status ${response.status}` };
      }

      return { healthy: true };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { healthy: false, error: "Timeout ao conectar com Evolution API" };
      }
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      return { healthy: false, error: `Falha ao conectar: ${errorMessage}` };
    }
  }

  async fetchGroupInfo(
    instanceName: string,
    groupJid: string
  ): Promise<EvolutionGroupInfo | null> {
    const url = `${this.baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`;

    try {
      this.logger.debug(`Fetching group info for: ${groupJid}`);

      const response = await fetch(url, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch group info: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as EvolutionGroupInfo;

      if (!data.id || !data.subject) {
        this.logger.warn(`Invalid group info response for: ${groupJid}`);
        return null;
      }

      this.logger.debug(`Group info fetched: ${data.subject} (${data.size} participants)`);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch group info: ${errorMessage}`);
      return null;
    }
  }

  async fetchGroupParticipants(
    instanceName: string,
    groupJid: string
  ): Promise<Array<{ id: string; admin?: string | null }> | null> {
    const url = `${this.baseUrl}/group/participants/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`;

    try {
      this.logger.debug(`Fetching group participants for: ${groupJid}`);

      const response = await fetch(url, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch group participants: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as { participants: Array<{ id: string; admin?: string | null }> };

      this.logger.debug(`Group participants fetched: ${data.participants?.length ?? 0} participants`);
      return data.participants ?? [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch group participants: ${errorMessage}`);
      return null;
    }
  }

  async fetchGroupPictureUrl(
    instanceName: string,
    groupJid: string
  ): Promise<string | null> {
    const url = `${this.baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`;

    try {
      this.logger.debug(`Fetching group picture for: ${groupJid}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: groupJid }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch group picture: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as { profilePictureUrl?: string; wpiUrl?: string };

      const pictureUrl = data.profilePictureUrl || data.wpiUrl || null;

      if (pictureUrl) {
        this.logger.debug(`Group picture fetched for ${groupJid}`);
      }

      return pictureUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch group picture: ${errorMessage}`);
      return null;
    }
  }

  async checkWhatsAppNumbers(
    instanceName: string,
    numbers: string[]
  ): Promise<WhatsAppNumberCheck[]> {
    const url = `${this.baseUrl}/chat/whatsappNumbers/${instanceName}`;

    try {
      this.logger.debug(`Checking WhatsApp numbers: ${numbers.join(", ")}`);

      const cleanedNumbers = numbers.map((n) => this.extractPhoneNumber(n));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ numbers: cleanedNumbers }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to check WhatsApp numbers: ${error}`);
        throw new Error(`Evolution API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as WhatsAppNumberCheck[];

      this.logger.debug(
        `WhatsApp number check results: ${data.map((d) => `${d.number}:${d.exists}`).join(", ")}`
      );

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to check WhatsApp numbers: ${errorMessage}`);
      throw error;
    }
  }

  async validateNumbers(
    channel: OutboundChannel,
    numbers: string[]
  ): Promise<NumberValidationResult[]> {
    const instanceName = channel.payload.instanceName;
    if (!instanceName) {
      throw new Error("Evolution channel requires instanceName");
    }

    return this.checkWhatsAppNumbers(instanceName, numbers);
  }

  async deleteMessage(
    instanceName: string,
    data: { id: string; remoteJid: string; fromMe: boolean; participant?: string }
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/deleteMessageForEveryone/${instanceName}`;

    const originalId = this.extractOriginalMessageId(data.id);

    const payload: Record<string, unknown> = {
      id: originalId,
      remoteJid: data.remoteJid,
      fromMe: data.fromMe,
    };

    if (data.participant) {
      payload.participant = data.participant;
    }

    this.logger.log(`DELETE MESSAGE - URL: ${url}, Payload: ${JSON.stringify(payload)}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    this.logger.log(`DELETE MESSAGE Response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      this.logger.error(`Failed to delete message: ${responseText}`);
      throw new Error(`Evolution API error: ${response.status} ${responseText}`);
    }

    this.logger.log(`Message ${originalId} deleted successfully via Evolution API`);
  }

  async sendReaction(
    instanceName: string,
    data: { messageId: string; remoteJid: string; emoji: string; fromMe: boolean }
  ): Promise<void> {
    const url = `${this.baseUrl}/message/sendReaction/${instanceName}`;

    const originalMessageId = this.extractOriginalMessageId(data.messageId);
    const normalizedRemoteJid = this.normalizeRemoteJidForMessageKey(data.remoteJid);
    const remoteJidCandidates =
      normalizedRemoteJid !== data.remoteJid
        ? [data.remoteJid, normalizedRemoteJid]
        : [data.remoteJid];

    for (let index = 0; index < remoteJidCandidates.length; index++) {
      const remoteJid = remoteJidCandidates[index]!;
      const attempt = index + 1;
      const totalAttempts = remoteJidCandidates.length;
      const payload = {
        key: {
          remoteJid,
          fromMe: data.fromMe,
          id: originalMessageId,
        },
        reaction: data.emoji,
      };

      this.logger.log(
        `SEND REACTION - Attempt ${attempt}/${totalAttempts} - URL: ${url}, Payload: ${JSON.stringify(payload)}`
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      this.logger.log(
        `SEND REACTION - Attempt ${attempt}/${totalAttempts} Response: ${response.status} - ${responseText}`
      );

      if (response.ok) {
        this.logger.log(`Reaction ${data.emoji} sent successfully to message ${originalMessageId}`);
        return;
      }

      const shouldRetryWithNormalizedJid =
        index === 0 &&
        remoteJidCandidates.length > 1 &&
        this.isEvolutionJidNotFoundError(responseText);

      if (shouldRetryWithNormalizedJid) {
        this.logger.warn(
          `SEND REACTION - Retrying with normalized remoteJid. Original: ${data.remoteJid}, Normalized: ${normalizedRemoteJid}`
        );
        continue;
      }

      this.logger.error(
        `SEND REACTION - Final failure on attempt ${attempt}/${totalAttempts} for remoteJid ${remoteJid}: ${responseText}`
      );
      throw new Error(`Evolution API error: ${response.status} ${responseText}`);
    }
  }

  async editMessage(
    instanceName: string,
    data: { messageId: string; remoteJid: string; text: string }
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/updateMessage/${instanceName}`;

    const phoneNumber = this.extractPhoneNumber(data.remoteJid);
    const normalizedPhone = this.normalizePhoneForWhatsApp(phoneNumber);

    const normalizedRemoteJid = data.remoteJid.endsWith("@g.us")
      ? data.remoteJid
      : `${normalizedPhone}@s.whatsapp.net`;

    const originalMessageId = this.extractOriginalMessageId(data.messageId);

    const payload = {
      number: normalizedPhone,
      text: data.text,
      key: {
        remoteJid: normalizedRemoteJid,
        fromMe: true,
        id: originalMessageId,
      },
    };

    this.logger.log(`EDIT MESSAGE - URL: ${url}, Payload: ${JSON.stringify(payload)}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    this.logger.log(`EDIT MESSAGE Response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      let errorMessage = responseText;
      let errorContext = "";

      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || responseText;
        errorContext = JSON.stringify(errorJson);
      } catch {
        // Manter texto original se nao for JSON
      }

      this.logger.error(
        `Failed to edit message - Status: ${response.status}, ` +
          `MessageId: ${originalMessageId}, RemoteJid: ${normalizedRemoteJid}, ` +
          `Error: ${errorMessage}, Context: ${errorContext}`
      );

      throw new Error(`Evolution API error (${response.status}): ${errorMessage}`);
    }

    this.logger.log(`Message ${originalMessageId} edited successfully via Evolution API`);
  }

  async fetchProfilePictureUrl(
    instanceName: string,
    number: string
  ): Promise<string | null> {
    const url = `${this.baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`;

    try {
      this.logger.debug(`Fetching profile picture for: ${number}`);

      const cleanedNumber = this.extractPhoneNumber(number);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: cleanedNumber }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.warn(`Failed to fetch profile picture: ${error}`);
        return null;
      }

      const data = (await response.json()) as { profilePictureUrl?: string; wpiUrl?: string };

      const pictureUrl = data.profilePictureUrl || data.wpiUrl || null;

      if (pictureUrl) {
        this.logger.debug(`Profile picture fetched for ${number}: ${pictureUrl.substring(0, 50)}...`);
      } else {
        this.logger.debug(`No profile picture found for ${number}`);
      }

      return pictureUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch profile picture: ${errorMessage}`);
      return null;
    }
  }

  async fetchContactName(
    instanceName: string,
    remoteJid: string
  ): Promise<string | null> {
    const url = `${this.baseUrl}/chat/findContacts/${instanceName}`;

    try {
      this.logger.debug(`Fetching contact name for: ${remoteJid}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ where: { id: remoteJid } }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        this.logger.warn(`Failed to fetch contact name: ${error}`);
        return null;
      }

      const data = (await response.json()) as Array<{
        pushName?: string;
        notify?: string;
        name?: string;
      }>;

      const contact = Array.isArray(data) ? data[0] : null;
      if (!contact) {
        this.logger.debug(`No contact found for ${remoteJid}`);
        return null;
      }

      const contactName = contact.pushName || contact.notify || contact.name || null;

      if (contactName) {
        this.logger.debug(`Contact name fetched for ${remoteJid}: ${contactName}`);
      } else {
        this.logger.debug(`Contact found but no name available for ${remoteJid}`);
      }

      return contactName;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch contact name: ${errorMessage}`);
      return null;
    }
  }

  private normalizePhoneForWhatsApp(phone: string): string {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("55") && digits.length === 13) {
      const ddd = digits.substring(2, 4);
      const dddNumber = parseInt(ddd, 10);
      if (dddNumber >= 11 && dddNumber <= 99) {
        const ninthDigit = digits.charAt(4);
        if (ninthDigit === "9") {
          return digits.substring(0, 4) + digits.substring(5);
        }
      }
    }

    return digits;
  }

  private normalizeRemoteJidForMessageKey(remoteJid: string): string {
    if (
      remoteJid.endsWith("@g.us") ||
      remoteJid.endsWith("@lid") ||
      (remoteJid.includes("@") && !remoteJid.endsWith("@s.whatsapp.net"))
    ) {
      return remoteJid;
    }

    const phoneNumber = this.extractPhoneNumber(remoteJid);
    const normalizedPhone = this.normalizePhoneForWhatsApp(phoneNumber);

    return `${normalizedPhone}@s.whatsapp.net`;
  }

  private isEvolutionJidNotFoundError(responseText: string): boolean {
    return /"exists"\s*:\s*false/i.test(responseText);
  }

  private extractPhoneNumber(remoteJid: string): string {
    if (remoteJid.endsWith("@g.us")) {
      return remoteJid;
    }
    return remoteJid
      .replace("@s.whatsapp.net", "")
      .replace(/\D/g, "");
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

  private async request(path: string, body: unknown): Promise<EvolutionResponse> {
    return this.requestBreaker.fire({ path, body });
  }

  private async executeRequest(params: RequestParams): Promise<EvolutionResponse> {
    const url = `${this.baseUrl}${params.path}`;

    this.logger.debug(`POST ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Evolution API error: ${error}`);
      throw new Error(`Evolution API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<EvolutionResponse>;
  }
}
