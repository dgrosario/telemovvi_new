import { Attendant } from "../../domain/entities/attendant";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { User } from "../../domain/entities/user";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
}

interface MessagesRepository {
  upsert(message: Message, conversationId: string): Promise<void>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

export class SendInternalComment {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly usersRepository: UsersRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    if (conversation.isInternal) {
      throw new Error(
        "Internal comments are only for external conversations. Use SendInternalMessage for internal conversations."
      );
    }

    const sender = await this.usersRepository.retrieve(input.senderId);
    if (!sender) {
      throw NotFound.throw("User");
    }

    const message = Message.create({
      id: crypto.randomUUID(),
      type: "text",
      content: input.content,
      sender: Attendant.create({ id: sender.id, name: sender.name }),
      caption: null,
      filename: null,
      mimetype: null,
      internal: true,
    });

    message.markAsSent();

    await this.messagesRepository.upsert(message, input.conversationId);

    return {
      messageId: message.id,
      conversationId: input.conversationId,
      senderName: sender.name,
    };
  }

  static instance() {
    return new SendInternalComment(
      ConversationsDatabaseRepository.instance(),
      MessagesDatabaseRepository.instance(),
      UsersDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  senderId: string;
  workspaceId: string;
  content: string;
};

type OutputDTO = {
  messageId: string;
  conversationId: string;
  senderName: string;
};
