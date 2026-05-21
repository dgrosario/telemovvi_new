import {
  OutboundChannel,
  OutboundMessageVariable,
  InteractivePayload,
} from "../consumers/interfaces/outbound-message.interface";

export type MediaType = "audio" | "image" | "document" | "video";

export interface QuotedMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
}

export interface MediaDownloadResult {
  success: boolean;
  content?: Buffer;
  mime?: string;
  filename?: string;
  error?: string;
}

export interface NumberValidationResult {
  exists: boolean;
  jid: string;
  number: string;
}

export interface ChannelApiService {
  sendTextMessage(
    channel: OutboundChannel,
    to: string,
    content: string,
    quoted?: QuotedMessage
  ): Promise<string>;

  sendTemplateMessage?(
    channel: OutboundChannel,
    to: string,
    templateName: string,
    variables: OutboundMessageVariable[],
    language?: string
  ): Promise<string>;

  sendMediaMessage(
    channel: OutboundChannel,
    to: string,
    mediaId: string,
    type: MediaType,
    caption?: string,
    filename?: string,
    mimeType?: string,
    quoted?: QuotedMessage
  ): Promise<string>;

  sendAudioMessage?(
    channel: OutboundChannel,
    to: string,
    audioBase64: string,
    quoted?: QuotedMessage
  ): Promise<string>;

  downloadMedia?(
    channel: OutboundChannel,
    messageId: string,
    mimetype?: string,
    remoteJid?: string,
    mediaUrl?: string
  ): Promise<MediaDownloadResult>;

  validateNumbers?(
    channel: OutboundChannel,
    numbers: string[]
  ): Promise<NumberValidationResult[]>;

  sendInteractiveMessage?(
    channel: OutboundChannel,
    to: string,
    interactive: InteractivePayload
  ): Promise<string>;
}
