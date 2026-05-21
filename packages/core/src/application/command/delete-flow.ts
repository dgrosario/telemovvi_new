import { Flow } from "../../domain/entities/flow";
import { NotFound } from "../../domain/errors/not-found";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Flow | null>;
  delete(id: string): Promise<void>;
}

export class DeleteFlow {
  constructor(private readonly flowsRepository: FlowsRepository) {}

  async execute(input: InputDTO): Promise<void> {
    const flow = await this.flowsRepository.retrieveByWorkspace(
      input.flowId,
      input.workspaceId
    );

    if (!flow) throw NotFound.throw("Flow");

    await this.flowsRepository.delete(input.flowId);
  }

  static instance() {
    return new DeleteFlow(FlowsDatabaseRepository.instance());
  }
}

type InputDTO = {
  flowId: string;
  workspaceId: string;
};
