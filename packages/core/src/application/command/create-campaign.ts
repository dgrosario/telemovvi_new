import { Campaign } from "../../domain/entities/campaign";
import { CampaignMessage } from "../../domain/entities/campaign-message";
import { CampaignRecipient } from "../../domain/entities/campaign-recipient";
import { NotFound } from "../../domain/errors/not-found";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";

interface CampaignsRepository {
  createWithRecipients(
    campaign: Campaign,
    recipients: CampaignRecipient[]
  ): Promise<void>;
}

interface ChannelsRepository {
  retrieve(
    id: string,
    workspaceId: string
  ): Promise<{ id: string; type: string } | null>;
}

interface PartnersRepository {
  findByLabelsWithWhatsAppContacts(
    workspaceId: string,
    labelIds: string[]
  ): Promise<Array<{ partnerId: string; partnerContactId: string; contactValue: string }>>;
}

interface InputDTO {
  workspaceId: string;
  channelId: string;
  name: string;
  type?: Campaign.Type;
  filterLabelIds?: string[];
  minIntervalMs?: number;
  maxIntervalMs?: number;
  scheduledAt?: Date;
  createdBy: string;
  messages: Array<{
    variationLabel: CampaignMessage.VariationLabel;
    type: CampaignMessage.MessageType;
    content?: string;
    templateName?: string;
    variables?: CampaignMessage.Variable[];
  }>;
}

interface OutputDTO {
  id: string;
  totalRecipients: number;
}

export class CreateCampaign {
  constructor(
    private readonly campaignsRepository: CampaignsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Campaign name is required");
    }

    const campaignType = input.type ?? "manual";
    const filterLabelIds = input.filterLabelIds ?? [];

    if (campaignType === "manual" && filterLabelIds.length === 0) {
      throw new Error("At least one label filter is required for manual campaigns");
    }

    if (!input.messages || input.messages.length === 0) {
      throw new Error("At least one message variation is required");
    }

    const channel = await this.channelsRepository.retrieve(
      input.channelId,
      input.workspaceId
    );

    if (!channel) {
      throw NotFound.throw("Channel");
    }

    const whatsappChannelTypes = ["whatsapp", "evolution", "meta_api"];
    if (!whatsappChannelTypes.includes(channel.type)) {
      throw new Error(
        "Campaigns are only supported for WhatsApp channels (whatsapp, evolution, meta_api)"
      );
    }

    let eligibleContacts: Array<{
      partnerId: string;
      partnerContactId: string;
      contactValue: string;
    }> = [];

    if (campaignType === "manual") {
      eligibleContacts = await this.partnersRepository.findByLabelsWithWhatsAppContacts(
        input.workspaceId,
        filterLabelIds
      );

      if (eligibleContacts.length === 0) {
        throw new Error("No eligible recipients found with the selected filters");
      }
    }

    const campaign = Campaign.create({
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      name: input.name,
      type: campaignType,
      filterLabelIds,
      minIntervalMs: input.minIntervalMs,
      maxIntervalMs: input.maxIntervalMs,
      scheduledAt: input.scheduledAt,
      createdBy: input.createdBy,
      messages: input.messages,
    });

    campaign.setTotalRecipients(eligibleContacts.length);

    const recipients = eligibleContacts.map((contact) =>
      CampaignRecipient.create({
        campaignId: campaign.id,
        partnerId: contact.partnerId,
        partnerContactId: contact.partnerContactId,
      })
    );

    await this.campaignsRepository.createWithRecipients(campaign, recipients);

    return {
      id: campaign.id,
      totalRecipients: recipients.length,
    };
  }

  static instance(): CreateCampaign {
    return new CreateCampaign(
      CampaignsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance()
    );
  }
}
