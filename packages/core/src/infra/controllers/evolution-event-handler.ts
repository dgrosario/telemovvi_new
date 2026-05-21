import type { Server as SocketIOServer } from "socket.io";
import { RabbitMQMessage } from "../drivers/rabbitmq-consumer-driver";
import {
  EvolutionEvent,
  EvolutionMessagesUpsertData,
  EvolutionMessagesUpdateData,
  EvolutionMessagesDeleteData,
  extractEvolutionDeleteEventInfo,
  EvolutionSendMessageData,
  EvolutionConnectionUpdateData,
  EvolutionQrcodeUpdateData,
  EvolutionContactData,
  EvolutionContactsUpsertData,
  EvolutionPresenceUpdateData,
} from "./evolution-event-types";
import { Channel } from "../../domain/entities/channel";
import { PhoneNormalizer } from "../../domain/services/phone-normalizer";

export type { EvolutionEvent } from "./evolution-event-types";

export type OnMessageReceivedProps = {
  instanceName: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  content: string;
  type: "text" | "audio" | "image" | "document" | "sticker" | "video" | "location";
  timestamp: number;
  contactName: string;
  username?: string;
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
  filename?: string;
  mediaKey?: string;
  expectedChannelType?: Channel.Type;
  isGroup: boolean;
  groupJid?: string;
  groupName?: string;
  participantJid?: string;
  participantName?: string;
  quotedMessageId?: string;
};

export type OnMessageStatusUpdateProps = {
  instanceName: string;
  messageId: string;
  remoteJid: string;
  status: "sent" | "delivered" | "viewed" | "failed";
  error?: {
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  };
};

export type OnConnectionUpdateProps = {
  instanceName: string;
  state: "open" | "close" | "connecting";
  statusReason?: number;
};

export type OnQrcodeUpdateProps = {
  instanceName: string;
  qrcodeBase64: string;
};

export type OnContactUpsertProps = {
  instanceName: string;
  contactId: string;
  contactName: string;
  contactThumbnail?: string;
};

export type OnPresenceUpdateProps = {
  instanceName: string;
  remoteJid: string;
  presence: "available" | "unavailable" | "composing" | "recording" | "paused";
  lastSeen?: number;
};

export type OnMessageDeleteProps = {
  instanceName: string;
  messageId: string;
  remoteJid: string;
};

export type OnSendMessageProps = {
  instanceName: string;
  messageId: string;
  remoteJid: string;
  status: string;
  timestamp: number;
};

export type OnMessageEditProps = {
  instanceName: string;
  messageId: string;
  remoteJid: string;
  newContent: string;
  editedAt: number;
};

export interface EvolutionEventHandlerCallbacks {
  onMessageReceived: (props: OnMessageReceivedProps) => Promise<void>;
  onMessageStatusUpdate: (props: OnMessageStatusUpdateProps) => Promise<void>;
  onConnectionUpdate: (props: OnConnectionUpdateProps) => Promise<void>;
  onQrcodeUpdate: (props: OnQrcodeUpdateProps) => Promise<void>;
  onContactUpsert?: (props: OnContactUpsertProps) => Promise<void>;
  onPresenceUpdate?: (props: OnPresenceUpdateProps) => Promise<void>;
  onMessageDelete?: (props: OnMessageDeleteProps) => Promise<void>;
  onSendMessage?: (props: OnSendMessageProps) => Promise<void>;
  onMessageEdit?: (props: OnMessageEditProps) => Promise<void>;
}

export class EvolutionEventHandler {
  private callbacks: EvolutionEventHandlerCallbacks;
  private io?: SocketIOServer;

  constructor(callbacks: EvolutionEventHandlerCallbacks, io?: SocketIOServer) {
    this.callbacks = callbacks;
    this.io = io;
  }

  private extractPhoneNumber(remoteJid: string): string {
    return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  }

  private mapEvolutionStatus(status: number | string): "sent" | "delivered" | "viewed" | "failed" {
    // Formato string (Evolution API v2)
    if (typeof status === "string") {
      switch (status.toUpperCase()) {
        case "SERVER_ACK":
        case "PENDING":
          return "sent";
        case "DELIVERY_ACK":
          return "delivered";
        case "READ":
        case "PLAYED":
          return "viewed";
        case "ERROR":
        case "FAILED":
          return "failed";
        default:
          return "sent";
      }
    }
    // Formato numero (formato antigo)
    switch (status) {
      case 2:
        return "sent";
      case 3:
        return "delivered";
      case 4:
        return "viewed";
      case 5:
        return "failed";
      default:
        return "sent";
    }
  }

