import {
  Channel,
  ChannelPayload,
  EvolutionChannelPayload,
  isEvolutionPayload,
} from "../../domain/entities/channel";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { OnQrcodeUpdateProps } from "../../infra/controllers/evolution-event-handler";

interface ChannelsRepository {
  retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Partial<ChannelPayload>
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
  upsert(channel: Channel, workspaceId: string): Promise<void>;
}

export type UpdateChannelQrcodeOutput = {
  channel: Channel;
  workspaceId: string;
} | null;

export class UpdateChannelQrcode {
  constructor(private readonly channelsRepository: ChannelsRepository) {}

  async execute(
    input: OnQrcodeUpdateProps
  ): Promise<UpdateChannelQrcodeOutput> {
    console.log(
      "[UpdateChannelQrcode] Updating QR code for instance:",
      input.instanceName
    );

    const result = await this.channelsRepository.retrieveByTypeAndPayload(
      "evolution",
      { instanceName: input.instanceName }
    );

    if (!result) {
      console.log(
        "[UpdateChannelQrcode] Channel not found for instance:",
        input.instanceName
      );
      return null;
    }

    const { channel, workspaceId } = result;

    if (isEvolutionPayload(channel.payload)) {
      const updatedPayload: EvolutionChannelPayload = {
        ...channel.payload,
        qrcode: input.qrcodeBase64,
      };
      channel.payload = updatedPayload;
    }

    await this.channelsRepository.upsert(channel, workspaceId);

    console.log(
      "[UpdateChannelQrcode] QR code updated for channel:",
      channel.id
    );

    return { channel, workspaceId };
  }

  static instance(): UpdateChannelQrcode {
    return new UpdateChannelQrcode(ChannelsDatabaseRepository.instance());
  }
}
