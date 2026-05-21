export interface MetaRabbitMQMessage<T = unknown> {
  event: string;
  instance: string;
  source: "whatsapp" | "instagram" | "evolution" | "meta_api" | "internal";
  data: T;
}

export interface MetaMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface MetaMediaMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  mediaKey?: string;
}

export interface MetaInteractiveReply {
  id: string;
  title: string;
  description?: string;
}

export interface MetaReactionMessage {
  key: MetaMessageKey;
  text: string;
}

export interface MetaLocationMessage {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  url?: string;
}

export interface MetaMessagesUpsertData {
  key: MetaMessageKey;
  message: {
    conversation?: string;
    imageMessage?: MetaMediaMessage;
    audioMessage?: MetaMediaMessage;
    videoMessage?: MetaMediaMessage;
    documentMessage?: MetaMediaMessage & { title?: string };
    stickerMessage?: MetaMediaMessage;
    interactiveReply?: MetaInteractiveReply;
    reactionMessage?: MetaReactionMessage;
    locationMessage?: MetaLocationMessage;
  };
  messageTimestamp: number;
  pushName: string;
  quotedMessageId?: string;
  editedMessageId?: string;
}

export interface MetaMessagesUpdateData {
  key: MetaMessageKey;
  status: "sent" | "delivered" | "read" | "failed";
  error?: {
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  };
}

export interface MetaConnectionUpdateData {
  state: "connected" | "disconnected" | "token_refresh_needed";
  statusReason?: string;
}
