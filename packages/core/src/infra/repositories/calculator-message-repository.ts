import { eq } from "drizzle-orm";
import { CalculatorMessage } from "../../domain/entities/calculator-message";
import { createDatabaseConnection } from "../database";
import { calculatorMessages } from "../database/schemas";

export class CalculatorMessageRepository {
  async upsert(message: CalculatorMessage): Promise<CalculatorMessage> {
    const db = createDatabaseConnection();

    const [result] = await db
      .insert(calculatorMessages)
      .values({
        id: message.id,
        workspaceId: message.workspaceId,
        footerMessage: message.footerMessage,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })
      .onConflictDoUpdate({
        target: calculatorMessages.workspaceId,
        set: {
          footerMessage: message.footerMessage,
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.mapToEntity(result!);
  }

  async findByWorkspace(workspaceId: string): Promise<CalculatorMessage | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(calculatorMessages)
      .where(eq(calculatorMessages.workspaceId, workspaceId));

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async getOrCreate(workspaceId: string): Promise<CalculatorMessage> {
    const existing = await this.findByWorkspace(workspaceId);
    if (existing) return existing;

    const message = CalculatorMessage.create({ workspaceId });
    return this.upsert(message);
  }

  async updateFooterMessage(workspaceId: string, footerMessage: string): Promise<CalculatorMessage> {
    const existing = await this.findByWorkspace(workspaceId);

    if (existing) {
      existing.update({ footerMessage });
      return this.upsert(existing);
    }

    const message = CalculatorMessage.create({ workspaceId, footerMessage });
    return this.upsert(message);
  }

  private mapToEntity(row: typeof calculatorMessages.$inferSelect): CalculatorMessage {
    return CalculatorMessage.instance({
      id: row.id,
      workspaceId: row.workspaceId,
      footerMessage: row.footerMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new CalculatorMessageRepository();
  }
}
