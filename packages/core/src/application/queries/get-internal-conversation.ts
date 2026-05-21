import { Conversation } from "../../domain/entities/conversation";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { InternalConversationParticipantsDatabaseRepository } from "../../infra/repositories/internal-conversation-participants-repository";

interface ConversationsRepository {
  retrieveWithParticipants(id: string): Promise<Conversation | null>;
}

interface ParticipantsRepository {
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
}

export class GetInternalConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly participantsRepository: ParticipantsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const isParticipant = await this.participantsRepository.isParticipant(
      input.conversationId,
      input.userId
    );

    if (!isParticipant) {
      throw new Error("User is not a participant of this conversation");
    }

    const conversation =
      await this.conversationsRepository.retrieveWithParticipants(
        input.conversationId
      );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    if (!conversation.isInternal) {
      throw new Error("This is not an internal conversation");
    }

    return {
      conversation: conversation.raw(),
    };
  }

  static instance() {
    return new GetInternalConversation(
      ConversationsDatabaseRepository.instance(),
      InternalConversationParticipantsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  userId: string;
  workspaceId: string;
};

type OutputDTO = {
  conversation: Conversation.Raw;
};
