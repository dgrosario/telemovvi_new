import { Sector } from "../../domain/entities/sector";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";

interface SectorsRepository {
  findDefault(workspaceId: string): Promise<Sector | null>;
}

export class GetDefaultSector {
  constructor(private readonly sectorsRepository: SectorsRepository) {}

  async execute(input: InputDTO): Promise<OutputDTO | null> {
    const sector = await this.sectorsRepository.findDefault(input.workspaceId);

    if (!sector) return null;

    return sector.raw();
  }

  static instance() {
    return new GetDefaultSector(SectorsDatabaseRepository.instance());
  }
}

type InputDTO = {
  workspaceId: string;
};

type OutputDTO = {
  id: string;
  name: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  color: string;
  isDefault: boolean;
};
