import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";

interface PartnersRepository {
  countByLabels(workspaceId: string, labelIds: string[]): Promise<number>;
  findByLabelsWithWhatsAppContacts(
    workspaceId: string,
    labelIds: string[]
  ): Promise<Array<{ partnerId: string; partnerContactId: string; contactValue: string }>>;
}

type InputDTO = {
  workspaceId: string;
  labelIds: string[];
};

type OutputDTO = {
  count: number;
};

export class CountRecipients {
  constructor(private readonly partnersRepository: PartnersRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const labelIds = input.labelIds ?? [];

    if (labelIds.length === 0) {
      return { count: 0 };
    }

    const contacts = await this.partnersRepository.findByLabelsWithWhatsAppContacts(
      input.workspaceId,
      labelIds
    );

    const uniqueContactIds = new Set<string>();
    for (const contact of contacts) {
      uniqueContactIds.add(contact.partnerContactId);
    }

    return { count: uniqueContactIds.size };
  }

  static instance(): CountRecipients {
    return new CountRecipients(PartnersDatabaseRepository.instance());
  }
}
