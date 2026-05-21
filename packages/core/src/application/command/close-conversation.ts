import { Conversation } from "../../domain/entities/conversation";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowStatusChecker } from "../services/flow-status-checker";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

export class CloseConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(input: InputDTO): Promise<Conversation> {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) throw NotFound.throw("conversation");

    if (conversation.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser fechados");
    }

    const previousStatus = conversation.status;
    conversation.close();

    if (previousStatus !== conversation.status) {
      const flowChecker = FlowStatusChecker.instance();
      await flowChecker.checkAndTerminateIfNeeded(
        conversation,
        input.workspaceId
      );
    }

    await this.conversationsRepository.upsert(conversation, input.workspaceId);

    return conversation;
  }
  static instance() {
    return new CloseConversation(ConversationsDatabaseRepository.instance());
  }
}

type InputDTO = {
  conversationId: string;
  workspaceId: string;
};
