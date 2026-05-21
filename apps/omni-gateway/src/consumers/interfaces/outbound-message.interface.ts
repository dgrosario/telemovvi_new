export interface OutboundMessageSender {
  id: string;
  name: string;
}

export interface OutboundMessageVariable {
  name: string;
  value: string;
}

export interface InteractiveButton {
  type?: "reply";
  reply?: { id: string; title: string };
  buttonId?: string;
  buttonText?: { displayText: string };
}

export interface InteractiveSection {
  title?: string;
  rows: Array<{
    id?: string;
    rowId?: string;
    title: string;
    description?: string;
  }>;
}

export interface InteractivePayload {
  type: "button" | "list";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    buttons?: InteractiveButton[];
    button?: string;
    sections?: InteractiveSection[];
  };
}

export interface OutboundMessage {
  conversationId: string;
  channelId: string;
  workspaceId: string;
  type: "text" | "template" | "audio" | "image" | "document" | "video" | "interactive";
  content?: string;
  templateName?: string;
  templateLanguage?: string;
  language?: string; // Backward compatibility with older producers
  variables?: OutboundMessageVariable[];
  mediaId?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  localMediaPath?: string;
  interactive?: InteractivePayload;
  sender: OutboundMessageSender;
  createdAt: string;
  correlationId?: string;
  quotedMessageId?: string;
  to: string;
  isGroup?: boolean;
  channel: OutboundChannel;
  lastClientMessageCreatedAt?: string;
  isAutomated?: boolean;
  isCampaignMessage?: boolean;
  campaignId?: string;
  campaignRecipientId?: string;
  recipientName?: string;
}

export interface OutboundChannel {
  id: string;
  type: "whatsapp" | "instagram" | "evolution" | "meta_api";
  payload: {
    phoneNumberId?: string;
    phoneId?: string; // WhatsApp Embedded Signup uses phoneId
    pageId?: string;
    accessToken?: string;
    instanceName?: string;
    appId?: string;
    appSecret?: string;
  };
}

export interface MessageSentConfirmation {
  conversationId: string;
  channelId: string;
  workspaceId: string;
  messageId: string;
  externalId: string;
  type: string;
  content?: string;
  sender: OutboundMessageSender;
  sentAt: string;
  correlationId?: string;
  localMediaPath?: string;
  quotedMessageId?: string;
  templateName?: string;
  isCampaignMessage?: boolean;
  campaignId?: string;
  campaignRecipientId?: string;
  recipientName?: string;
}
