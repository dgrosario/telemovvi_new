import { and, desc, eq, ilike, inArray, isNull, lt, not, or, InferSelectModel } from "drizzle-orm";
import { Message } from "../../domain/entities/message";
import type { Channel } from "../../domain/entities/channel";
import { Sender } from "../../domain/entities/sender";
import { createDatabaseConnection } from "../database";
import { channels, conversations, messages, partnerContacts, partners } from "../database/schemas";

type MessageRow = InferSelectModel<typeof messages>;

const MESSAGE_TYPES: readonly Message.Type[] = ["text", "audio", "image", "sticker", "document", "video", "template", "location"];
const SENDER_TYPES: readonly Sender.Type[] = ["attendant", "contact"];

function isMessageType(value: string | null): value is Message.Type {
  return value !== null && MESSAGE_TYPES.includes(value as Message.Type);
}

function isSenderType(value: string | null): value is Sender.Type {
  return value !== null && SENDER_TYPES.includes(value as Sender.Type);
}

export class MessagesDatabaseRepository {
  private timestampToDate(timestamp: number) {
    return new Date(timestamp * 1000);
  }

  private dateToTimestamp(date: Date) {
    return Math.floor(date.getTime() / 1000);
  }

  private mapRowToMessage(row: MessageRow): Message {
    const messageType = isMessageType(row.type) ? row.type : "text";
    const senderType = isSenderType(row.senderType) ? row.senderType : "attendant";

    return Message.instance({
      content: row.content,
      originalContent: row.originalContent ?? null,
      caption: row.caption,
      filename: row.filename,
      mimetype: row.mimetype,
      mediaKey: row.mediaKey,
      createdAt: this.timestampToDate(row.createdAt),
      id: row.id,
      internal: row.internal,
      sender: Sender.create(senderType, row.senderId, row.senderName),
      type: messageType,
      status: row.status,
      viewedAt: row.viewedAt ? this.timestampToDate(row.viewedAt) : null,
      deletedAt: row.deletedAt ? this.timestampToDate(row.deletedAt) : null,
      editedAt: row.editedAt ? this.timestampToDate(row.editedAt) : null,
      quotedMessageId: row.quotedMessageId ?? null,
      templateName: row.templateName ?? null,
      remoteJid: row.remoteJid ?? null,
    });
  }

  async upsert(message: Message, conversation?: string) {
    const db = createDatabaseConnection();

    let conversationId = conversation;

    if (!conversationId) {
      const [oldMessage] = await db
        .select({
          conversationId: messages.conversationId,
        })
        .from(messages)
        .where(eq(messages.id, message.id));

      if (!oldMessage?.conversationId) return;
      conversationId = oldMessage.conversationId;
    }

    await db
      .insert(messages)
      .values({
        content: message.content,
        originalContent: message.originalContent,
        caption: message.caption,
        filename: message.filename,
        mimetype: message.mimetype,
        mediaKey: message.mediaKey,
        createdAt: this.dateToTimestamp(message.createdAt),
        id: message.id,
        senderId: message.sender.id,
        internal: message.internal,
        senderName: message.sender.name,
        senderType: message.sender?.type,
        status: message.status,
        type: message.type,
        conversationId,
        viewedAt: message.viewedAt
          ? this.dateToTimestamp(message.viewedAt)
          : null,
        quotedMessageId: message.quotedMessageId,
        templateName: message.templateName,
        remoteJid: message.remoteJid,
      })
      .onConflictDoUpdate({
        set: {
          content: message.content,
          originalContent: message.originalContent,
          caption: message.caption,
          filename: message.filename,
          mimetype: message.mimetype,
          mediaKey: message.mediaKey,
          createdAt: this.dateToTimestamp(message.createdAt),
          senderId: message.sender.id,
          conversationId,
          internal: message.internal,
          senderName: message.sender.name,
          senderType: message.sender?.type,
          status: message.status,
          type: message.type,
          viewedAt: message.viewedAt
            ? this.dateToTimestamp(message.viewedAt)
            : null,
          quotedMessageId: message.quotedMessageId,
          templateName: message.templateName,
          remoteJid: message.remoteJid,
        },
        target: messages.id,
      });
  }

