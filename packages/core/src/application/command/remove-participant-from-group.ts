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
}

export class RemoveParticipantFromGroup {
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

    if (!conversation.isGroup) {
      throw new Error("Can only remove participants from group conversations");
    }

    const isAdminParticipant = conversation.participants.find(
      (p) => p.userId === input.removedByUserId && p.role === "admin" && p.isActive
    );

    if (!isAdminParticipant) {
      throw new Error("Only admins can remove participants from the group");
    }

    if (input.userId === input.removedByUserId) {
      throw new Error("Admins cannot remove themselves, use leave instead");
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

    await this.participantsRepository.remove(input.conversationId, input.userId);

    return {
      success: true,
      removedUserId: input.userId,
    };
  }

  static instance() {
    return new RemoveParticipantFromGroup(
      ConversationsDatabaseRepository.instance(),
      InternalConversationParticipantsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  userId: string;
  removedByUserId: string;
  workspaceId: string;
};

type OutputDTO =
  | { success: true; removedUserId: string }
  | { success: false; reason: string };
