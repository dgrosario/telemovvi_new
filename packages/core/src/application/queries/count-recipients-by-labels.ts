import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";

interface PartnersRepository {
  countByLabels(workspaceId: string, labelIds: string[]): Promise<number>;
}

type InputDTO = {
  workspaceId: string;
  labelIds: string[];
};

type OutputDTO = {
  count: number;
};

export class CountRecipientsByLabels {
  constructor(private readonly partnersRepository: PartnersRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    if (!input.labelIds || input.labelIds.length === 0) {
      return { count: 0 };
    }

    const count = await this.partnersRepository.countByLabels(
      input.workspaceId,
      input.labelIds
    );

    return { count };
  }

  static instance(): CountRecipientsByLabels {
    return new CountRecipientsByLabels(PartnersDatabaseRepository.instance());
  }
}
