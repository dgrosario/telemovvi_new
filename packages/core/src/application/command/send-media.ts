import { Attendant } from "../../domain/entities/attendant";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { User } from "../../domain/entities/user";
import { NotFound } from "../../domain/errors/not-found";
import { RabbitMQMessagingDriver } from "../../infra/drivers/messaging-driver";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";
import { Channel, getPayloadProperty } from "./../../domain/entities/channel";
import { HumanTakeoverFlowTerminator } from "../services/human-takeover-flow-terminator";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

interface UsersRepository {
  retrieve(userId: string): Promise<User | null>;
}

type SendMessageToQueueProps = {
  queueUrl: string;
  body: object;
  groupId: string;
  messageId: string;
};

interface MessagingDriver {
  sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean>;
}

const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";

export class SendMedia {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly messagingDriver: MessagingDriver,
    private readonly usersRepository: UsersRepository,
    private readonly humanTakeoverFlowTerminator: HumanTakeoverFlowTerminator
  ) {}

  async execute(input: InputDTO): Promise<void> {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) throw NotFound.throw("Conversation");

    const channel = await this.channelsRepository.retrieve(
      input.channelId,
      input.workspaceId
    );

    if (!channel) throw NotFound.throw("Channel");

    if (!conversation.contact && !conversation.isWhatsAppGroup) {
      throw new Error("Cannot send media to internal conversation");
    }

    let shouldPersistConversation = false;
    let shouldTerminateFlow = false;

    if (!conversation.attendant && !conversation.isWhatsAppGroup) {
      const user = await this.usersRepository.retrieve(input.userId);
      if (user) {
        conversation.assign(user);
        shouldPersistConversation = true;
        shouldTerminateFlow = true;
      }
    }

    if (conversation.attendant && conversation.status === "waiting") {
      conversation.openWaitingConversation();
      shouldPersistConversation = true;
    }

    if (shouldPersistConversation) {
      await this.conversationsRepository.upsert(
        conversation,
        input.workspaceId
      );
    }

    if (shouldTerminateFlow) {
      await this.humanTakeoverFlowTerminator.terminateForConversation(
        conversation.id
      );
    }

    const destination = conversation.isWhatsAppGroup
      ? conversation.groupJid
      : conversation.contact?.value;

    if (
      channel.type === "instagram" &&
      destination &&
      !/^\d+$/.test(destination)
    ) {
      throw new Error(
        "Contato Instagram ainda sem ID sincronizado. Aguarde a primeira mensagem do @username para sincronizar."
      );
    }

    const body = {
      content: input.mediaId,
      conversationId: conversation.id,
      channelId: input.channelId,
      workspaceId: input.workspaceId,
      createdAt: new Date(),
      sender: Attendant.create({ id: input.userId, name: input.userName }),
      type: input.type,
      caption: input.caption ?? "",
      filename: input.filename,
      mimeType: input.mimeType,
      correlationId: input.correlationId,
      mediaId: input.mediaId,
      localMediaPath: input.localMediaPath,
      quotedMessageId: input.quotedMessageId,
      to: destination,
      isGroup: conversation.isWhatsAppGroup,
      channel: {
        id: channel.id,
        type: channel.type,
        payload: {
          phoneNumberId: getPayloadProperty(channel.payload, "phoneId"),
          pageId: getPayloadProperty(channel.payload, "pageId"),
          accessToken: getPayloadProperty(channel.payload, "accessToken"),
          instanceName: getPayloadProperty(channel.payload, "instanceName"),
        },
      },
    };

    await this.messagingDriver.sendMessageToQueue({
      queueUrl: OUTBOUND_QUEUE,
      body,
      groupId: conversation.id,
      messageId: crypto.randomUUID(),
    });
  }

  static instance() {
    return new SendMedia(
      ConversationsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      RabbitMQMessagingDriver.instance(),
      UsersDatabaseRepository.instance(),
      HumanTakeoverFlowTerminator.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  channelId: string;
  userId: string;
  userName: string;
  filename: string;
  mimeType: string;
  workspaceId: string;
  type: Message.Type;
  caption?: string;
  correlationId?: string;
  mediaId: string;
  localMediaPath?: string;
  quotedMessageId?: string;
};
