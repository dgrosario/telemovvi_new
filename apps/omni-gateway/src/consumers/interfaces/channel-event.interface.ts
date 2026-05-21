export type ChannelSource = "evolution" | "whatsapp" | "instagram" | "messenger";

export interface ChannelEvent<T = unknown> {
  type:
    | "connection.update"
    | "qrcode.update"
    | "contacts.upsert"
    | "messages.update"
    | "messages.status";
  instanceName: string;
  timestamp: Date;
  source: ChannelSource;
  data: T;
}

export interface ConnectionUpdateData {
  state: "open" | "close" | "connecting";
  phoneNumber?: string;
  statusReason?: number;
}

export interface QrcodeUpdateData {
  qrcode: string;
}

export interface ContactsUpsertData {
  phoneNumber?: string;
}

export interface MessageUpdateData {
  messageId: string;
  remoteJid: string;
  newContent: string;
  editedAt: Date;
}

export type MessageStatus = "sent" | "delivered" | "read" | "played" | "failed";

export interface MessageStatusData {
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  status: MessageStatus;
  statusCode: number;
}
