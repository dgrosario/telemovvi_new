export interface InternalMessageSender {
  id: string;
  name: string;
}

export interface InternalMessage {
  id: string;
  conversationId: string;
  workspaceId: string;
  content: string;
  type: "text" | "audio" | "image" | "document" | "video";
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  sender: InternalMessageSender;
  recipients: string[];
  createdAt: string;
  correlationId?: string;
}

export interface InternalMessageDelivered {
  messageId: string;
  conversationId: string;
  workspaceId: string;
  sender: InternalMessageSender;
  recipients: string[];
  deliveredAt: string;
  correlationId?: string;
}
