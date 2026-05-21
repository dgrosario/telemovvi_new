import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";

interface MessagesRepository {
  markAllAsViewedByConversation(conversationId: string): Promise<void>;
}

interface InputDTO {
  conversationId: string;
  workspaceId: string;
}

export class MarkConversationAsRead {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async execute(input: InputDTO): Promise<void> {
    await this.messagesRepository.markAllAsViewedByConversation(
      input.conversationId
    );
  }

  static instance() {
    return new MarkConversationAsRead(MessagesDatabaseRepository.instance());
  }
}
