import { Attendant } from "../../domain/entities/attendant";
import { Conversation } from "../../domain/entities/conversation";
import { User } from "../../domain/entities/user";
import { NotFound } from "../../domain/errors/not-found";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";
import { Channel, getPayloadProperty } from "../../domain/entities/channel";
import { RabbitMQMessagingDriver } from "../../infra/drivers/messaging-driver";
import { HumanTakeoverFlowTerminator } from "../services/human-takeover-flow-terminator";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
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

interface UsersRepository {
  retrieve(userId: string): Promise<User | null>;
}

const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";

export class SendMessage {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly messagingDriver: MessagingDriver,
    private readonly usersRepository: UsersRepository,
    private readonly humanTakeoverFlowTerminator: HumanTakeoverFlowTerminator
  ) {}

  async execute(input: InputDTO): Promise<void> {
    if (!input.content && !input.templateName) return;

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
      throw new Error("Cannot send external message to internal conversation");
    }

    /**
     * Reabrir conversa expirada apenas se:
     * - estiver enviando template
     * - canal for WhatsApp oficial (whatsapp | meta_api com wabaId)
     */
    if (conversation.status === "expired" && input.templateName) {
      const channelPayload = channel.payload as Record<string, unknown>;
      const hasWabaId =
        channelPayload &&
        "wabaId" in channelPayload &&
        !!channelPayload.wabaId;

      const isOfficialApiChannel =
        (channel.type === "whatsapp" || channel.type === "meta_api") &&
        hasWabaId;

      if (isOfficialApiChannel) {
        conversation.reopen();
      } else {
        throw new Error(
          "Cannot reopen expired conversation: channel is not using Official WhatsApp API"
        );
      }
    }

    let shouldPersistConversation = false;
    let shouldTerminateFlow = false;

    /**
     * Definição do sender
     */
    let sender: Attendant | undefined = undefined;

    // Caso especial: sistema / automação
    if (input.bypassAttendance && input.senderName) {
      sender = Attendant.create({
        id: input.userId,
        name: input.senderName,
      });
    } else {
      const user = await this.usersRepository.retrieve(input.userId);

      if (user) {
        // Sender sempre é o usuário atual
        sender = Attendant.create({ id: user.id, name: user.name });

        // Atribuir atendente somente se ainda não houver e não for grupo WhatsApp
        if (!conversation.attendant && !conversation.isWhatsAppGroup) {
          conversation.assign(user);
          shouldPersistConversation = true;
          shouldTerminateFlow = true;
        }
      } else {
        // Fallback seguro
        sender = conversation.attendant ?? undefined;
      }

      if (conversation.attendant && conversation.status === "waiting") {
        conversation.openWaitingConversation();
        shouldPersistConversation = true;
      }
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
      content: input.content,
      conversationId: conversation.id,
      channelId: input.channelId,
      workspaceId: input.workspaceId,
      createdAt: new Date(),
      sender,
      type: input.templateName ? "template" : "text",
      variables: input.variables,
      templateName: input.templateName,
      templateLanguage: input.language,
      language: input.language,
      correlationId: input.correlationId,
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
    return new SendMessage(
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
  content?: string;
  workspaceId: string;
  templateName?: string;
  language?: string;
  variables?: { name: string; value: string }[];
  correlationId?: string;
  quotedMessageId?: string;
  bypassAttendance?: boolean;
  senderName?: string;
};
