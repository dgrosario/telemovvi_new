import { Campaign } from "../../domain/entities/campaign";
import { NotFound } from "../../domain/errors/not-found";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";

interface CampaignsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Campaign | null>;
  update(campaign: Campaign): Promise<void>;
}

interface InputDTO {
  campaignId: string;
  workspaceId: string;
}

export class StartCampaign {
  constructor(private readonly campaignsRepository: CampaignsRepository) {}

  async execute(input: InputDTO): Promise<void> {
    const campaign = await this.campaignsRepository.retrieveByWorkspace(
      input.campaignId,
      input.workspaceId
    );

    if (!campaign) {
      throw NotFound.throw("Campaign");
    }

    if (!campaign.canStart()) {
      throw new Error(
        `Campaign cannot be started. Current status: ${campaign.status}`
      );
    }

    if (campaign.totalRecipients === 0) {
      throw new Error("Campaign has no recipients");
    }

    campaign.start();

    await this.campaignsRepository.update(campaign);
  }

  static instance(): StartCampaign {
    return new StartCampaign(CampaignsDatabaseRepository.instance());
  }
}
