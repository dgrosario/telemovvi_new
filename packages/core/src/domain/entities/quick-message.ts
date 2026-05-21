export namespace QuickMessage {
  export type MediaType = "image" | "document" | "audio" | "video";

  export interface Props {
    id: string;
    shortcode: string;
    message: string;
    mediaUrl?: string | null;
    mediaType?: MediaType | null;
    mediaName?: string | null;
    isPublic: boolean;
    userId: string;
    workspaceId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }

  export interface Raw {
    id: string;
    shortcode: string;
    message: string;
    mediaUrl: string | null;
    mediaType: MediaType | null;
    mediaName: string | null;
    isPublic: boolean;
    userId: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    shortcode: string;
    message: string;
    mediaUrl?: string | null;
    mediaType?: MediaType | null;
    mediaName?: string | null;
    isPublic?: boolean;
    userId: string;
    workspaceId: string;
  }
}

export class QuickMessage {
  public id: string;
  public shortcode: string;
  public message: string;
  public mediaUrl: string | null;
  public mediaType: QuickMessage.MediaType | null;
  public mediaName: string | null;
  public isPublic: boolean;
  public userId: string;
  public workspaceId: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: QuickMessage.Props) {
    this.id = props.id;
    this.shortcode = props.shortcode;
    this.message = props.message;
    this.mediaUrl = props.mediaUrl ?? null;
    this.mediaType = props.mediaType ?? null;
    this.mediaName = props.mediaName ?? null;
    this.isPublic = props.isPublic;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  hasMedia(): boolean {
    return this.mediaUrl !== null;
  }

  update(props: Partial<QuickMessage.CreateProps>): void {
    if (props.shortcode !== undefined) this.shortcode = props.shortcode;
    if (props.message !== undefined) this.message = props.message;
    if (props.mediaUrl !== undefined) this.mediaUrl = props.mediaUrl ?? null;
    if (props.mediaType !== undefined) this.mediaType = props.mediaType ?? null;
    if (props.mediaName !== undefined) this.mediaName = props.mediaName ?? null;
    if (props.isPublic !== undefined) this.isPublic = props.isPublic;
    this.updatedAt = new Date();
  }

  raw(): QuickMessage.Raw {
    return {
      id: this.id,
      shortcode: this.shortcode,
      message: this.message,
      mediaUrl: this.mediaUrl,
      mediaType: this.mediaType,
      mediaName: this.mediaName,
      isPublic: this.isPublic,
      userId: this.userId,
      workspaceId: this.workspaceId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: QuickMessage.Props): QuickMessage {
    return new QuickMessage(props);
  }

  static create(props: QuickMessage.CreateProps): QuickMessage {
    return new QuickMessage({
      id: crypto.randomUUID(),
      shortcode: props.shortcode.toLowerCase().replace(/^\//, ""),
      message: props.message,
      mediaUrl: props.mediaUrl,
      mediaType: props.mediaType,
      mediaName: props.mediaName,
      isPublic: props.isPublic ?? false,
      userId: props.userId,
      workspaceId: props.workspaceId,
    });
  }
}
