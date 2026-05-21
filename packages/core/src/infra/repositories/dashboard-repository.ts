import { and, eq, gte, lte, sql } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import {
  conversations,
  memberships,
  messages,
  partners,
  users,
} from "../database/schemas";

export type DashboardMetricsInput = {
  workspaceId: string;
  startDate: string;
  endDate: string;
};

export type ConversationMetrics = {
  open: number;
  waiting: number;
  closed: number;
};

export type ActivityMetrics = {
  totalAttendants: number;
  newContacts: number;
  messagesReceived: number;
  messagesSent: number;
};

export type PerformanceMetrics = {
  avgServiceTimeMinutes: number | null;
  avgWaitTimeMinutes: number | null;
};

export type DashboardMetricsOutput = {
  conversations: ConversationMetrics;
  activity: ActivityMetrics;
  performance: PerformanceMetrics;
};

export type AttendantMetrics = {
  id: string;
  name: string;
  thumbnail: string | null;
  conversationsInProgress: number;
  conversationsFinished: number;
  messagesSent: number;
  avgServiceTimeMinutes: number | null;
  avgFirstResponseMinutes: number | null;
};

export class DashboardDatabaseRepository {
  async getMetrics(input: DashboardMetricsInput): Promise<DashboardMetricsOutput> {
    const db = createDatabaseConnection();
    const { workspaceId, startDate, endDate } = input;

    const startTimestamp = Math.floor(new Date(startDate).setHours(0, 0, 0, 0) / 1000);
    const endTimestamp = Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000);

    const [conversationMetrics, activityMetrics, performanceMetrics] = await Promise.all([
      this.getConversationMetrics(db, workspaceId, startTimestamp, endTimestamp),
      this.getActivityMetrics(db, workspaceId, startTimestamp, endTimestamp),
      this.getPerformanceMetrics(db, workspaceId, startTimestamp, endTimestamp),
    ]);

