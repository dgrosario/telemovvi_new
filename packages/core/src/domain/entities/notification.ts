import { InvalidCreation } from "../errors/invalid-creation";

export namespace Notification {
  export type Type =
    | "conversation:assigned"
    | "internal:message"
    | "transfer:requested"
    | "channel:new-message";

  export type RecipientType = "user" | "sector" | "workspace";

  export type Priority = "low" | "normal" | "high";

  export interface Metadata {
    conversationId?: string;
    messageId?: string;
    channelId?: string;
    sectorId?: string;
    senderId?: string;
    senderName?: string;
    [key: string]: unknown;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    type: Type;
    title: string;
    content: string;
    metadata: Metadata;
    recipientType: RecipientType;
    recipientId: string;
    isRead: boolean;
    readAt: Date | null;
    priority: Priority;
    createdAt: Date;
    expiresAt: Date | null;
  }

  export interface CreateProps {
    id?: string;
    workspaceId: string;
    type: Type;
    title: string;
    content: string;
    metadata?: Metadata;
    recipientType: RecipientType;
    recipientId: string;
    priority?: Priority;
    expiresAt?: Date | null;
  }

  export interface Props {
    id: string;
    workspaceId: string;
    type: Type;
    title: string;
    content: string;
    metadata: Metadata;
    recipientType: RecipientType;
    recipientId: string;
    isRead: boolean;
    readAt: Date | null;
    priority: Priority;
    createdAt: Date;
    expiresAt: Date | null;
  }
}

export class Notification {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly type: Notification.Type;
  public readonly title: string;
  public readonly content: string;
  public readonly metadata: Notification.Metadata;
  public readonly recipientType: Notification.RecipientType;
  public readonly recipientId: string;
  public isRead: boolean;
  public readAt: Date | null;
  public readonly priority: Notification.Priority;
  public readonly createdAt: Date;
  public readonly expiresAt: Date | null;

  constructor(props: Notification.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.type = props.type;
    this.title = props.title;
    this.content = props.content;
    this.metadata = props.metadata;
    this.recipientType = props.recipientType;
    this.recipientId = props.recipientId;
    this.isRead = props.isRead;
    this.readAt = props.readAt;
    this.priority = props.priority;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
  }

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  markAsRead(): this {
    if (this.isRead) return this;

    this.isRead = true;
    this.readAt = new Date();

    return this;
  }

  raw(): Notification.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      type: this.type,
      title: this.title,
      content: this.content,
      metadata: this.metadata,
      recipientType: this.recipientType,
      recipientId: this.recipientId,
      isRead: this.isRead,
      readAt: this.readAt,
      priority: this.priority,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
    };
  }

  static instance(props: Notification.Props): Notification {
    return new Notification(props);
  }

  static fromRaw(props: Notification.Raw): Notification {
    return new Notification({
      id: props.id,
      workspaceId: props.workspaceId,
      type: props.type,
      title: props.title,
      content: props.content,
      metadata: props.metadata,
      recipientType: props.recipientType,
      recipientId: props.recipientId,
      isRead: props.isRead,
      readAt: props.readAt,
      priority: props.priority,
      createdAt: props.createdAt,
      expiresAt: props.expiresAt,
    });
  }

  static create(props: Notification.CreateProps): Notification {
    const id = props.id || crypto.randomUUID();

    if (!props.workspaceId) throw InvalidCreation.instance();
    if (!props.title) throw InvalidCreation.instance();
    if (!props.recipientId) throw InvalidCreation.instance();

    return new Notification({
      id,
      workspaceId: props.workspaceId,
      type: props.type,
      title: props.title,
      content: props.content,
      metadata: props.metadata || {},
      recipientType: props.recipientType,
      recipientId: props.recipientId,
      isRead: false,
      readAt: null,
      priority: props.priority || "normal",
      createdAt: new Date(),
      expiresAt: props.expiresAt || null,
    });
  }
}
