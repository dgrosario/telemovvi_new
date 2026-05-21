import { and, eq, or, isNull, asc } from "drizzle-orm";
import { SystemVariable } from "../../domain/entities/system-variable";
import { createDatabaseConnection } from "../database";
import { systemVariables } from "../database/schemas";

export class SystemVariablesDatabaseRepository {
  async create(variable: SystemVariable): Promise<SystemVariable> {
    const db = createDatabaseConnection();

    const [inserted] = await db
      .insert(systemVariables)
      .values({
        id: variable.id,
        key: variable.key,
        label: variable.label,
        description: variable.description,
        resolverType: variable.resolverType,
        resolverConfig: variable.resolverConfig,
        workspaceId: variable.workspaceId,
        isSystem: variable.isSystem,
        isActive: variable.isActive,
        createdAt: variable.createdAt,
        updatedAt: variable.updatedAt,
      })
      .returning();

    return this.mapToEntity(inserted!);
  }

  async update(
    id: string,
    data: SystemVariable.UpdateProps
  ): Promise<SystemVariable | null> {
    const db = createDatabaseConnection();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.label !== undefined) updateData.label = data.label;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.resolverConfig !== undefined)
      updateData.resolverConfig = data.resolverConfig;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [updated] = await db
      .update(systemVariables)
      .set(updateData)
      .where(eq(systemVariables.id, id))
      .returning();

    if (!updated) return null;

    return this.mapToEntity(updated);
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();
    await db.delete(systemVariables).where(eq(systemVariables.id, id));
  }

  async findById(id: string): Promise<SystemVariable | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(systemVariables)
      .where(eq(systemVariables.id, id));

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByKey(
    key: string,
    workspaceId?: string | null
  ): Promise<SystemVariable | null> {
    const db = createDatabaseConnection();

    const conditions = workspaceId
      ? and(
          eq(systemVariables.key, key),
          or(
            eq(systemVariables.workspaceId, workspaceId),
            eq(systemVariables.isSystem, true)
          )
        )
      : and(eq(systemVariables.key, key), eq(systemVariables.isSystem, true));

    const [row] = await db.select().from(systemVariables).where(conditions);

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async listForWorkspace(workspaceId: string): Promise<SystemVariable[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(systemVariables)
      .where(
        and(
          eq(systemVariables.isActive, true),
          or(
            eq(systemVariables.workspaceId, workspaceId),
            eq(systemVariables.isSystem, true)
          )
        )
      )
      .orderBy(asc(systemVariables.label));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listByWorkspace(workspaceId: string): Promise<SystemVariable[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(systemVariables)
      .where(
        or(
          eq(systemVariables.workspaceId, workspaceId),
          eq(systemVariables.isSystem, true)
        )
      )
      .orderBy(asc(systemVariables.isSystem), asc(systemVariables.label));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listSystemVariables(): Promise<SystemVariable[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(systemVariables)
      .where(eq(systemVariables.isSystem, true))
      .orderBy(asc(systemVariables.label));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listCustomByWorkspace(workspaceId: string): Promise<SystemVariable[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(systemVariables)
      .where(
        and(
          eq(systemVariables.workspaceId, workspaceId),
          eq(systemVariables.isSystem, false)
        )
      )
      .orderBy(asc(systemVariables.label));

    return rows.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(
    row: typeof systemVariables.$inferSelect
  ): SystemVariable {
    return SystemVariable.instance({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      resolverType: row.resolverType as SystemVariable.ResolverType,
      resolverConfig: row.resolverConfig as SystemVariable.ResolverConfig,
      workspaceId: row.workspaceId,
      isSystem: row.isSystem,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new SystemVariablesDatabaseRepository();
  }
}
