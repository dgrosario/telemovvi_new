export namespace InternalConversationParticipant {
  export type Role = "admin" | "member";

  export interface Props {
    id: string;
    conversationId: string;
    userId: string;
    userName: string;
    userThumbnail: string | null;
    role: Role;
    joinedAt: Date;
    leftAt: Date | null;
  }

  export interface Raw {
    id: string;
    conversationId: string;
    userId: string;
    userName: string;
    userThumbnail: string | null;
    role: Role;
    joinedAt: Date;
    leftAt: Date | null;
  }

  export interface CreateProps {
    conversationId: string;
    userId: string;
    userName: string;
    userThumbnail?: string | null;
    role?: Role;
  }
}

export class InternalConversationParticipant {
  public id: string;
  public conversationId: string;
  public userId: string;
  public userName: string;
  public userThumbnail: string | null;
  public role: InternalConversationParticipant.Role;
  public joinedAt: Date;
  public leftAt: Date | null;

  constructor(props: InternalConversationParticipant.Props) {
    this.id = props.id;
    this.conversationId = props.conversationId;
    this.userId = props.userId;
    this.userName = props.userName;
    this.userThumbnail = props.userThumbnail;
    this.role = props.role;
    this.joinedAt = props.joinedAt;
    this.leftAt = props.leftAt;
  }

  get isActive(): boolean {
    return this.leftAt === null;
  }

  leave(): void {
    this.leftAt = new Date();
  }

  promoteToAdmin(): void {
    this.role = "admin";
  }

  demoteToMember(): void {
    this.role = "member";
  }

  raw(): InternalConversationParticipant.Raw {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      userName: this.userName,
      userThumbnail: this.userThumbnail,
      role: this.role,
      joinedAt: this.joinedAt,
      leftAt: this.leftAt,
    };
  }

  static instance(
    props: InternalConversationParticipant.Props
  ): InternalConversationParticipant {
    return new InternalConversationParticipant(props);
  }

  static fromRaw(
    props: InternalConversationParticipant.Raw
  ): InternalConversationParticipant {
    return new InternalConversationParticipant(props);
  }

  static create(
    props: InternalConversationParticipant.CreateProps
  ): InternalConversationParticipant {
    return new InternalConversationParticipant({
      id: crypto.randomUUID(),
      conversationId: props.conversationId,
      userId: props.userId,
      userName: props.userName,
      userThumbnail: props.userThumbnail ?? null,
      role: props.role ?? "member",
      joinedAt: new Date(),
      leftAt: null,
    });
  }
}
