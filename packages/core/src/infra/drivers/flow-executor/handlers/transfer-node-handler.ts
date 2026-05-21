import { Conversation } from "../../../../domain/entities/conversation";
import { FlowNode } from "../../../../domain/entities/flow-node";
import { Sector } from "../../../../domain/entities/sector";
import { NotFound } from "../../../../domain/errors/not-found";
import { SectorsDatabaseRepository } from "../../../repositories/sectors-respository";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

interface SectorsRepository {
  retrieve(id: string): Promise<Sector | null>;
}

export class TransferNodeHandler implements NodeHandler {
  constructor(private readonly sectorsRepository: SectorsRepository) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "transfer";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.TransferData;

    if (!nodeData.sectorId) {
      context.conversation.sector = null;
      context.conversation.attendant = null;
      context.conversation.status = "waiting";

      return {
        success: true,
        shouldPause: false,
        nextNodeId: null,
      };
    }

    const sector = await this.sectorsRepository.retrieve(nodeData.sectorId);

    if (!sector) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Sector not found",
      };
    }

    context.conversation.transferToSector(sector);

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  static instance() {
    return new TransferNodeHandler(SectorsDatabaseRepository.instance());
  }
}
