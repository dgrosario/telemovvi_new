import { and, eq } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { sectorPermissions, sectors } from "../database/schemas";

export type BlockedSector = {
  sectorId: string;
  sectorName: string;
};

export class SectorPermissionsDatabaseRepository {
  /**
   * Lista os setores BLOQUEADOS para visualização de dados de contato
   * Se retornar vazio, significa que o usuário pode ver todos os setores (sem restrições)
   * Se retornar setores, o usuário NÃO pode ver dados de contato nesses setores
   */
  async listBlockedSectorsForContactDetails(
    userId: string
  ): Promise<BlockedSector[]> {
    try {
      const db = createDatabaseConnection();

      const results = await db
        .select({
          sectorId: sectorPermissions.sectorId,
          sectorName: sectors.name,
        })
        .from(sectorPermissions)
        .leftJoin(sectors, eq(sectors.id, sectorPermissions.sectorId))
        .where(
          and(
            eq(sectorPermissions.userId, userId),
            eq(sectorPermissions.permission, "view:contact-details")
          )
        );

      return results.map((r) => ({
        sectorId: r.sectorId,
        sectorName: r.sectorName ?? "",
      }));
    } catch (error) {
      // Table might not exist yet, return empty (allows all)
      console.warn("sector_permissions table may not exist yet:", error);
      return [];
    }
  }

  /**
   * Define os setores BLOQUEADOS para visualização de dados de contato
   * Se a lista estiver vazia, remove todas as restrições (permite todos)
   * Se setores forem passados, o usuário NÃO poderá ver dados de contato nesses setores
   */
  async setBlockedSectorsForContactDetails(
    userId: string,
    sectorIds: string[]
  ): Promise<void> {
    const db = createDatabaseConnection();

    // Remove existing sector restrictions for this user
    await db
      .delete(sectorPermissions)
      .where(
        and(
          eq(sectorPermissions.userId, userId),
          eq(sectorPermissions.permission, "view:contact-details")
        )
      );

    // Insert new blocked sectors
    if (sectorIds.length > 0) {
      await db.insert(sectorPermissions).values(
        sectorIds.map((sectorId) => ({
          userId,
          sectorId,
          permission: "view:contact-details",
        }))
      );
    }
  }

  static instance(): SectorPermissionsDatabaseRepository {
    return new SectorPermissionsDatabaseRepository();
  }
}
