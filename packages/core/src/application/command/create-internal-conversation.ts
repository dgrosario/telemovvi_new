import { Conversation } from "../../domain/entities/conversation";
import { InternalConversationParticipant } from "../../domain/entities/internal-conversation-participant";
import { User } from "../../domain/entities/user";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { InternalConversationParticipantsDatabaseRepository } from "../../infra/repositories/internal-conversation-participants-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";

interface ConversationsRepository {
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface ParticipantsRepository {
  addBulk(participants: InternalConversationParticipant[]): Promise<void>;
  findDirectConversation(
    userId1: string,
    userId2: string,
    workspaceId: string
  ): Promise<string | null>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

export class CreateInternalConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly participantsRepository: ParticipantsRepository,
    private readonly usersRepository: UsersRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    if (input.participantIds.length === 0) {
      throw new Error("At least one participant is required");
    }

    const creator = await this.usersRepository.retrieve(input.creatorId);
    if (!creator) {
      throw new Error("Creator not found");
    }

    const participantsInfo: { id: string; name: string; thumbnail: string | null }[] = [];
    for (const participantId of input.participantIds) {
      const user = await this.usersRepository.retrieve(participantId);
      if (!user) {
        throw new Error(`User ${participantId} not found`);
      }
      participantsInfo.push({
        id: user.id,
        name: user.name,
        thumbnail: user.thumbnail ?? null,
      });
    }

    const isDirect = input.participantIds.length === 1;

    if (isDirect) {
      const firstParticipant = input.participantIds[0];
      if (!firstParticipant) {
        throw new Error("Participant ID is required for direct conversation");
      }

      const existingConversationId =
        await this.participantsRepository.findDirectConversation(
          input.creatorId,
          firstParticipant,
          input.workspaceId
        );

      if (existingConversationId) {
        return {
          conversationId: existingConversationId,
          created: false,
        };
      }
    }

    if (!isDirect && !input.name) {
      throw new Error("Group name is required");
    }

    const conversation = isDirect
      ? Conversation.createDirect({
          participantIds: input.participantIds,
          participantNames: participantsInfo.map((p) => p.name),
          participantThumbnails: participantsInfo.map((p) => p.thumbnail),
          creatorId: creator.id,
          creatorName: creator.name,
          creatorThumbnail: creator.thumbnail,
        })
      : Conversation.createGroup({
          participantIds: input.participantIds,
          participantNames: participantsInfo.map((p) => p.name),
          participantThumbnails: participantsInfo.map((p) => p.thumbnail),
          creatorId: creator.id,
          creatorName: creator.name,
          creatorThumbnail: creator.thumbnail,
          name: input.name,
        });

    await this.conversationsRepository.upsert(conversation, input.workspaceId);
    await this.participantsRepository.addBulk(conversation.participants);

    return {
      conversationId: conversation.id,
      created: true,
    };
  }

  static instance() {
    return new CreateInternalConversation(
      ConversationsDatabaseRepository.instance(),
      InternalConversationParticipantsDatabaseRepository.instance(),
      UsersDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  creatorId: string;
  participantIds: string[];
  workspaceId: string;
  name?: string;
};

type OutputDTO = {
  conversationId: string;
  created: boolean;
};
