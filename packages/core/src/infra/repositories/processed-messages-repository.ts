import { and, eq, lt } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { processedMessages } from "../database/schemas";

export class ProcessedMessagesDatabaseRepository {
  async exists(messageId: string, instanceName: string): Promise<boolean> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select({ messageId: processedMessages.messageId })
      .from(processedMessages)
      .where(
        and(
          eq(processedMessages.messageId, messageId),
          eq(processedMessages.instanceName, instanceName)
        )
      )
      .limit(1);

    return !!row;
  }

  async markProcessed(
    messageId: string,
    instanceName: string,
    eventType: string
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .insert(processedMessages)
      .values({
        messageId,
        instanceName,
        eventType,
        processedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  async cleanup(olderThanHours: number): Promise<number> {
    const db = createDatabaseConnection();

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await db
      .delete(processedMessages)
      .where(lt(processedMessages.processedAt, cutoffDate))
      .returning();

    return result.length;
  }

  static instance(): ProcessedMessagesDatabaseRepository {
    return new ProcessedMessagesDatabaseRepository();
  }
}
