import { and, eq, inArray, isNull } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { channels, channelsInSector, sectors } from "../database/schemas";
import { NotFound } from "../../domain/errors/not-found";
import { InvalidCreation } from "../../domain/errors/invalid-creation";

export class ChannelInSectorsDatabaseRepository {
  async addRelationsToSector(channelsIds: string[], sectorId: string) {
    if (!sectorId || !channelsIds?.length) return null;

    const db = createDatabaseConnection();

    const [sector] = await db
      .select({ workspaceId: sectors.workspaceId })
      .from(sectors)
      .where(eq(sectors.id, sectorId));

    if (!sector) {
      throw NotFound.throw("Setor não encontrado");
    }

    const channelsData = await db
      .select({ id: channels.id, workspaceId: channels.workspaceId })
      .from(channels)
      .where(and(inArray(channels.id, channelsIds), isNull(channels.deletedAt)));

    if (channelsData.length !== channelsIds.length) {
      throw NotFound.throw("Um ou mais canais não foram encontrados");
    }

    const invalidChannels = channelsData.filter(
      (channel) => channel.workspaceId !== sector.workspaceId
    );

    if (invalidChannels.length > 0) {
      throw InvalidCreation.instance(
        "Todos os canais devem pertencer ao mesmo workspace do setor"
      );
    }

    const values = channelsIds.map((channelId) => ({
      channelId,
      sectorId,
    }));

    try {
      const result = await db
        .insert(channelsInSector)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações conexão-setor:", error);
      return null;
    }
  }

  async addRelationsToChannel(channelId: string, sectorIds: string[]) {
    if (!sectorIds?.length || !channelId) return null;

    const db = createDatabaseConnection();

    const [channel] = await db
      .select({ workspaceId: channels.workspaceId })
      .from(channels)
      .where(and(eq(channels.id, channelId), isNull(channels.deletedAt)));

    if (!channel) {
      throw NotFound.throw("Canal não encontrado");
    }

    const sectorsData = await db
      .select({ id: sectors.id, workspaceId: sectors.workspaceId })
      .from(sectors)
      .where(inArray(sectors.id, sectorIds));

    if (sectorsData.length !== sectorIds.length) {
      throw NotFound.throw("Um ou mais setores não foram encontrados");
    }

    const invalidSectors = sectorsData.filter(
      (sector) => sector.workspaceId !== channel.workspaceId
    );

    if (invalidSectors.length > 0) {
      throw InvalidCreation.instance(
        "Todos os setores devem pertencer ao mesmo workspace do canal"
      );
    }

    const values = sectorIds.map((sectorId) => ({
      channelId,
      sectorId,
    }));

    try {
      const result = await db
        .insert(channelsInSector)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações conexão-setor:", error);
      return null;
    }
  }

  async listBySector(sectorId: string) {
    if (!sectorId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        channelId: channelsInSector.channelId,
        sectorId: channelsInSector.sectorId,
      })
      .from(channelsInSector)
      .where(eq(channelsInSector.sectorId, sectorId));

    return response;
  }

  async deleteRelationsFromSector(channelsIds: string[], sectorId: string) {
    if (!sectorId || !channelsIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(channelsInSector)
        .where(
          and(
            eq(channelsInSector.sectorId, sectorId),
            inArray(channelsInSector.channelId, channelsIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações conexão-setor:", error);
      return null;
    }
  }

  async deleteRelationsFromChannel(sectorsIds: string[], channelId: string) {
    if (!channelId || !sectorsIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(channelsInSector)
        .where(
          and(
            eq(channelsInSector.channelId, channelId),
            inArray(channelsInSector.sectorId, sectorsIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações conexão-setor:", error);
      return null;
    }
  }

  async listByChannel(channelId: string) {
    if (!channelId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        channelId: channelsInSector.channelId,
        sectorId: channelsInSector.sectorId,
      })
      .from(channelsInSector)
      .where(eq(channelsInSector.channelId, channelId));

    return response;
  }
}
