import { Conversation } from "../../domain/entities/conversation";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { InternalConversationParticipantsDatabaseRepository } from "../../infra/repositories/internal-conversation-participants-repository";

interface ConversationsRepository {
  retrieveWithParticipants(id: string): Promise<Conversation | null>;
}

interface ParticipantsRepository {
  remove(conversationId: string, userId: string): Promise<void>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  listActiveByConversation(
    conversationId: string
  ): Promise<{ userId: string; role: string }[]>;
}

export class LeaveInternalConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly participantsRepository: ParticipantsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const conversation = await this.conversationsRepository.retrieveWithParticipants(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    if (!conversation.isInternal) {
      throw new Error("Can only leave internal conversations");
    }

    const isParticipant = await this.participantsRepository.isParticipant(
      input.conversationId,
      input.userId
    );

    if (!isParticipant) {
      return {
        success: false,
        reason: "User is not a participant of this conversation",
      };
    }

    if (conversation.isDirect) {
      await this.participantsRepository.remove(
        input.conversationId,
        input.userId
      );

      return {
        success: true,
        conversationId: input.conversationId,
      };
    }

    const activeParticipants =
      await this.participantsRepository.listActiveByConversation(
        input.conversationId
      );

    const userParticipant = activeParticipants.find(
      (p) => p.userId === input.userId
    );

    if (userParticipant?.role === "admin") {
      const otherAdmins = activeParticipants.filter(
        (p) => p.role === "admin" && p.userId !== input.userId
      );

      if (otherAdmins.length === 0 && activeParticipants.length > 1) {
        return {
          success: false,
          reason:
            "Cannot leave group as the only admin. Promote another member to admin first.",
        };
      }
    }

    await this.participantsRepository.remove(input.conversationId, input.userId);

    return {
      success: true,
      conversationId: input.conversationId,
    };
  }

  static instance() {
    return new LeaveInternalConversation(
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

type OutputDTO =
  | { success: true; conversationId: string }
  | { success: false; reason: string };
