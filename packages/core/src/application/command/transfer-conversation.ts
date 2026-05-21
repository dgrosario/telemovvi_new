import { Conversation } from "../../domain/entities/conversation";
import { Sector } from "../../domain/entities/sector";
import { User } from "../../domain/entities/user";
import { NotAuthorized } from "../../domain/errors/not-authorized";
import { createDatabaseConnection, eq } from "../../infra/database";
import { usersInSector } from "../../infra/database/schemas";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";
import { HumanTakeoverFlowTerminator } from "../services/human-takeover-flow-terminator";

interface ConversationsRepository {
  retrieve(conversationId: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface SectorsRepository {
  retrieve(sectorId: string): Promise<Sector | null>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

export class TransferConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly sectorsRepository: SectorsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly humanTakeoverFlowTerminator: HumanTakeoverFlowTerminator
  ) {}

  async execute(input: InputDTO) {
    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation || !input.sectorId) return;

    if (conversation.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ser transferidos");
    }

    const sector = await this.sectorsRepository.retrieve(input.sectorId);

    if (sector) {
      conversation.transferToSector(Sector.instance(sector));
    }

    let assignedAttendant = false;

    if (input.attendantId) {
      if (input.sectorId && !input.bypassSectorCheck) {
        const userHasAccessToSector = await this.checkUserHasAccessToSector(
          input.attendantId,
          input.sectorId
        );

        if (!userHasAccessToSector) {
          throw NotAuthorized.throw(["usuario nao tem acesso ao setor destino"]);
        }
      }

      const user = await this.usersRepository.retrieve(input.attendantId);
      if (user) {
        conversation.assign(user);
        assignedAttendant = true;
      }
    }

    await this.conversationsRepository.upsert(conversation, input.workspaceId);

    if (assignedAttendant) {
      await this.humanTakeoverFlowTerminator.terminateForConversation(
        conversation.id
      );
    }
  }

  private async checkUserHasAccessToSector(
    userId: string,
    sectorId: string
  ): Promise<boolean> {
    const db = createDatabaseConnection();
    const userSectors = await db
      .select({ sectorId: usersInSector.sectorId })
      .from(usersInSector)
      .where(eq(usersInSector.userId, userId));

    return userSectors.some((s) => s.sectorId === sectorId);
  }

  static instance() {
    return new TransferConversation(
      ConversationsDatabaseRepository.instance(),
      SectorsDatabaseRepository.instance(),
      UsersDatabaseRepository.instance(),
      HumanTakeoverFlowTerminator.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  sectorId?: string;
  workspaceId: string;
  attendantId?: string;
  bypassSectorCheck?: boolean;
};
