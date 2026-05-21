import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Message } from "@omnichannel/core/domain/entities/message";

export interface ChannelCapabilities {
  supportedMessageTypes: Message.Type[];
  supportsVoiceNotes: boolean;
  supportsDocuments: boolean;
  supportsInteractiveMenus: boolean;
  supportsQuickReplies: boolean;
  maxImageSize: number;
  maxVideoSize: number;
  maxAudioSize: number;
  maxDocumentSize: number;
}

const WHATSAPP_CAPABILITIES: ChannelCapabilities = {
  supportedMessageTypes: [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "template",
  ],
  supportsVoiceNotes: true,
  supportsDocuments: true,
  supportsInteractiveMenus: true,
  supportsQuickReplies: true,
  maxImageSize: 5 * 1024 * 1024,
  maxVideoSize: 16 * 1024 * 1024,
  maxAudioSize: 16 * 1024 * 1024,
  maxDocumentSize: 100 * 1024 * 1024,
};

const INSTAGRAM_CAPABILITIES: ChannelCapabilities = {
  supportedMessageTypes: ["text", "image", "audio", "video", "sticker"],
  supportsVoiceNotes: false,
  supportsDocuments: false,
  supportsInteractiveMenus: false,
  supportsQuickReplies: true,
  maxImageSize: 8 * 1024 * 1024,
  maxVideoSize: 25 * 1024 * 1024,
  maxAudioSize: 25 * 1024 * 1024,
  maxDocumentSize: 0,
};

const EVOLUTION_CAPABILITIES: ChannelCapabilities = {
  supportedMessageTypes: [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "template",
  ],
  supportsVoiceNotes: true,
  supportsDocuments: true,
  supportsInteractiveMenus: true,
  supportsQuickReplies: true,
  maxImageSize: 16 * 1024 * 1024,
  maxVideoSize: 16 * 1024 * 1024,
  maxAudioSize: 16 * 1024 * 1024,
  maxDocumentSize: 100 * 1024 * 1024,
};

const META_API_CAPABILITIES: ChannelCapabilities = {
  supportedMessageTypes: [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "template",
  ],
  supportsVoiceNotes: true,
  supportsDocuments: true,
  supportsInteractiveMenus: true,
  supportsQuickReplies: true,
  maxImageSize: 5 * 1024 * 1024,
  maxVideoSize: 16 * 1024 * 1024,
  maxAudioSize: 16 * 1024 * 1024,
  maxDocumentSize: 100 * 1024 * 1024,
};

const INTERNAL_CAPABILITIES: ChannelCapabilities = {
  supportedMessageTypes: [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
  ],
  supportsVoiceNotes: true,
  supportsDocuments: true,
  supportsInteractiveMenus: false,
  supportsQuickReplies: false,
  maxImageSize: 50 * 1024 * 1024,
  maxVideoSize: 50 * 1024 * 1024,
  maxAudioSize: 50 * 1024 * 1024,
  maxDocumentSize: 50 * 1024 * 1024,
};

const CAPABILITIES_MAP: Record<Channel.Type, ChannelCapabilities> = {
  whatsapp: WHATSAPP_CAPABILITIES,
  instagram: INSTAGRAM_CAPABILITIES,
  evolution: EVOLUTION_CAPABILITIES,
  meta_api: META_API_CAPABILITIES,
};

export function getChannelCapabilities(
  channelType: Channel.Type | undefined | null,
): ChannelCapabilities {
  if (!channelType) {
    return INTERNAL_CAPABILITIES;
  }
  return CAPABILITIES_MAP[channelType] ?? INTERNAL_CAPABILITIES;
}

export function isMessageTypeSupported(
  channelType: Channel.Type | undefined | null,
  messageType: Message.Type,
): boolean {
  const capabilities = getChannelCapabilities(channelType);
  return capabilities.supportedMessageTypes.includes(messageType);
}

export function canSendVoiceNote(
  channelType: Channel.Type | undefined | null,
): boolean {
  return getChannelCapabilities(channelType).supportsVoiceNotes;
}

export function canSendDocument(
  channelType: Channel.Type | undefined | null,
): boolean {
  return getChannelCapabilities(channelType).supportsDocuments;
}

export interface UnsupportedMessageError {
  type: "unsupported_message_type";
  channelType: Channel.Type;
  messageType: Message.Type;
  message: string;
}

export interface FileTooLargeError {
  type: "file_too_large";
  channelType: Channel.Type;
  maxSize: number;
  actualSize: number;
  message: string;
}

export interface UnsupportedMimeTypeError {
  type: "unsupported_mime_type";
  channelType: Channel.Type;
  mimeType: string;
  message: string;
}

export type ChannelValidationError =
  | UnsupportedMessageError
  | FileTooLargeError
  | UnsupportedMimeTypeError;

const CHANNEL_DISPLAY_NAMES: Record<Channel.Type, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  evolution: "WhatsApp",
  meta_api: "Meta API",
};

