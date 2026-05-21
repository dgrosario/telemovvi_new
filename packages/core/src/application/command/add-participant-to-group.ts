import { Conversation } from "../../domain/entities/conversation";
import { InternalConversationParticipant } from "../../domain/entities/internal-conversation-participant";
import { User } from "../../domain/entities/user";
import { NotFound } from "../../domain/errors/not-found";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { InternalConversationParticipantsDatabaseRepository } from "../../infra/repositories/internal-conversation-participants-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";

interface ConversationsRepository {
  retrieveWithParticipants(id: string): Promise<Conversation | null>;
}

interface ParticipantsRepository {
  add(participant: InternalConversationParticipant): Promise<void>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

export class AddParticipantToGroup {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly participantsRepository: ParticipantsRepository,
    private readonly usersRepository: UsersRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const conversation = await this.conversationsRepository.retrieveWithParticipants(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    if (!conversation.isGroup) {
      throw new Error("Can only add participants to group conversations");
    }

    const isAdminParticipant = conversation.participants.find(
      (p) => p.userId === input.addedByUserId && p.role === "admin" && p.isActive
    );

    if (!isAdminParticipant) {
      throw new Error("Only admins can add participants to the group");
    }

    const isAlreadyParticipant = await this.participantsRepository.isParticipant(
      input.conversationId,
      input.userId
    );

    if (isAlreadyParticipant) {
      return {
        success: false,
        reason: "User is already a participant",
      };
    }

    const user = await this.usersRepository.retrieve(input.userId);
    if (!user) {
      throw NotFound.throw("User");
    }

    const participant = InternalConversationParticipant.create({
      conversationId: input.conversationId,
      userId: user.id,
      userName: user.name,
      userThumbnail: user.thumbnail,
      role: "member",
    });

    await this.participantsRepository.add(participant);

    return {
      success: true,
      participant: participant.raw(),
    };
  }

  static instance() {
    return new AddParticipantToGroup(
      ConversationsDatabaseRepository.instance(),
      InternalConversationParticipantsDatabaseRepository.instance(),
      UsersDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  userId: string;
  addedByUserId: string;
  workspaceId: string;
};

type OutputDTO =
  | { success: true; participant: InternalConversationParticipant.Raw }
  | { success: false; reason: string };
