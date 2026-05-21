import { Flow } from "../../domain/entities/flow";
import { NotFound } from "../../domain/errors/not-found";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Flow | null>;
}

export class GetFlow {
  constructor(private readonly flowsRepository: FlowsRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const flow = await this.flowsRepository.retrieveByWorkspace(
      input.flowId,
      input.workspaceId
    );

    if (!flow) throw NotFound.throw("Flow");

    return flow.raw();
  }

  static instance() {
    return new GetFlow(FlowsDatabaseRepository.instance());
  }
}

type InputDTO = {
  flowId: string;
  workspaceId: string;
};

type OutputDTO = Flow.Raw;
