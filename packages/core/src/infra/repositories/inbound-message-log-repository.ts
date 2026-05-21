import { createDatabaseConnection } from "../database";
import { inboundMessageLogs } from "../database/schemas";

export class InboundMessageLogDatabaseRepository {
  async save(data: {
    source: string;
    instanceName: string;
    messageId?: string;
    event: string;
    rawPayload: unknown;
  }): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(inboundMessageLogs).values({
      source: data.source,
      instanceName: data.instanceName,
      messageId: data.messageId ?? null,
      event: data.event,
      rawPayload: data.rawPayload,
      processed: false,
    });
  }

  async markProcessed(id: string): Promise<void> {
    const { eq } = await import("drizzle-orm");
    const db = createDatabaseConnection();

    await db
      .update(inboundMessageLogs)
      .set({ processed: true })
      .where(eq(inboundMessageLogs.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    const { eq } = await import("drizzle-orm");
    const db = createDatabaseConnection();

    await db
      .update(inboundMessageLogs)
      .set({ error })
      .where(eq(inboundMessageLogs.id, id));
  }

  static instance(): InboundMessageLogDatabaseRepository {
    return new InboundMessageLogDatabaseRepository();
  }
}
