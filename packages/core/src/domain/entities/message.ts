import { InvalidCreation } from "../errors/invalid-creation";
import { Attendant } from "./attendant";
import { Channel } from "./channel";
import { Contact } from "./contact";
import { Sender } from "./sender";

export namespace Message {
  export type Type = "text" | "audio" | "image" | "sticker" | "document" | "video" | "template" | "location";
  export type Status = "senting" | "sent" | "delivered" | "viewed" | "failed";

  export interface Reaction {
    id: string;
    emoji: string;
    reactorType: "attendant" | "contact";
    reactorId: string;
    reactorName: string | null;
    createdAt: Date;
  }

  export interface Raw {
    id: string;
    type: Type;
    content: string;
    originalContent: string | null;
    caption: string | null;
    filename: string | null;
    mimetype: string | null;
    mediaKey: string | null;
    sender: Sender.Props;
    internal: boolean;
    createdAt: Date;
    viewedAt: Date | null;
    deletedAt: Date | null;
    editedAt: Date | null;
    status: Status;
    quotedMessageId: string | null;
    reactions?: Reaction[];
    templateName: string | null;
    remoteJid: string | null;
  }

  export interface GroupedRaw extends Raw {
    channel: { id: string; type: Channel.Type; name: string } | null;
  }

  export interface CreateProps {
    id: string;
    type: Type;
    content: string;
    caption?: string | null;
    filename?: string | null;
    mimetype?: string | null;
    mediaKey?: string | null;
    sender: Attendant | Contact;
    createdAt?: Date;
    internal?: boolean;
    quotedMessageId?: string | null;
    templateName?: string | null;
    remoteJid?: string | null;
  }

  export interface Props {
    id: string;
    type: Type;
    content: string;
    originalContent: string | null;
    caption: string | null;
    filename: string | null;
    mimetype: string | null;
    mediaKey: string | null;
    sender: Sender;
    internal: boolean;
    createdAt: Date;
    viewedAt: Date | null;
    deletedAt: Date | null;
    editedAt: Date | null;
    status: Status;
    quotedMessageId: string | null;
    templateName: string | null;
    remoteJid: string | null;
  }
}

export class Message {
  public readonly id: string;
  public readonly type: Message.Type;
  public readonly content: string;
  public readonly originalContent: string | null;
  public readonly caption: string | null;
  public readonly filename: string | null;
  public readonly mimetype: string | null;
  public readonly mediaKey: string | null;
  public readonly sender: Sender;
  public readonly createdAt: Date;
  public viewedAt: Date | null;
  public deletedAt: Date | null;
  public editedAt: Date | null;
  public internal: boolean;
  public status: Message.Status;
  public readonly quotedMessageId: string | null;
  public readonly templateName: string | null;
  public readonly remoteJid: string | null;

  constructor(props: Message.Props) {
    this.id = props.id;
    this.type = props.type;
    this.content = props.content;
    this.originalContent = props.originalContent;
    this.caption = props.caption;
    this.filename = props.filename;
    this.mimetype = props.mimetype;
    this.mediaKey = props.mediaKey;
    this.sender = props.sender;
    this.createdAt = props.createdAt;
    this.viewedAt = props.viewedAt;
    this.deletedAt = props.deletedAt;
    this.editedAt = props.editedAt;
    this.internal = props.internal;
    this.status = props.status;
    this.quotedMessageId = props.quotedMessageId;
    this.templateName = props.templateName;
    this.remoteJid = props.remoteJid;
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  hasEditHistory(): boolean {
    return this.originalContent !== null;
  }

  getOriginalContent(): string | null {
    return this.originalContent;
  }

  markAsViewed() {
    this.status = "viewed";
    this.viewedAt = new Date();

    return this;
  }

  markAsSent() {
    this.status = "sent";
  }

  markAsDelivered() {
    this.status = "delivered";
  }

  markAsFailed() {
    this.status = "failed";
  }

  raw(): Message.Raw {
    return {
      content: this.content,
      originalContent: this.originalContent,
      caption: this.caption,
      filename: this.filename,
      mimetype: this.mimetype,
      mediaKey: this.mediaKey,
      createdAt: this.createdAt,
      id: this.id,
      internal: this.internal,
      sender: this.sender.raw(),
      type: this.type,
      viewedAt: this.viewedAt,
      deletedAt: this.deletedAt,
      editedAt: this.editedAt,
      status: this.status,
      quotedMessageId: this.quotedMessageId,
      templateName: this.templateName,
      remoteJid: this.remoteJid,
    };
  }

  static instance(props: Message.Props) {
    return new Message(props);
  }

  static fromRaw(props: Message.Raw) {
    return new Message({
      content: props.content,
      originalContent: props.originalContent,
      caption: props.caption,
      filename: props.filename,
      mimetype: props.mimetype,
      mediaKey: props.mediaKey,
      createdAt: props.createdAt,
      id: props.id,
      internal: props.internal,
      sender: Sender.create(
        props.sender.type,
        props.sender.id,
        props.sender.name
      ),
      status: props.status,
      type: props.type,
      viewedAt: props.viewedAt,
      deletedAt: props.deletedAt,
      editedAt: props.editedAt,
      quotedMessageId: props.quotedMessageId,
      templateName: props.templateName,
      remoteJid: props.remoteJid,
    });
  }

  static create(props: Message.CreateProps) {
    if (!props.id) throw InvalidCreation.instance();

    if (props.type === "template" && !props.templateName) {
      throw new Error("templateName is required for template messages");
    }

    if (props.type !== "template" && props.templateName) {
      throw new Error("templateName should only be set for template messages");
    }

    return new Message({
      content: props.content ?? "",
      originalContent: null,
      caption: props.caption ?? null,
      filename: props.filename ?? null,
      mimetype: props.mimetype ?? null,
      mediaKey: props.mediaKey ?? null,
      createdAt: props.createdAt || new Date(),
      id: props.id,
      sender: Sender.create(
        props.sender.senderType,
        props.sender.id,
        props.sender.name
      ),
      type: props?.type,
      viewedAt: null,
      deletedAt: null,
      editedAt: null,
      internal: props.internal ?? false,
      status: "senting",
      quotedMessageId: props.quotedMessageId ?? null,
      templateName: props.templateName ?? null,
      remoteJid: props.remoteJid ?? null,
    });
  }
}