  private normalizeMediaKey(mediaKey: unknown): string | undefined {
    if (!mediaKey) return undefined;

    if (typeof mediaKey === "string") {
      return mediaKey;
    }

    if (Buffer.isBuffer(mediaKey)) {
      return mediaKey.toString("base64");
    }

    if (mediaKey instanceof Uint8Array) {
      return Buffer.from(mediaKey).toString("base64");
    }

    if (typeof mediaKey === "object" && mediaKey !== null) {
      const obj = mediaKey as Record<string, unknown>;
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return Buffer.from(obj.data as number[]).toString("base64");
      }
    }

    return undefined;
  }

  private extractMessageContent(
    message: EvolutionMessagesUpsertData["message"]
  ): {
    content: string;
    type: "text" | "audio" | "image" | "document" | "sticker" | "video" | "location";
    mediaUrl?: string;
    mimetype?: string;
    caption?: string;
    filename?: string;
    mediaKey?: string;
    quotedMessageId?: string;
  } {
    if (message.conversation) {
      return {
        content: message.conversation,
        type: "text",
      };
    }

    if (message.extendedTextMessage) {
      return {
        content: message.extendedTextMessage.text,
        type: "text",
        quotedMessageId: message.extendedTextMessage.contextInfo?.stanzaId,
      };
    }

    if (message.imageMessage) {
      return {
        content: message.imageMessage.url,
        type: "image",
        mediaUrl: message.imageMessage.url,
        mimetype: message.imageMessage.mimetype,
        caption: message.imageMessage.caption,
        mediaKey: this.normalizeMediaKey(message.imageMessage.mediaKey),
        quotedMessageId: message.imageMessage.contextInfo?.stanzaId,
      };
    }

    if (message.audioMessage) {
      return {
        content: message.audioMessage.url,
        type: "audio",
        mediaUrl: message.audioMessage.url,
        mimetype: message.audioMessage.mimetype,
        mediaKey: this.normalizeMediaKey(message.audioMessage.mediaKey),
        quotedMessageId: message.audioMessage.contextInfo?.stanzaId,
      };
    }

    if (message.documentMessage) {
      return {
        content: message.documentMessage.url,
        type: "document",
        mediaUrl: message.documentMessage.url,
        mimetype: message.documentMessage.mimetype,
        filename: message.documentMessage.title,
        mediaKey: this.normalizeMediaKey(message.documentMessage.mediaKey),
        quotedMessageId: message.documentMessage.contextInfo?.stanzaId,
      };
    }

    if (message.stickerMessage) {
      return {
        content: message.stickerMessage.url,
        type: "sticker",
        mediaUrl: message.stickerMessage.url,
        mimetype: message.stickerMessage.mimetype,
        mediaKey: this.normalizeMediaKey(message.stickerMessage.mediaKey),
        quotedMessageId: message.stickerMessage.contextInfo?.stanzaId,
      };
    }

    if (message.videoMessage) {
      return {
        content: message.videoMessage.url,
        type: "video",
        mediaUrl: message.videoMessage.url,
        mimetype: message.videoMessage.mimetype,
        caption: message.videoMessage.caption,
        mediaKey: this.normalizeMediaKey(message.videoMessage.mediaKey),
        quotedMessageId: message.videoMessage.contextInfo?.stanzaId,
      };
    }

    if (message.locationMessage) {
      const loc = message.locationMessage;
      const locationData = JSON.stringify({
        latitude: loc.degreesLatitude,
        longitude: loc.degreesLongitude,
        name: loc.name || null,
        address: loc.address || null,
      });
      return {
        content: locationData,
        type: "location",
        quotedMessageId: loc.contextInfo?.stanzaId,
      };
    }

    return {
      content: "",
      type: "text",
    };
  }

  private isGroupJid(remoteJid: string): boolean {
    return remoteJid.endsWith("@g.us");
  }

  async handleMessagesUpsert(
    event: RabbitMQMessage<EvolutionMessagesUpsertData>
  ): Promise<void> {
    const { instance, data } = event;

    if (data.key.fromMe) {
      console.log(
        "[EvolutionEventHandler] Ignoring outgoing message:",
        data.key.id
      );
      return;
    }

    const { content, type, mediaUrl, mimetype, caption, filename, mediaKey, quotedMessageId } =
      this.extractMessageContent(data.message);

    if (!content && !mediaUrl) {
      console.log("[EvolutionEventHandler] Empty message, skipping");
      return;
    }

    const isGroup = this.isGroupJid(data.key.remoteJid);

    const props: OnMessageReceivedProps = {
      instanceName: instance,
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      fromMe: data.key.fromMe,
      content,
      type,
      timestamp: data.messageTimestamp,
      contactName: data.pushName || (PhoneNormalizer.isLinkedId(data.key.remoteJid) ? "" : this.extractPhoneNumber(data.key.remoteJid)),
      mediaUrl,
      mimetype,
      caption,
      filename,
      mediaKey,
      expectedChannelType: "evolution",
      isGroup,
      groupJid: isGroup ? data.key.remoteJid : undefined,
      groupName: isGroup ? data.groupName : undefined,
      participantJid: isGroup ? data.key.participant : undefined,
      participantName: isGroup ? data.pushName : undefined,
      quotedMessageId,
    };

    console.log(
      "[EvolutionEventHandler] Processing incoming message:",
      props.messageId,
      isGroup ? `(group: ${data.key.remoteJid})` : "",
      quotedMessageId ? `(reply to: ${quotedMessageId})` : ""
    );

    await this.callbacks.onMessageReceived(props);
  }

  async handleMessagesUpdate(
    event: RabbitMQMessage<
      EvolutionMessagesUpdateData | EvolutionMessagesUpdateData[]
    >
  ): Promise<void> {
    const { instance, data } = event;

    // Normalizar para array - Evolution API pode enviar objeto unico ou array
    const updates = Array.isArray(data) ? data : [data];

    for (const update of updates) {
      const messageId = update.keyId ?? update?.key?.id;
      const remoteJid = update.remoteJid ?? update?.key?.remoteJid;

      if (!messageId || !remoteJid) continue;

      // Verificar se e uma edicao de mensagem
      const editedMessage = update.update?.message?.editedMessage;
      if (editedMessage && this.callbacks.onMessageEdit) {
        const newContent =
          editedMessage.message?.conversation ||
          editedMessage.message?.extendedTextMessage?.text ||
          "";

        if (newContent) {
          const editProps: OnMessageEditProps = {
            instanceName: instance,
            messageId,
            remoteJid,
            newContent,
            editedAt: update.update?.messageTimestamp || Date.now(),
          };

          console.log(
            "[EvolutionEventHandler] Processing message edit:",
            editProps.messageId,
            "-> new content:",
            newContent.substring(0, 50)
          );

          await this.callbacks.onMessageEdit(editProps);
          continue;
        }
      }

      // Suportar AMBOS os formatos: novo (flat) e antigo (nested)
      const rawFromMe = update.fromMe ?? update?.key?.fromMe;

      // Mapear status string ou numero para nosso formato
      const rawStatus = update.status ?? update?.update?.status;
      if (!rawStatus) continue;

      const status = this.mapEvolutionStatus(rawStatus);

      const props: OnMessageStatusUpdateProps = {
        instanceName: instance,
        messageId,
        remoteJid,
        status,
      };

      console.log(
        "[EvolutionEventHandler] Processing status update:",
        props.messageId,
        "->",
        props.status,
        "(rawFromMe:",
        rawFromMe,
        ")"
      );

      await this.callbacks.onMessageStatusUpdate(props);
    }
  }

  async handleConnectionUpdate(
    event: RabbitMQMessage<EvolutionConnectionUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    const props: OnConnectionUpdateProps = {
      instanceName: instance,
      state: data.state,
      statusReason: data.statusReason,
    };

    console.log(
      "[EvolutionEventHandler] Processing connection update:",
      instance,
      "->",
      data.state
    );

    await this.callbacks.onConnectionUpdate(props);

    if (this.io) {
      this.io.emit("channel:connection:update", {
        instanceName: instance,
        state: data.state,
      });
    }
  }

  async handleQrcodeUpdate(
    event: RabbitMQMessage<EvolutionQrcodeUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    const qrcodeBase64 =
      (data as EvolutionQrcodeUpdateData)?.qrcode?.base64 ||
      (data as { base64?: string })?.base64;

    if (!qrcodeBase64) {
      console.log(
        "[EvolutionEventHandler] QR code update without base64, skipping:",
        instance
      );
      return;
    }

    const props: OnQrcodeUpdateProps = {
      instanceName: instance,
      qrcodeBase64,
    };

    console.log("[EvolutionEventHandler] Processing QR code update:", instance);

    await this.callbacks.onQrcodeUpdate(props);

    if (this.io) {
      this.io.emit("channel:qrcode:update", {
        instanceName: instance,
        qrcode: qrcodeBase64,
      });
    }
  }

  async handleContactsUpsert(
    event: RabbitMQMessage<EvolutionContactsUpsertData>
  ): Promise<void> {
    const { instance, data } = event;

    // Quando recebemos contatos, a conexao foi estabelecida com sucesso
    // Evolution API nao envia connection.update com state: "open" via RabbitMQ
    // entao usamos este evento como indicador de conexao bem-sucedida
    await this.callbacks.onConnectionUpdate({
      instanceName: instance,
      state: "open",
    });

    if (!this.callbacks.onContactUpsert) return;

    const rawContacts = (data as EvolutionContactsUpsertData)?.contacts;
    const contacts = Array.isArray(rawContacts)
      ? rawContacts
      : rawContacts
        ? [rawContacts]
        : Array.isArray(data)
          ? (data as EvolutionContactData[])
          : [];

    for (const contact of contacts) {
      if (!contact?.id) continue;

      const props: OnContactUpsertProps = {
        instanceName: instance,
        contactId: contact.id,
        contactName:
          contact.name || contact.notify || this.extractPhoneNumber(contact.id),
        contactThumbnail: contact.imgUrl,
      };

      console.log(
        "[EvolutionEventHandler] Processing contact upsert:",
        props.contactId
      );

      await this.callbacks.onContactUpsert(props);
    }
  }

  async handlePresenceUpdate(
    event: RabbitMQMessage<EvolutionPresenceUpdateData>
  ): Promise<void> {
    const { instance, data } = event;

    if (!this.callbacks.onPresenceUpdate) return;

    for (const [jid, presence] of Object.entries(data.presences)) {
      const props: OnPresenceUpdateProps = {
        instanceName: instance,
        remoteJid: jid,
        presence: presence.lastKnownPresence,
        lastSeen: presence.lastSeen,
      };

      console.log(
        "[EvolutionEventHandler] Processing presence update:",
        jid,
        "->",
        presence.lastKnownPresence
      );

      await this.callbacks.onPresenceUpdate(props);

      if (this.io) {
        this.io.emit("contact:presence:update", {
          instanceName: instance,
          remoteJid: jid,
          presence: presence.lastKnownPresence,
          lastSeen: presence.lastSeen,
        });
      }
    }
  }

  async handleMessagesDelete(
    event: RabbitMQMessage<EvolutionMessagesDeleteData>
  ): Promise<void> {
    const { instance, data } = event;

    if (!this.callbacks.onMessageDelete) return;

    const { targetMessageId, remoteJid } = extractEvolutionDeleteEventInfo(data);

    if (!targetMessageId) {
      console.log(
        "[EvolutionEventHandler] Delete event without target message ID, skipping"
      );
      return;
    }

    const props: OnMessageDeleteProps = {
      instanceName: instance,
      messageId: targetMessageId,
      remoteJid: remoteJid ?? "",
    };

    console.log(
      "[EvolutionEventHandler] Processing message delete:",
      props.messageId
    );

    await this.callbacks.onMessageDelete(props);

    if (this.io) {
      this.io.emit("message:deleted", {
        instanceName: instance,
        messageId: targetMessageId,
        remoteJid: remoteJid ?? "",
      });
    }
  }

  async handleSendMessage(
    event: RabbitMQMessage<EvolutionSendMessageData>
  ): Promise<void> {
    const { instance, data } = event;

    if (!this.callbacks.onSendMessage) return;

    const props: OnSendMessageProps = {
      instanceName: instance,
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      status: data.status,
      timestamp: data.messageTimestamp,
    };

    console.log(
      "[EvolutionEventHandler] Processing send message confirmation:",
      props.messageId
    );

    await this.callbacks.onSendMessage(props);
  }

  static create(
    callbacks: EvolutionEventHandlerCallbacks,
    io?: SocketIOServer
  ): EvolutionEventHandler {
    return new EvolutionEventHandler(callbacks, io);
  }
}
