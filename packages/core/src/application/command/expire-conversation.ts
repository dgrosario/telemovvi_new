import { Conversation } from "../../domain/entities/conversation";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowStatusChecker } from "../services/flow-status-checker";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

export class ExpireConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(input: InputDTO) {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) throw NotFound.throw("conversation");

    if (conversation.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem expirar");
    }

    if (conversation.channel?.type === "evolution") {
      throw new Error("Conversas de canais Evolution nao podem expirar");
    }

    const previousStatus = conversation.status;
    conversation.expire();

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
    return new ExpireConversation(ConversationsDatabaseRepository.instance());
  }
}

type InputDTO = {
  conversationId: string;
  workspaceId: string;
};
