import { Campaign } from "../../domain/entities/campaign";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";

interface CampaignsRepository {
  retrieveScheduledCampaigns(beforeDate: Date): Promise<Campaign[]>;
  update(campaign: Campaign): Promise<void>;
}

interface OutputDTO {
  processedCount: number;
  campaignIds: string[];
}

export class ProcessScheduledCampaigns {
  constructor(private readonly campaignsRepository: CampaignsRepository) {}

  async execute(): Promise<OutputDTO> {
    const now = new Date();

    const scheduledCampaigns =
      await this.campaignsRepository.retrieveScheduledCampaigns(now);

    const startedCampaignIds: string[] = [];

    for (const campaign of scheduledCampaigns) {
      if (campaign.totalRecipients === 0) {
        continue;
      }

      campaign.start();
      await this.campaignsRepository.update(campaign);
      startedCampaignIds.push(campaign.id);
    }

    return {
      processedCount: startedCampaignIds.length,
      campaignIds: startedCampaignIds,
    };
  }

  static instance(): ProcessScheduledCampaigns {
    return new ProcessScheduledCampaigns(CampaignsDatabaseRepository.instance());
  }
}
