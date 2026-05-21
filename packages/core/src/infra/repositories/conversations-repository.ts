import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { alias } from "drizzle-orm/pg-core";
import { Channel } from "../../domain/entities/channel";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { InternalConversationParticipant } from "../../domain/entities/internal-conversation-participant";
import { createDatabaseConnection } from "../database";
import {
  channels,
  conversations,
  internalConversationParticipants,
  messages,
  partnerContacts,
  partners,
  partnersLabels,
  sectors,
  users,
} from "../database/schemas";

export type SearchInputDTO = {
  workspaceId: string;
  query?: string;
  searchType?: "phone" | "instagram" | "client-name" | "attendant-name" | "all";
  statusFilters?: Conversation.Status[];
  channelFilters: (string | null)[];
  sectorFilters: (string | null)[];
  userFilters: string[];
  labelFilters?: string[];
  dateStart?: string;
  dateEnd?: string;
  dateStartAt?: number;
  dateEndAt?: number;
  dateType?: "creation" | "lastMessage";
  sortOrder?: "desc" | "asc";
  waitingStatus?: "attendant" | "client" | "";
  receivedChannelFilters?: string[];
  conversationTypeFilter?: "contacts" | "groups" | "all";
  userSelectedChannelIds?: string[];
};

export type CounterConversations = {
  open: number;
  waiting: number;
  expired: number;
  closed: number;
  internal: number;
};

export type UnreadByStatus = {
  open: number;
  waiting: number;
  expired: number;
  closed: number;
  internal: number;
};

export type SearchConversationsOutputDTO = {
  conversations: Conversation.Raw[];
  counters: CounterConversations;
  unreadByStatus: UnreadByStatus;
};

export type PaginatedSearchInputDTO = SearchInputDTO & {
  cursor?: string | null;
  limit?: number;
};

export type PaginatedSearchOutputDTO = {
  conversations: Conversation.Raw[];
  counters: CounterConversations;
  unreadByStatus: UnreadByStatus;
  nextCursor: string | null;
  hasMore: boolean;
};

export type GroupNameSyncCandidateDTO = {
  workspaceId: string;
  channelId: string;
  groupJid: string;
  currentName: string | null;
};

type CursorData = {
  lastMessageAt: number;
  id: string;
};

type FullQueryRawResult = {
  id: string;
  contact: {
    id: string | null;
    name: string | null;
    thumbnail: string | null;
    value: string | null;
    username: string | null;
    type: Channel.Type | null;
  };
  attendant: {
    id: string;
    name: string;
  } | null;
  status: string | null;
  openedAt: Date | null;
  firstOpenedAt: Date | null;
  closedAt: Date | null;
  sector: {
    id: string;
    name: string;
  } | null;
  channel: {
    id: string;
    name: string;
    type: Channel.Type;
  } | null;
  receivedChannel: {
    id: string;
    name: string;
    type: Channel.Type;
  } | null;
  teaser: string | null;
  messageToView: number | null;
  lastMessageCreatedAt: number | null;
  waitingAt: number | null;
  lastClientMessageCreatedAt: number | null;
  activeFlowExecutionId: string | null;
  flowCompletedAt: Date | null;
  conversationType: string | null;
  name: string | null;
  groupJid: string | null;
};

type FullQueryOutput = Conversation.Raw & {
  openedAt: Date | null;
  closedAt: Date | null;
  workspaceId: string;
};

function convertTimestampToDate(timestamp: unknown): Date | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }
  const numericTimestamp =
    typeof timestamp === "string" ? Number(timestamp) : (timestamp as number);
  if (Number.isNaN(numericTimestamp)) {
    return null;
  }
  return new Date(numericTimestamp * 1000);
}

function mapRawToConversation(rawResult: FullQueryRawResult): FullQueryOutput {
  const isInternal =
    rawResult.conversationType === "direct" ||
    rawResult.conversationType === "group";

  return {
    id: rawResult.id,
    contact: isInternal
      ? null
      : Contact.instance({
          id: rawResult.contact.id ?? "",
          name: rawResult.contact.name ?? "",
          thumbnail: rawResult.contact.thumbnail ?? "",
          value: rawResult.contact.value ?? "",
          username: rawResult.contact.username ?? "",
          type: rawResult.contact.type ?? "whatsapp",
        }).raw(),
    attendant: rawResult.attendant
      ? { id: rawResult.attendant.id, name: rawResult.attendant.name }
      : null,
    status: rawResult.status as Conversation.Status | null,
    openedAt: rawResult.openedAt,
    firstOpenedAt: rawResult.firstOpenedAt,
    closedAt: rawResult.closedAt,
    sector: rawResult.sector
      ? { id: rawResult.sector.id, name: rawResult.sector.name }
      : null,
    channel: rawResult.channel
      ? {
          id: rawResult.channel.id,
          name: rawResult.channel.name,
          type: rawResult.channel.type,
        }
      : null,
    receivedChannel: rawResult.receivedChannel?.id
      ? {
          id: rawResult.receivedChannel.id,
          name: rawResult.receivedChannel.name ?? "",
          type: rawResult.receivedChannel.type,
        }
      : null,
    teaser: rawResult.teaser ?? "",
    messageToView: rawResult.messageToView ?? 0,
    lastMessageCreatedAt: convertTimestampToDate(
      rawResult.lastMessageCreatedAt,
    ),
    waitingAt: convertTimestampToDate(rawResult.waitingAt),
    lastClientMessageCreatedAt: convertTimestampToDate(
      rawResult.lastClientMessageCreatedAt,
    ),
    activeFlowExecutionId: rawResult.activeFlowExecutionId,
    flowCompletedAt: rawResult.flowCompletedAt,
    workspaceId: "",
    conversationType: (rawResult.conversationType ??
      "external") as Conversation.Type,
    name: rawResult.name,
    participants: [],
    groupJid: rawResult.groupJid,
    isFromReceivingNumber:
      rawResult.receivedChannel?.id !== null &&
      rawResult.receivedChannel?.id !== undefined,
  };
}

type DatabaseConnection = PostgresJsDatabase<Record<string, unknown>>;

type ResolvedDateRange = {
  startDate: Date;
  endDate: Date;
  startTimestamp: number;
  endTimestamp: number;
};

const MAX_REASONABLE_UNIX_TIMESTAMP_SECONDS = 4_102_444_800; // 2100-01-01T00:00:00Z

function resolveDateRange(
  input: Pick<
    SearchInputDTO,
    "dateStart" | "dateEnd" | "dateStartAt" | "dateEndAt"
  >,
): ResolvedDateRange | null {
  if (
    typeof input.dateStartAt === "number" &&
    Number.isFinite(input.dateStartAt) &&
    typeof input.dateEndAt === "number" &&
    Number.isFinite(input.dateEndAt)
  ) {
    const startTimestamp = Math.floor(input.dateStartAt);
    const endTimestamp = Math.floor(input.dateEndAt);

    if (
      startTimestamp < 0 ||
      endTimestamp < 0 ||
      startTimestamp > MAX_REASONABLE_UNIX_TIMESTAMP_SECONDS ||
      endTimestamp > MAX_REASONABLE_UNIX_TIMESTAMP_SECONDS ||
      startTimestamp > endTimestamp
    ) {
      return null;
    }

    return {
      startDate: new Date(startTimestamp * 1000),
      endDate: new Date(endTimestamp * 1000),
      startTimestamp,
      endTimestamp,
    };
  }

  if (input.dateStart && input.dateEnd) {
    const startDate = new Date(`${input.dateStart}T00:00:00`);
    const endDate = new Date(`${input.dateEnd}T23:59:59.999`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }

    return {
      startDate,
      endDate,
      startTimestamp: Math.floor(startDate.getTime() / 1000),
      endTimestamp: Math.floor(endDate.getTime() / 1000),
    };
  }

  return null;
}

