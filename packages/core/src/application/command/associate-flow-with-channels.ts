import { FlowsInChannelsDatabaseRepository } from "../../infra/repositories/flows-in-channels-repository";

interface FlowsInChannelsRepository {
  deleteAllRelationsFromFlow(flowId: string): Promise<unknown>;
  addRelationsToFlow(flowId: string, channelIds: string[]): Promise<unknown>;
}

export class AssociateFlowWithChannels {
  constructor(
    private readonly flowsInChannelsRepository: FlowsInChannelsRepository
  ) {}

  async execute(input: InputDTO): Promise<void> {
    await this.flowsInChannelsRepository.deleteAllRelationsFromFlow(
      input.flowId
    );

    if (input.channelIds.length > 0) {
      await this.flowsInChannelsRepository.addRelationsToFlow(
        input.flowId,
        input.channelIds
      );
    }
  }

  static instance() {
    return new AssociateFlowWithChannels(
      FlowsInChannelsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  flowId: string;
  channelIds: string[];
};
