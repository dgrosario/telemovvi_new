import { Attendant } from "../../domain/entities/attendant";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { User } from "../../domain/entities/user";
import { NotFound } from "../../domain/errors/not-found";
import { RabbitMQMessagingDriver } from "../../infra/drivers/messaging-driver";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { InternalConversationParticipantsDatabaseRepository } from "../../infra/repositories/internal-conversation-participants-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
}

interface ParticipantsRepository {
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  getParticipantUserIds(conversationId: string): Promise<string[]>;
}

interface MessagesRepository {
  upsert(message: Message, conversationId: string): Promise<void>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
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

const INTERNAL_QUEUE =
  process.env.INTERNAL_QUEUE || "internal-messages";

export class SendInternalMessage {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly participantsRepository: ParticipantsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly messagingDriver: MessagingDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    if (!conversation.isInternal) {
      throw new Error("This command is for internal conversations only");
    }

    const isParticipant = await this.participantsRepository.isParticipant(
      input.conversationId,
      input.senderId
    );

    if (!isParticipant) {
      throw new Error("User is not a participant of this conversation");
    }

    const sender = await this.usersRepository.retrieve(input.senderId);
    if (!sender) {
      throw NotFound.throw("User");
    }

    const message = Message.create({
      id: crypto.randomUUID(),
      type: input.type,
      content: input.content,
      sender: Attendant.create({ id: sender.id, name: sender.name }),
      caption: input.caption ?? null,
      filename: input.filename ?? null,
      mimetype: input.mimeType ?? null,
      internal: true,
    });

    message.markAsSent();

    await this.messagesRepository.upsert(message, input.conversationId);

    const participantIds = await this.participantsRepository.getParticipantUserIds(
      input.conversationId
    );

    const messagePayload = {
      id: message.id,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      content: input.content,
      type: input.type,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      filename: input.filename,
      mimeType: input.mimeType,
      sender: {
        id: sender.id,
        name: sender.name,
      },
      recipients: participantIds.filter((id) => id !== input.senderId),
      createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
      correlationId: message.id,
    };

    await this.messagingDriver.sendMessageToQueue({
      queueUrl: INTERNAL_QUEUE,
      body: messagePayload,
      groupId: input.conversationId,
      messageId: message.id,
    });

    return {
      messageId: message.id,
      conversationId: input.conversationId,
    };
  }

  static instance() {
    return new SendInternalMessage(
      ConversationsDatabaseRepository.instance(),
      InternalConversationParticipantsDatabaseRepository.instance(),
      MessagesDatabaseRepository.instance(),
      UsersDatabaseRepository.instance(),
      RabbitMQMessagingDriver.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  senderId: string;
  workspaceId: string;
  content: string;
  type: Message.Type;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
};

type OutputDTO = {
  messageId: string;
  conversationId: string;
};
