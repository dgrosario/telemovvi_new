import { Flow } from "../../domain/entities/flow";
import { FlowConnection } from "../../domain/entities/flow-connection";
import { FlowNode } from "../../domain/entities/flow-node";
import { NotFound } from "../../domain/errors/not-found";
import { FlowValidationService } from "../../domain/services/flow-validation-service";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  retrieve(id: string): Promise<Flow | null>;
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Flow | null>;
  update(flow: Flow): Promise<void>;
}

export class UpdateFlow {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly validationService: FlowValidationService
  ) {}

  async execute(input: InputDTO): Promise<void> {
    const flow = await this.flowsRepository.retrieveByWorkspace(
      input.flowId,
      input.workspaceId
    );

    if (!flow) throw NotFound.throw("Flow");

    if (input.name) {
      flow.updateName(input.name);
    }

    const isActivating = input.status === "active" && flow.status !== "active";

    if (input.status === "active") {
      flow.activate();
    } else if (input.status === "inactive") {
      flow.deactivate();
    }

    if (input.nodes && input.connections) {
      const nodes = input.nodes.map((node) => FlowNode.fromRaw(node));
      const connections = input.connections.map((conn) =>
        FlowConnection.fromRaw(conn)
      );

      flow.updateNodesAndConnections(nodes, connections);

      const validation = this.validationService.validate(flow, {
        strict: isActivating,
      });

      if (!validation.valid) {
        throw new Error(
          `Flow validation failed: ${validation.errors.join(", ")}`
        );
      }
    }

    await this.flowsRepository.update(flow);
  }

  static instance() {
    return new UpdateFlow(
      FlowsDatabaseRepository.instance(),
      FlowValidationService.instance()
    );
  }
}

type InputDTO = {
  flowId: string;
  workspaceId: string;
  name?: string;
  status?: Flow.Status;
  nodes?: FlowNode.Raw[];
  connections?: FlowConnection.Raw[];
};
