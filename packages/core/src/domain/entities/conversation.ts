import { InvalidCreation } from "../errors/invalid-creation";
import { Attendant } from "./attendant";
import { Channel } from "./channel";
import { Contact } from "./contact";
import { ConversationChannel } from "./conversation-channel";
import { InternalConversationParticipant } from "./internal-conversation-participant";
import { Sector } from "./sector";
import { User } from "./user";

export namespace Conversation {
  export type Status = "waiting" | "open" | "closed" | "expired" | "internal";
  export type Type = "external" | "direct" | "group" | "whatsapp-group";

  export type ExpiredConversation = {
    id: string;
    lastClientMessageCreatedAt: Date | null;
  };

  export interface Props {
    id: string;
    contact: Contact | null;
    attendant: Attendant | null;
    status: Status | null;
    openedAt: Date | null;
    firstOpenedAt: Date | null;
    closedAt: Date | null;
    sector: Sector | null;
    channel: ConversationChannel | null;
    teaser: string;
    messageToView: number;
    lastMessageCreatedAt: Date | null;
    lastClientMessageCreatedAt: Date | null;
    waitingAt: Date | null;
    activeFlowExecutionId: string | null;
    flowCompletedAt: Date | null;
    receivedChannel: ConversationChannel | null;
    conversationType: Type;
    name: string | null;
    participants: InternalConversationParticipant[];
    groupJid: string | null;
  }

  export interface Raw {
    id: string;
    contact: Contact.Raw | null;
    attendant: Attendant.Props | null;
    status: Status | null;
    openedAt: Date | null;
    firstOpenedAt: Date | null;
    closedAt: Date | null;
    sector: Sector.Props | null;
    channel: ConversationChannel.Props | null;
    teaser: string;
    messageToView: number;
    lastMessageCreatedAt: Date | null;
    lastClientMessageCreatedAt: Date | null;
    waitingAt: Date | null;
    activeFlowExecutionId: string | null;
    flowCompletedAt: Date | null;
    receivedChannel: ConversationChannel.Props | null;
    conversationType: Type;
    name: string | null;
    participants: InternalConversationParticipant.Raw[];
    groupJid: string | null;
    isFromReceivingNumber: boolean;
  }

  export interface CreateInternalProps {
    participantIds: string[];
    participantNames: string[];
    participantThumbnails: (string | null)[];
    creatorId: string;
    creatorName: string;
    creatorThumbnail?: string | null;
    name?: string;
  }
}

export class Conversation {
  public id: string;
  public contact: Contact | null;
  public attendant: Attendant | null;
  public status: Conversation.Status | null;
  public openedAt: Date | null;
  public firstOpenedAt: Date | null;
  public closedAt: Date | null;
  public sector: Sector | null;
  public channel: ConversationChannel | null;
  public teaser: string;
  public messageToView: number;
  public lastMessageCreatedAt: Date | null;
  public lastClientMessageCreatedAt: Date | null;
  public waitingAt: Date | null;
  public activeFlowExecutionId: string | null;
  public flowCompletedAt: Date | null;
  public receivedChannel: ConversationChannel | null;
  public conversationType: Conversation.Type;
  public name: string | null;
  public participants: InternalConversationParticipant[];
  public groupJid: string | null;

  constructor(props: Conversation.Props) {
    this.id = props.id;
    this.contact = props.contact;
    this.attendant = props.attendant;
    this.status = props.status;
    this.openedAt = props.openedAt;
    this.firstOpenedAt = props.firstOpenedAt;
    this.closedAt = props.closedAt;
    this.sector = props.sector;
    this.channel = props.channel;
    this.teaser = props.teaser;
    this.messageToView = props.messageToView;
    this.lastMessageCreatedAt = props.lastMessageCreatedAt;
    this.lastClientMessageCreatedAt = props.lastClientMessageCreatedAt;
    this.waitingAt = props.waitingAt;
    this.activeFlowExecutionId = props.activeFlowExecutionId;
    this.flowCompletedAt = props.flowCompletedAt;
    this.receivedChannel = props.receivedChannel;
    this.conversationType = props.conversationType;
    this.name = props.name;
    this.participants = props.participants;
    this.groupJid = props.groupJid;
  }

  get isInternal(): boolean {
    return this.conversationType === "direct" || this.conversationType === "group";
  }

  get isGroup(): boolean {
    return this.conversationType === "group";
  }

  get isDirect(): boolean {
    return this.conversationType === "direct";
  }

  get isWhatsAppGroup(): boolean {
    return this.conversationType === "whatsapp-group";
  }

  get isFromReceivingNumber(): boolean {
    return this.receivedChannel !== null;
  }

  get displayName(): string {
    if (this.isInternal || this.isWhatsAppGroup) {
      return this.name ?? this.participants.map((p) => p.userName).join(", ");
    }
    return this.contact?.name ?? "";
  }

