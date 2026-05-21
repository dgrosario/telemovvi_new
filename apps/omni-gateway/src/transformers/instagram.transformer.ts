import { Injectable, Logger } from "@nestjs/common";
import { MainDatabaseService } from "../database/main-database.service";

interface InstagramInboundMessage {
  messageId: string;
  senderId: string;
  content: string;
  type: "text" | "audio" | "image" | "document" | "sticker" | "video";
  timestamp: number;
  contactName?: string;
  username?: string;
  pageId: string;
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
}

interface InstagramStatusUpdate {
  messageId: string;
  status: "sent" | "delivered" | "read";
  timestamp: number;
}

interface InstagramReactionEvent {
  targetMessageId: string;
  reactorInstagramScopedId: string;
  recipientInstagramAccountId: string;
  action: "react" | "unreact";
  reaction: string | null;
  emoji: string | null;
  timestamp: number;
}

interface InstagramRabbitMQMessage {
  event: "messages.upsert" | "messages.update" | "messages.reaction";
  instance: string;
  source: "instagram";
  data: InstagramInboundMessage | InstagramStatusUpdate | InstagramReactionEvent;
}

interface InstagramAttachment {
  type: string;
  payload: {
    url?: string;
  };
}

interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: InstagramAttachment[];
}

interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: InstagramMessage;
  reaction?: {
    mid?: string;
    action: "react" | "unreact";
    reaction?: string;
    emoji?: string;
  };
  read?: {
    mid: string;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
}

interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging?: InstagramMessagingEvent[];
  changes?: Array<{
    field: string;
    value: {
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: InstagramMessage;
    };
  }>;
}

export interface InstagramWebhookPayload {
  object: string;
  entry: InstagramWebhookEntry[];
}

@Injectable()
export class InstagramTransformer {
  private readonly logger = new Logger(InstagramTransformer.name);

  constructor(
    private readonly mainDatabaseService: MainDatabaseService
  ) {}

