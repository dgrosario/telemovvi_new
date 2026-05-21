import { FlowsInSectorsDatabaseRepository } from "../../infra/repositories/flows-in-sectors-repository";

interface FlowsInSectorsRepository {
  deleteAllRelationsFromFlow(flowId: string): Promise<unknown>;
  addRelationsToFlow(flowId: string, sectorIds: string[]): Promise<unknown>;
}

export class AssociateFlowWithSectors {
  constructor(
    private readonly flowsInSectorsRepository: FlowsInSectorsRepository
  ) {}

  async execute(input: InputDTO): Promise<void> {
    await this.flowsInSectorsRepository.deleteAllRelationsFromFlow(
      input.flowId
    );

    if (input.sectorIds.length > 0) {
      await this.flowsInSectorsRepository.addRelationsToFlow(
        input.flowId,
        input.sectorIds
      );
    }
  }

  static instance() {
    return new AssociateFlowWithSectors(
      FlowsInSectorsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  flowId: string;
  sectorIds: string[];
};
