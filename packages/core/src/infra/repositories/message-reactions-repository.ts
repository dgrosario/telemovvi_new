import { and, eq, inArray } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { messageReactions } from "../database/schemas";

export type ReactorType = "attendant" | "contact";

export interface MessageReaction {
  id: string;
  messageId: string;
  emoji: string;
  reactorType: ReactorType;
  reactorId: string;
  reactorName: string | null;
  createdAt: Date;
}

export interface AddReactionInput {
  messageId: string;
  emoji: string;
  reactorType: ReactorType;
  reactorId: string;
  reactorName?: string;
}

export class MessageReactionsDatabaseRepository {
  async addReaction(input: AddReactionInput): Promise<MessageReaction> {
    const db = createDatabaseConnection();

    const [result] = await db
      .insert(messageReactions)
      .values({
        messageId: input.messageId,
        emoji: input.emoji,
        reactorType: input.reactorType,
        reactorId: input.reactorId,
        reactorName: input.reactorName ?? null,
      })
      .onConflictDoUpdate({
        target: [
          messageReactions.messageId,
          messageReactions.reactorId,
          messageReactions.emoji,
        ],
        set: {
          createdAt: new Date(),
        },
      })
      .returning();

    return result as MessageReaction;
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    reactorId: string
  ): Promise<boolean> {
    const db = createDatabaseConnection();

    const result = await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.emoji, emoji),
          eq(messageReactions.reactorId, reactorId)
        )
      )
      .returning({ id: messageReactions.id });

    return result.length > 0;
  }

  async removeReactionsByMessageAndReactor(
    messageId: string,
    reactorId: string
  ): Promise<number> {
    const db = createDatabaseConnection();

    const result = await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.reactorId, reactorId)
        )
      )
      .returning({ id: messageReactions.id });

    return result.length;
  }

  async toggleReaction(input: AddReactionInput): Promise<{
    action: "added" | "removed";
    reaction: MessageReaction | null;
  }> {
    const db = createDatabaseConnection();

    const [existing] = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, input.messageId),
          eq(messageReactions.emoji, input.emoji),
          eq(messageReactions.reactorId, input.reactorId)
        )
      );

    if (existing) {
      await this.removeReaction(input.messageId, input.emoji, input.reactorId);
      return { action: "removed", reaction: existing as MessageReaction };
    }

    const reaction = await this.addReaction(input);
    return { action: "added", reaction };
  }

  async listByMessageId(messageId: string): Promise<MessageReaction[]> {
    const db = createDatabaseConnection();

    const results = await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .orderBy(messageReactions.createdAt);

    return results as MessageReaction[];
  }

  async listByMessageIds(
    messageIds: string[]
  ): Promise<Map<string, MessageReaction[]>> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const db = createDatabaseConnection();

    const results = await db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds))
      .orderBy(messageReactions.createdAt);

    const reactionsMap = new Map<string, MessageReaction[]>();

    for (const reaction of results) {
      const existing = reactionsMap.get(reaction.messageId) ?? [];
      existing.push(reaction as MessageReaction);
      reactionsMap.set(reaction.messageId, existing);
    }

    return reactionsMap;
  }

  async removeAllByMessageId(messageId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.messageId, messageId));
  }

  static instance() {
    return new MessageReactionsDatabaseRepository();
  }
}
