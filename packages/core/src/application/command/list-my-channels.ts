import { Membership } from "../../domain/entities/membership";
import { ChannelInSectorsDatabaseRepository } from "../../infra/repositories/channels-in-sectors-repository";
import { createDatabaseConnection, eq } from "../../infra/database";
import { usersInSector } from "../../infra/database/schemas";

interface ChannelsInSectorRepository {
  listBySector(
    sectorId: string
  ): Promise<{ channelId: string | null; sectorId: string | null }[]>;
}

export class ListMyChannels {
  constructor(
    private readonly channelsInSectorRepository: ChannelsInSectorRepository
  ) {}

  async execute(input: InputDTO): Promise<string[]> {
    if (input.membership.hasPermission("list:all-channels")) {
      return [];
    }

    const db = createDatabaseConnection();
    const userSectors = await db
      .select({ sectorId: usersInSector.sectorId })
      .from(usersInSector)
      .where(eq(usersInSector.userId, input.id));

    if (userSectors.length === 0) {
      return [];
    }

    const channelIds = new Set<string>();

    for (const { sectorId } of userSectors) {
      if (!sectorId) continue;
      const relations = await this.channelsInSectorRepository.listBySector(
        sectorId
      );
      for (const r of relations) {
        if (r.channelId) {
          channelIds.add(r.channelId);
        }
      }
    }

    return Array.from(channelIds);
  }

  static instance() {
    return new ListMyChannels(new ChannelInSectorsDatabaseRepository());
  }
}

type InputDTO = {
  id: string;
  workspaceId: string;
  membership: Membership;
};