export class ConversationsDatabaseRepository {
  buildConversationTeaserSql(conversationIdColumn: string) {
    const conversationIdRef = sql.raw(conversationIdColumn);

    return sql<string>`
      (
        SELECT
          CASE
            WHEN m.deleted_at IS NOT NULL THEN 'Mensagem excluída'
            WHEN m.type = 'audio' THEN 'Áudio'
            WHEN m.type = 'image' THEN 'Imagem'
            WHEN m.type = 'video' THEN 'Vídeo'
            WHEN m.type = 'document' THEN 'Documento'
            WHEN m.type = 'sticker' THEN 'Sticker'
            WHEN m.type = 'template' THEN 'Template'
            WHEN m.content LIKE 'https://mmg.whatsapp.net/%' THEN 'Mídia'
            WHEN m.content LIKE 'https://pps.whatsapp.net/%' THEN 'Mídia'
            ELSE m.content
          END
        FROM ${messages} m
        WHERE m.conversation_id = ${conversationIdRef}
        ORDER BY m.created_at DESC
        LIMIT 1
      )
    `;
  }

  private fullQuery(
    db: DatabaseConnection,
    options?: { limit?: number; orderBy?: SQL[] },
  ) {
    const receivedCh = alias(channels, "received_ch");

    return {
      where: (params: SQL | undefined): Promise<FullQueryOutput[]> => {
        let query = db
          .select({
            id: conversations.id,
            contact: {
              id: partnerContacts.id,
              name: partners.name,
              thumbnail: partnerContacts.thumbnail,
              value: partnerContacts.value,
              username: partnerContacts.username,
              type: partnerContacts.type,
            },
            attendant: {
              id: users.id,
              name: users.name,
            },
            status: conversations.status,
            openedAt: conversations.openedAt,
            firstOpenedAt: conversations.firstOpenedAt,
            closedAt: conversations.closedAt,
            sector: {
              id: sectors.id,
              name: sectors.name,
            },
            channel: {
              id: channels.id,
              name: channels.name,
              type: channels.type,
            },
            receivedChannel: {
              id: receivedCh.id,
              name: receivedCh.name,
              type: receivedCh.type,
            },
            teaser: this.buildConversationTeaserSql("\"conversations\".\"id\"").as("teaser"),
            messageToView: sql<number>`
            (
              SELECT COUNT(*)::int
              FROM ${messages} m
              WHERE
                m.conversation_id = ${conversations.id}
                AND m.sender_type = 'contact'
                AND m.viewed_at IS NULL
            )
          `.as("message_to_view"),
            lastMessageCreatedAt: sql<number>`
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = ${conversations.id}
              ORDER BY m.created_at DESC
              LIMIT 1
            )
          `.as("last_message_time"),
            waitingAt: sql<number>`
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = ${conversations.id}
              ORDER BY m.created_at ASC
              LIMIT 1
            )
          `.as("waiting_at"),
            lastClientMessageCreatedAt: sql<number>`
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE
                m.conversation_id = ${conversations.id}
                AND m.sender_type = 'contact'
              ORDER BY m.created_at DESC
              LIMIT 1
            )
          `.as("last_client_message_time"),
            activeFlowExecutionId: conversations.activeFlowExecutionId,
            flowCompletedAt: conversations.flowCompletedAt,
            conversationType: conversations.conversationType,
            name: conversations.name,
            groupJid: conversations.groupJid,
          })
          .from(conversations)
          .leftJoin(
            partnerContacts,
            eq(partnerContacts.id, conversations.contact),
          )
          .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
          .leftJoin(users, eq(users.id, conversations.attendantId))
          .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
          .leftJoin(channels, eq(channels.id, conversations.channel))
          .leftJoin(
            receivedCh,
            eq(receivedCh.id, conversations.receivedChannelId),
          )
          .where(params)
          .$dynamic();

        if (options?.orderBy?.length) {
          query = query.orderBy(...options.orderBy);
        }
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        return query.then((response) =>
          response.map((row) => {
            const rawResult: FullQueryRawResult = {
              id: row.id,
              contact: {
                id: row.contact.id,
                name: row.contact.name,
                thumbnail: row.contact.thumbnail,
                value: row.contact.value,
                username: row.contact.username,
                type: row.contact.type,
              },
              attendant: row.attendant?.id
                ? { id: row.attendant.id, name: row.attendant.name ?? "" }
                : null,
              status: row.status,
              openedAt: row.openedAt,
              firstOpenedAt: row.firstOpenedAt,
              closedAt: row.closedAt,
              sector: row.sector?.id
                ? { id: row.sector.id, name: row.sector.name ?? "" }
                : null,
              channel: row.channel?.id
                ? {
                    id: row.channel.id,
                    name: row.channel.name ?? "",
                    type: row.channel.type,
                  }
                : null,
              receivedChannel: row.receivedChannel?.id
                ? {
                    id: row.receivedChannel.id,
                    name: row.receivedChannel.name ?? "",
                    type: row.receivedChannel.type,
                  }
                : null,
              teaser: row.teaser,
              messageToView: row.messageToView,
              lastMessageCreatedAt: row.lastMessageCreatedAt,
              waitingAt: row.waitingAt,
              lastClientMessageCreatedAt: row.lastClientMessageCreatedAt,
              activeFlowExecutionId: row.activeFlowExecutionId,
              flowCompletedAt: row.flowCompletedAt,
              conversationType: row.conversationType,
              name: row.name,
              groupJid: row.groupJid,
            };
            return mapRawToConversation(rawResult);
          }),
        );
      },
    };
  }

  async retrieve(id: string): Promise<Conversation | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [conversation] = await this.fullQuery(db).where(
      eq(conversations.id, id),
    );

    if (!conversation) return null;

