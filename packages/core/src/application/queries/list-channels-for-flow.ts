import { Channel, ChannelPayload, parseChannelPayload } from "../../domain/entities/channel";
import { createDatabaseConnection } from "../../infra/database";
import { channels, flowsInChannels } from "../../infra/database/schemas";
import { and, eq, isNull } from "drizzle-orm";

export class ListChannelsForFlow {
  async execute(input: InputDTO): Promise<OutputDTO[]> {
    const db = createDatabaseConnection();

    const result = await db
      .select({
        id: channels.id,
        name: channels.name,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        createdAt: channels.createdAt,
      })
      .from(flowsInChannels)
      .innerJoin(channels, eq(flowsInChannels.channelId, channels.id))
      .where(and(eq(flowsInChannels.flowId, input.flowId), isNull(channels.deletedAt)));

    return result.map((channel) => ({
      id: channel.id,
      name: channel.name,
      status: channel.status,
      type: channel.type,
      payload: parseChannelPayload(channel.payload),
      createdAt: channel.createdAt,
    }));
  }

  static instance() {
    return new ListChannelsForFlow();
  }
}

type InputDTO = {
  flowId: string;
};

type OutputDTO = {
  id: string;
  name: string;
  status: Channel.Status;
  type: Channel.Type;
  payload: ChannelPayload;
  createdAt: Date;
};