    return {
      conversations: conversationMetrics,
      activity: activityMetrics,
      performance: performanceMetrics,
    };
  }

  private async getConversationMetrics(
    db: ReturnType<typeof createDatabaseConnection>,
    workspaceId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<ConversationMetrics> {
    const currentStatusResult = await db
      .select({
        open: sql<number>`COUNT(*) FILTER (WHERE ${conversations.status} = 'open')::int`,
        waiting: sql<number>`COUNT(*) FILTER (WHERE ${conversations.status} = 'waiting')::int`,
      })
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));

    const closedResult = await db
      .select({
        closed: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.status, "closed"),
          gte(sql`EXTRACT(EPOCH FROM ${conversations.closedAt})`, startTimestamp),
          lte(sql`EXTRACT(EPOCH FROM ${conversations.closedAt})`, endTimestamp)
        )
      );

    return {
      open: currentStatusResult[0]?.open ?? 0,
      waiting: currentStatusResult[0]?.waiting ?? 0,
      closed: closedResult[0]?.closed ?? 0,
    };
  }

  private async getActivityMetrics(
    db: ReturnType<typeof createDatabaseConnection>,
    workspaceId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<ActivityMetrics> {
    const attendantsResult = await db
      .select({
        total: sql<number>`COUNT(DISTINCT ${users.id})::int`,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(users.isDeletable, true)
        )
      );

    const newContactsResult = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(partners)
      .where(
        and(
          eq(partners.workspaceId, workspaceId),
          gte(sql`EXTRACT(EPOCH FROM ${partners.createdAt})`, startTimestamp),
          lte(sql`EXTRACT(EPOCH FROM ${partners.createdAt})`, endTimestamp)
        )
      );

    const messagesResult = await db
      .select({
        received: sql<number>`COUNT(*) FILTER (WHERE ${messages.senderType} = 'contact')::int`,
        sent: sql<number>`COUNT(*) FILTER (WHERE ${messages.senderType} = 'attendant')::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          gte(messages.createdAt, startTimestamp),
          lte(messages.createdAt, endTimestamp)
        )
      );

    return {
      totalAttendants: attendantsResult[0]?.total ?? 0,
      newContacts: newContactsResult[0]?.count ?? 0,
      messagesReceived: messagesResult[0]?.received ?? 0,
      messagesSent: messagesResult[0]?.sent ?? 0,
    };
  }

  private async getPerformanceMetrics(
    db: ReturnType<typeof createDatabaseConnection>,
    workspaceId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<PerformanceMetrics> {
    const avgServiceResult = await db
      .select({
        avgMinutes: sql<number | null>`
          AVG(
            EXTRACT(EPOCH FROM (${conversations.closedAt} - ${conversations.openedAt})) / 60
          )::numeric
        `,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.status, "closed"),
          sql`${conversations.openedAt} IS NOT NULL`,
          gte(sql`EXTRACT(EPOCH FROM ${conversations.closedAt})`, startTimestamp),
          lte(sql`EXTRACT(EPOCH FROM ${conversations.closedAt})`, endTimestamp)
        )
      );

    const [avgWaitRow] = await db.execute(sql`
      SELECT AVG(first_response_minutes)::numeric as avg_minutes
      FROM (
        SELECT (
          SELECT (${messages.createdAt} - EXTRACT(EPOCH FROM c.opened_at)) / 60
          FROM ${messages}
          WHERE ${messages.conversationId} = c.id
            AND ${messages.senderType} = 'attendant'
          ORDER BY ${messages.createdAt} ASC
          LIMIT 1
        ) as first_response_minutes
        FROM ${conversations} c
        WHERE c.workspace_id = ${workspaceId}
          AND c.status = 'closed'
          AND EXTRACT(EPOCH FROM c.closed_at) >= ${startTimestamp}
          AND EXTRACT(EPOCH FROM c.closed_at) <= ${endTimestamp}
      ) sq
      WHERE first_response_minutes IS NOT NULL
    `);

    const avgWaitMinutes = (avgWaitRow as { avg_minutes?: string })?.avg_minutes;

    return {
      avgServiceTimeMinutes: avgServiceResult[0]?.avgMinutes ?? null,
      avgWaitTimeMinutes: avgWaitMinutes ? Number(avgWaitMinutes) : null,
    };
  }

  async getAttendantMetrics(input: DashboardMetricsInput): Promise<AttendantMetrics[]> {
    const db = createDatabaseConnection();
    const { workspaceId, startDate, endDate } = input;

    const startTimestamp = Math.floor(new Date(startDate).setHours(0, 0, 0, 0) / 1000);
    const endTimestamp = Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000);

    const results = await db.execute(sql`
      SELECT
        u.id,
        u.name,
        u.thumbnail,
        (
          SELECT COUNT(*)::int
          FROM ${conversations}
          WHERE attendant_id = u.id AND status = 'open'
        ) as conversations_in_progress,
        (
          SELECT COUNT(*)::int
          FROM ${conversations}
          WHERE attendant_id = u.id
            AND status = 'closed'
            AND EXTRACT(EPOCH FROM closed_at) >= ${startTimestamp}
            AND EXTRACT(EPOCH FROM closed_at) <= ${endTimestamp}
        ) as conversations_finished,
        (
          SELECT COUNT(*)::int
          FROM ${messages} m
          INNER JOIN ${conversations} c ON m.conversation_id = c.id
          WHERE c.attendant_id = u.id
            AND m.sender_type = 'attendant'
            AND m.created_at >= ${startTimestamp}
            AND m.created_at <= ${endTimestamp}
        ) as messages_sent,
        (
          SELECT AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) / 60)::numeric
          FROM ${conversations}
          WHERE attendant_id = u.id
            AND status = 'closed'
            AND opened_at IS NOT NULL
            AND EXTRACT(EPOCH FROM closed_at) >= ${startTimestamp}
            AND EXTRACT(EPOCH FROM closed_at) <= ${endTimestamp}
        ) as avg_service_time_minutes,
        (
          SELECT AVG(first_response_minutes)::numeric
          FROM (
            SELECT (
              SELECT (m.created_at - EXTRACT(EPOCH FROM conv.opened_at)) / 60
              FROM ${messages} m
              WHERE m.conversation_id = conv.id
                AND m.sender_type = 'attendant'
              ORDER BY m.created_at ASC
              LIMIT 1
            ) as first_response_minutes
            FROM ${conversations} conv
            WHERE conv.attendant_id = u.id
              AND conv.status = 'closed'
              AND EXTRACT(EPOCH FROM conv.closed_at) >= ${startTimestamp}
              AND EXTRACT(EPOCH FROM conv.closed_at) <= ${endTimestamp}
          ) sub
          WHERE first_response_minutes IS NOT NULL
        ) as avg_first_response_minutes
      FROM ${users} u
      INNER JOIN ${memberships} m ON m.user_id = u.id
      WHERE m.workspace_id = ${workspaceId}
        AND u.is_deletable = true
      ORDER BY u.name ASC
    `);

    type AttendantRow = {
      id: string;
      name: string;
      thumbnail: string | null;
      conversations_in_progress: number;
      conversations_finished: number;
      messages_sent: number;
      avg_service_time_minutes: string | null;
      avg_first_response_minutes: string | null;
    };

    return (results as unknown as AttendantRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      thumbnail: row.thumbnail ? String(row.thumbnail) : null,
      conversationsInProgress: Number(row.conversations_in_progress) || 0,
      conversationsFinished: Number(row.conversations_finished) || 0,
      messagesSent: Number(row.messages_sent) || 0,
      avgServiceTimeMinutes: row.avg_service_time_minutes
        ? Number(row.avg_service_time_minutes)
        : null,
      avgFirstResponseMinutes: row.avg_first_response_minutes
        ? Number(row.avg_first_response_minutes)
        : null,
    }));
  }

  static instance() {
    return new DashboardDatabaseRepository();
  }
}
