import { Flow } from "../../domain/entities/flow";
import { FlowConnection } from "../../domain/entities/flow-connection";
import { FlowNode } from "../../domain/entities/flow-node";
import { NotFound } from "../../domain/errors/not-found";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  retrieve(id: string): Promise<Flow | null>;
  create(flow: Flow): Promise<void>;
}

export class DuplicateFlow {
  constructor(private readonly flowsRepository: FlowsRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const originalFlow = await this.flowsRepository.retrieve(input.flowId);

    if (!originalFlow) throw NotFound.throw("Flow");

    const nodes = originalFlow.nodes.map((node) =>
      FlowNode.fromRaw(node.raw())
    );

    const connections = originalFlow.connections.map((conn) =>
      FlowConnection.fromRaw(conn.raw())
    );

    const duplicatedFlow = Flow.create({
      workspaceId: originalFlow.workspaceId,
      name: `${originalFlow.name} (copy)`,
      status: "draft",
    });

    duplicatedFlow.updateNodesAndConnections(nodes, connections);

    await this.flowsRepository.create(duplicatedFlow);

    return {
      id: duplicatedFlow.id,
      name: duplicatedFlow.name,
      status: duplicatedFlow.status,
      createdAt: duplicatedFlow.createdAt,
    };
  }

  static instance() {
    return new DuplicateFlow(FlowsDatabaseRepository.instance());
  }
}

type InputDTO = {
  flowId: string;
};

type OutputDTO = {
  id: string;
  name: string;
  status: Flow.Status;
  createdAt: Date;
};
