import { and, eq, asc } from "drizzle-orm";
import { PaymentPlanInstallment } from "../../domain/entities/payment-plan-installment";
import { createDatabaseConnection } from "../database";
import { paymentPlanInstallments } from "../database/schemas";

export class PaymentPlanInstallmentRepository {
  async create(installment: PaymentPlanInstallment): Promise<PaymentPlanInstallment> {
    const db = createDatabaseConnection();

    const [inserted] = await db
      .insert(paymentPlanInstallments)
      .values({
        id: installment.id,
        planId: installment.planId,
        installmentNumber: installment.installmentNumber,
        interestRate: installment.interestRate.toString(),
        additionalFee: installment.additionalFee.toString(),
        isEnabled: installment.isEnabled,
        createdAt: installment.createdAt,
        updatedAt: installment.updatedAt,
      })
      .returning();

    return this.mapToEntity(inserted!);
  }

  async createMany(installments: PaymentPlanInstallment[]): Promise<PaymentPlanInstallment[]> {
    if (installments.length === 0) return [];

    const db = createDatabaseConnection();

    const inserted = await db
      .insert(paymentPlanInstallments)
      .values(
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
      )
      .returning();

    return inserted.map((row) => this.mapToEntity(row));
  }

  async update(
    id: string,
    data: PaymentPlanInstallment.UpdateProps
  ): Promise<PaymentPlanInstallment | null> {
    const db = createDatabaseConnection();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.interestRate !== undefined) updateData.interestRate = data.interestRate.toString();
    if (data.additionalFee !== undefined) updateData.additionalFee = data.additionalFee.toString();
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    const [updated] = await db
      .update(paymentPlanInstallments)
      .set(updateData)
      .where(eq(paymentPlanInstallments.id, id))
      .returning();

    if (!updated) return null;
    return this.mapToEntity(updated);
  }

  async upsertByPlanAndInstallment(
    planId: string,
    installmentNumber: number,
    data: { interestRate: number; additionalFee: number; isEnabled: boolean }
  ): Promise<PaymentPlanInstallment> {
    const db = createDatabaseConnection();

    const existing = await this.findByPlanAndInstallment(planId, installmentNumber);

    if (existing) {
      const [updated] = await db
        .update(paymentPlanInstallments)
        .set({
          interestRate: data.interestRate.toString(),
          additionalFee: data.additionalFee.toString(),
          isEnabled: data.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(paymentPlanInstallments.id, existing.id))
        .returning();

      return this.mapToEntity(updated!);
    }

    const installment = PaymentPlanInstallment.create({
      planId,
      installmentNumber,
      interestRate: data.interestRate,
      additionalFee: data.additionalFee,
      isEnabled: data.isEnabled,
    });

    return this.create(installment);
  }

  async bulkUpsert(
    planId: string,
    items: PaymentPlanInstallment.BulkItem[]
  ): Promise<PaymentPlanInstallment[]> {
    const results: PaymentPlanInstallment[] = [];

    for (const item of items) {
      const result = await this.upsertByPlanAndInstallment(planId, item.installmentNumber, {
        interestRate: item.interestRate,
        additionalFee: item.additionalFee,
        isEnabled: item.isEnabled,
      });
      results.push(result);
    }

    return results;
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();
    await db.delete(paymentPlanInstallments).where(eq(paymentPlanInstallments.id, id));
  }

  async deleteByPlanAndInstallment(planId: string, installmentNumber: number): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(paymentPlanInstallments)
      .where(
        and(
          eq(paymentPlanInstallments.planId, planId),
          eq(paymentPlanInstallments.installmentNumber, installmentNumber)
        )
      );
  }

  async findById(id: string): Promise<PaymentPlanInstallment | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(paymentPlanInstallments)
      .where(eq(paymentPlanInstallments.id, id));

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findByPlanAndInstallment(
    planId: string,
    installmentNumber: number
  ): Promise<PaymentPlanInstallment | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(paymentPlanInstallments)
      .where(
        and(
          eq(paymentPlanInstallments.planId, planId),
          eq(paymentPlanInstallments.installmentNumber, installmentNumber)
        )
      );

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async listByPlan(planId: string): Promise<PaymentPlanInstallment[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(paymentPlanInstallments)
      .where(eq(paymentPlanInstallments.planId, planId))
      .orderBy(asc(paymentPlanInstallments.installmentNumber));

    return rows.map((row) => this.mapToEntity(row));
  }

  async listEnabledByPlan(planId: string): Promise<PaymentPlanInstallment[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(paymentPlanInstallments)
      .where(
        and(
          eq(paymentPlanInstallments.planId, planId),
          eq(paymentPlanInstallments.isEnabled, true)
        )
      )
      .orderBy(asc(paymentPlanInstallments.installmentNumber));

    return rows.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(
    row: typeof paymentPlanInstallments.$inferSelect
  ): PaymentPlanInstallment {
    return PaymentPlanInstallment.instance({
      id: row.id,
      planId: row.planId,
      installmentNumber: row.installmentNumber,
      interestRate: parseFloat(row.interestRate),
      additionalFee: parseFloat(row.additionalFee),
      isEnabled: row.isEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new PaymentPlanInstallmentRepository();
  }
}
