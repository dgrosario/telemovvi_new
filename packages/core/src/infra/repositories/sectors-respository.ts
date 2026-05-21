import { and, eq, inArray } from "drizzle-orm";
import { Sector } from "../../domain/entities/sector";
import { createDatabaseConnection } from "../database";
import { sectors } from "../database/schemas";

export class SectorsDatabaseRepository {
  async retrieve(sectorId?: string) {
    if (!sectorId) return null;
    const db = createDatabaseConnection();
    const [sector] = await db
      .select()
      .from(sectors)
      .where(and(eq(sectors.id, sectorId), eq(sectors.removed, false)));

    if (!sector) return null;

    return Sector.instance(sector);
  }

  async list(workspaceId: string): Promise<Sector.Props[]> {
    const db = createDatabaseConnection();

    const response = await db
      .select()
      .from(sectors)
      .where(
        and(eq(sectors.workspaceId, workspaceId), eq(sectors.removed, false))
      );

    return response;
  }

  async upsert(workspaceId: string, sector: Sector): Promise<void> {
    const db = createDatabaseConnection();

    const sectorData = sector.raw();

    await db
      .insert(sectors)
      .values({
        id: sectorData.id,
        name: sectorData.name,
        workspaceId,
        removed: false,
        workingHoursStart: sectorData.workingHoursStart,
        workingHoursEnd: sectorData.workingHoursEnd,
        color: sectorData.color,
        isDefault: sectorData.isDefault,
      })
      .onConflictDoUpdate({
        set: {
          name: sectorData.name,
          workingHoursStart: sectorData.workingHoursStart,
          workingHoursEnd: sectorData.workingHoursEnd,
          color: sectorData.color,
          isDefault: sectorData.isDefault,
        },
        target: sectors.id,
      });
  }

  async removeMany(ids: string[]): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .update(sectors)
      .set({ removed: true })
      .where(inArray(sectors.id, ids));
  }

  async findDefault(workspaceId: string): Promise<Sector | null> {
    const db = createDatabaseConnection();
    const [sector] = await db
      .select()
      .from(sectors)
      .where(
        and(
          eq(sectors.workspaceId, workspaceId),
          eq(sectors.isDefault, true),
          eq(sectors.removed, false)
        )
      );

    if (!sector) return null;

    return Sector.instance(sector);
  }

  async setAsDefault(sectorId: string, workspaceId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(sectors)
      .set({ isDefault: false })
      .where(
        and(eq(sectors.workspaceId, workspaceId), eq(sectors.isDefault, true))
      );

    await db
      .update(sectors)
      .set({ isDefault: true })
      .where(eq(sectors.id, sectorId));
  }

  async validateSectorIds(
    sectorIds: string[],
    workspaceId: string
  ): Promise<{ valid: boolean; invalidIds: string[] }> {
    if (sectorIds.length === 0) {
      return { valid: true, invalidIds: [] };
    }

    const db = createDatabaseConnection();
    const existingSectors = await db
      .select({ id: sectors.id })
      .from(sectors)
      .where(
        and(
          inArray(sectors.id, sectorIds),
          eq(sectors.workspaceId, workspaceId),
          eq(sectors.removed, false)
        )
      );

    const existingIds = new Set(existingSectors.map((s) => s.id));
    const invalidIds = sectorIds.filter((id) => !existingIds.has(id));

    return {
      valid: invalidIds.length === 0,
      invalidIds,
    };
  }

  static instance() {
    return new SectorsDatabaseRepository();
  }
}