  raw(): Conversation.Raw {
    return {
      attendant: this.attendant ? this.attendant?.raw?.() : null,
      channel: this.channel?.raw() ?? null,
      contact: this.contact?.raw() ?? null,
      id: this.id,
      openedAt: this.openedAt,
      firstOpenedAt: this.firstOpenedAt,
      sector: this.sector?.raw?.() ?? null,
      status: this.status,
      teaser: this.teaser,
      closedAt: this.closedAt,
      messageToView: this.messageToView,
      lastMessageCreatedAt: this.lastMessageCreatedAt,
      lastClientMessageCreatedAt: this.lastClientMessageCreatedAt,
      waitingAt: this.waitingAt,
      activeFlowExecutionId: this.activeFlowExecutionId,
      flowCompletedAt: this.flowCompletedAt,
      receivedChannel: this.receivedChannel?.raw() ?? null,
      conversationType: this.conversationType,
      name: this.name,
      participants: this.participants.map((p) => p.raw()),
      groupJid: this.groupJid,
      isFromReceivingNumber: this.isFromReceivingNumber,
    };
  }

  setChannel(channel: ConversationChannel) {
    this.channel = channel;
  }

  assign(user: User, sector?: Sector) {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ter atendentes atribuidos");
    }
    if (!user) throw new Error("Falha ao abrir o atendimento!");
    this.status = this.status === "waiting" ? "open" : this.status;
    const now = new Date();
    if (!this.firstOpenedAt) {
      this.firstOpenedAt = now;
    }
    this.openedAt = now;
    this.attendant = Attendant.create({
      id: user.id,
      name: user.name,
    });
    if (sector) {
      this.sector = sector;
    }
  }

  assignWithoutStatusChange(user: User, sector?: Sector) {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ter atendentes atribuidos");
    }
    if (!user) throw new Error("Falha ao abrir o atendimento!");
    const now = new Date();
    if (!this.firstOpenedAt) {
      this.firstOpenedAt = now;
    }
    this.openedAt = now;
    this.attendant = Attendant.create({
      id: user.id,
      name: user.name,
    });
    if (sector) {
      this.sector = sector;
    }
  }

  transferToUser(user: User) {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser transferidos");
    }
    this.attendant = Attendant.create({
      id: user.id,
      name: user.name,
    });
    if (this.status === "waiting") {
      this.status = "open";
      const now = new Date();
      if (!this.firstOpenedAt) {
        this.firstOpenedAt = now;
      }
      this.openedAt = now;
    }
  }

  transferToSector(sector: Sector) {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser transferidos");
    }
    this.sector = sector;
    this.attendant = null;
    this.status = "waiting";
  }

  openWaitingConversation() {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser abertos");
    }
    if (this.status !== "waiting") return;

    const now = new Date();
    this.status = "open";
    this.closedAt = null;
    if (!this.firstOpenedAt) {
      this.firstOpenedAt = now;
    }
    this.openedAt = now;
  }

  close() {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser fechados");
    }
    this.status = "closed";
    this.closedAt = new Date();
  }

  expire() {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem expirar");
    }
    this.status = "expired";
    this.closedAt = new Date();
  }

  reopen() {
    if (this.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser reabertos");
    }
    this.status = "waiting";
    this.closedAt = null;
    this.openedAt = null;
    this.attendant = null;
    this.waitingAt = new Date();
    this.flowCompletedAt = null;
  }

  markFlowCompleted() {
    this.flowCompletedAt = new Date();
    this.activeFlowExecutionId = null;
  }

  addParticipant(participant: InternalConversationParticipant): void {
    if (!this.isInternal) {
      throw new Error("Cannot add participants to external conversations");
    }
    const exists = this.participants.some((p) => p.userId === participant.userId);
    if (!exists) {
      this.participants.push(participant);
    }
  }

  removeParticipant(userId: string): void {
    if (!this.isInternal) {
      throw new Error("Cannot remove participants from external conversations");
    }
    const participant = this.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.leave();
    }
  }

  static instance(props: Conversation.Props) {
    return new Conversation(props);
  }

  static fromRaw(props: Conversation.Raw) {
    return new Conversation({
      attendant: props.attendant ? Attendant.create(props.attendant) : null,
      channel: props.channel ? ConversationChannel.instance(props.channel) : null,
      closedAt: props.closedAt,
      contact: props.contact ? Contact.instance(props.contact) : null,
      id: props.id,
      openedAt: props.openedAt,
      firstOpenedAt: props.firstOpenedAt,
      sector: props.sector ? Sector.instance(props.sector) : null,
      status: props.status,
      teaser: props.teaser,
      messageToView: props.messageToView,
      lastMessageCreatedAt: props.lastMessageCreatedAt,
      lastClientMessageCreatedAt: props.lastClientMessageCreatedAt,
      waitingAt: props.waitingAt,
      activeFlowExecutionId: props.activeFlowExecutionId,
      flowCompletedAt: props.flowCompletedAt,
      receivedChannel: props.receivedChannel
        ? ConversationChannel.instance(props.receivedChannel)
        : null,
      conversationType: props.conversationType,
      name: props.name,
      participants: props.participants.map((p) =>
        InternalConversationParticipant.fromRaw(p)
      ),
      groupJid: props.groupJid,
    });
  }

  static create(contact: Contact, channel: Channel, receivedChannel?: Channel) {
    if (!contact || !channel) throw InvalidCreation.instance();

    return new Conversation({
      id: crypto.randomUUID().toString(),
      contact,
      attendant: null,
      status: "waiting",
      openedAt: null,
      firstOpenedAt: null,
      sector: null,
      channel: ConversationChannel.create(channel),
      closedAt: null,
      teaser: "",
      messageToView: 0,
      lastMessageCreatedAt: null,
      lastClientMessageCreatedAt: null,
      waitingAt: null,
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      receivedChannel: receivedChannel
        ? ConversationChannel.create(receivedChannel)
        : null,
      conversationType: "external",
      name: null,
      participants: [],
      groupJid: null,
    });
  }

  static createDirect(props: Conversation.CreateInternalProps): Conversation {
    if (props.participantIds.length !== 1) {
      throw new Error("Direct conversations must have exactly one other participant");
    }

    const conversationId = crypto.randomUUID().toString();

    const creatorParticipant = InternalConversationParticipant.create({
      conversationId,
      userId: props.creatorId,
      userName: props.creatorName,
      userThumbnail: props.creatorThumbnail,
      role: "admin",
    });

    const otherParticipant = InternalConversationParticipant.create({
      conversationId,
      userId: props.participantIds[0] ?? "",
      userName: props.participantNames[0] ?? "",
      userThumbnail: props.participantThumbnails[0] ?? null,
      role: "member",
    });

    return new Conversation({
      id: conversationId,
      contact: null,
      attendant: null,
      status: "internal",
      openedAt: new Date(),
      firstOpenedAt: new Date(),
      sector: null,
      channel: null,
      closedAt: null,
      teaser: "",
      messageToView: 0,
      lastMessageCreatedAt: null,
      lastClientMessageCreatedAt: null,
      waitingAt: null,
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      receivedChannel: null,
      conversationType: "direct",
      name: null,
      participants: [creatorParticipant, otherParticipant],
      groupJid: null,
    });
  }

  static createGroup(props: Conversation.CreateInternalProps): Conversation {
    if (props.participantIds.length < 1) {
      throw new Error("Group conversations must have at least one other participant");
    }
    if (!props.name) {
      throw new Error("Group conversations must have a name");
    }

    const conversationId = crypto.randomUUID().toString();

    const creatorParticipant = InternalConversationParticipant.create({
      conversationId,
      userId: props.creatorId,
      userName: props.creatorName,
      userThumbnail: props.creatorThumbnail,
      role: "admin",
    });

    const otherParticipants = props.participantIds.map((id, index) =>
      InternalConversationParticipant.create({
        conversationId,
        userId: id,
        userName: props.participantNames[index] ?? "",
        userThumbnail: props.participantThumbnails[index] ?? null,
        role: "member",
      })
    );

    return new Conversation({
      id: conversationId,
      contact: null,
      attendant: null,
      status: "internal",
      openedAt: new Date(),
      firstOpenedAt: new Date(),
      sector: null,
      channel: null,
      closedAt: null,
      teaser: "",
      messageToView: 0,
      lastMessageCreatedAt: null,
      lastClientMessageCreatedAt: null,
      waitingAt: null,
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      receivedChannel: null,
      conversationType: "group",
      name: props.name,
      participants: [creatorParticipant, ...otherParticipants],
      groupJid: null,
    });
  }

  static createFromWhatsAppGroup(
    groupJid: string,
    groupName: string | null,
    channel: Channel,
    receivedChannel?: Channel
  ): Conversation {
    if (!groupJid || !channel) {
      throw InvalidCreation.instance();
    }

    return new Conversation({
      id: crypto.randomUUID().toString(),
      contact: null,
      attendant: null,
      status: null,
      openedAt: null,
      firstOpenedAt: null,
      sector: null,
      channel: ConversationChannel.create(channel),
      closedAt: null,
      teaser: "",
      messageToView: 0,
      lastMessageCreatedAt: null,
      lastClientMessageCreatedAt: null,
      waitingAt: null,
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      receivedChannel: receivedChannel
        ? ConversationChannel.create(receivedChannel)
        : null,
      conversationType: "whatsapp-group",
      name: groupName,
      participants: [],
      groupJid,
    });
  }
}
