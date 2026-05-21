import { and, count, desc, eq, gte, InferSelectModel, lte, or } from "drizzle-orm";
import { Notification } from "../../domain/entities/notification";
import { createDatabaseConnection } from "../database";
import { notifications } from "../database/schemas";

type NotificationRow = InferSelectModel<typeof notifications>;

type CursorData = {
  createdAt: Date;
  id: string;
};

type FilterOptions = {
  isRead?: boolean;
  type?: Notification.Type;
  startDate?: Date;
  endDate?: Date;
};

export class NotificationsDatabaseRepository {
  private mapRowToNotification(row: NotificationRow): Notification {
    return Notification.fromRaw({
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type as Notification.Type,
      title: row.title,
      content: row.content,
      metadata: (row.metadata as Notification.Metadata) || {},
      recipientType: row.recipientType as Notification.RecipientType,
      recipientId: row.recipientId,
      isRead: row.isRead,
      readAt: row.readAt,
      priority: row.priority as Notification.Priority,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  }

  private encodeCursor(data: CursorData): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: data.createdAt.toISOString(),
        id: data.id,
      })
    ).toString("base64");
  }

  private decodeCursor(cursor: string): CursorData {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    return {
      createdAt: new Date(decoded.createdAt),
      id: decoded.id,
    };
  }

  async create(notification: Notification): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(notifications).values({
      id: notification.id,
      workspaceId: notification.workspaceId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: notification.metadata,
      recipientType: notification.recipientType,
      recipientId: notification.recipientId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      priority: notification.priority,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    });
  }

  async findById(id: string): Promise<Notification | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!row) return null;

    return this.mapRowToNotification(row);
  }

  async update(notification: Notification): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(notifications)
      .set({
        isRead: notification.isRead,
        readAt: notification.readAt,
      })
      .where(eq(notifications.id, notification.id));
  }

  async markAsRead(notificationId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));
  }

  async markAllAsReadForUser(
    userId: string,
    workspaceId: string
  ): Promise<number> {
    const db = createDatabaseConnection();

    const now = new Date();

    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: now,
      })
      .where(
        and(
          eq(notifications.workspaceId, workspaceId),
          eq(notifications.recipientType, "user"),
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        )
      )
      .returning({ id: notifications.id });

    return result.length;
  }

  async listForUser(input: {
    userId: string;
    workspaceId: string;
    filters?: FilterOptions;
    cursor?: string | null;
    limit?: number;
  }): Promise<{
    notifications: Notification[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const db = createDatabaseConnection();
    const limit = input.limit || 20;

    const conditions = [
      eq(notifications.workspaceId, input.workspaceId),
      or(
        and(
          eq(notifications.recipientType, "user"),
          eq(notifications.recipientId, input.userId)
        ),
        eq(notifications.recipientType, "workspace")
      ),
    ];

    if (input.filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, input.filters.isRead));
    }

    if (input.filters?.type) {
      conditions.push(eq(notifications.type, input.filters.type));
    }

    if (input.filters?.startDate) {
      conditions.push(
        gte(notifications.createdAt, input.filters.startDate)
      );
    }

    if (input.filters?.endDate) {
      conditions.push(
        lte(notifications.createdAt, input.filters.endDate)
      );
    }

    if (input.cursor) {
      const cursorData = this.decodeCursor(input.cursor);
      conditions.push(
        or(
          lte(notifications.createdAt, cursorData.createdAt),
          and(
            eq(notifications.createdAt, cursorData.createdAt),
            lte(notifications.id, cursorData.id)
          )
        )
      );
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        nextCursor = this.encodeCursor({
          createdAt: lastItem.createdAt,
          id: lastItem.id,
        });
      }
    }

    const notificationEntities = items.map((row) =>
      this.mapRowToNotification(row)
    );

    return {
      notifications: notificationEntities,
      nextCursor,
      hasMore,
    };
  }

  async countUnreadForUser(
    userId: string,
    workspaceId: string
  ): Promise<number> {
    const db = createDatabaseConnection();

    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, workspaceId),
          or(
            and(
              eq(notifications.recipientType, "user"),
              eq(notifications.recipientId, userId)
            ),
            eq(notifications.recipientType, "workspace")
          ),
          eq(notifications.isRead, false)
        )
      );

    return Number(result?.count) || 0;
  }

  static instance() {
    return new NotificationsDatabaseRepository();
  }
}
