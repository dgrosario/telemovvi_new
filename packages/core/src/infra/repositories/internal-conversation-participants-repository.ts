import { and, eq, isNull, sql } from "drizzle-orm";
import { InternalConversationParticipant } from "../../domain/entities/internal-conversation-participant";
import { createDatabaseConnection } from "../database";
import {
  conversations,
  internalConversationParticipants,
  users,
} from "../database/schemas";

export class InternalConversationParticipantsDatabaseRepository {
  async add(participant: InternalConversationParticipant): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .insert(internalConversationParticipants)
      .values({
        id: participant.id,
        conversationId: participant.conversationId,
        userId: participant.userId,
        role: participant.role,
        joinedAt: participant.joinedAt,
        leftAt: participant.leftAt,
      })
      .onConflictDoNothing();
  }

  async addBulk(participants: InternalConversationParticipant[]): Promise<void> {
    if (participants.length === 0) return;

    const db = createDatabaseConnection();

    await db
      .insert(internalConversationParticipants)
      .values(
        participants.map((p) => ({
          id: p.id,
          conversationId: p.conversationId,
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        }))
      )
      .onConflictDoNothing();
  }

  async remove(conversationId: string, userId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(internalConversationParticipants)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(internalConversationParticipants.conversationId, conversationId),
          eq(internalConversationParticipants.userId, userId),
          isNull(internalConversationParticipants.leftAt)
        )
      );
  }

  async listByConversation(
    conversationId: string
  ): Promise<InternalConversationParticipant[]> {
    const db = createDatabaseConnection();

    const results = await db
      .select({
        id: internalConversationParticipants.id,
        conversationId: internalConversationParticipants.conversationId,
        userId: internalConversationParticipants.userId,
        userName: users.name,
        userThumbnail: users.thumbnail,
        role: internalConversationParticipants.role,
        joinedAt: internalConversationParticipants.joinedAt,
        leftAt: internalConversationParticipants.leftAt,
      })
      .from(internalConversationParticipants)
      .innerJoin(users, eq(users.id, internalConversationParticipants.userId))
      .where(eq(internalConversationParticipants.conversationId, conversationId));

    return results.map((row) =>
      InternalConversationParticipant.instance({
        id: row.id,
        conversationId: row.conversationId,
        userId: row.userId,
        userName: row.userName,
        userThumbnail: row.userThumbnail,
        role: row.role,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
      })
    );
  }

  async listActiveByConversation(
    conversationId: string
  ): Promise<InternalConversationParticipant[]> {
    const db = createDatabaseConnection();

    const results = await db
      .select({
        id: internalConversationParticipants.id,
        conversationId: internalConversationParticipants.conversationId,
        userId: internalConversationParticipants.userId,
        userName: users.name,
        userThumbnail: users.thumbnail,
        role: internalConversationParticipants.role,
        joinedAt: internalConversationParticipants.joinedAt,
        leftAt: internalConversationParticipants.leftAt,
      })
      .from(internalConversationParticipants)
      .innerJoin(users, eq(users.id, internalConversationParticipants.userId))
      .where(
        and(
          eq(internalConversationParticipants.conversationId, conversationId),
          isNull(internalConversationParticipants.leftAt)
        )
      );

    return results.map((row) =>
      InternalConversationParticipant.instance({
        id: row.id,
        conversationId: row.conversationId,
        userId: row.userId,
        userName: row.userName,
        userThumbnail: row.userThumbnail,
        role: row.role,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
      })
    );
  }

  async listConversationIdsByUser(
    userId: string,
    workspaceId: string
  ): Promise<string[]> {
    const db = createDatabaseConnection();

    const results = await db
      .select({ conversationId: internalConversationParticipants.conversationId })
      .from(internalConversationParticipants)
      .innerJoin(
        conversations,
        eq(conversations.id, internalConversationParticipants.conversationId)
      )
      .where(
        and(
          eq(internalConversationParticipants.userId, userId),
          eq(conversations.workspaceId, workspaceId),
          isNull(internalConversationParticipants.leftAt)
        )
      );

    return results.map((row) => row.conversationId);
  }

  async findDirectConversation(
    userId1: string,
    userId2: string,
    workspaceId: string
  ): Promise<string | null> {
    const db = createDatabaseConnection();

    const result = await db.execute<{ conversation_id: string }>(sql`
      SELECT p1.conversation_id
      FROM ${internalConversationParticipants} p1
      INNER JOIN ${internalConversationParticipants} p2
        ON p1.conversation_id = p2.conversation_id
      INNER JOIN ${conversations} c
        ON c.id = p1.conversation_id
      WHERE p1.user_id = ${userId1}
        AND p2.user_id = ${userId2}
        AND p1.left_at IS NULL
        AND p2.left_at IS NULL
        AND c.conversation_type = 'direct'
        AND c.workspace_id = ${workspaceId}
      LIMIT 1
    `);

    if (result.length === 0) return null;

    const firstRow = result[0];
    return firstRow?.conversation_id ?? null;
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const db = createDatabaseConnection();

    const [result] = await db
      .select({ id: internalConversationParticipants.id })
      .from(internalConversationParticipants)
      .where(
        and(
          eq(internalConversationParticipants.conversationId, conversationId),
          eq(internalConversationParticipants.userId, userId),
          isNull(internalConversationParticipants.leftAt)
        )
      )
      .limit(1);

    return result !== undefined;
  }

  async getParticipantUserIds(conversationId: string): Promise<string[]> {
    const db = createDatabaseConnection();

    const results = await db
      .select({ userId: internalConversationParticipants.userId })
      .from(internalConversationParticipants)
      .where(
        and(
          eq(internalConversationParticipants.conversationId, conversationId),
          isNull(internalConversationParticipants.leftAt)
        )
      );

    return results.map((row) => row.userId);
  }

  static instance() {
    return new InternalConversationParticipantsDatabaseRepository();
  }
}