  async retrieve(messageId: string) {
    const db = createDatabaseConnection();
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));

    if (!message) return null;

    return this.mapRowToMessage(message);
  }

  async retrieveWithChannelId(
    messageId: string
  ): Promise<{ message: Message; channelId: string | null } | null> {
    const db = createDatabaseConnection();
    const [result] = await db
      .select({
        message: messages,
        channelId: conversations.channel,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(messages.id, messageId));

    if (!result) return null;

    return {
      message: this.mapRowToMessage(result.message),
      channelId: result.channelId,
    };
  }

  async list(conversationId: string) {
    const db = createDatabaseConnection();
    const messagesList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt));

    return messagesList.map((row) => this.mapRowToMessage(row).raw());
  }

  async listLastMessageToView(conversationId: string) {
    const db = createDatabaseConnection();
    const messagesList = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          not(eq(messages.status, "viewed")),
          eq(messages.senderType, "contact")
        )
      );

    return messagesList.map((row) => this.mapRowToMessage(row));
  }

  async retrieveConversationId(messageId: string) {
    const db = createDatabaseConnection();
    const [message] = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId));

    if (!message) return null;

    return message;
  }

  async resolveMessageReference(messageId: string, instanceName?: string) {
    const db = createDatabaseConnection();
    const candidateIds = [messageId];

    if (instanceName) {
      const instanceScopedMessageId = `${messageId}:${instanceName}`;
      if (instanceScopedMessageId !== messageId) {
        candidateIds.push(instanceScopedMessageId);
      }
    }

    for (const candidateId of candidateIds) {
      const [message] = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          workspaceId: conversations.workspaceId,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(eq(messages.id, candidateId));

      if (message) {
        return message;
      }
    }

    return null;
  }

  async listLastMessageFromContact(conversationId: string) {
    const db = createDatabaseConnection();
    const [message] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderType, "contact")
        )
      )
      .orderBy(desc(messages.createdAt));

    if (!message) return null;

    return this.mapRowToMessage(message);
  }

  async listMediaByContactId(contactId: string) {
    const db = createDatabaseConnection();

    const mediaTypes = ["image", "video", "document", "audio"] as const;
    type MediaType = (typeof mediaTypes)[number];

    function isMediaType(value: string | null): value is MediaType {
      return value !== null && mediaTypes.includes(value as MediaType);
    }

    const mediaMessages = await db
      .select({
        id: messages.id,
        type: messages.type,
        content: messages.content,
        filename: messages.filename,
        mimetype: messages.mimetype,
        caption: messages.caption,
        createdAt: messages.createdAt,
        conversationId: messages.conversationId,
        channelId: conversations.channel,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.contact, contactId),
          inArray(messages.type, [...mediaTypes])
        )
      )
      .orderBy(desc(messages.createdAt));

    return mediaMessages
      .filter((m): m is typeof m & { type: MediaType } => isMediaType(m.type))
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        filename: m.filename,
        mimetype: m.mimetype,
        caption: m.caption,
        createdAt: this.timestampToDate(m.createdAt),
        conversationId: m.conversationId,
        channelId: m.channelId,
      }));
  }

  async retrieveWithContact(messageId: string): Promise<{
    message: Message;
    contactValue: string;
  } | null> {
    const db = createDatabaseConnection();

    const [result] = await db
      .select({
        message: messages,
        contactValue: partnerContacts.value,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(partnerContacts, eq(conversations.contact, partnerContacts.id))
      .where(eq(messages.id, messageId));

    if (!result) return null;

    return {
      message: this.mapRowToMessage(result.message),
      contactValue: result.contactValue,
    };
  }

  async markAllAsViewedByConversation(conversationId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(messages)
      .set({ viewedAt: this.dateToTimestamp(new Date()) })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderType, "contact"),
          isNull(messages.viewedAt)
        )
      );
  }

  async listPaginated(options: {
    conversationId: string;
    limit: number;
    beforeId?: string;
  }): Promise<{
    messages: Message.Raw[];
    hasMore: boolean;
    oldestId: string | null;
  }> {
    const db = createDatabaseConnection();
    const { conversationId, limit, beforeId } = options;

    let cursorTimestamp: number | null = null;

    if (beforeId) {
      const [cursorMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, beforeId))
        .limit(1);

      if (cursorMessage) {
        cursorTimestamp = cursorMessage.createdAt;
      }
    }

    const filters = [eq(messages.conversationId, conversationId)];

    if (cursorTimestamp !== null) {
      filters.push(lt(messages.createdAt, cursorTimestamp));
    }

    const messagesList = await db
      .select()
      .from(messages)
      .where(and(...filters))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = messagesList.length > limit;
    const resultMessages = hasMore ? messagesList.slice(0, limit) : messagesList;

    const lastMessage = resultMessages[resultMessages.length - 1];
    const oldestId = lastMessage ? lastMessage.id : null;

    return {
      messages: resultMessages.map((row) => this.mapRowToMessage(row).raw()).reverse(),
      hasMore,
      oldestId,
    };
  }

  async updateMediaPath(messageId: string, mediaPath: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(messages)
      .set({ mediaPath })
      .where(eq(messages.id, messageId));
  }

  async softDelete(messageId: string, deletedAt: Date = new Date()): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(messages)
      .set({ deletedAt: this.dateToTimestamp(deletedAt) })
      .where(eq(messages.id, messageId));
  }

  async updateContent(
    messageId: string,
    newContent: string,
    editedAt: Date
  ): Promise<{ conversationId: string } | null> {
    const db = createDatabaseConnection();

    const [message] = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        originalContent: messages.originalContent,
      })
      .from(messages)
      .where(eq(messages.id, messageId));

    if (!message || !message.conversationId) return null;

    const originalContentToStore = message.originalContent ?? message.content;

    await db
      .update(messages)
      .set({
        content: newContent,
        editedAt: this.dateToTimestamp(editedAt),
        originalContent: originalContentToStore,
      })
      .where(eq(messages.id, messageId));

    return { conversationId: message.conversationId };
  }

  async searchInConversation(
    conversationId: string,
    searchTerm: string,
    limit: number = 50
  ): Promise<Message.Raw[]> {
    const db = createDatabaseConnection();
    const searchPattern = `%${searchTerm}%`;

    const results = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          or(
            ilike(messages.content, searchPattern),
            ilike(messages.caption, searchPattern)
          )
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return results.map((row) => this.mapRowToMessage(row).raw());
  }

  async loadMessagesUntilId(options: {
    conversationId: string;
    targetMessageId: string;
    currentOldestId?: string;
    batchSize?: number;
  }): Promise<{
    messages: Message.Raw[];
    hasMore: boolean;
    oldestId: string | null;
    targetFound: boolean;
  }> {
    const db = createDatabaseConnection();
    const { conversationId, targetMessageId, currentOldestId, batchSize = 100 } = options;

    const [targetMessage] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.id, targetMessageId),
          eq(messages.conversationId, conversationId)
        )
      )
      .limit(1);

    if (!targetMessage) {
      return {
        messages: [],
        hasMore: false,
        oldestId: null,
        targetFound: false,
      };
    }

    let cursorTimestamp: number | null = null;

    if (currentOldestId) {
      const [cursorMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, currentOldestId))
        .limit(1);

      if (cursorMessage) {
        cursorTimestamp = cursorMessage.createdAt;
      }
    }

    const filters = [
      eq(messages.conversationId, conversationId),
    ];

    if (cursorTimestamp !== null) {
      filters.push(lt(messages.createdAt, cursorTimestamp));
    }

    const allMessages: MessageRow[] = [];
    let hasMore = true;
    let lastTimestamp = cursorTimestamp;
    let targetFound = false;
    const maxIterations = 20;
    let iterations = 0;

    while (hasMore && !targetFound && iterations < maxIterations) {
      iterations++;
      const batchFilters = [eq(messages.conversationId, conversationId)];

      if (lastTimestamp !== null) {
        batchFilters.push(lt(messages.createdAt, lastTimestamp));
      }

      const batch = await db
        .select()
        .from(messages)
        .where(and(...batchFilters))
        .orderBy(desc(messages.createdAt))
        .limit(batchSize + 1);

      hasMore = batch.length > batchSize;
      const resultBatch = hasMore ? batch.slice(0, batchSize) : batch;

      allMessages.push(...resultBatch);

      targetFound = resultBatch.some(m => m.id === targetMessageId);

      const lastInBatch = resultBatch[resultBatch.length - 1];
      if (lastInBatch) {
        lastTimestamp = lastInBatch.createdAt;
      } else {
        hasMore = false;
      }
    }

    const lastMessage = allMessages[allMessages.length - 1];
    const oldestId = lastMessage ? lastMessage.id : null;

    return {
      messages: allMessages.map((row) => this.mapRowToMessage(row).raw()).reverse(),
      hasMore,
      oldestId,
      targetFound,
    };
  }

  async existsInDifferentConversation(
    messageId: string,
    targetConversationId: string
  ): Promise<{ exists: boolean; existingConversationId: string | null }> {
    const db = createDatabaseConnection();

    const [existing] = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!existing) {
      return { exists: false, existingConversationId: null };
    }

    if (existing.conversationId === targetConversationId) {
      return { exists: false, existingConversationId: null };
    }

    return { exists: true, existingConversationId: existing.conversationId };
  }

  async listForWorkspace(
    conversationId: string,
    workspaceId: string
  ): Promise<Message.Raw[]> {
    if (!conversationId || !workspaceId) return [];

    const db = createDatabaseConnection();

    const messagesList = await db
      .select({
        id: messages.id,
        content: messages.content,
        originalContent: messages.originalContent,
        caption: messages.caption,
        filename: messages.filename,
        mimetype: messages.mimetype,
        mediaKey: messages.mediaKey,
        mediaPath: messages.mediaPath,
        createdAt: messages.createdAt,
        internal: messages.internal,
        senderId: messages.senderId,
        senderName: messages.senderName,
        senderType: messages.senderType,
        type: messages.type,
        status: messages.status,
        conversationId: messages.conversationId,
        viewedAt: messages.viewedAt,
        deletedAt: messages.deletedAt,
        editedAt: messages.editedAt,
        quotedMessageId: messages.quotedMessageId,
        templateName: messages.templateName,
        remoteJid: messages.remoteJid,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(conversations.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(messages.createdAt));

    return messagesList.map((row) => this.mapRowToMessage(row as MessageRow).raw());
  }

  async listPaginatedForWorkspace(options: {
    conversationId: string;
    workspaceId: string;
    limit: number;
    beforeId?: string;
  }): Promise<{
    messages: Message.Raw[];
    hasMore: boolean;
    oldestId: string | null;
  }> {
    const db = createDatabaseConnection();
    const { conversationId, workspaceId, limit, beforeId } = options;

    if (!conversationId || !workspaceId) {
      return { messages: [], hasMore: false, oldestId: null };
    }

    let cursorTimestamp: number | null = null;

    if (beforeId) {
      const [cursorMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, beforeId))
        .limit(1);

      if (cursorMessage) {
        cursorTimestamp = cursorMessage.createdAt;
      }
    }

    const filters = [
      eq(messages.conversationId, conversationId),
      eq(conversations.workspaceId, workspaceId),
    ];

    if (cursorTimestamp !== null) {
      filters.push(lt(messages.createdAt, cursorTimestamp));
    }

    const messagesList = await db
      .select({
        id: messages.id,
        content: messages.content,
        originalContent: messages.originalContent,
        caption: messages.caption,
        filename: messages.filename,
        mimetype: messages.mimetype,
        mediaKey: messages.mediaKey,
        mediaPath: messages.mediaPath,
        createdAt: messages.createdAt,
        internal: messages.internal,
        senderId: messages.senderId,
        senderName: messages.senderName,
        senderType: messages.senderType,
        type: messages.type,
        status: messages.status,
        conversationId: messages.conversationId,
        viewedAt: messages.viewedAt,
        deletedAt: messages.deletedAt,
        editedAt: messages.editedAt,
        quotedMessageId: messages.quotedMessageId,
        templateName: messages.templateName,
        remoteJid: messages.remoteJid,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(...filters))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = messagesList.length > limit;
    const resultMessages = hasMore ? messagesList.slice(0, limit) : messagesList;

    const lastMessage = resultMessages[resultMessages.length - 1];
    const oldestId = lastMessage ? lastMessage.id : null;

    return {
      messages: resultMessages.map((row) => this.mapRowToMessage(row as MessageRow).raw()).reverse(),
      hasMore,
      oldestId,
    };
  }

  async listUntilIdForWorkspace(options: {
    conversationId: string;
    workspaceId: string;
    targetMessageId: string;
    currentOldestId?: string;
    batchSize?: number;
  }): Promise<{
    messages: Message.Raw[];
    hasMore: boolean;
    oldestId: string | null;
    targetFound: boolean;
  }> {
    const db = createDatabaseConnection();
    const { conversationId, workspaceId, targetMessageId, currentOldestId, batchSize = 100 } = options;

    if (!conversationId || !workspaceId) {
      return { messages: [], hasMore: false, oldestId: null, targetFound: false };
    }

    const [targetMessage] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.id, targetMessageId),
          eq(messages.conversationId, conversationId),
          eq(conversations.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!targetMessage) {
      return {
        messages: [],
        hasMore: false,
        oldestId: null,
        targetFound: false,
      };
    }

    let cursorTimestamp: number | null = null;

    if (currentOldestId) {
      const [cursorMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, currentOldestId))
        .limit(1);

      if (cursorMessage) {
        cursorTimestamp = cursorMessage.createdAt;
      }
    }

    let hasMore = true;
    let lastTimestamp = cursorTimestamp;
    let targetFound = false;
    const maxIterations = 20;
    let iterations = 0;

    const selectColumns = {
      id: messages.id,
      content: messages.content,
      originalContent: messages.originalContent,
      caption: messages.caption,
      filename: messages.filename,
      mimetype: messages.mimetype,
      mediaKey: messages.mediaKey,
      mediaPath: messages.mediaPath,
      createdAt: messages.createdAt,
      internal: messages.internal,
      senderId: messages.senderId,
      senderName: messages.senderName,
      senderType: messages.senderType,
      type: messages.type,
      status: messages.status,
      conversationId: messages.conversationId,
      viewedAt: messages.viewedAt,
      deletedAt: messages.deletedAt,
      editedAt: messages.editedAt,
      quotedMessageId: messages.quotedMessageId,
      templateName: messages.templateName,
      remoteJid: messages.remoteJid,
    };

    const allMessages: unknown[] = [];

    while (hasMore && !targetFound && iterations < maxIterations) {
      iterations++;

      const batchFilters = [
        eq(messages.conversationId, conversationId),
        eq(conversations.workspaceId, workspaceId),
      ];

      if (lastTimestamp !== null) {
        batchFilters.push(lt(messages.createdAt, lastTimestamp));
      }

      const batch = await db
        .select(selectColumns)
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(and(...batchFilters))
        .orderBy(desc(messages.createdAt))
        .limit(batchSize + 1);

      hasMore = batch.length > batchSize;
      const resultBatch = hasMore ? batch.slice(0, batchSize) : batch;

      allMessages.push(...resultBatch);

      targetFound = resultBatch.some(m => m.id === targetMessageId);

      const lastInBatch = resultBatch[resultBatch.length - 1];
      if (lastInBatch) {
        lastTimestamp = lastInBatch.createdAt;
      } else {
        hasMore = false;
      }
    }

    const lastMessage = allMessages[allMessages.length - 1] as MessageRow | undefined;
    const oldestId = lastMessage ? lastMessage.id : null;

    return {
      messages: allMessages.map((row) => this.mapRowToMessage(row as MessageRow).raw()).reverse(),
      hasMore,
      oldestId,
      targetFound,
    };
  }

  async listPaginatedByContact(options: {
    contactId: string;
    workspaceId: string;
    limit: number;
    beforeId?: string;
  }): Promise<{
    messages: Message.GroupedRaw[];
    hasMore: boolean;
  }> {
    const db = createDatabaseConnection();
    const { contactId, workspaceId, limit, beforeId } = options;

    if (!contactId || !workspaceId) {
      return { messages: [], hasMore: false };
    }

    const [partnerRow] = await db
      .select({ partnerId: partnerContacts.partnerId })
      .from(partnerContacts)
      .innerJoin(partners, eq(partnerContacts.partnerId, partners.id))
      .where(
        and(
          eq(partnerContacts.id, contactId),
          eq(partners.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!partnerRow?.partnerId) {
      return { messages: [], hasMore: false };
    }

    const allPartnerContacts = await db
      .select({ id: partnerContacts.id })
      .from(partnerContacts)
      .where(eq(partnerContacts.partnerId, partnerRow.partnerId));

    const contactIds = allPartnerContacts.map((pc) => pc.id);

    if (contactIds.length === 0) {
      return { messages: [], hasMore: false };
    }

    let cursorTimestamp: number | null = null;

    if (beforeId) {
      const [cursorMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, beforeId))
        .limit(1);

      if (cursorMessage) {
        cursorTimestamp = cursorMessage.createdAt;
      }
    }

    const filters = [
      inArray(conversations.contact, contactIds),
      eq(conversations.workspaceId, workspaceId),
      or(
        eq(conversations.conversationType, "external"),
        isNull(conversations.conversationType)
      ),
    ];

    if (cursorTimestamp !== null) {
      filters.push(lt(messages.createdAt, cursorTimestamp));
    }

    const rows = await db
      .select({
        id: messages.id,
        content: messages.content,
        originalContent: messages.originalContent,
        caption: messages.caption,
        filename: messages.filename,
        mimetype: messages.mimetype,
        mediaKey: messages.mediaKey,
        mediaPath: messages.mediaPath,
        createdAt: messages.createdAt,
        internal: messages.internal,
        senderId: messages.senderId,
        senderName: messages.senderName,
        senderType: messages.senderType,
        type: messages.type,
        status: messages.status,
        conversationId: messages.conversationId,
        viewedAt: messages.viewedAt,
        deletedAt: messages.deletedAt,
        editedAt: messages.editedAt,
        quotedMessageId: messages.quotedMessageId,
        templateName: messages.templateName,
        remoteJid: messages.remoteJid,
        channelType: channels.type,
        channelName: channels.name,
        channelId: channels.id,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .leftJoin(channels, eq(conversations.channel, channels.id))
      .where(and(...filters))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const groupedMessages: Message.GroupedRaw[] = resultRows
      .map((row) => {
        const { channelType, channelName, channelId, ...messageFields } = row;
        return {
          ...this.mapRowToMessage(messageFields as MessageRow).raw(),
          channel: channelId && channelType && channelName
            ? { id: channelId, type: channelType as Channel.Type, name: channelName }
            : null,
        };
      })
      .reverse();

    return {
      messages: groupedMessages,
      hasMore,
    };
  }

  static instance() {
    return new MessagesDatabaseRepository();
  }
}
