import { Campaign } from "../../domain/entities/campaign";
import { Channel } from "../../domain/entities/channel";
import {
  CampaignsDatabaseRepository,
  ListCampaignsInputDTO,
  ListCampaignsOutputDTO,
} from "../../infra/repositories/campaigns-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";

interface CampaignsRepository {
  list(input: ListCampaignsInputDTO): Promise<ListCampaignsOutputDTO>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

type InputDTO = {
  workspaceId: string;
  status?: Campaign.Status[];
  pageIndex?: number;
  pageSize?: number;
};

type OutputDTO = {
  campaigns: Array<{
    id: string;
    name: string;
    status: Campaign.Status;
    channelId: string;
    channelName: string;
    channelType: Channel.Type;
    filterLabelIds: string[];
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    progress: {
      sent: number;
      failed: number;
      pending: number;
      total: number;
      percentage: number;
    };
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  pageIndex: number;
  pageSize: number;
};

export class ListCampaigns {
  constructor(
    private readonly campaignsRepository: CampaignsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const result = await this.campaignsRepository.list({
      workspaceId: input.workspaceId,
      status: input.status,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    });

    const campaignsWithChannel = await Promise.all(
      result.campaigns.map(async (campaign) => {
        const channel = await this.channelsRepository.retrieve(
          campaign.channelId,
          campaign.workspaceId
        );

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          channelId: campaign.channelId,
          channelName: channel?.name ?? "Canal removido",
          channelType: channel?.type ?? ("whatsapp" as Channel.Type),
          filterLabelIds: campaign.filterLabelIds,
          scheduledAt: campaign.scheduledAt,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
          totalRecipients: campaign.totalRecipients,
          sentCount: campaign.sentCount,
          failedCount: campaign.failedCount,
          progress: campaign.getProgress(),
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        };
      })
    );

    return {
      campaigns: campaignsWithChannel,
      total: result.total,
      pageIndex: result.pageIndex,
      pageSize: result.pageSize,
    };
  }

  static instance(): ListCampaigns {
    return new ListCampaigns(
      CampaignsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance()
    );
  }
}
