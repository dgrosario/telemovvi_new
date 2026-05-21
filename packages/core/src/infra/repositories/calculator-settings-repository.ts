import { and, eq, asc } from "drizzle-orm";
import { CalculatorSettings } from "../../domain/entities/calculator-settings";
import { createDatabaseConnection } from "../database";
import { calculatorSettings } from "../database/schemas";

export class CalculatorSettingsDatabaseRepository {
  async create(setting: CalculatorSettings): Promise<CalculatorSettings> {
    const db = createDatabaseConnection();

    const [inserted] = await db
      .insert(calculatorSettings)
      .values({
        id: setting.id,
        workspaceId: setting.workspaceId,
        installmentNumber: setting.installmentNumber,
        interestRate: setting.interestRate.toString(),
        isEnabled: setting.isEnabled,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      })
      .returning();

    return this.mapToEntity(inserted!);
  }

  async createMany(settings: CalculatorSettings[]): Promise<CalculatorSettings[]> {
    const db = createDatabaseConnection();

    const values = settings.map((setting) => ({
      id: setting.id,
      workspaceId: setting.workspaceId,
      installmentNumber: setting.installmentNumber,
      interestRate: setting.interestRate.toString(),
      isEnabled: setting.isEnabled,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    }));

    const inserted = await db
      .insert(calculatorSettings)
      .values(values)
      .returning();

    return inserted.map((row) => this.mapToEntity(row));
  }

  async update(
    id: string,
    data: CalculatorSettings.UpdateProps
  ): Promise<CalculatorSettings | null> {
    const db = createDatabaseConnection();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.interestRate !== undefined)
      updateData.interestRate = data.interestRate.toString();
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    const [updated] = await db
      .update(calculatorSettings)
      .set(updateData)
      .where(eq(calculatorSettings.id, id))
      .returning();

    if (!updated) return null;

    return this.mapToEntity(updated);
  }

  async upsertByWorkspaceAndInstallment(
    workspaceId: string,
    installmentNumber: number,
    data: { interestRate: number; isEnabled: boolean }
  ): Promise<CalculatorSettings> {
    const db = createDatabaseConnection();

    const existing = await this.findByWorkspaceAndInstallment(
      workspaceId,
      installmentNumber
    );

    if (existing) {
      const [updated] = await db
        .update(calculatorSettings)
        .set({
          interestRate: data.interestRate.toString(),
          isEnabled: data.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(calculatorSettings.id, existing.id))
        .returning();

      return this.mapToEntity(updated!);
    }

    const setting = CalculatorSettings.create({
      workspaceId,
      installmentNumber,
      interestRate: data.interestRate,
      isEnabled: data.isEnabled,
    });

    return this.create(setting);
  }

  async bulkUpsert(
    workspaceId: string,
    items: CalculatorSettings.BulkUpdateItem[]
  ): Promise<CalculatorSettings[]> {
    const results: CalculatorSettings[] = [];

    for (const item of items) {
      const result = await this.upsertByWorkspaceAndInstallment(
        workspaceId,
        item.installmentNumber,
        {
          interestRate: item.interestRate,
          isEnabled: item.isEnabled,
        }
      );
      results.push(result);
    }

    return results;
  }

  async findById(id: string): Promise<CalculatorSettings | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(calculatorSettings)
      .where(eq(calculatorSettings.id, id));

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByWorkspaceAndInstallment(
    workspaceId: string,
    installmentNumber: number
  ): Promise<CalculatorSettings | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(calculatorSettings)
      .where(
        and(
          eq(calculatorSettings.workspaceId, workspaceId),
          eq(calculatorSettings.installmentNumber, installmentNumber)
        )
      );

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async listByWorkspace(workspaceId: string): Promise<CalculatorSettings[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(calculatorSettings)
      .where(eq(calculatorSettings.workspaceId, workspaceId))
      .orderBy(asc(calculatorSettings.installmentNumber));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listEnabledByWorkspace(workspaceId: string): Promise<CalculatorSettings[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(calculatorSettings)
      .where(
        and(
          eq(calculatorSettings.workspaceId, workspaceId),
          eq(calculatorSettings.isEnabled, true)
        )
      )
      .orderBy(asc(calculatorSettings.installmentNumber));

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteByWorkspaceAndInstallment(
    workspaceId: string,
    installmentNumber: number
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .delete(calculatorSettings)
      .where(
        and(
          eq(calculatorSettings.workspaceId, workspaceId),
          eq(calculatorSettings.installmentNumber, installmentNumber)
        )
      );
  }

  async initializeDefaultSettings(
    workspaceId: string
  ): Promise<CalculatorSettings[]> {
    const existing = await this.listByWorkspace(workspaceId);

    if (existing.length > 0) {
      return existing;
    }

    const defaultSettings = CalculatorSettings.createDefaultSettings(workspaceId);
    return this.createMany(defaultSettings);
  }

  async getOrInitialize(workspaceId: string): Promise<CalculatorSettings[]> {
    const existing = await this.listByWorkspace(workspaceId);

    if (existing.length > 0) {
      return existing;
    }

    return this.initializeDefaultSettings(workspaceId);
  }

  private mapToEntity(
    row: typeof calculatorSettings.$inferSelect
  ): CalculatorSettings {
    return CalculatorSettings.instance({
      id: row.id,
      workspaceId: row.workspaceId,
      installmentNumber: row.installmentNumber,
      interestRate: parseFloat(row.interestRate),
      isEnabled: row.isEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new CalculatorSettingsDatabaseRepository();
  }
}
