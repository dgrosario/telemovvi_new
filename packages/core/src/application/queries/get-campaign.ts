import { Campaign } from "../../domain/entities/campaign";
import { CampaignMessage } from "../../domain/entities/campaign-message";
import { Channel } from "../../domain/entities/channel";
import { NotFound } from "../../domain/errors/not-found";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";
import { CampaignRecipientsDatabaseRepository } from "../../infra/repositories/campaign-recipients-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";

interface CampaignsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Campaign | null>;
}

interface CampaignRecipientsRepository {
  countByStatus(campaignId: string): Promise<Record<string, number>>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

type InputDTO = {
  campaignId: string;
  workspaceId: string;
};

type OutputDTO = {
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
  createdBy: string | null;
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
  messages: Array<{
    id: string;
    variationLabel: CampaignMessage.VariationLabel;
    type: CampaignMessage.MessageType;
    content: string | null;
    templateName: string | null;
    variables: CampaignMessage.Variable[];
    sentCount: number;
    createdAt: Date;
  }>;
  recipientStats: {
    pending: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export class GetCampaign {
  constructor(
    private readonly campaignsRepository: CampaignsRepository,
    private readonly recipientsRepository: CampaignRecipientsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const campaign = await this.campaignsRepository.retrieveByWorkspace(
      input.campaignId,
      input.workspaceId
    );

    if (!campaign) {
      throw NotFound.throw("Campaign");
    }

    const channel = await this.channelsRepository.retrieve(
      campaign.channelId,
      campaign.workspaceId
    );

    const statusCounts = await this.recipientsRepository.countByStatus(
      campaign.id
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
      createdBy: campaign.createdBy,
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      progress: campaign.getProgress(),
      messages: campaign.messages.map((m) => ({
        id: m.id,
        variationLabel: m.variationLabel,
        type: m.type,
        content: m.content,
        templateName: m.templateName,
        variables: m.variables,
        sentCount: m.sentCount,
        createdAt: m.createdAt,
      })),
      recipientStats: {
        pending: statusCounts["pending"] ?? 0,
        sent: statusCounts["sent"] ?? 0,
        failed: statusCounts["failed"] ?? 0,
        skipped: statusCounts["skipped"] ?? 0,
      },
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  static instance(): GetCampaign {
    return new GetCampaign(
      CampaignsDatabaseRepository.instance(),
      CampaignRecipientsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance()
    );
  }
}
