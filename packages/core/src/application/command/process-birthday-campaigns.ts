import { Campaign } from "../../domain/entities/campaign";
import { CampaignRecipient } from "../../domain/entities/campaign-recipient";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";
import { CampaignRecipientsDatabaseRepository } from "../../infra/repositories/campaign-recipients-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";

interface CampaignsRepository {
  listRunningBirthdayCampaigns(): Promise<Campaign[]>;
  update(campaign: Campaign): Promise<void>;
}

interface CampaignRecipientsRepository {
  findExistingPartnerIds(
    campaignId: string,
    partnerIds: string[]
  ): Promise<Set<string>>;
  createBatch(recipients: CampaignRecipient[]): Promise<void>;
}

interface PartnersRepository {
  findBirthdayPartnersWithWhatsAppContacts(
    workspaceId: string
  ): Promise<Array<{ partnerId: string; partnerContactId: string }>>;
}

interface OutputDTO {
  processedCampaigns: number;
  newRecipients: number;
  campaignResults: Array<{
    campaignId: string;
    campaignName: string;
    newRecipients: number;
  }>;
}

export class ProcessBirthdayCampaigns {
  constructor(
    private readonly campaignsRepository: CampaignsRepository,
    private readonly recipientsRepository: CampaignRecipientsRepository,
    private readonly partnersRepository: PartnersRepository
  ) {}

  async execute(): Promise<OutputDTO> {
    const birthdayCampaigns =
      await this.campaignsRepository.listRunningBirthdayCampaigns();

    if (birthdayCampaigns.length === 0) {
      return {
        processedCampaigns: 0,
        newRecipients: 0,
        campaignResults: [],
      };
    }

    const campaignResults: OutputDTO["campaignResults"] = [];
    let totalNewRecipients = 0;

    for (const campaign of birthdayCampaigns) {
      try {
        const birthdayContacts =
          await this.partnersRepository.findBirthdayPartnersWithWhatsAppContacts(
            campaign.workspaceId
          );

        if (birthdayContacts.length === 0) {
          campaignResults.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            newRecipients: 0,
          });
          continue;
        }

        const partnerIds = birthdayContacts.map((c) => c.partnerId);
        const existingPartnerIds =
          await this.recipientsRepository.findExistingPartnerIds(
            campaign.id,
            partnerIds
          );

        const newContacts = birthdayContacts.filter(
          (c) => !existingPartnerIds.has(c.partnerId)
        );

        if (newContacts.length === 0) {
          campaignResults.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            newRecipients: 0,
          });
          continue;
        }

        const newRecipients = newContacts.map((contact) =>
          CampaignRecipient.create({
            campaignId: campaign.id,
            partnerId: contact.partnerId,
            partnerContactId: contact.partnerContactId,
          })
        );

        await this.recipientsRepository.createBatch(newRecipients);

        campaign.setTotalRecipients(
          campaign.totalRecipients + newRecipients.length
        );
        await this.campaignsRepository.update(campaign);

        campaignResults.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          newRecipients: newRecipients.length,
        });

        totalNewRecipients += newRecipients.length;
      } catch (error) {
        console.error(
          `[ProcessBirthdayCampaigns] Error processing campaign ${campaign.id}:`,
          error
        );
        campaignResults.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          newRecipients: 0,
        });
      }
    }

    return {
      processedCampaigns: birthdayCampaigns.length,
      newRecipients: totalNewRecipients,
      campaignResults,
    };
  }

  static instance(): ProcessBirthdayCampaigns {
    return new ProcessBirthdayCampaigns(
      CampaignsDatabaseRepository.instance(),
      CampaignRecipientsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance()
    );
  }
}
