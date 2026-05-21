import { Sector } from "../../domain/entities/sector";
import { Membership } from "../../domain/entities/membership";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";
import { createDatabaseConnection, eq } from "../../infra/database";
import { usersInSector } from "../../infra/database/schemas";

interface SectorsRepository {
  list(workspaceId: string): Promise<Sector.Props[]>;
  retrieve(sectorId?: string): Promise<Sector | null>;
}

export class ListMySector {
  constructor(private readonly sectorsRepository: SectorsRepository) {}

  async execute(input: InputDTO) {
    if (input.membership.hasPermission("list:all-sectors")) {
      return await this.sectorsRepository.list(input.workspaceId);
    }

    const db = createDatabaseConnection();
    const userSectors = await db
      .select({
        sectorId: usersInSector.sectorId,
      })
      .from(usersInSector)
      .where(eq(usersInSector.userId, input.id));

    if (userSectors.length === 0) {
      return [];
    }

    const sectorsList: Sector.Props[] = [];
    for (const { sectorId } of userSectors) {
      if (!sectorId) continue;
      const sector = await this.sectorsRepository.retrieve(sectorId);
      if (sector) {
        sectorsList.push(sector.raw());
      }
    }

    return sectorsList;
  }

  static instance() {
    return new ListMySector(SectorsDatabaseRepository.instance());
  }
}

type InputDTO = {
  id: string;
  workspaceId: string;
  membership: Membership;
};
