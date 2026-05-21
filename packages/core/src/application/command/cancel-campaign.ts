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

export class CancelCampaign {
  constructor(private readonly campaignsRepository: CampaignsRepository) {}

  async execute(input: InputDTO): Promise<void> {
    const campaign = await this.campaignsRepository.retrieveByWorkspace(
      input.campaignId,
      input.workspaceId
    );

    if (!campaign) {
      throw NotFound.throw("Campaign");
    }

    if (!campaign.canCancel()) {
      throw new Error(
        `Campaign cannot be cancelled. Current status: ${campaign.status}`
      );
    }

    campaign.cancel();

    await this.campaignsRepository.update(campaign);
  }

  static instance(): CancelCampaign {
    return new CancelCampaign(CampaignsDatabaseRepository.instance());
  }
}