const MESSAGE_TYPE_DISPLAY_NAMES: Record<Message.Type, string> = {
  text: "texto",
  image: "imagem",
  audio: "áudio",
  video: "vídeo",
  document: "documento",
  sticker: "figurinha",
  template: "template",
  location: "localização",
};

export function validateMessageForChannel(
  channelType: Channel.Type | undefined | null,
  messageType: Message.Type,
  fileSize?: number,
): ChannelValidationError | null {
  if (!channelType) {
    return null;
  }

  const capabilities = getChannelCapabilities(channelType);
  const channelName = CHANNEL_DISPLAY_NAMES[channelType];
  const messageTypeName = MESSAGE_TYPE_DISPLAY_NAMES[messageType];

  if (!capabilities.supportedMessageTypes.includes(messageType)) {
    return {
      type: "unsupported_message_type",
      channelType,
      messageType,
      message: `O ${channelName} nao suporta envio de ${messageTypeName}. Este tipo de mensagem nao pode ser enviado por este canal.`,
    };
  }

  if (fileSize) {
    let maxSize = 0;
    switch (messageType) {
      case "image":
        maxSize = capabilities.maxImageSize;
        break;
      case "video":
        maxSize = capabilities.maxVideoSize;
        break;
      case "audio":
        maxSize = capabilities.maxAudioSize;
        break;
      case "document":
        maxSize = capabilities.maxDocumentSize;
        break;
    }

    if (maxSize > 0 && fileSize > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      return {
        type: "file_too_large",
        channelType,
        maxSize,
        actualSize: fileSize,
        message: `O arquivo (${actualSizeMB}MB) excede o limite de ${maxSizeMB}MB permitido pelo ${channelName}.`,
      };
    }
  }

  return null;
}

const META_SUPPORTED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

const META_SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const META_SUPPORTED_VIDEO_MIMES = new Set(["video/mp4", "video/3gpp"]);

const META_SUPPORTED_AUDIO_MIMES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
  "audio/opus",
]);

const MIME_SETS_BY_MESSAGE_TYPE: Partial<Record<Message.Type, Set<string>>> = {
  document: META_SUPPORTED_DOCUMENT_MIMES,
  image: META_SUPPORTED_IMAGE_MIMES,
  video: META_SUPPORTED_VIDEO_MIMES,
  audio: META_SUPPORTED_AUDIO_MIMES,
};

const READABLE_FORMATS: Partial<Record<Message.Type, string>> = {
  document: "PDF, Word, Excel, PowerPoint, TXT e ZIP",
  image: "JPEG, PNG e WebP",
  video: "MP4 e 3GPP",
  audio: "AAC, MP3, MP4, AMR, OGG e Opus",
};

const META_MIME_ALIAS_MAP: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "audio/mp3": "audio/mpeg",
};

const STRICT_META_MIME_CHANNEL_TYPES = new Set<Channel.Type>([
  "whatsapp",
  "meta_api",
]);

function normalizeMimeTypeForValidation(mimeType: string): string {
  const trimmed = mimeType.trim().toLowerCase();
  const withoutParameters = trimmed.split(";")[0]?.trim() ?? trimmed;
  return META_MIME_ALIAS_MAP[withoutParameters] ?? withoutParameters;
}

export function validateMimeTypeForChannel(
  channelType: Channel.Type | undefined | null,
  messageType: Message.Type,
  mimeType: string,
): ChannelValidationError | null {
  if (!channelType || !STRICT_META_MIME_CHANNEL_TYPES.has(channelType)) {
    return null;
  }

  const allowedMimes = MIME_SETS_BY_MESSAGE_TYPE[messageType];
  if (!allowedMimes) {
    return null;
  }

  const normalizedMimeType = normalizeMimeTypeForValidation(mimeType);
  if (allowedMimes.has(normalizedMimeType)) {
    return null;
  }

  const channelName = CHANNEL_DISPLAY_NAMES[channelType];
  const formats = READABLE_FORMATS[messageType] ?? messageType;

  return {
    type: "unsupported_mime_type",
    channelType,
    mimeType,
    message: `Formato de arquivo nao suportado pelo ${channelName}. Formatos aceitos: ${formats}.`,
  };
}

export function getUnsupportedFeaturesMessage(
  channelType: Channel.Type,
): string[] {
  const messages: string[] = [];
  const capabilities = getChannelCapabilities(channelType);
  const channelName = CHANNEL_DISPLAY_NAMES[channelType];

  if (!capabilities.supportsDocuments) {
    messages.push(
      `${channelName} nao suporta envio de documentos (PDF, Word, Excel)`,
    );
  }

  if (!capabilities.supportsVoiceNotes) {
    messages.push(`${channelName} nao suporta envio de mensagens de voz`);
  }

  if (!capabilities.supportsInteractiveMenus) {
    messages.push(
      `${channelName} nao suporta menus interativos (botoes serao convertidos para texto)`,
    );
  }

  return messages;
}
