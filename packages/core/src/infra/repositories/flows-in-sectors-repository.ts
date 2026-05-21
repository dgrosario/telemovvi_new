import { and, eq, inArray } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { flowsInSectors, sectors } from "../database/schemas";

export class FlowsInSectorsDatabaseRepository {
  async addRelationsToFlow(flowId: string, sectorIds: string[]) {
    if (!flowId || !sectorIds?.length) return null;

    const db = createDatabaseConnection();

    const values = sectorIds.map((sectorId) => ({
      flowId,
      sectorId,
    }));

    try {
      const result = await db
        .insert(flowsInSectors)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações fluxo-setor:", error);
      return null;
    }
  }

  async addRelationsToSector(sectorId: string, flowIds: string[]) {
    if (!sectorId || !flowIds?.length) return null;

    const db = createDatabaseConnection();

    const values = flowIds.map((flowId) => ({
      flowId,
      sectorId,
    }));

    try {
      const result = await db
        .insert(flowsInSectors)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações fluxo-setor:", error);
      return null;
    }
  }

  async listByFlow(flowId: string) {
    if (!flowId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        flowId: flowsInSectors.flowId,
        sectorId: flowsInSectors.sectorId,
      })
      .from(flowsInSectors)
      .where(eq(flowsInSectors.flowId, flowId));

    return response;
  }

  async listBySector(sectorId: string) {
    if (!sectorId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        flowId: flowsInSectors.flowId,
        sectorId: flowsInSectors.sectorId,
      })
      .from(flowsInSectors)
      .where(eq(flowsInSectors.sectorId, sectorId));

    return response;
  }

  async deleteRelationsFromFlow(sectorIds: string[], flowId: string) {
    if (!flowId || !sectorIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInSectors)
        .where(
          and(
            eq(flowsInSectors.flowId, flowId),
            inArray(flowsInSectors.sectorId, sectorIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações fluxo-setor:", error);
      return null;
    }
  }

  async deleteRelationsFromSector(flowIds: string[], sectorId: string) {
    if (!sectorId || !flowIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInSectors)
        .where(
          and(
            eq(flowsInSectors.sectorId, sectorId),
            inArray(flowsInSectors.flowId, flowIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações fluxo-setor:", error);
      return null;
    }
  }

  async deleteAllRelationsFromFlow(flowId: string) {
    if (!flowId) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInSectors)
        .where(eq(flowsInSectors.flowId, flowId));

      return result;
    } catch (error) {
      console.error("Erro ao deletar todas as relações do fluxo:", error);
      return null;
    }
  }

  async listSectorIdsForFlow(flowId: string): Promise<string[]> {
    if (!flowId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        sectorId: flowsInSectors.sectorId,
      })
      .from(flowsInSectors)
      .where(eq(flowsInSectors.flowId, flowId));

    return response.map((r) => r.sectorId);
  }

  static instance() {
    return new FlowsInSectorsDatabaseRepository();
  }
}
