export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

export interface EvolutionContextInfo {
  stanzaId?: string;
  participant?: string;
  quotedMessage?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { title?: string };
  };
}

export interface EvolutionMessagesUpsertData {
  key: EvolutionMessageKey;
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: EvolutionContextInfo;
    };
    imageMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
      fileSha256: string;
      fileLength: string;
      mediaKey: string;
      contextInfo?: EvolutionContextInfo;
    };
    audioMessage?: {
      url: string;
      mimetype: string;
      fileSha256: string;
      fileLength: string;
      seconds: number;
      ptt: boolean;
      mediaKey: string;
      contextInfo?: EvolutionContextInfo;
    };
    documentMessage?: {
      url: string;
      mimetype: string;
      title: string;
      fileSha256: string;
      fileLength: string;
      mediaKey: string;
      contextInfo?: EvolutionContextInfo;
    };
    stickerMessage?: {
      url: string;
      mimetype: string;
      fileSha256: string;
      fileLength: string;
      mediaKey: string;
      contextInfo?: EvolutionContextInfo;
    };
    videoMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
      fileSha256: string;
      fileLength: string;
      seconds: number;
      mediaKey: string;
      contextInfo?: EvolutionContextInfo;
    };
    locationMessage?: {
      degreesLatitude: number;
      degreesLongitude: number;
      name?: string;
      address?: string;
      url?: string;
      contextInfo?: EvolutionContextInfo;
    };
  };
  contextInfo?: EvolutionContextInfo;
  messageTimestamp: number;
  pushName: string;
  messageType?: string;
  groupName?: string;
}

export interface EvolutionEditedMessage {
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
}

export interface EvolutionMessagesUpdateData {
  // Formato antigo (nested)
  key?: EvolutionMessageKey;
  update?: {
    status?: number;
    message?: {
      editedMessage?: EvolutionEditedMessage;
    };
    messageTimestamp?: number;
  };
  // Formato novo (flat) - Evolution API v2
  keyId?: string;
  remoteJid?: string;
  fromMe?: boolean;
  status?: string;
  instanceId?: string;
  messageId?: string;
}

export interface EvolutionProtocolMessageReference {
  key?: Partial<EvolutionMessageKey>;
  type?: string | number;
}

export interface EvolutionMessagesDeleteData {
  // Formato direto (Evolution API v2 / docs atuais)
  id?: string;
  remoteJid?: string;
  fromMe?: boolean;
  status?: string;
  messageId?: string;
  targetMessageId?: string;
  key?: EvolutionMessageKey;
  // Formatos observados em payloads de revoke/protocol message
  message?: {
    protocolMessage?: EvolutionProtocolMessageReference;
  };
  protocolMessage?: EvolutionProtocolMessageReference;
}

export function extractEvolutionDeleteEventInfo(
  data: EvolutionMessagesDeleteData
): {
  rawDeleteEventId: string | null;
  targetMessageId: string | null;
  remoteJid: string | null;
} {
  const protocolKey =
    data.message?.protocolMessage?.key ?? data.protocolMessage?.key ?? null;

  return {
    rawDeleteEventId:
      data.id ?? data.key?.id ?? data.messageId ?? data.targetMessageId ?? null,
    targetMessageId:
      protocolKey?.id ??
      data.targetMessageId ??
      data.messageId ??
      data.id ??
      data.key?.id ??
      null,
    remoteJid:
      protocolKey?.remoteJid ?? data.remoteJid ?? data.key?.remoteJid ?? null,
  };
}

export interface EvolutionSendMessageData {
  key: EvolutionMessageKey;
  message: EvolutionMessagesUpsertData["message"];
  messageTimestamp: number;
  status: string;
}

export interface EvolutionConnectionUpdateData {
  state: "open" | "close" | "connecting";
  statusReason?: number;
}

export interface EvolutionQrcodeUpdateData {
  qrcode: {
    base64: string;
    code?: string;
  };
}

export interface EvolutionContactData {
  id: string;
  name?: string;
  notify?: string;
  imgUrl?: string;
}

export interface EvolutionContactsUpsertData {
  contacts: EvolutionContactData[];
}

export interface EvolutionPresenceUpdateData {
  id: string;
  presences: {
    [jid: string]: {
      lastKnownPresence: "available" | "unavailable" | "composing" | "recording" | "paused";
      lastSeen?: number;
    };
  };
}

export namespace EvolutionEvent {
  export type MessageKey = EvolutionMessageKey;
  export type MessagesUpsertData = EvolutionMessagesUpsertData;
  export type MessagesUpdateData = EvolutionMessagesUpdateData;
  export type MessagesDeleteData = EvolutionMessagesDeleteData;
  export type SendMessageData = EvolutionSendMessageData;
  export type ConnectionUpdateData = EvolutionConnectionUpdateData;
  export type QrcodeUpdateData = EvolutionQrcodeUpdateData;
  export type ContactData = EvolutionContactData;
  export type ContactsUpsertData = EvolutionContactsUpsertData;
  export type PresenceUpdateData = EvolutionPresenceUpdateData;
}
