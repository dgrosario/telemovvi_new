import { Injectable, Logger } from "@nestjs/common";
import {
  MetaRabbitMQMessage,
  MetaMessagesUpsertData,
  MetaMessagesUpdateData,
} from "../publishers/interfaces/meta-event.interface";

interface WhatsAppInteractiveReply {
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
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
  interactive?: WhatsAppInteractiveReply;
  button?: { text: string; payload: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    url?: string;
  };
  contacts?: Array<{
    name: { formatted_name: string };
    phones?: Array<{ phone: string; type?: string }>;
  }>;
  order?: Record<string, unknown>;
  context?: { id?: string; message_id?: string; from?: string };
  revoke?: { original_message_id: string };
  edit?: {
    original_message_id: string;
    message: { type: string; text?: { body: string } };
  };
}

interface WhatsAppWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: {
      details?: string;
    };
  }>;
}

interface WhatsAppWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: WhatsAppWebhookMessage[];
  statuses?: WhatsAppWebhookStatus[];
}

@Injectable()
export class WhatsAppTransformer {
  private readonly logger = new Logger(WhatsAppTransformer.name);

  transformMessagesUpsert(
    value: WhatsAppWebhookValue
  ): MetaRabbitMQMessage<MetaMessagesUpsertData>[] {
    const results: MetaRabbitMQMessage<MetaMessagesUpsertData>[] = [];

    if (!value.messages || value.messages.length === 0) {
      return results;
    }

    const phoneNumberId = value.metadata.phone_number_id;
    const contactName = value.contacts?.[0]?.profile?.name || "";

    for (const message of value.messages) {
      const messageData = this.extractMessageContent(message);

      if (!messageData) {
        this.logger.warn(
          `Invalid WhatsApp message payload: type=${message.type}, id=${message.id}`
        );
        continue;
      }

      const data: MetaMessagesUpsertData = {
        key: {
          remoteJid: `${message.from}@s.whatsapp.net`,
          fromMe: false,
          id: message.id,
        },
        message: messageData.message,
        messageTimestamp: parseInt(message.timestamp, 10),
        pushName: contactName,
        quotedMessageId: message.context?.id ?? message.context?.message_id,
      };

      if (messageData.isEdit && messageData.message.editedMessageId) {
        data.editedMessageId = messageData.message.editedMessageId;
      }

      if (messageData.isUnsupported) {
        this.logger.warn(
          `Unsupported message type received, using placeholder: ${messageData.unsupportedType || message.type} (${message.id})`
        );
      }

      if (data.quotedMessageId) {
        this.logger.log(
          `Message ${message.id} is a reply to ${data.quotedMessageId}`
        );
      }

      results.push({
        event: "messages.upsert",
        instance: phoneNumberId,
        source: "whatsapp",
        data,
      });
    }

    return results;
  }

  transformMessagesUpdate(
    value: WhatsAppWebhookValue
  ): MetaRabbitMQMessage<MetaMessagesUpdateData>[] {
    const results: MetaRabbitMQMessage<MetaMessagesUpdateData>[] = [];

    if (!value.statuses || value.statuses.length === 0) {
      return results;
    }

    const phoneNumberId = value.metadata.phone_number_id;

    for (const status of value.statuses) {
      const mappedStatus = this.mapStatus(status.status);

      if (!mappedStatus) {
        continue;
      }

      const data: MetaMessagesUpdateData = {
        key: {
          remoteJid: `${status.recipient_id}@s.whatsapp.net`,
          fromMe: true,
          id: status.id,
        },
        status: mappedStatus,
        ...(mappedStatus === "failed"
          ? {
              error: this.extractStatusError(status),
            }
          : {}),
      };

      results.push({
        event: "messages.update",
        instance: phoneNumberId,
        source: "whatsapp",
        data,
      });
    }

    return results;
  }

