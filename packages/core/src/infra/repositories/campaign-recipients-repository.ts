import { and, eq, inArray, sql } from "drizzle-orm";
import { CampaignRecipient } from "../../domain/entities/campaign-recipient";
import { createDatabaseConnection } from "../database";
import {
  campaignRecipients,
  partners,
  partnerContacts,
} from "../database/schemas";

export type RecipientWithContact = {
  recipient: CampaignRecipient;
  partnerName: string;
  contactValue: string;
  contactType: string;
};

export type CountByStatusOutput = {
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type RecipientUpdateData = {
  id: string;
  messageId: string | null;
  status: CampaignRecipient.Status;
  externalMessageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
};

export class CampaignRecipientsDatabaseRepository {
  async createBatch(recipients: CampaignRecipient[]): Promise<void> {
    if (recipients.length === 0) return;

    const db = createDatabaseConnection();
    const BATCH_SIZE = 500;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await db.insert(campaignRecipients).values(
        batch.map((r) => ({
          id: r.id,
          campaignId: r.campaignId,
          partnerId: r.partnerId,
          partnerContactId: r.partnerContactId,
          messageId: r.messageId,
          status: r.status,
          externalMessageId: r.externalMessageId,
          errorMessage: r.errorMessage,
          sentAt: r.sentAt,
          createdAt: r.createdAt,
        }))
      );
    }
  }

  async findPendingByCampaign(
    campaignId: string,
    limit: number
  ): Promise<RecipientWithContact[]> {
    if (!campaignId) return [];

    const db = createDatabaseConnection();

    const results = await db
      .select({
        id: campaignRecipients.id,
        campaignId: campaignRecipients.campaignId,
        partnerId: campaignRecipients.partnerId,
        partnerContactId: campaignRecipients.partnerContactId,
        messageId: campaignRecipients.messageId,
        status: campaignRecipients.status,
        externalMessageId: campaignRecipients.externalMessageId,
        errorMessage: campaignRecipients.errorMessage,
        sentAt: campaignRecipients.sentAt,
        createdAt: campaignRecipients.createdAt,
        partnerName: partners.name,
        contactValue: partnerContacts.value,
        contactType: partnerContacts.type,
      })
      .from(campaignRecipients)
      .innerJoin(partners, eq(campaignRecipients.partnerId, partners.id))
      .innerJoin(
        partnerContacts,
        eq(campaignRecipients.partnerContactId, partnerContacts.id)
      )
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "pending")
        )
      )
      .limit(limit);

    return results.map((r) => ({
      recipient: CampaignRecipient.fromRaw({
        id: r.id,
        campaignId: r.campaignId,
        partnerId: r.partnerId,
        partnerContactId: r.partnerContactId,
        messageId: r.messageId,
        status: r.status as CampaignRecipient.Status,
        externalMessageId: r.externalMessageId,
        errorMessage: r.errorMessage,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
      }),
      partnerName: r.partnerName,
      contactValue: r.contactValue,
      contactType: r.contactType,
    }));
  }

  async update(recipient: CampaignRecipient): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(campaignRecipients)
      .set({
        messageId: recipient.messageId,
        status: recipient.status,
        externalMessageId: recipient.externalMessageId,
        errorMessage: recipient.errorMessage,
        sentAt: recipient.sentAt,
      })
      .where(eq(campaignRecipients.id, recipient.id));
  }

  async updateBatch(recipients: RecipientUpdateData[]): Promise<void> {
    if (recipients.length === 0) return;

    const db = createDatabaseConnection();

    await db.transaction(async (tx) => {
      for (const recipient of recipients) {
        await tx
          .update(campaignRecipients)
          .set({
            messageId: recipient.messageId,
            status: recipient.status,
            externalMessageId: recipient.externalMessageId,
            errorMessage: recipient.errorMessage,
            sentAt: recipient.sentAt,
          })
          .where(eq(campaignRecipients.id, recipient.id));
      }
    });
  }

  async hasPendingByCampaign(campaignId: string): Promise<boolean> {
    if (!campaignId) return false;

    const db = createDatabaseConnection();

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "pending")
        )
      );

    return Number(result?.count ?? 0) > 0;
  }

  async countByStatus(campaignId: string): Promise<CountByStatusOutput> {
    if (!campaignId) {
      return { pending: 0, sent: 0, failed: 0, skipped: 0 };
    }

    const db = createDatabaseConnection();

    const results = await db
      .select({
        status: campaignRecipients.status,
        count: sql<number>`count(*)`,
      })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId))
      .groupBy(campaignRecipients.status);

    const counts: CountByStatusOutput = {
      pending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const row of results) {
      const status = row.status as CampaignRecipient.Status;
      counts[status] = Number(row.count);
    }

    return counts;
  }

  async listByCampaign(
    campaignId: string,
    options?: {
      status?: CampaignRecipient.Status;
      pageIndex?: number;
      pageSize?: number;
    }
  ): Promise<{ recipients: RecipientWithContact[]; total: number }> {
    if (!campaignId) {
      return { recipients: [], total: 0 };
    }

    const db = createDatabaseConnection();
    const pageSize = options?.pageSize ?? 50;
    const pageIndex = options?.pageIndex ?? 0;
    const offset = pageIndex * pageSize;

    const conditions = [eq(campaignRecipients.campaignId, campaignId)];

    if (options?.status) {
      conditions.push(eq(campaignRecipients.status, options.status));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaignRecipients)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    const results = await db
      .select({
        id: campaignRecipients.id,
        campaignId: campaignRecipients.campaignId,
        partnerId: campaignRecipients.partnerId,
        partnerContactId: campaignRecipients.partnerContactId,
        messageId: campaignRecipients.messageId,
        status: campaignRecipients.status,
        externalMessageId: campaignRecipients.externalMessageId,
        errorMessage: campaignRecipients.errorMessage,
        sentAt: campaignRecipients.sentAt,
        createdAt: campaignRecipients.createdAt,
        partnerName: partners.name,
        contactValue: partnerContacts.value,
        contactType: partnerContacts.type,
      })
      .from(campaignRecipients)
      .innerJoin(partners, eq(campaignRecipients.partnerId, partners.id))
      .innerJoin(
        partnerContacts,
        eq(campaignRecipients.partnerContactId, partnerContacts.id)
      )
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);

    return {
      recipients: results.map((r) => ({
        recipient: CampaignRecipient.fromRaw({
          id: r.id,
          campaignId: r.campaignId,
          partnerId: r.partnerId,
          partnerContactId: r.partnerContactId,
          messageId: r.messageId,
          status: r.status as CampaignRecipient.Status,
          externalMessageId: r.externalMessageId,
          errorMessage: r.errorMessage,
          sentAt: r.sentAt,
          createdAt: r.createdAt,
        }),
        partnerName: r.partnerName,
        contactValue: r.contactValue,
        contactType: r.contactType,
      })),
      total,
    };
  }

  async findExistingPartnerIds(
    campaignId: string,
    partnerIds: string[]
  ): Promise<Set<string>> {
    if (!campaignId || partnerIds.length === 0) return new Set();

    const db = createDatabaseConnection();

    const results = await db
      .select({ partnerId: campaignRecipients.partnerId })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          inArray(campaignRecipients.partnerId, partnerIds)
        )
      );

    return new Set(results.map((r) => r.partnerId));
  }

  async updateExternalMessageId(
    recipientId: string,
    externalMessageId: string
  ): Promise<void> {
    if (!recipientId) return;

    const db = createDatabaseConnection();

    await db
      .update(campaignRecipients)
      .set({ externalMessageId })
      .where(eq(campaignRecipients.id, recipientId));
  }

  static instance(): CampaignRecipientsDatabaseRepository {
    return new CampaignRecipientsDatabaseRepository();
  }
}
