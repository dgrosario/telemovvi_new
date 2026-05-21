import { Conversation } from "../../domain/entities/conversation";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";

interface ConversationsRepository {
  listInternalConversations(
    userId: string,
    workspaceId: string
  ): Promise<Conversation.Raw[]>;
}

export class ListInternalConversations {
  constructor(
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const conversations =
      await this.conversationsRepository.listInternalConversations(
        input.userId,
        input.workspaceId
      );

    return {
      conversations,
    };
  }

  static instance() {
    return new ListInternalConversations(
      ConversationsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  userId: string;
  workspaceId: string;
};

type OutputDTO = {
  conversations: Conversation.Raw[];
};