    return Conversation.fromRaw(conversation);
  }

  async retrieveByPartnerId(
    partnerId: string,
    workspaceId: string,
  ): Promise<Conversation | null> {
    if (!partnerId || !workspaceId) return null;

    const db = createDatabaseConnection();

    const results = await this.fullQuery(db).where(
      and(
        eq(conversations.workspaceId, workspaceId),
        sql`${conversations.contact} IN (
          SELECT pc.id FROM ${partnerContacts} pc
          WHERE pc.partner_id = ${partnerId}
        )`,
      ),
    );

    if (results.length === 0) return null;

    results.sort((a, b) => {
      const dateA = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      const dateB = b.openedAt ? new Date(b.openedAt).getTime() : 0;
      return dateB - dateA;
    });

    const firstResult = results[0];
    if (!firstResult) return null;

    return Conversation.fromRaw(firstResult);
  }

  async retrieveByMessageId(
    messageId: string,
  ): Promise<{ conversation: Conversation; workspaceId: string } | null> {
    if (!messageId) return null;

    const db = createDatabaseConnection();

    const [result] = await db
      .select({
        id: conversations.id,
        workspaceId: conversations.workspaceId,
        contact: {
          id: partnerContacts.id,
          name: partners.name,
          thumbnail: partnerContacts.thumbnail,
          value: partnerContacts.value,
          username: partnerContacts.username,
          type: partnerContacts.type,
        },
        attendant: {
          id: users.id,
          name: users.name,
        },
        status: conversations.status,
        conversationType: conversations.conversationType,
        conversationName: conversations.name,
        groupJid: conversations.groupJid,
        openedAt: conversations.openedAt,
        firstOpenedAt: conversations.firstOpenedAt,
        closedAt: conversations.closedAt,
        sector: {
          id: sectors.id,
          name: sectors.name,
        },
        channel: {
          id: channels.id,
          name: channels.name,
          type: channels.type,
        },
        teaser: this.buildConversationTeaserSql("\"conversations\".\"id\"").as("teaser"),
        messageToView: sql<number>`
            (
              SELECT COUNT(*)::int
              FROM ${messages} m
              WHERE
                m.conversation_id = ${conversations.id}
                AND m.sender_type = 'contact'
                AND m.viewed_at IS NULL
            )
          `.as("message_to_view"),
        lastMessageCreatedAt: sql<number>`
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = ${conversations.id}
              ORDER BY m.created_at DESC
              LIMIT 1
            )
          `.as("last_message_time"),
        lastClientMessageCreatedAt: sql<number>`
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE
                m.conversation_id = ${conversations.id}
                AND m.sender_type = 'contact'
              ORDER BY m.created_at DESC
              LIMIT 1
            )
          `.as("last_client_message_time"),
      })
      .from(conversations)
      .leftJoin(partnerContacts, eq(partnerContacts.id, conversations.contact))
      .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
      .leftJoin(channels, eq(channels.id, conversations.channel))
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(messages.id, messageId));

    if (!result) return null;

    const conversationRaw: Conversation.Raw = {
      id: result.id,
      contact: result.contact.id
        ? Contact.instance({
            id: result.contact.id,
            name: result.contact.name ?? "",
            thumbnail: result.contact.thumbnail ?? "",
            value: result.contact.value ?? "",
            username: result.contact.username ?? "",
            type: result.contact.type ?? "whatsapp",
          }).raw()
        : null,
      attendant:
        result.attendant?.id && result.attendant?.name
          ? { id: result.attendant.id, name: result.attendant.name }
          : null,
      status: result.status as Conversation.Status,
      openedAt: result.openedAt,
      firstOpenedAt: result.firstOpenedAt,
      closedAt: result.closedAt,
      sector:
        result.sector?.id && result.sector?.name
          ? { id: result.sector.id, name: result.sector.name }
          : null,
      channel: result.channel?.id
        ? {
            id: result.channel.id,
            name: result.channel.name ?? "",
            type: result.channel.type ?? "whatsapp",
          }
        : null,
      receivedChannel: null,
      teaser: result.teaser ?? "",
      messageToView: result.messageToView ?? 0,
      lastMessageCreatedAt: convertTimestampToDate(result.lastMessageCreatedAt),
      waitingAt: null,
      lastClientMessageCreatedAt: convertTimestampToDate(
        result.lastClientMessageCreatedAt,
      ),
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      conversationType: result.conversationType ?? "external",
      name: result.conversationName ?? null,
      participants: [],
      groupJid: result.groupJid ?? null,
      isFromReceivingNumber: false,
    };

    return {
      conversation: Conversation.fromRaw(conversationRaw),
      workspaceId: result.workspaceId,
    };
  }

  async search(input: SearchInputDTO): Promise<SearchConversationsOutputDTO> {
    if (!input.workspaceId) {
      return {
        conversations: [],
        counters: { open: 0, waiting: 0, expired: 0, closed: 0, internal: 0 },
        unreadByStatus: {
          open: 0,
          waiting: 0,
          expired: 0,
          closed: 0,
          internal: 0,
        },
      };
    }

    const db = createDatabaseConnection();

    const baseFilters: (SQL | undefined)[] = [
      eq(conversations.workspaceId, input.workspaceId),
    ];

    if (input.query?.trim()) {
      const searchType = input.searchType || "all";
      const q = input.query.trim();
      const instagramQuery = q.replace(/^@/, "");

      if (searchType === "phone") {
        baseFilters.push(eq(partnerContacts.value, q));
      } else if (searchType === "instagram") {
        baseFilters.push(
          and(
            eq(partnerContacts.type, "instagram"),
            or(
              ilike(partnerContacts.username, `${instagramQuery}%`),
              and(
                ilike(partnerContacts.value, `${instagramQuery}%`),
                sql`COALESCE(${partnerContacts.username}, '') = ''`,
              ),
            ),
          ),
        );
      } else if (searchType === "client-name") {
        baseFilters.push(ilike(partners.name, `%${q}%`));
      } else if (searchType === "attendant-name") {
        baseFilters.push(ilike(users.name, `%${q}%`));
      } else if (searchType === "all") {
        baseFilters.push(
          or(
            ilike(partnerContacts.value, `%${q}%`),
            ilike(partnerContacts.username, `%${instagramQuery}%`),
            ilike(partners.name, `%${q}%`),
          ),
        );
      }
    }

    const sectorChannelFilter = this.buildSectorChannelFilters(input);
    if (sectorChannelFilter) {
      baseFilters.push(sectorChannelFilter);
    }

    if (input.userSelectedChannelIds?.length) {
      baseFilters.push(
        inArray(conversations.channel, input.userSelectedChannelIds),
      );
    }

    if (input.receivedChannelFilters?.length) {
      baseFilters.push(
        inArray(conversations.receivedChannelId, input.receivedChannelFilters),
      );
    }

    if (input.userFilters?.length) {
      baseFilters.push(
        or(
          inArray(conversations.attendantId, input.userFilters),
          isNull(conversations.attendantId),
        ),
      );
    }

    if (input.labelFilters?.length) {
      baseFilters.push(
        inArray(
          partners.id,
          db
            .selectDistinct({ partnerId: partnersLabels.partnerId })
            .from(partnersLabels)
            .where(inArray(partnersLabels.labelId, input.labelFilters)),
        ),
      );
    }

    const dateRange = resolveDateRange(input);
    if (dateRange) {
      const dateType = input.dateType || "lastMessage";

      if (dateType === "creation") {
        baseFilters.push(
          and(
            gte(conversations.openedAt, dateRange.startDate),
            lte(conversations.openedAt, dateRange.endDate),
          ),
        );
      } else if (dateType === "lastMessage") {
        baseFilters.push(
          sql`(
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}`,
        );
      }
    }

    if (input.waitingStatus) {
      if (input.waitingStatus === "attendant") {
        baseFilters.push(
          sql`(
            SELECT m.sender_type
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) = 'contact'`,
        );
      } else if (input.waitingStatus === "client") {
        baseFilters.push(
          sql`(
            SELECT m.sender_type
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) != 'contact'`,
        );
      }
    }

    if (input.conversationTypeFilter === "groups") {
      baseFilters.push(eq(conversations.conversationType, "whatsapp-group"));
      baseFilters.push(
        sql`${conversations.id} IN (
          SELECT DISTINCT ON (c_dedup.group_jid) c_dedup.id
          FROM ${conversations} c_dedup
          LEFT JOIN LATERAL (
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = c_dedup.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) last_msg ON true
          WHERE c_dedup.conversation_type = 'whatsapp-group'
            AND c_dedup.workspace_id = ${input.workspaceId}
            AND c_dedup.group_jid IS NOT NULL
          ORDER BY c_dedup.group_jid, last_msg.created_at DESC NULLS LAST, c_dedup.id DESC
        )`,
      );
    } else if (input.conversationTypeFilter === "all") {
      baseFilters.push(
        or(
          eq(conversations.conversationType, "external"),
          eq(conversations.conversationType, "whatsapp-group"),
          isNull(conversations.conversationType),
        ),
      );
    } else {
      baseFilters.push(
        or(
          eq(conversations.conversationType, "external"),
          isNull(conversations.conversationType),
        ),
      );
    }

    const filters: (SQL | undefined)[] = [...baseFilters];
    const isGroupsFilter = input.conversationTypeFilter === "groups";
    const hasSearchQuery = !!input.query?.trim();
    if (
      input.statusFilters &&
      input.statusFilters.length > 0 &&
      !isGroupsFilter &&
      !hasSearchQuery
    ) {
      filters.push(inArray(conversations.status, input.statusFilters));
    }

    const whereClause = and(...filters.filter(Boolean));
    const whereClauseCounter = and(...baseFilters.filter(Boolean));

    const conversationsList = await this.fullQuery(db).where(whereClause);

    const sortOrder = input.sortOrder || "desc";
    conversationsList.sort((a, b) => {
      const timeA = a.lastMessageCreatedAt?.getTime() ?? 0;
      const timeB = b.lastMessageCreatedAt?.getTime() ?? 0;
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    const counts = await db
      .select({
        status: conversations.status,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .leftJoin(partnerContacts, eq(partnerContacts.id, conversations.contact))
      .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
      .leftJoin(channels, eq(channels.id, conversations.channel))
      .where(whereClauseCounter)
      .groupBy(conversations.status);

    const counters = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };

    for (const row of counts) {
      if (row.status && row.status in counters) {
        counters[row.status as keyof typeof counters] = row.total;
      }
    }

    const unreadCounts = await db
      .select({
        status: conversations.status,
        total: sql<number>`COALESCE(SUM(
          (SELECT COUNT(*)::int FROM ${messages} m
           WHERE m.conversation_id = ${conversations.id}
             AND m.sender_type = 'contact'
             AND m.viewed_at IS NULL)
        ), 0)::int`,
      })
      .from(conversations)
      .leftJoin(partnerContacts, eq(partnerContacts.id, conversations.contact))
      .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
      .leftJoin(channels, eq(channels.id, conversations.channel))
      .where(whereClauseCounter)
      .groupBy(conversations.status);

    const unreadByStatus = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };

    for (const row of unreadCounts) {
      if (row.status && row.status in unreadByStatus) {
        unreadByStatus[row.status as keyof typeof unreadByStatus] = Number(
          row.total,
        );
      }
    }

    return { conversations: conversationsList, counters, unreadByStatus };
  }

  private buildSectorChannelFilters(
    input: Pick<SearchInputDTO, "sectorFilters" | "channelFilters">,
  ): SQL | undefined {
    const sectorParts: SQL[] = [];
    const channelParts: SQL[] = [];

    if (input.sectorFilters?.length) {
      const onlySectorIds = input.sectorFilters.filter(
        (v): v is string => v !== null,
      );
      const includeNullSector = input.sectorFilters.includes(null);

      if (onlySectorIds.length > 0) {
        sectorParts.push(inArray(conversations.sectorId, onlySectorIds));
      }

      if (includeNullSector) {
        sectorParts.push(isNull(conversations.sectorId));
      }
    }

    if (input.channelFilters?.length) {
      const onlyChannelIds = input.channelFilters.filter(
        (v): v is string => v !== null,
      );
      const includeNullChannel = input.channelFilters.includes(null);

      if (onlyChannelIds.length > 0) {
        channelParts.push(inArray(conversations.channel, onlyChannelIds));
      }
      if (includeNullChannel) {
        channelParts.push(isNull(conversations.channel));
      }
    }

    const sectorFilter =
      sectorParts.length === 0
        ? undefined
        : sectorParts.length === 1
          ? sectorParts[0]
          : or(...sectorParts);
    const channelFilter =
      channelParts.length === 0
        ? undefined
        : channelParts.length === 1
          ? channelParts[0]
          : or(...channelParts);

    if (sectorFilter && channelFilter) {
      return and(sectorFilter, channelFilter);
    }

    return sectorFilter ?? channelFilter;
  }

  private buildBaseFilters(
    input: SearchInputDTO,
    db: DatabaseConnection,
  ): (SQL | undefined)[] {
    const baseFilters: (SQL | undefined)[] = [
      eq(conversations.workspaceId, input.workspaceId),
    ];

    if (input.query?.trim()) {
      const searchType = input.searchType || "all";
      const q = input.query.trim();
      const instagramQuery = q.replace(/^@/, "");

      if (searchType === "phone") {
        baseFilters.push(eq(partnerContacts.value, q));
      } else if (searchType === "instagram") {
        baseFilters.push(
          and(
            eq(partnerContacts.type, "instagram"),
            or(
              ilike(partnerContacts.username, `${instagramQuery}%`),
              and(
                ilike(partnerContacts.value, `${instagramQuery}%`),
                sql`COALESCE(${partnerContacts.username}, '') = ''`,
              ),
            ),
          ),
        );
      } else if (searchType === "client-name") {
        baseFilters.push(ilike(partners.name, `%${q}%`));
      } else if (searchType === "attendant-name") {
        baseFilters.push(ilike(users.name, `%${q}%`));
      } else if (searchType === "all") {
        baseFilters.push(
          or(
            ilike(partnerContacts.value, `%${q}%`),
            ilike(partnerContacts.username, `%${instagramQuery}%`),
            ilike(partners.name, `%${q}%`),
          ),
        );
      }
    }

    const sectorChannelFilter = this.buildSectorChannelFilters(input);
    if (sectorChannelFilter) {
      baseFilters.push(sectorChannelFilter);
    }

    if (input.userSelectedChannelIds?.length) {
      baseFilters.push(
        inArray(conversations.channel, input.userSelectedChannelIds),
      );
    }

    if (input.receivedChannelFilters?.length) {
      baseFilters.push(
        inArray(conversations.receivedChannelId, input.receivedChannelFilters),
      );
    }

    if (input.userFilters?.length) {
      baseFilters.push(
        or(
          inArray(conversations.attendantId, input.userFilters),
          isNull(conversations.attendantId),
        ),
      );
    }

    if (input.labelFilters?.length) {
      baseFilters.push(
        inArray(
          partners.id,
          db
            .selectDistinct({ partnerId: partnersLabels.partnerId })
            .from(partnersLabels)
            .where(inArray(partnersLabels.labelId, input.labelFilters)),
        ),
      );
    }

    const dateRange = resolveDateRange(input);
    if (dateRange) {
      const dateType = input.dateType || "lastMessage";

      if (dateType === "creation") {
        baseFilters.push(
          and(
            gte(conversations.openedAt, dateRange.startDate),
            lte(conversations.openedAt, dateRange.endDate),
          ),
        );
      } else if (dateType === "lastMessage") {
        baseFilters.push(
          sql`(
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}`,
        );
      }
    }

    if (input.waitingStatus) {
      if (input.waitingStatus === "attendant") {
        baseFilters.push(
          sql`(
            SELECT m.sender_type
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) = 'contact'`,
        );
      } else if (input.waitingStatus === "client") {
        baseFilters.push(
          sql`(
            SELECT m.sender_type
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          ) != 'contact'`,
        );
      }
    }

    if (input.conversationTypeFilter === "groups") {
      baseFilters.push(eq(conversations.conversationType, "whatsapp-group"));
      baseFilters.push(
        sql`${conversations.id} IN (
          SELECT DISTINCT ON (c_dedup.group_jid) c_dedup.id
          FROM ${conversations} c_dedup
          LEFT JOIN LATERAL (
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = c_dedup.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) last_msg ON true
          WHERE c_dedup.conversation_type = 'whatsapp-group'
            AND c_dedup.workspace_id = ${input.workspaceId}
            AND c_dedup.group_jid IS NOT NULL
          ORDER BY c_dedup.group_jid, last_msg.created_at DESC NULLS LAST, c_dedup.id DESC
        )`,
      );
    } else if (input.conversationTypeFilter === "all") {
      baseFilters.push(
        or(
          eq(conversations.conversationType, "external"),
          eq(conversations.conversationType, "whatsapp-group"),
          isNull(conversations.conversationType),
        ),
      );
    } else {
      baseFilters.push(
        or(
          eq(conversations.conversationType, "external"),
          isNull(conversations.conversationType),
        ),
      );
    }

    return baseFilters;
  }

  private encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString("base64url");
  }

  private decodeCursor(cursor: string): CursorData {
    return JSON.parse(Buffer.from(cursor, "base64url").toString());
  }

  private async getCountersForFilters(
    db: DatabaseConnection,
    baseFilters: (SQL | undefined)[],
  ): Promise<CounterConversations> {
    const whereClauseCounter = and(...baseFilters.filter(Boolean));

    const counts = await db
      .select({
        status: conversations.status,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .leftJoin(partnerContacts, eq(partnerContacts.id, conversations.contact))
      .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
      .leftJoin(channels, eq(channels.id, conversations.channel))
      .where(whereClauseCounter)
      .groupBy(conversations.status);

    const counters: CounterConversations = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };

    for (const row of counts) {
      if (row.status && row.status in counters) {
        counters[row.status as keyof CounterConversations] = row.total;
      }
    }

    return counters;
  }

  private async getUnreadByStatusForFilters(
    db: DatabaseConnection,
    baseFilters: (SQL | undefined)[],
  ): Promise<UnreadByStatus> {
    const unreadCounts = await db
      .select({
        status: conversations.status,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .leftJoin(partnerContacts, eq(partnerContacts.id, conversations.contact))
      .leftJoin(partners, eq(partners.id, partnerContacts.partnerId))
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .leftJoin(sectors, eq(sectors.id, conversations.sectorId))
      .leftJoin(channels, eq(channels.id, conversations.channel))
      .where(
        and(
          ...baseFilters.filter(Boolean),
          sql`EXISTS (
            SELECT 1 FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
              AND m.sender_type = 'contact'
              AND m.viewed_at IS NULL
          )`,
        ),
      )
      .groupBy(conversations.status);

    const unreadByStatus: UnreadByStatus = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };

    for (const row of unreadCounts) {
      if (row.status && row.status in unreadByStatus) {
        unreadByStatus[row.status as keyof UnreadByStatus] = Number(row.total);
      }
    }

    return unreadByStatus;
  }

  async searchPaginated(
    input: PaginatedSearchInputDTO,
  ): Promise<PaginatedSearchOutputDTO> {
    const emptyResult: PaginatedSearchOutputDTO = {
      conversations: [],
      counters: { open: 0, waiting: 0, expired: 0, closed: 0, internal: 0 },
      unreadByStatus: {
        open: 0,
        waiting: 0,
        expired: 0,
        closed: 0,
        internal: 0,
      },
      nextCursor: null,
      hasMore: false,
    };

    if (!input.workspaceId) {
      return emptyResult;
    }

    const db = createDatabaseConnection();
    const limit = input.limit || 50;
    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;

    const baseFilters = this.buildBaseFilters(input, db);

    const filters: (SQL | undefined)[] = [...baseFilters];
    const isGroupsFilter = input.conversationTypeFilter === "groups";
    const hasSearchQuery = !!input.query?.trim();
    if (
      input.statusFilters &&
      input.statusFilters.length > 0 &&
      !isGroupsFilter &&
      !hasSearchQuery
    ) {
      filters.push(inArray(conversations.status, input.statusFilters));
    }

    if (cursor) {
      const isAsc = input.sortOrder === "asc";
      if (isAsc) {
        filters.push(
          sql`(
            COALESCE((
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = ${conversations.id}
              ORDER BY m.created_at DESC
              LIMIT 1
            ), 0) > ${cursor.lastMessageAt}
            OR (
              COALESCE((
                SELECT m.created_at
                FROM ${messages} m
                WHERE m.conversation_id = ${conversations.id}
                ORDER BY m.created_at DESC
                LIMIT 1
              ), 0) = ${cursor.lastMessageAt}
              AND ${conversations.id} > ${cursor.id}
            )
          )`,
        );
      } else {
        filters.push(
          sql`(
            COALESCE((
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = ${conversations.id}
              ORDER BY m.created_at DESC
              LIMIT 1
            ), 0) < ${cursor.lastMessageAt}
            OR (
              COALESCE((
                SELECT m.created_at
                FROM ${messages} m
                WHERE m.conversation_id = ${conversations.id}
                ORDER BY m.created_at DESC
                LIMIT 1
              ), 0) = ${cursor.lastMessageAt}
              AND ${conversations.id} < ${cursor.id}
            )
          )`,
        );
      }
    }

    const whereClause = and(...filters.filter(Boolean));

    const isAsc = input.sortOrder === "asc";
    const orderByExprs = isAsc
      ? [asc(sql`last_message_time`), asc(conversations.id)]
      : [desc(sql`last_message_time`), desc(conversations.id)];

    const conversationsList = await this.fullQuery(db, {
      orderBy: orderByExprs,
      limit: limit + 1,
    }).where(whereClause);

    const hasMore = conversationsList.length > limit;
    const paginatedConversations = hasMore
      ? conversationsList.slice(0, limit)
      : conversationsList;

    let nextCursor: string | null = null;
    if (hasMore && paginatedConversations.length > 0) {
      const lastIndex = paginatedConversations.length - 1;
      const lastConversation = paginatedConversations[lastIndex];
      if (lastConversation !== undefined) {
        nextCursor = this.encodeCursor({
          lastMessageAt: lastConversation.lastMessageCreatedAt
            ? Math.floor(lastConversation.lastMessageCreatedAt.getTime() / 1000)
            : 0,
          id: lastConversation.id,
        });
      }
    }

    let counters: CounterConversations = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };
    let unreadByStatus: UnreadByStatus = {
      open: 0,
      waiting: 0,
      expired: 0,
      closed: 0,
      internal: 0,
    };

    if (!cursor) {
      [counters, unreadByStatus] = await Promise.all([
        this.getCountersForFilters(db, baseFilters),
        this.getUnreadByStatusForFilters(db, baseFilters),
      ]);
    }

    return {
      conversations: paginatedConversations,
      counters,
      unreadByStatus,
      nextCursor,
      hasMore,
    };
  }

  async retrieveOver24h(
    workspaceId: string,
  ): Promise<Conversation.ExpiredConversation[] | null> {
    if (!workspaceId) return null;

    const db = createDatabaseConnection();

    type RawExpiredRow = {
      id: string;
      lastClientMessageCreatedAt: number | string | null;
    };

    const expirationWindowCondition = this.buildExpirationWindowCondition();
    const rawResults = await db.execute<RawExpiredRow>(
      sql`
        SELECT
          c.id,
          (
            SELECT m.created_at
            FROM ${messages} m
            WHERE
              m.conversation_id = c.id
              AND m.sender_type = 'contact'
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS "lastClientMessageCreatedAt"
        FROM ${conversations} c
        INNER JOIN ${channels} ch ON c.channel = ch.id
        WHERE
          ${expirationWindowCondition}
          AND c.status IN ('open', 'waiting')
          AND c.workspace_id = ${workspaceId}
          AND ch.type != 'evolution';
      `,
    );

    const expiredConversations: Conversation.ExpiredConversation[] =
      rawResults.map((row) => ({
        id: row.id,
        lastClientMessageCreatedAt: convertTimestampToDate(
          row.lastClientMessageCreatedAt,
        ),
      }));

    return expiredConversations;
  }

  private buildExpirationWindowCondition(): SQL {
    const instagramCutoffTimestamp = sql`EXTRACT(EPOCH FROM (NOW() - INTERVAL '7 days'))`;
    const officialWhatsAppCutoffTimestamp = sql`EXTRACT(EPOCH FROM (NOW() - INTERVAL '24 hours'))`;

    const lastClientMessageTimestamp = sql`(
      SELECT m.created_at
      FROM ${messages} m
      WHERE
        m.conversation_id = c.id
        AND m.sender_type = 'contact'
      ORDER BY m.created_at DESC
      LIMIT 1
    )`;

    const lastTemplateByAttendantTimestamp = sql`(
      SELECT m.created_at
      FROM ${messages} m
      WHERE
        m.conversation_id = c.id
        AND m.sender_type = 'attendant'
        AND m.type = 'template'
      ORDER BY m.created_at DESC
      LIMIT 1
    )`;

    const whatsappWindowStart = sql`GREATEST(
      COALESCE(${lastClientMessageTimestamp}, 0),
      COALESCE(${lastTemplateByAttendantTimestamp}, 0)
    )`;

    return sql`
      (
        (
          ch.type = 'instagram'
          AND ${lastClientMessageTimestamp} < ${instagramCutoffTimestamp}
        )
        OR (
          ch.type IN ('whatsapp', 'meta_api')
          AND ch.payload->>'wabaId' IS NOT NULL
          AND ${whatsappWindowStart} > 0
          AND ${whatsappWindowStart} < ${officialWhatsAppCutoffTimestamp}
        )
      )
    `;
  }

  async retrieveOpenByChannelIdAndContactId(
    channelId: string,
    contactId: string,
    _receivedChannelId?: string | null,
  ): Promise<Conversation | null> {
    if (!channelId || !contactId) return null;
    const db = createDatabaseConnection();

    const filters: (SQL | undefined)[] = [
      eq(conversations.channel, channelId),
      eq(conversations.contact, contactId),
      or(eq(conversations.status, "open"), eq(conversations.status, "waiting")),
    ];

    const [conversation] = await this.fullQuery(db).where(and(...filters));

    if (!conversation) return null;
    return Conversation.fromRaw(conversation);
  }

  async retrieveOpenByChannelAndPartnerName(
    channelId: string,
    partnerName: string,
    workspaceId: string,
  ): Promise<Conversation | null> {
    if (!channelId || !partnerName || !workspaceId) return null;

    const isNumericName = /^\d+$/.test(partnerName);
    if (isNumericName) return null;

    const db = createDatabaseConnection();

    const results = await db.execute(sql`
      SELECT c.id
      FROM ${conversations} c
      INNER JOIN ${partnerContacts} pc ON pc.id = c.contact
      INNER JOIN ${partners} p ON p.id = pc.partner_id
      WHERE c.channel = ${channelId}
        AND c.workspace_id = ${workspaceId}
        AND c.status IN ('open', 'waiting')
        AND c.conversation_type = 'external'
        AND LOWER(p.name) = LOWER(${partnerName})
      ORDER BY c.opened_at DESC NULLS LAST
      LIMIT 1
    `);

    if (!results.length) return null;

    const row = results[0] as { id: string };
    return this.retrieve(row.id);
  }

  async retrieveByChannelAndPartnerName(
    channelId: string,
    partnerName: string,
    workspaceId: string,
  ): Promise<Conversation | null> {
    if (!channelId || !partnerName || !workspaceId) return null;

    const isNumericName = /^\d+$/.test(partnerName);
    if (isNumericName) return null;

    const db = createDatabaseConnection();

    const results = await db.execute(sql`
      SELECT c.id
      FROM ${conversations} c
      INNER JOIN ${partnerContacts} pc ON pc.id = c.contact
      INNER JOIN ${partners} p ON p.id = pc.partner_id
      WHERE c.channel = ${channelId}
        AND c.workspace_id = ${workspaceId}
        AND c.conversation_type = 'external'
        AND LOWER(p.name) = LOWER(${partnerName})
      ORDER BY c.opened_at DESC NULLS LAST
      LIMIT 1
    `);

    if (!results.length) return null;

    const row = results[0] as { id: string };
    return this.retrieve(row.id);
  }

  async retrieveLatestByChannelIdAndContactId(
    channelId: string,
    contactId: string,
  ): Promise<Conversation | null> {
    if (!channelId || !contactId) return null;
    const db = createDatabaseConnection();

    const filters: (SQL | undefined)[] = [
      eq(conversations.channel, channelId),
      eq(conversations.contact, contactId),
      or(
        eq(conversations.status, "closed"),
        eq(conversations.status, "expired"),
      ),
    ];

    const results = await this.fullQuery(db).where(and(...filters));

    if (!results.length) return null;

    results.sort((a, b) => {
      const dateA = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const dateB = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return dateB - dateA;
    });

    return Conversation.fromRaw(results[0] as FullQueryOutput);
  }

  async retrieveOpenByGroupJid(
    channelId: string,
    groupJid: string,
  ): Promise<Conversation | null> {
    if (!channelId || !groupJid) return null;
    const db = createDatabaseConnection();

    const filters: (SQL | undefined)[] = [
      eq(conversations.channel, channelId),
      eq(conversations.groupJid, groupJid),
      eq(conversations.conversationType, "whatsapp-group"),
    ];

    const [conversation] = await this.fullQuery(db).where(and(...filters));

    if (!conversation) return null;
    return Conversation.fromRaw(conversation);
  }

  async upsert(conversation: Conversation, workspaceId: string) {
    const db = createDatabaseConnection();
    const activeFlowExecutionIdToPersist = conversation.attendant
      ? null
      : conversation.activeFlowExecutionId;
    try {
      await db
        .insert(conversations)
        .values({
          id: conversation.id,
          channel: conversation.channel?.id || null,
          receivedChannelId: conversation.receivedChannel?.id || null,
          sectorId: conversation.sector?.id,
          contact: conversation.contact?.id || null,
          attendantId: conversation.attendant?.id || null,
          status: conversation.status,
          workspaceId,
          openedAt: conversation.openedAt,
          firstOpenedAt: conversation.firstOpenedAt,
          closedAt: conversation.closedAt,
          activeFlowExecutionId: activeFlowExecutionIdToPersist,
          flowCompletedAt: conversation.flowCompletedAt,
          conversationType: conversation.conversationType,
          name: conversation.name,
          groupJid: conversation.groupJid,
        })
        .onConflictDoUpdate({
          target: conversations.id,
          set: {
            openedAt: conversation.openedAt,
            firstOpenedAt: conversation.firstOpenedAt,
            closedAt: conversation.closedAt,
            status: conversation.status,
            workspaceId,
            attendantId: conversation.attendant?.id || null,
            sectorId: conversation.sector?.id,
            receivedChannelId: conversation.receivedChannel?.id || null,
            activeFlowExecutionId: activeFlowExecutionIdToPersist,
            flowCompletedAt: conversation.flowCompletedAt,
            conversationType: conversation.conversationType,
            name: conversation.name,
            groupJid: conversation.groupJid,
          },
        });
    } catch (error: unknown) {
      const cause = (error as { cause?: unknown }).cause;
      const causeCode =
        cause instanceof Error
          ? (cause as { code?: string }).code
          : undefined;
      const causeMessage =
        cause instanceof Error ? cause.message : undefined;
      const isUniqueViolation =
        error instanceof Error &&
        (error.message.includes("idx_conversations_unique_open_contact") ||
          error.message.includes("idx_conversations_unique_whatsapp_group") ||
          (error as { code?: string }).code === "23505" ||
          causeCode === "23505" ||
          causeMessage?.includes("idx_conversations_unique_open_contact") ||
          causeMessage?.includes("idx_conversations_unique_whatsapp_group"));

      if (isUniqueViolation) {
        if (
          conversation.conversationType === "whatsapp-group" &&
          conversation.groupJid &&
          conversation.channel?.id
        ) {
          const existingConversation = await this.retrieveOpenByGroupJid(
            conversation.channel.id,
            conversation.groupJid,
          );

          if (existingConversation) {
            conversation.id = existingConversation.id;
            console.log(
              "[ConversationsRepository] Race condition handled for group: using existing conversation",
              existingConversation.id,
            );
            return;
          }
        }

        if (conversation.contact?.id && conversation.channel?.id) {
          const existingConversation =
            await this.retrieveOpenByChannelIdAndContactId(
              conversation.channel.id,
              conversation.contact.id,
            );

          if (existingConversation) {
            conversation.id = existingConversation.id;
            console.log(
              "[ConversationsRepository] Race condition handled: using existing conversation",
              existingConversation.id,
            );
            return;
          }
        }
      }

      throw error;
    }
  }

  async assignAtomically(
    conversationId: string,
    attendantId: string,
    workspaceId: string,
    sectorId?: string,
  ): Promise<{ success: boolean; currentAttendantName: string | null }> {
    const db = createDatabaseConnection();

    const now = new Date();
    const result = await db
      .update(conversations)
      .set({
        attendantId,
        status: "open",
        openedAt: now,
        firstOpenedAt: sql`COALESCE(${conversations.firstOpenedAt}, ${now.toISOString()})`,
        closedAt: null,
        activeFlowExecutionId: null,
        ...(sectorId && { sectorId }),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
          or(
            isNull(conversations.attendantId),
            eq(conversations.attendantId, attendantId),
            eq(conversations.status, "closed"),
            eq(conversations.status, "expired"),
          ),
        ),
      )
      .returning({ id: conversations.id });

    if (result.length > 0) {
      return { success: true, currentAttendantName: null };
    }

    const [existingConversation] = await db
      .select({
        attendantName: users.name,
      })
      .from(conversations)
      .leftJoin(users, eq(users.id, conversations.attendantId))
      .where(eq(conversations.id, conversationId));

    return {
      success: false,
      currentAttendantName: existingConversation?.attendantName ?? null,
    };
  }

  async reopenAtomically(
    channelId: string,
    contactId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; conversationId: string | null }> {
    const db = createDatabaseConnection();

    const [closedConversation] = await db
      .select({
        id: conversations.id,
        closedAt: conversations.closedAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.channel, channelId),
          eq(conversations.contact, contactId),
          eq(conversations.workspaceId, workspaceId),
          or(
            eq(conversations.status, "closed"),
            eq(conversations.status, "expired"),
          ),
        ),
      )
      .orderBy(desc(conversations.closedAt))
      .limit(1);

    if (!closedConversation) {
      return { success: false, conversationId: null };
    }

    const result = await db
      .update(conversations)
      .set({
        status: "waiting",
        closedAt: null,
        openedAt: null,
        attendantId: null,
        flowCompletedAt: null,
        activeFlowExecutionId: null,
      })
      .where(
        and(
          eq(conversations.id, closedConversation.id),
          or(
            eq(conversations.status, "closed"),
            eq(conversations.status, "expired"),
          ),
        ),
      )
      .returning({ id: conversations.id });

    return {
      success: result.length > 0,
      conversationId: result.length > 0 ? (result[0]?.id ?? null) : null,
    };
  }

  async ensureWaitingStatus(conversationId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .update(conversations)
      .set({
        status: "waiting",
        closedAt: null,
        openedAt: null,
        attendantId: null,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.status, "expired"),
        ),
      );
  }

  async listInternalConversations(
    userId: string,
    workspaceId: string,
  ): Promise<Conversation.Raw[]> {
    const db = createDatabaseConnection();

    const conversationIds = await db
      .select({
        conversationId: internalConversationParticipants.conversationId,
      })
      .from(internalConversationParticipants)
      .innerJoin(
        conversations,
        eq(conversations.id, internalConversationParticipants.conversationId),
      )
      .where(
        and(
          eq(internalConversationParticipants.userId, userId),
          eq(conversations.workspaceId, workspaceId),
          isNull(internalConversationParticipants.leftAt),
          or(
            eq(conversations.conversationType, "direct"),
            eq(conversations.conversationType, "group"),
          ),
        ),
      );

    if (conversationIds.length === 0) {
      return [];
    }

    const ids = conversationIds.map((c) => c.conversationId);

    const conversationResults = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        openedAt: conversations.openedAt,
        firstOpenedAt: conversations.firstOpenedAt,
        closedAt: conversations.closedAt,
        conversationType: conversations.conversationType,
        name: conversations.name,
        teaser: this.buildConversationTeaserSql("\"conversations\".\"id\"").as("teaser"),
        messageToView: sql<number>`
          (
            SELECT COUNT(*)::int
            FROM "messages" m
            WHERE
              m.conversation_id = "conversations"."id"
              AND m.sender_id != ${userId}
              AND m.viewed_at IS NULL
          )
        `.as("message_to_view"),
        lastMessageCreatedAt: sql<number>`
          (
            SELECT m.created_at
            FROM "messages" m
            WHERE m.conversation_id = "conversations"."id"
            ORDER BY m.created_at DESC
            LIMIT 1
          )
        `.as("last_message_time"),
      })
      .from(conversations)
      .where(inArray(conversations.id, ids))
      .orderBy(desc(sql`last_message_time`));

    const participantsResults = await db
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
          inArray(internalConversationParticipants.conversationId, ids),
          isNull(internalConversationParticipants.leftAt),
        ),
      );

    const participantsByConversation = new Map<
      string,
      InternalConversationParticipant.Raw[]
    >();

    for (const p of participantsResults) {
      const existing = participantsByConversation.get(p.conversationId) || [];
      existing.push({
        id: p.id,
        conversationId: p.conversationId,
        userId: p.userId,
        userName: p.userName,
        userThumbnail: p.userThumbnail,
        role: p.role,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      });
      participantsByConversation.set(p.conversationId, existing);
    }

    return conversationResults.map((conv) => ({
      id: conv.id,
      contact: null,
      attendant: null,
      status: conv.status as Conversation.Status,
      openedAt: conv.openedAt,
      firstOpenedAt: conv.firstOpenedAt,
      closedAt: conv.closedAt,
      sector: null,
      channel: null,
      receivedChannel: null,
      teaser: conv.teaser ?? "",
      messageToView: conv.messageToView ?? 0,
      lastMessageCreatedAt: convertTimestampToDate(conv.lastMessageCreatedAt),
      waitingAt: null,
      lastClientMessageCreatedAt: null,
      activeFlowExecutionId: null,
      flowCompletedAt: null,
      conversationType: (conv.conversationType ??
        "external") as Conversation.Type,
      name: conv.name,
      participants: participantsByConversation.get(conv.id) ?? [],
      groupJid: null,
      isFromReceivingNumber: false,
    }));
  }

  async retrieveWithParticipants(id: string): Promise<Conversation | null> {
    const conversation = await this.retrieve(id);
    if (!conversation) return null;

    if (!conversation.isInternal) {
      return conversation;
    }

    const db = createDatabaseConnection();

    const participantsResults = await db
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
      .where(eq(internalConversationParticipants.conversationId, id));

    for (const p of participantsResults) {
      conversation.participants.push(
        InternalConversationParticipant.instance({
          id: p.id,
          conversationId: p.conversationId,
          userId: p.userId,
          userName: p.userName,
          userThumbnail: p.userThumbnail,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        }),
      );
    }

    return conversation;
  }

  async countWithoutReceivedChannel(channelId: string): Promise<number> {
    const db = createDatabaseConnection();

    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.channel, channelId),
          isNull(conversations.receivedChannelId),
        ),
      );

    return result?.count ?? 0;
  }

  async migrateToResponseChannel(
    receivedChannelId: string,
    responseChannelId: string,
  ): Promise<number> {
    const db = createDatabaseConnection();

    const result = await db
      .update(conversations)
      .set({
        channel: responseChannelId,
        receivedChannelId: receivedChannelId,
      })
      .where(
        and(
          eq(conversations.channel, receivedChannelId),
          isNull(conversations.receivedChannelId),
        ),
      )
      .returning({ id: conversations.id });

    return result.length;
  }

  async setActiveFlowExecutionIdIfNull(
    conversationId: string,
    executionId: string,
  ): Promise<boolean> {
    const db = createDatabaseConnection();

    const result = await db
      .update(conversations)
      .set({
        activeFlowExecutionId: executionId,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          isNull(conversations.activeFlowExecutionId),
        ),
      )
      .returning({ id: conversations.id });

    return result.length > 0;
  }

  async clearActiveFlowExecution(conversationId: string): Promise<void> {
    if (!conversationId) return;

    const db = createDatabaseConnection();

    await db
      .update(conversations)
      .set({
        activeFlowExecutionId: null,
      })
      .where(eq(conversations.id, conversationId));
  }

  async delete(conversationId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }

  async updateName(conversationId: string, name: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(conversations)
      .set({ name })
      .where(eq(conversations.id, conversationId));
  }

  async listDistinctWhatsappGroupsForNameSync(
    limit: number,
    offset: number,
  ): Promise<GroupNameSyncCandidateDTO[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select({
        workspaceId: conversations.workspaceId,
        channelId: conversations.channel,
        groupJid: conversations.groupJid,
        currentName: sql<string | null>`MAX(${conversations.name})`.as(
          "current_name",
        ),
      })
      .from(conversations)
      .innerJoin(channels, eq(channels.id, conversations.channel))
      .where(
        and(
          eq(conversations.conversationType, "whatsapp-group"),
          eq(channels.type, "evolution"),
          sql`${conversations.groupJid} IS NOT NULL`,
        ),
      )
      .groupBy(
        conversations.workspaceId,
        conversations.channel,
        conversations.groupJid,
      )
      .orderBy(
        asc(conversations.workspaceId),
        asc(conversations.channel),
        asc(conversations.groupJid),
      )
      .limit(limit)
      .offset(offset);

    return rows
      .filter(
        (row) =>
          !!row.workspaceId &&
          !!row.channelId &&
          !!row.groupJid &&
          row.groupJid.trim().length > 0,
      )
      .map((row) => ({
        workspaceId: row.workspaceId,
        channelId: row.channelId!,
        groupJid: row.groupJid!,
        currentName: row.currentName,
      }));
  }

  async listIdsByWorkspaceChannelGroup(
    workspaceId: string,
    channelId: string,
    groupJid: string,
  ): Promise<string[]> {
    if (!workspaceId || !channelId || !groupJid) return [];

    const db = createDatabaseConnection();
    const rows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, channelId),
          eq(conversations.groupJid, groupJid),
          eq(conversations.conversationType, "whatsapp-group"),
        ),
      );

    return rows.map((row) => row.id);
  }

  async updateNameByWorkspaceChannelGroup(
    workspaceId: string,
    channelId: string,
    groupJid: string,
    name: string,
  ): Promise<void> {
    if (!workspaceId || !channelId || !groupJid || !name) return;

    const db = createDatabaseConnection();

    await db
      .update(conversations)
      .set({ name })
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, channelId),
          eq(conversations.groupJid, groupJid),
          eq(conversations.conversationType, "whatsapp-group"),
        ),
      );
  }

  async belongsToWorkspace(
    conversationId: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!conversationId || !workspaceId) return false;

    const db = createDatabaseConnection();

    const [result] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    return !!result;
  }

  async retrieveForWorkspace(
    conversationId: string,
    workspaceId: string,
  ): Promise<Conversation | null> {
    if (!conversationId || !workspaceId) return null;

    const db = createDatabaseConnection();

    const [conversation] = await this.fullQuery(db).where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
      ),
    );

    if (!conversation) return null;
    return Conversation.fromRaw(conversation);
  }

  async retrieveWithParticipantsForWorkspace(
    conversationId: string,
    workspaceId: string,
  ): Promise<Conversation | null> {
    const conversation = await this.retrieveForWorkspace(
      conversationId,
      workspaceId,
    );
    if (!conversation) return null;

    if (!conversation.isInternal) {
      return conversation;
    }

    const db = createDatabaseConnection();

    const participantsResults = await db
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
        eq(internalConversationParticipants.conversationId, conversationId),
      );

    for (const p of participantsResults) {
      conversation.participants.push(
        InternalConversationParticipant.instance({
          id: p.id,
          conversationId: p.conversationId,
          userId: p.userId,
          userName: p.userName,
          userThumbnail: p.userThumbnail,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        }),
      );
    }

    return conversation;
  }

  async clearActiveFlows(channelId: string): Promise<number> {
    if (!channelId) return 0;

    const db = createDatabaseConnection();

    const result = await db
      .update(conversations)
      .set({
        activeFlowExecutionId: null,
        flowCompletedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.channel, channelId),
          isNotNull(conversations.activeFlowExecutionId),
        ),
      )
      .returning({ id: conversations.id });

    return result.length;
  }

  async countOpenAndActiveFlowsByChannel(
    channelId: string,
  ): Promise<{ openConversations: number; activeFlows: number }> {
    if (!channelId) return { openConversations: 0, activeFlows: 0 };

    const db = createDatabaseConnection();

    const [result] = await db
      .select({
        openConversations: sql<number>`COUNT(*) FILTER (WHERE ${conversations.status} IN ('open', 'waiting'))::int`,
        activeFlows: sql<number>`COUNT(*) FILTER (WHERE ${conversations.activeFlowExecutionId} IS NOT NULL)::int`,
      })
      .from(conversations)
      .where(eq(conversations.channel, channelId));

    return {
      openConversations: result?.openConversations ?? 0,
      activeFlows: result?.activeFlows ?? 0,
    };
  }

  async listByContact(
    partnerContactId: string,
    workspaceId: string,
  ): Promise<Conversation.Raw[]> {
    if (!partnerContactId || !workspaceId) return [];

    const db = createDatabaseConnection();

    const [partnerRow] = await db
      .select({ partnerId: partnerContacts.partnerId })
      .from(partnerContacts)
      .innerJoin(partners, eq(partnerContacts.partnerId, partners.id))
      .where(
        and(
          eq(partnerContacts.id, partnerContactId),
          eq(partners.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!partnerRow?.partnerId) return [];
    const partnerId = partnerRow.partnerId;

    const contactChannel = alias(channels, "contact_channel");
    const attendant = alias(users, "attendant_user");

    const rows = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        openedAt: conversations.openedAt,
        firstOpenedAt: conversations.firstOpenedAt,
        closedAt: conversations.closedAt,
        teaser: this.buildConversationTeaserSql("\"conversations\".\"id\"").as("teaser"),
        lastMessageCreatedAt: sql<number>`
          (
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
            ORDER BY m.created_at DESC
            LIMIT 1
          )
        `.as("last_message_time"),
        lastClientMessageCreatedAt: sql<number>`
          (
            SELECT m.created_at
            FROM ${messages} m
            WHERE m.conversation_id = ${conversations.id}
              AND m.sender_type = 'contact'
            ORDER BY m.created_at DESC
            LIMIT 1
          )
        `.as("last_client_message_time"),
        waitingAt: sql<number>`null`.as("waiting_at"),
        activeFlowExecutionId: conversations.activeFlowExecutionId,
        flowCompletedAt: conversations.flowCompletedAt,
        conversationType: conversations.conversationType,
        name: conversations.name,
        groupJid: conversations.groupJid,
        channelId: contactChannel.id,
        channelName: contactChannel.name,
        channelType: contactChannel.type,
        sectorId: sectors.id,
        sectorName: sectors.name,
        sectorColor: sectors.color,
        attendantId: attendant.id,
        attendantName: attendant.name,
        contactId: partnerContacts.id,
        contactValue: partnerContacts.value,
        contactName: partners.name,
        contactType: partnerContacts.type,
      })
      .from(conversations)
      .innerJoin(partnerContacts, eq(conversations.contact, partnerContacts.id))
      .innerJoin(partners, eq(partnerContacts.partnerId, partners.id))
      .leftJoin(contactChannel, eq(conversations.channel, contactChannel.id))
      .leftJoin(sectors, eq(conversations.sectorId, sectors.id))
      .leftJoin(attendant, eq(conversations.attendantId, attendant.id))
      .where(
        and(
          eq(partnerContacts.partnerId, partnerId),
          eq(conversations.workspaceId, workspaceId),
        ),
      )
      .orderBy(sql`last_message_time DESC NULLS LAST`)
      // TODO: adicionar paginacao quando necessario - 100 e suficiente para o historico atual
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      status: row.status as Conversation.Status | null,
      openedAt: row.openedAt,
      firstOpenedAt: row.firstOpenedAt,
      closedAt: row.closedAt,
      teaser: row.teaser ?? "",
      messageToView: 0,
      lastMessageCreatedAt: convertTimestampToDate(row.lastMessageCreatedAt),
      lastClientMessageCreatedAt: convertTimestampToDate(
        row.lastClientMessageCreatedAt,
      ),
      waitingAt: null,
      activeFlowExecutionId: row.activeFlowExecutionId,
      flowCompletedAt: row.flowCompletedAt,
      conversationType: (row.conversationType ??
        "external") as Conversation.Type,
      name: row.name,
      groupJid: row.groupJid,
      isFromReceivingNumber: false,
      contact: row.contactId
        ? {
            id: row.contactId,
            value: row.contactValue ?? "",
            name: row.contactName ?? "",
            type: (row.contactType ?? "whatsapp") as Channel.Type,
            acronym: (row.contactName ?? "?").charAt(0).toUpperCase(),
            thumbnail: "",
            username: "",
          }
        : null,
      attendant: row.attendantId
        ? {
            id: row.attendantId,
            name: row.attendantName ?? "",
          }
        : null,
      sector: row.sectorId
        ? {
            id: row.sectorId,
            name: row.sectorName ?? "",
            color: row.sectorColor ?? "#3B82F6",
          }
        : null,
      channel: row.channelId
        ? {
            id: row.channelId,
            name: row.channelName ?? "",
            type: row.channelType as Channel.Type,
          }
        : null,
      receivedChannel: null,
      participants: [],
    }));
  }

  async getCrossChannelIndicators(
    contactIds: string[],
    workspaceId: string,
  ): Promise<
    Array<{ contactId: string; newestOtherChannelMessageAt: number }>
  > {
    if (contactIds.length === 0) return [];

    const db = createDatabaseConnection();

    const results = await db.execute(
      this.buildCrossChannelIndicatorsQuery(contactIds, workspaceId),
    );

    return Array.from(results, (row) => {
      const r = row as {
        contactId: string;
        newestOtherChannelMessageAt: string;
      };
      return {
        contactId: r.contactId,
        newestOtherChannelMessageAt: Number(r.newestOtherChannelMessageAt),
      };
    });
  }

  private buildCrossChannelIndicatorsQuery(
    contactIds: string[],
    workspaceId: string,
  ): SQL {
    return sql`
      WITH origin_conversations AS (
        SELECT
          c_origin.id AS origin_conversation_id,
          c_origin.contact AS origin_contact_id,
          pc_origin.partner_id AS origin_partner_id
        FROM ${conversations} c_origin
        INNER JOIN ${partnerContacts} pc_origin
          ON pc_origin.id = c_origin.contact
        WHERE
          c_origin.contact = ANY(${contactIds})
          AND c_origin.workspace_id = ${workspaceId}
          AND c_origin.status IN ('open', 'waiting', 'expired')
          AND (
            c_origin.conversation_type = 'external'
            OR c_origin.conversation_type IS NULL
          )
      ),
      other_active_conversations AS (
        SELECT
          o.origin_contact_id,
          COALESCE(
            (
              SELECT m.created_at
              FROM ${messages} m
              WHERE m.conversation_id = c_other.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ),
            EXTRACT(EPOCH FROM c_other.opened_at)
          ) AS last_msg_at
        FROM origin_conversations o
        INNER JOIN ${conversations} c_other
          ON c_other.workspace_id = ${workspaceId}
          AND c_other.status IN ('open', 'waiting', 'expired')
          AND (
            c_other.conversation_type = 'external'
            OR c_other.conversation_type IS NULL
          )
          AND c_other.id != o.origin_conversation_id
        INNER JOIN ${partnerContacts} pc_other
          ON pc_other.id = c_other.contact
        WHERE
          c_other.contact = o.origin_contact_id
          OR pc_other.partner_id = o.origin_partner_id
      )
      SELECT
        origin_contact_id AS "contactId",
        MAX(last_msg_at) AS "newestOtherChannelMessageAt"
      FROM other_active_conversations
      GROUP BY origin_contact_id
    `;
  }

  static instance() {
    return new ConversationsDatabaseRepository();
  }
}
