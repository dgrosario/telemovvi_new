import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";

interface ConversationsRepository {
  retrieveOpenByChannelIdAndContactId(
    channelId: string,
    contactId: string,
    receivedChannelId?: string | null
  ): Promise<Conversation | null>;
}

interface MessagesRepository {
  listLastMessageToView(conversationId: string): Promise<Message[]>;
  upsert(message: Message, conversation?: string): Promise<void>;
}

export class MarkLastMessagesContactAsViewed {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository
  ) {}

  async execute(input: InputDTO) {
    const conversation =
      await this.conversationsRepository.retrieveOpenByChannelIdAndContactId(
        input.channel,
        input.contact
      );

    if (!conversation) throw NotFound.throw("conversation");

    const messagesToView = await this.messagesRepository.listLastMessageToView(
      conversation.id
    );

    await Promise.all(
      messagesToView.map(async (message) => {
        message.markAsViewed();
        await this.messagesRepository.upsert(message, conversation.id);
      })
    );
  }

  static instance() {
    return new MarkLastMessagesContactAsViewed(
      ConversationsDatabaseRepository.instance(),
      MessagesDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  contact: string;
  channel: string;
  workspaceId: string;
};
