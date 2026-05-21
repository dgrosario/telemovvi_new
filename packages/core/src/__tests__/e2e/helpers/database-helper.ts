import { eq, and, desc, like, sql } from "drizzle-orm";
import { createDatabaseConnection } from "../../../infra/database";
import {
  conversations,
  messages,
  partnerContacts,
  partners,
} from "../../../infra/database/schemas";
import { waitFor, WaitForOptions } from "../utils/wait-for";

export type DbMessage = {
  id: string;
  content: string;
  caption: string | null;
  filename: string | null;
  mimetype: string | null;
  createdAt: number;
  viewedAt: number | null;
  type: string | null;
  status: string;
  senderType: string | null;
  senderName: string;
  senderId: string;
  internal: boolean;
  conversationId: string | null;
};

export type DbConversation = {
  id: string;
  channel: string | null;
  sectorId: string | null;
  contact: string | null;
  attendantId: string | null;
  status: string | null;
  workspaceId: string;
  activeFlowExecutionId: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  receivedChannelId: string | null;
  conversationType: string;
  name: string | null;
};

export type DbContact = {
  id: string;
  type: string;
  value: string;
  thumbnail: string | null;
  partnerId: string;
};

export class DatabaseHelper {
  private db = createDatabaseConnection();

  async findMessageById(messageId: string): Promise<DbMessage | null> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    return row || null;
  }

  async findMessagesByConversationId(
    conversationId: string,
    limit = 50
  ): Promise<DbMessage[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows;
  }

  async findConversationByContact(
    phoneNumber: string,
    channelId?: string
  ): Promise<DbConversation | null> {
    const cleanedNumber = phoneNumber.replace(/\D/g, "");

    const contactRows = await this.db
      .select()
      .from(partnerContacts)
      .where(like(partnerContacts.value, `%${cleanedNumber}%`))
      .limit(1);

    if (contactRows.length === 0) {
      return null;
    }

    const contact = contactRows[0]!;

    let query = this.db
      .select()
      .from(conversations)
      .where(eq(conversations.contact, contact.id));

    if (channelId) {
      query = this.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.contact, contact.id),
            eq(conversations.channel, channelId)
          )
        );
    }

    const convRows = await query.orderBy(desc(conversations.openedAt)).limit(1);

    return convRows[0] || null;
  }

  async findConversationById(conversationId: string): Promise<DbConversation | null> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return row || null;
  }

  async findOpenConversationByContact(
    phoneNumber: string,
    channelId: string
  ): Promise<DbConversation | null> {
    const cleanedNumber = phoneNumber.replace(/\D/g, "");

    const contactRows = await this.db
      .select()
      .from(partnerContacts)
      .where(like(partnerContacts.value, `%${cleanedNumber}%`))
      .limit(1);

    if (contactRows.length === 0) {
      return null;
    }

    const contact = contactRows[0]!;

    const [row] = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.contact, contact.id),
          eq(conversations.channel, channelId),
          sql`${conversations.status} IN ('open', 'waiting')`
        )
      )
      .limit(1);

    return row || null;
  }

  async waitForMessage(
    conversationId: string,
    predicate: (msg: DbMessage) => boolean,
    options?: WaitForOptions
  ): Promise<DbMessage> {
    return waitFor(
      async () => {
        const messages = await this.findMessagesByConversationId(conversationId);
        const match = messages.find(predicate);
        return match || null;
      },
      {
        timeout: options?.timeout ?? 30000,
        interval: options?.interval ?? 1000,
        timeoutMessage: `Message not found in conversation ${conversationId} within timeout`,
      }
    );
  }

  async waitForConversation(
    phoneNumber: string,
    channelId: string,
    options?: WaitForOptions
  ): Promise<DbConversation> {
    return waitFor(
      async () => {
        return this.findOpenConversationByContact(phoneNumber, channelId);
      },
      {
        timeout: options?.timeout ?? 30000,
        interval: options?.interval ?? 1000,
        timeoutMessage: `Conversation not found for contact ${phoneNumber} within timeout`,
      }
    );
  }

  async cleanupTestData(phoneNumber: string): Promise<{
    contactsDeleted: number;
    partnersDeleted: number;
  }> {
    const cleanedNumber = phoneNumber.replace(/\D/g, "");

    const contactRows = await this.db
      .select({ id: partnerContacts.id, partnerId: partnerContacts.partnerId })
      .from(partnerContacts)
      .where(like(partnerContacts.value, `%${cleanedNumber}%`));

    if (contactRows.length === 0) {
      return { contactsDeleted: 0, partnersDeleted: 0 };
    }

    const partnerIds = [...new Set(contactRows.map((c) => c.partnerId))];
    const contactIds = contactRows.map((c) => c.id);

    for (const contactId of contactIds) {
      await this.db
        .delete(conversations)
        .where(eq(conversations.contact, contactId));
    }

    const contactResult = await this.db
      .delete(partnerContacts)
      .where(like(partnerContacts.value, `%${cleanedNumber}%`))
      .returning();

    let partnersDeleted = 0;
    for (const partnerId of partnerIds) {
      const remainingContacts = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(partnerContacts)
        .where(eq(partnerContacts.partnerId, partnerId));

      if (remainingContacts[0]?.count === 0) {
        await this.db.delete(partners).where(eq(partners.id, partnerId));
        partnersDeleted++;
      }
    }

    return {
      contactsDeleted: contactResult.length,
      partnersDeleted,
    };
  }

  async getConversationMessageCount(conversationId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    return result?.count ?? 0;
  }

  static instance(): DatabaseHelper {
    return new DatabaseHelper();
  }
}
