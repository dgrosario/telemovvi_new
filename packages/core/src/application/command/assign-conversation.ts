import { Conversation } from "../../domain/entities/conversation";
import { ConversationAlreadyAssigned } from "../../domain/errors/conversation-already-assigned";
import { NotAuthorized } from "../../domain/errors/not-authorized";
import { NotFound } from "../../domain/errors/not-found";
import { createDatabaseConnection, eq } from "../../infra/database";
import { usersInSector } from "../../infra/database/schemas";
import { HumanTakeoverFlowTerminator } from "../services/human-takeover-flow-terminator";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";

interface ConversationsRepository {
  retrieve(conversationId: string): Promise<Conversation | null>;
  assignAtomically(
    conversationId: string,
    attendantId: string,
    workspaceId: string,
    sectorId?: string
  ): Promise<{ success: boolean; currentAttendantName: string | null }>;
}

export class AssignConversation {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly humanTakeoverFlowTerminator: HumanTakeoverFlowTerminator
  ) {}

  async execute(input: InputDTO): Promise<Conversation> {
    if (!input.attendantId) {
      throw NotFound.throw("Atendente");
    }

    if (!input.conversationId) {
      throw NotFound.throw("Conversa");
    }

    // Primeiro verifica se a conversa existe
    const existingConversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!existingConversation) {
      throw NotFound.throw("Conversa");
    }

    if (existingConversation.isWhatsAppGroup) {
      throw new Error("Grupos do WhatsApp nao podem ter atendentes atribuidos");
    }

    if (existingConversation.sector?.id && !input.bypassSectorCheck) {
      const userHasAccessToSector = await this.checkUserHasAccessToSector(
        input.attendantId,
        existingConversation.sector.id
      );

      if (!userHasAccessToSector) {
        const sectorName = existingConversation.sector?.name || "desconhecido";
        throw NotAuthorized.throw([
          `para assumir conversas do setor "${sectorName}". Voce nao pertence a este setor`
        ]);
      }
    }

    const result = await this.conversationsRepository.assignAtomically(
      input.conversationId,
      input.attendantId,
      input.workspaceId,
      input.sectorId
    );

    if (!result.success) {
      throw ConversationAlreadyAssigned.throw(
        result.currentAttendantName ?? undefined
      );
    }

    await this.humanTakeoverFlowTerminator.terminateForConversation(
      input.conversationId
    );

    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversa");
    }

    return conversation;
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
    return new AssignConversation(
      ConversationsDatabaseRepository.instance(),
      HumanTakeoverFlowTerminator.instance()
    );
  }
}

type InputDTO = {
  conversationId: string;
  attendantId: string;
  workspaceId: string;
  sectorId?: string;
  bypassSectorCheck?: boolean;
};