  async transformMessagesUpsert(
    payload: InstagramWebhookPayload
  ): Promise<InstagramRabbitMQMessage[]> {
    const results: InstagramRabbitMQMessage[] = [];

    for (const entry of payload.entry) {
      const pageId = entry.id;

      if (entry.messaging) {
        for (const event of entry.messaging) {
          if (event.reaction) {
            const reactionEvent = this.transformReactionEvent(event, pageId);
            if (reactionEvent) {
              results.push(reactionEvent);
            }
            continue;
          }

          // Processa eventos de leitura (read)
          if (event.read) {
            const statusUpdate = this.transformReadEvent(event, pageId);
            if (statusUpdate) {
              results.push(statusUpdate);
            }
            continue;
          }

          // Processa eventos de entrega (delivery)
          if (event.delivery) {
            const statusUpdates = this.transformDeliveryEvent(event, pageId);
            results.push(...statusUpdates);
            continue;
          }

          // Processa mensagens
          const message = await this.transformMessagingEvent(event, pageId);
          if (message) {
            results.push(message);
          }
        }
      }

      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "messages" && change.value.message) {
            const message = await this.transformChangeEvent(change.value, pageId);
            if (message) {
              results.push(message);
            }
          }
        }
      }
    }

    return results;
  }

  private transformReactionEvent(
    event: InstagramMessagingEvent,
    pageId: string
  ): InstagramRabbitMQMessage | null {
    if (!event.reaction?.mid) {
      this.logger.warn("Instagram reaction event missing target message id");
      return null;
    }

    const data: InstagramReactionEvent = {
      targetMessageId: event.reaction.mid,
      reactorInstagramScopedId: event.sender.id,
      recipientInstagramAccountId: event.recipient.id,
      action: event.reaction.action,
      reaction: event.reaction.reaction ?? null,
      emoji: event.reaction.emoji ?? null,
      timestamp: event.timestamp,
    };

    return {
      event: "messages.reaction",
      instance: pageId,
      source: "instagram",
      data,
    };
  }

  private transformReadEvent(
    event: InstagramMessagingEvent,
    pageId: string
  ): InstagramRabbitMQMessage | null {
    if (!event.read?.mid) {
      return null;
    }

    this.logger.log(`[transformReadEvent] Processing read event for message ${event.read.mid}`);

    const data: InstagramStatusUpdate = {
      messageId: event.read.mid,
      status: "read",
      timestamp: event.timestamp,
    };

    return {
      event: "messages.update",
      instance: pageId,
      source: "instagram",
      data,
    };
  }

  private transformDeliveryEvent(
    event: InstagramMessagingEvent,
    pageId: string
  ): InstagramRabbitMQMessage[] {
    if (!event.delivery?.mids || event.delivery.mids.length === 0) {
      return [];
    }

    this.logger.log(`[transformDeliveryEvent] Processing delivery event for ${event.delivery.mids.length} messages`);

    return event.delivery.mids.map((mid) => {
      const data: InstagramStatusUpdate = {
        messageId: mid,
        status: "delivered",
        timestamp: event.timestamp,
      };

      return {
        event: "messages.update",
        instance: pageId,
        source: "instagram",
        data,
      };
    });
  }

  private async transformMessagingEvent(
    event: InstagramMessagingEvent,
    pageId: string
  ): Promise<InstagramRabbitMQMessage | null> {
    if (!event.message) {
      return null;
    }

    // Ignora mensagens de echo (mensagens enviadas por nós mesmos)
    // Quando sender.id === pageId, significa que somos nós que enviamos
    if (event.sender.id === pageId) {
      this.logger.log(`[transformMessagingEvent] Ignoring echo message ${event.message.mid} (sent by us)`);
      return null;
    }

    const messageData = this.extractMessageContent(event.message);

    if (!messageData) {
      return null;
    }

    this.logger.log(`[transformMessagingEvent] Processing message ${event.message.mid} from sender ${event.sender.id}`);

    const userInfo = await this.fetchInstagramUserInfo(
      event.sender.id,
      pageId
    );

    const contactName = userInfo?.name || userInfo?.username || event.sender.id;
    const username = userInfo?.username || "";

    this.logger.log(`[transformMessagingEvent] Contact name result: ${contactName}, username: ${username || 'NULL'}`);

    const data: InstagramInboundMessage = {
      messageId: event.message.mid,
      senderId: event.sender.id,
      content: messageData.content,
      type: messageData.type,
      timestamp: event.timestamp,
      contactName,
      username,
      pageId: pageId,
      mediaUrl: messageData.mediaUrl,
      mimetype: messageData.mimetype,
      caption: messageData.caption,
    };

    this.logger.log(`[transformMessagingEvent] Final contactName in data: ${data.contactName}, username: ${data.username}`);

    return {
      event: "messages.upsert",
      instance: pageId,
      source: "instagram",
      data,
    };
  }

  private async transformChangeEvent(
    value: {
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: InstagramMessage;
    },
    pageId: string
  ): Promise<InstagramRabbitMQMessage | null> {
    if (!value.message || !value.sender) {
      return null;
    }

    // Ignora mensagens de echo (mensagens enviadas por nós mesmos)
    // Quando sender.id === pageId, significa que somos nós que enviamos
    if (value.sender.id === pageId) {
      this.logger.log(`[transformChangeEvent] Ignoring echo message ${value.message.mid} (sent by us)`);
      return null;
    }

    const messageData = this.extractMessageContent(value.message);

    if (!messageData) {
      return null;
    }

    this.logger.log(`[transformChangeEvent] Processing message ${value.message.mid} from sender ${value.sender.id}`);

    const userInfo = await this.fetchInstagramUserInfo(
      value.sender.id,
      pageId
    );

    const contactName = userInfo?.name || userInfo?.username || value.sender.id;
    const username = userInfo?.username || "";

    this.logger.log(`[transformChangeEvent] Contact name result: ${contactName}, username: ${username || 'NULL'}`);

    const data: InstagramInboundMessage = {
      messageId: value.message.mid,
      senderId: value.sender.id,
      content: messageData.content,
      type: messageData.type,
      timestamp: value.timestamp || Date.now(),
      contactName,
      username,
      pageId: pageId,
      mediaUrl: messageData.mediaUrl,
      mimetype: messageData.mimetype,
      caption: messageData.caption,
    };

    this.logger.log(`[transformChangeEvent] Final contactName in data: ${data.contactName}, username: ${data.username}`);

    return {
      event: "messages.upsert",
      instance: pageId,
      source: "instagram",
      data,
    };
  }

  private extractMessageContent(message: InstagramMessage): {
    content: string;
    type: "text" | "audio" | "image" | "document" | "sticker" | "video";
    mediaUrl?: string;
    mimetype?: string;
    caption?: string;
  } | null {
    if (message.text) {
      return {
        content: message.text,
        type: "text",
      };
    }

    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      const url = attachment.payload.url;

      if (!url) {
        this.logger.warn("Attachment without URL", { type: attachment.type });
        return {
          content: "[Mídia não disponível]",
          type: "text",
        };
      }

      switch (attachment.type) {
        case "image":
          return {
            content: url,
            type: "image",
            mediaUrl: url,
            mimetype: "image/jpeg",
          };

        case "video":
          return {
            content: url,
            type: "video",
            mediaUrl: url,
            mimetype: "video/mp4",
          };

        case "audio":
          return {
            content: url,
            type: "audio",
            mediaUrl: url,
            mimetype: "audio/mpeg",
          };

        case "file":
          return {
            content: url,
            type: "document",
            mediaUrl: url,
            mimetype: "application/octet-stream",
          };

        default:
          this.logger.warn(`Unsupported attachment type: ${attachment.type}`, {
            url,
          });
          return {
            content: url || `[${attachment.type}]`,
            type: attachment.type === "story_mention" || attachment.type === "story_reply" ? "image" : "text" as const,
            mediaUrl: url || undefined,
            mimetype: url ? "image/jpeg" : undefined,
          };
      }
    }

    this.logger.warn("Instagram message without text or attachments");
    return {
      content: "[Mensagem recebida sem conteúdo]",
      type: "text",
    };
  }

  private async fetchInstagramUserInfo(
    instagramUserId: string,
    pageId: string
  ): Promise<{ name: string | null; username: string | null } | null> {
    try {
      this.logger.log(`[fetchInstagramUserInfo] Starting fetch for user ${instagramUserId} on page ${pageId}`);

      const sql = this.mainDatabaseService.getConnection();
      if (!sql) {
        this.logger.warn("Database connection not available");
        return null;
      }

      const channels = await sql<Array<{ payload: Record<string, unknown> }>>`
        SELECT payload
        FROM channels
        WHERE type = 'instagram'
          AND (
            payload->>'pageId' = ${pageId}
            OR payload->>'igUserId' = ${pageId}
            OR payload->>'instagramId' = ${pageId}
          )
        LIMIT 1
      `;

      if (channels.length === 0 || !channels[0].payload) {
        this.logger.warn(`Instagram channel not found for pageId: ${pageId}`);
        return null;
      }

      const payload = channels[0].payload as { accessToken?: string };
      const accessToken = payload.accessToken;

      if (!accessToken) {
        this.logger.warn(`No access token found for Instagram page: ${pageId}`);
        return null;
      }

      this.logger.log(`[fetchInstagramUserInfo] Found access token, calling Instagram Graph API for user ${instagramUserId}`);

      const fields = "name,username";
      const url = `https://graph.instagram.com/v22.0/${instagramUserId}?fields=${fields}&access_token=${accessToken}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        const errorCode = error?.error?.code;
        const errorMessage = error?.error?.message;

        if (errorCode === 230 || errorCode === 9010 || errorCode === 190) {
          this.logger.log(
            `[fetchInstagramUserInfo] Cannot fetch Instagram user ${instagramUserId}: ${errorMessage} (Code: ${errorCode})`
          );
          return null;
        }

        this.logger.warn(
          `[fetchInstagramUserInfo] Failed to fetch Instagram user ${instagramUserId}: ${errorMessage} (Code: ${errorCode})`
        );
        return null;
      }

      const userInfo = await response.json();
      const name = userInfo.name || null;
      const username = userInfo.username || null;

      if (name || username) {
        this.logger.log(`[fetchInstagramUserInfo] SUCCESS: Fetched name="${name}", username="${username}" for user ${instagramUserId}`);
      } else {
        this.logger.warn(`[fetchInstagramUserInfo] Graph API returned no name or username for user ${instagramUserId}`);
      }

      return { name, username };
    } catch (error) {
      this.logger.error(
        `[fetchInstagramUserInfo] ERROR fetching Instagram user ${instagramUserId}:`,
        error
      );
      return null;
    }
  }
}