  private extractMessageContent(message: WhatsAppWebhookMessage): {
    message: MetaMessagesUpsertData["message"] & { editedMessageId?: string };
    isUnsupported?: boolean;
    unsupportedType?: string;
    isEdit?: boolean;
  } | null {
    switch (message.type) {
      case "text":
        return {
          message: {
            conversation: message.text?.body || "",
          },
        };

      case "image":
        return {
          message: {
            imageMessage: {
              mediaKey: message.image?.id,
              mimetype: message.image?.mime_type,
              caption: message.image?.caption,
            },
          },
        };

      case "audio":
        return {
          message: {
            audioMessage: {
              mediaKey: message.audio?.id,
              mimetype: message.audio?.mime_type,
            },
          },
        };

      case "video":
        return {
          message: {
            videoMessage: {
              mediaKey: message.video?.id,
              mimetype: message.video?.mime_type,
              caption: message.video?.caption,
            },
          },
        };

      case "document":
        return {
          message: {
            documentMessage: {
              mediaKey: message.document?.id,
              mimetype: message.document?.mime_type,
              title: message.document?.filename,
              caption: message.document?.caption,
            },
          },
        };

      case "sticker":
        return {
          message: {
            stickerMessage: {
              mediaKey: message.sticker?.id,
              mimetype: message.sticker?.mime_type,
            },
          },
        };

      case "interactive": {
        const reply =
          message.interactive?.button_reply || message.interactive?.list_reply;

        if (!reply) {
          this.logger.warn(`Unknown interactive subtype`, {
            messageId: message.id,
            keys: Object.keys(message.interactive ?? {}),
          });
          return {
            message: {
              conversation: `[Resposta interativa não suportada]`,
            },
            isUnsupported: true,
            unsupportedType: `interactive:${Object.keys(message.interactive ?? {}).join(",")}`,
          };
        }

        return {
          message: {
            conversation: reply.title || reply.id,
            interactiveReply: {
              id: reply.id,
              title: reply.title,
              description:
                message.interactive?.list_reply?.description || undefined,
            },
          },
        };
      }

      case "reaction": {
        const targetMessageId = message.reaction?.message_id;
        if (!targetMessageId) {
          return null;
        }

        return {
          message: {
            reactionMessage: {
              key: {
                id: targetMessageId,
                remoteJid: `${message.from}@s.whatsapp.net`,
                fromMe: false,
              },
              text: message.reaction?.emoji || "",
            },
          },
        };
      }

      case "button": {
        const buttonText =
          message.button?.text || message.button?.payload || "";
        return {
          message: {
            conversation: buttonText,
            interactiveReply: {
              id: message.button?.payload || "",
              title: buttonText,
            },
          },
        };
      }

      case "location": {
        const loc = message.location;
        const locationText = loc?.name
          ? `${loc.name} (${loc.latitude}, ${loc.longitude})`
          : `Localização: ${loc?.latitude}, ${loc?.longitude}`;
        return {
          message: {
            conversation: locationText,
            locationMessage: {
              latitude: loc?.latitude,
              longitude: loc?.longitude,
              name: loc?.name,
              address: loc?.address,
              url: loc?.url,
            },
          },
        };
      }

      case "contacts": {
        const contact = message.contacts?.[0];
        const contactName = contact?.name?.formatted_name || "Contato";
        const phone = contact?.phones?.[0]?.phone || "";
        return {
          message: {
            conversation: `[Contato] ${contactName}${phone ? ` - ${phone}` : ""}`,
          },
        };
      }

      case "order":
        return {
          message: {
            conversation: "[Pedido recebido via catálogo]",
          },
        };

      case "revoke":
        return null;

      case "edit": {
        const editedMessageId = message.edit?.original_message_id;
        const newContent = message.edit?.message?.text?.body;
        if (!editedMessageId || !newContent) {
          return null;
        }
        return {
          message: {
            conversation: newContent,
            editedMessageId,
          },
          isEdit: true,
        };
      }

      case "system":
        return null;

      case "request_welcome":
        return null;

      default:
        this.logger.warn(
          `Unhandled message type: ${message.type}`,
          {
            messageId: message.id,
            type: message.type,
            keys: Object.keys(message),
          }
        );
        return {
          message: {
            conversation: `[Tipo de mensagem não suportado: ${message.type}]`,
          },
          isUnsupported: true,
          unsupportedType: message.type,
        };
    }
  }

  private mapStatus(status: string): "sent" | "delivered" | "read" | "failed" | null {
    switch (status.toLowerCase()) {
      case "sent":
        return "sent";
      case "delivered":
        return "delivered";
      case "read":
        return "read";
      case "failed":
        return "failed";
      default:
        return null;
    }
  }

  private extractStatusError(
    status: WhatsAppWebhookStatus
  ): MetaMessagesUpdateData["error"] | undefined {
    const firstError = status.errors?.[0];
    if (!firstError) {
      return undefined;
    }

    return {
      code: firstError.code,
      title: firstError.title,
      message: firstError.message,
      details: firstError.error_data?.details,
    };
  }
}
