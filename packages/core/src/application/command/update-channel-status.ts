import {
  Channel,
  ChannelPayload,
  EvolutionChannelPayload,
  isEvolutionPayload,
} from "../../domain/entities/channel";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { OnConnectionUpdateProps } from "../../infra/controllers/evolution-event-handler";

interface ChannelsRepository {
  retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Partial<ChannelPayload>
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
  upsert(channel: Channel, workspaceId: string): Promise<void>;
}

export type UpdateChannelStatusOutput = {
  channel: Channel;
  workspaceId: string;
} | null;

export class UpdateChannelStatus {
  constructor(private readonly channelsRepository: ChannelsRepository) {}

  async execute(
    input: OnConnectionUpdateProps
  ): Promise<UpdateChannelStatusOutput> {
    console.log(
      "[UpdateChannelStatus] Updating status for instance:",
      input.instanceName,
      "->",
      input.state
    );

    const result = await this.channelsRepository.retrieveByTypeAndPayload(
      "evolution",
      { instanceName: input.instanceName }
    );

    if (!result) {
      console.log(
        "[UpdateChannelStatus] Channel not found for instance:",
        input.instanceName
      );
      return null;
    }

    const { channel, workspaceId } = result;

    const newStatus: Channel.Status =
      input.state === "open" ? "connected" : "disconnected";

    if (channel.status !== newStatus) {
      channel.status = newStatus;

      if (
        (newStatus === "connected" || newStatus === "disconnected") &&
        isEvolutionPayload(channel.payload)
      ) {
        const updatedPayload: EvolutionChannelPayload = {
          ...channel.payload,
          qrcode: null,
        };
        channel.payload = updatedPayload;
      }

      await this.channelsRepository.upsert(channel, workspaceId);

      console.log(
        "[UpdateChannelStatus] Channel status updated:",
        channel.id,
        "->",
        newStatus
      );
    }

    return { channel, workspaceId };
  }

  static instance(): UpdateChannelStatus {
    return new UpdateChannelStatus(ChannelsDatabaseRepository.instance());
  }
}
