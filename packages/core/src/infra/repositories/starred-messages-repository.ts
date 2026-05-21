import { eq, and, desc } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { starredMessages, messages } from "../database/schemas";

export class StarredMessagesDatabaseRepository {
  async star(
    userId: string,
    messageId: string,
    conversationId: string
  ): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .insert(starredMessages)
      .values({
        userId,
        messageId,
        conversationId,
      })
      .onConflictDoNothing();
  }

  async unstar(userId: string, messageId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(starredMessages)
      .where(
        and(
          eq(starredMessages.userId, userId),
          eq(starredMessages.messageId, messageId)
        )
      );
  }

  async isStarred(userId: string, messageId: string): Promise<boolean> {
    const db = createDatabaseConnection();
    const [result] = await db
      .select({ id: starredMessages.id })
      .from(starredMessages)
      .where(
        and(
          eq(starredMessages.userId, userId),
          eq(starredMessages.messageId, messageId)
        )
      )
      .limit(1);
    return !!result;
  }

  async listByConversation(
    userId: string,
    conversationId: string
  ): Promise<string[]> {
    const db = createDatabaseConnection();
    const results = await db
      .select({ messageId: starredMessages.messageId })
      .from(starredMessages)
      .where(
        and(
          eq(starredMessages.userId, userId),
          eq(starredMessages.conversationId, conversationId)
        )
      );
    return results.map((r) => r.messageId);
  }

  async listWithDetailsByConversation(
    userId: string,
    conversationId: string
  ): Promise<StarredMessageWithDetails[]> {
    const db = createDatabaseConnection();
    const results = await db
      .select({
        id: starredMessages.id,
        messageId: starredMessages.messageId,
        starredAt: starredMessages.starredAt,
        content: messages.content,
        type: messages.type,
        senderName: messages.senderName,
        senderType: messages.senderType,
        createdAt: messages.createdAt,
        mediaPath: messages.mediaPath,
        filename: messages.filename,
      })
      .from(starredMessages)
      .innerJoin(messages, eq(starredMessages.messageId, messages.id))
      .where(
        and(
          eq(starredMessages.userId, userId),
          eq(starredMessages.conversationId, conversationId)
        )
      )
      .orderBy(desc(starredMessages.starredAt));
    return results;
  }

  static instance() {
    return new StarredMessagesDatabaseRepository();
  }
}

export type StarredMessageWithDetails = {
  id: string;
  messageId: string;
  starredAt: Date;
  content: string;
  type: string | null;
  senderName: string;
  senderType: string | null;
  createdAt: number;
  mediaPath: string | null;
  filename: string | null;
};
