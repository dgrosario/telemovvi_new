import axios, { AxiosInstance } from "axios";
import { waitFor, WaitForOptions } from "../utils/wait-for";

export type EvolutionMessage = {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      mimetype?: string;
    };
    audioMessage?: {
      mimetype?: string;
    };
    documentMessage?: {
      fileName?: string;
      mimetype?: string;
      caption?: string;
    };
    videoMessage?: {
      caption?: string;
      mimetype?: string;
    };
  };
  messageTimestamp?: number;
  pushName?: string;
};

export type EvolutionInstanceStatus = {
  instance: {
    instanceName: string;
    state: string;
  };
};

export type SendMessageResult = {
  messageId: string;
  remoteJid: string;
  timestamp: number;
};

export class EvolutionTestClient {
  private readonly client: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly instanceName: string
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        apikey: apiKey,
      },
    });
  }

  async sendTextMessage(to: string, text: string): Promise<SendMessageResult> {
    const number = this.formatPhoneNumber(to);

    const response = await this.client.post(
      `/message/sendText/${this.instanceName}`,
      {
        number,
        text,
        delay: 100,
      }
    );

    return {
      messageId: response.data.key.id,
      remoteJid: response.data.key.remoteJid,
      timestamp: parseInt(response.data.messageTimestamp, 10),
    };
  }

  async sendMediaMessage(
    to: string,
    type: "image" | "audio" | "document" | "video",
    media: string,
    caption?: string,
    fileName?: string
  ): Promise<SendMessageResult> {
    const number = this.formatPhoneNumber(to);

    if (type === "audio") {
      const response = await this.client.post(
        `/message/sendWhatsAppAudio/${this.instanceName}`,
        {
          number,
          audio: media,
          delay: 100,
          encoding: true,
        }
      );

      return {
        messageId: response.data.key.id,
        remoteJid: response.data.key.remoteJid,
        timestamp: parseInt(response.data.messageTimestamp, 10),
      };
    }

    const response = await this.client.post(
      `/message/sendMedia/${this.instanceName}`,
      {
        number,
        mediatype: type,
        media,
        caption,
        fileName,
        delay: 100,
      }
    );

    return {
      messageId: response.data.key.id,
      remoteJid: response.data.key.remoteJid,
      timestamp: parseInt(response.data.messageTimestamp, 10),
    };
  }

  async fetchMessages(
    remoteJid: string,
    limit = 20
  ): Promise<EvolutionMessage[]> {
    const response = await this.client.post(
      `/chat/findMessages/${this.instanceName}`,
      {
        where: {
          key: {
            remoteJid: this.formatRemoteJid(remoteJid),
          },
        },
        limit,
      }
    );

    const data = response.data;
    if (data.messages?.records) {
      return data.messages.records;
    }
    if (Array.isArray(data.messages)) {
      return data.messages;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  async waitForMessage(
    fromNumber: string,
    predicate: (msg: EvolutionMessage) => boolean,
    options?: WaitForOptions
  ): Promise<EvolutionMessage> {
    const remoteJid = this.formatRemoteJid(fromNumber);

    return waitFor(
      async () => {
        const messages = await this.fetchMessages(remoteJid);

        const match = messages.find((msg) => {
          if (msg.key.fromMe) return false;
          return predicate(msg);
        });

        return match || null;
      },
      {
        timeout: options?.timeout ?? 60000,
        interval: options?.interval ?? 2000,
        timeoutMessage: `Message not received from ${fromNumber} within timeout`,
      }
    );
  }

  async getInstanceStatus(): Promise<{
    connected: boolean;
    state: string;
    number?: string;
  }> {
    try {
      const response = await this.client.get(
        `/instance/connectionState/${this.instanceName}`
      );

      const state = response.data?.instance?.state || response.data?.state;

      return {
        connected: state === "open",
        state,
        number: response.data?.instance?.ownerJid?.replace("@s.whatsapp.net", ""),
      };
    } catch (error) {
      return {
        connected: false,
        state: "error",
      };
    }
  }

  async ensureConnected(): Promise<void> {
    const status = await this.getInstanceStatus();

    if (!status.connected) {
      throw new Error(
        `Test client instance "${this.instanceName}" is not connected. State: ${status.state}`
      );
    }
  }

  getMessageText(msg: EvolutionMessage): string | undefined {
    if (msg.message?.conversation) {
      return msg.message.conversation;
    }

    if (msg.message?.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    }

    if (msg.message?.imageMessage?.caption) {
      return msg.message.imageMessage.caption;
    }

    if (msg.message?.documentMessage?.caption) {
      return msg.message.documentMessage.caption;
    }

    if (msg.message?.videoMessage?.caption) {
      return msg.message.videoMessage.caption;
    }

    return undefined;
  }

  getMessageType(
    msg: EvolutionMessage
  ): "text" | "image" | "audio" | "document" | "video" | "unknown" {
    if (msg.message?.conversation || msg.message?.extendedTextMessage) {
      return "text";
    }

    if (msg.message?.imageMessage) {
      return "image";
    }

    if (msg.message?.audioMessage) {
      return "audio";
    }

    if (msg.message?.documentMessage) {
      return "document";
    }

    if (msg.message?.videoMessage) {
      return "video";
    }

    return "unknown";
  }

  private formatPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private formatRemoteJid(phone: string): string {
    const cleaned = this.formatPhoneNumber(phone);
    return `${cleaned}@s.whatsapp.net`;
  }

  static create(config?: {
    baseUrl?: string;
    apiKey?: string;
    instanceName?: string;
  }): EvolutionTestClient {
    return new EvolutionTestClient(
      config?.baseUrl || process.env.TEST_EVOLUTION_URL || "http://localhost:8080",
      config?.apiKey || process.env.TEST_EVOLUTION_API_KEY || "",
      config?.instanceName || process.env.TEST_EVOLUTION_INSTANCE_NAME || "test-client"
    );
  }
}
