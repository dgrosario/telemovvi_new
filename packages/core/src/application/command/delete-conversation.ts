import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";

interface ConversationsRepository {
  retrieve(id: string): Promise<{ id: string; status: string | null } | null>;
  delete(id: string): Promise<void>;
}

export class DeleteConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(input: InputDTO): Promise<void> {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) throw NotFound.throw("conversation");

    await this.conversationsRepository.delete(input.conversationId);
  }

  static instance() {
    return new DeleteConversation(ConversationsDatabaseRepository.instance());
  }
}

type InputDTO = {
  conversationId: string;
  workspaceId: string;
};
