import { Flow } from "../../domain/entities/flow";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  create(flow: Flow): Promise<void>;
}

export class CreateFlow {
  constructor(private readonly flowsRepository: FlowsRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const flow = Flow.create({
      workspaceId: input.workspaceId,
      name: input.name,
      status: input.status,
    });

    await this.flowsRepository.create(flow);

    return {
      id: flow.id,
      name: flow.name,
      status: flow.status,
      createdAt: flow.createdAt,
    };
  }

  static instance() {
    return new CreateFlow(FlowsDatabaseRepository.instance());
  }
}

type InputDTO = {
  workspaceId: string;
  name: string;
  status?: Flow.Status;
};

type OutputDTO = {
  id: string;
  name: string;
  status: Flow.Status;
  createdAt: Date;
};
