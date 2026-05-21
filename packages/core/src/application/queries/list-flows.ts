import { Flow } from "../../domain/entities/flow";
import { Channel } from "../../domain/entities/channel";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";
import { FlowsInChannelsDatabaseRepository } from "../../infra/repositories/flows-in-channels-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";

interface FlowsRepository {
  list(input: { workspaceId: string }): Promise<Flow[]>;
}

interface FlowsInChannelsRepository {
  listByFlow(
    flowId: string
  ): Promise<{ flowId: string | null; channelId: string | null }[]>;
}

interface ChannelsRepository {
  retrieve(id: string): Promise<Channel | null>;
}

export class ListFlows {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly flowsInChannelsRepository: FlowsInChannelsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO[]> {
    const flows = await this.flowsRepository.list({
      workspaceId: input.workspaceId,
    });
    
    const flowsWithChannels = await Promise.all(
      flows.map(async (flow) => {
        const flowChannelRelations =
          await this.flowsInChannelsRepository.listByFlow(flow.id);

        const channels = await Promise.all(
          flowChannelRelations
            .filter((relation) => relation.channelId !== null)
            .map(async (relation) => {
              const channel = await this.channelsRepository.retrieve(
                relation.channelId!
              );
              return channel
                ? {
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                  }
                : null;
            })
        );

        return {
          id: flow.id,
          name: flow.name,
          status: flow.status,
          nodesCount: flow.nodes.length,
          createdAt: flow.createdAt,
          updatedAt: flow.updatedAt,
          channels: channels.filter(
            (c): c is NonNullable<typeof c> => c !== null
          ),
        };
      })
    );

    return flowsWithChannels;
  }

  static instance() {
    return new ListFlows(
      FlowsDatabaseRepository.instance(),
      FlowsInChannelsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  workspaceId: string;
};

type OutputDTO = {
  id: string;
  name: string;
  status: Flow.Status;
  nodesCount: number;
  createdAt: Date;
  updatedAt: Date;
  channels: Array<{
    id: string;
    name: string;
    type: Channel.Type;
  }>;
};
