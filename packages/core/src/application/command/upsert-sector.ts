import { Sector } from "../../domain/entities/sector";
import { WorkingHours } from "../../domain/value-objects/working-hours";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";

interface SectorsRepository {
  upsert(workspaceId: string, sector: Sector): Promise<void>;
  setAsDefault(sectorId: string, workspaceId: string): Promise<void>;
}

export class UpsertSector {
  constructor(private readonly sectorsRepository: SectorsRepository) {}

  async execute(input: InputDTO) {
    const sector = input.id
      ? Sector.instance({
          id: input.id,
          name: input.name,
          workingHoursStart: input.workingHoursStart,
          workingHoursEnd: input.workingHoursEnd,
          color: input.color,
          isDefault: input.isDefault,
        })
      : Sector.create(input.name);

    if (input.workingHoursStart && input.workingHoursEnd) {
      const workingHours = WorkingHours.create(
        input.workingHoursStart,
        input.workingHoursEnd
      );
      sector.setWorkingHours(workingHours);
    }

    if (input.color) {
      sector.color = input.color;
    }

    await this.sectorsRepository.upsert(input.workspaceId, sector);

    if (input.isDefault) {
      await this.sectorsRepository.setAsDefault(sector.id, input.workspaceId);
    }
  }

  static instance() {
    return new UpsertSector(SectorsDatabaseRepository.instance());
  }
}

type InputDTO = {
  id?: string;
  name: string;
  workspaceId: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  color?: string;
  isDefault?: boolean;
};
