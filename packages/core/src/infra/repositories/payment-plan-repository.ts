import { and, eq, asc } from "drizzle-orm";
import { PaymentPlan } from "../../domain/entities/payment-plan";
import { PaymentPlanInstallment } from "../../domain/entities/payment-plan-installment";
import { createDatabaseConnection } from "../database";
import { paymentPlans, paymentPlanInstallments } from "../database/schemas";

export class PaymentPlanRepository {
  async create(plan: PaymentPlan): Promise<PaymentPlan> {
    const db = createDatabaseConnection();

    const [inserted] = await db
      .insert(paymentPlans)
      .values({
        id: plan.id,
        workspaceId: plan.workspaceId,
        name: plan.name,
        description: plan.description,
        isDefault: plan.isDefault,
        isEnabled: plan.isEnabled,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      })
      .returning();

    return this.mapToEntity(inserted!);
  }

  async createWithInstallments(
    plan: PaymentPlan,
    installments: PaymentPlanInstallment[]
  ): Promise<PaymentPlan> {
    const db = createDatabaseConnection();

    return await db.transaction(async (tx) => {
      const insertedRows = await tx
        .insert(paymentPlans)
        .values({
          id: plan.id,
          workspaceId: plan.workspaceId,
          name: plan.name,
          description: plan.description,
          isDefault: plan.isDefault,
          isEnabled: plan.isEnabled,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        })
        .returning();

      const inserted = insertedRows[0];
      if (!inserted) {
        throw new Error("Falha ao criar plano de pagamento");
      }

      if (installments.length > 0) {
        await tx.insert(paymentPlanInstallments).values(
          installments.map((i) => ({
            id: i.id,
            planId: i.planId,
            installmentNumber: i.installmentNumber,
            interestRate: i.interestRate.toString(),
            additionalFee: i.additionalFee.toString(),
            isEnabled: i.isEnabled,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
          }))
        );
      }

      return this.mapToEntity(inserted);
    });
  }

  async update(id: string, data: PaymentPlan.UpdateProps): Promise<PaymentPlan | null> {
    const db = createDatabaseConnection();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    const [updated] = await db
      .update(paymentPlans)
      .set(updateData)
      .where(eq(paymentPlans.id, id))
      .returning();

    if (!updated) return null;
    return this.mapToEntity(updated);
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();
    await db.delete(paymentPlans).where(eq(paymentPlans.id, id));
  }

  async findById(id: string): Promise<PaymentPlan | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.id, id));

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async listByWorkspace(workspaceId: string): Promise<PaymentPlan[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.workspaceId, workspaceId))
      .orderBy(asc(paymentPlans.name));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listEnabledByWorkspace(workspaceId: string): Promise<PaymentPlan[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(paymentPlans)
      .where(
        and(
          eq(paymentPlans.workspaceId, workspaceId),
          eq(paymentPlans.isEnabled, true)
        )
      )
      .orderBy(asc(paymentPlans.name));

    return rows.map((row) => this.mapToEntity(row));
  }

  async setDefault(workspaceId: string, planId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db.transaction(async (tx) => {
      // Remove default from all plans in workspace
      await tx
        .update(paymentPlans)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(paymentPlans.workspaceId, workspaceId));

      // Set new default
      await tx
        .update(paymentPlans)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(paymentPlans.id, planId));
    });
  }

  async getDefaultPlan(workspaceId: string): Promise<PaymentPlan | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(paymentPlans)
      .where(
        and(
          eq(paymentPlans.workspaceId, workspaceId),
          eq(paymentPlans.isDefault, true)
        )
      );

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async duplicatePlan(
    sourcePlanId: string,
    newName: string,
    workspaceId: string
  ): Promise<PaymentPlan> {
    const db = createDatabaseConnection();

    return await db.transaction(async (tx) => {
      // Get source plan installments
      const sourceInstallments = await tx
        .select()
        .from(paymentPlanInstallments)
        .where(eq(paymentPlanInstallments.planId, sourcePlanId));

      // Create new plan
      const newPlan = PaymentPlan.create({
        workspaceId,
        name: newName,
        isDefault: false,
        isEnabled: true,
      });

      const [inserted] = await tx
        .insert(paymentPlans)
        .values({
          id: newPlan.id,
          workspaceId: newPlan.workspaceId,
          name: newPlan.name,
          description: newPlan.description,
          isDefault: newPlan.isDefault,
          isEnabled: newPlan.isEnabled,
          createdAt: newPlan.createdAt,
          updatedAt: newPlan.updatedAt,
        })
        .returning();

      // Copy installments
      if (sourceInstallments.length > 0) {
        await tx.insert(paymentPlanInstallments).values(
          sourceInstallments.map((i) => ({
            id: crypto.randomUUID(),
            planId: newPlan.id,
            installmentNumber: i.installmentNumber,
            interestRate: i.interestRate,
            additionalFee: i.additionalFee,
            isEnabled: i.isEnabled,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );
      }

      return this.mapToEntity(inserted!);
    });
  }

  private mapToEntity(row: typeof paymentPlans.$inferSelect): PaymentPlan {
    return PaymentPlan.instance({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault,
      isEnabled: row.isEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new PaymentPlanRepository();
  }
}
