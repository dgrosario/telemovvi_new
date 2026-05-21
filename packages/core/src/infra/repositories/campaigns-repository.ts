import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { Campaign } from "../../domain/entities/campaign";
import { CampaignMessage } from "../../domain/entities/campaign-message";
import { CampaignRecipient } from "../../domain/entities/campaign-recipient";
import { createDatabaseConnection } from "../database";
import {
  campaigns,
  campaignMessages,
  campaignRecipients,
  partners,
  partnerContacts,
} from "../database/schemas";

const campaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "running",
  "completed",
  "cancelled",
  "failed",
]);

const variationLabelSchema = z.enum(["A", "B", "C"]);

const messageTypeSchema = z.enum(["text", "template"]);

const variableSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const campaignMessageSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  variationLabel: variationLabelSchema,
  type: messageTypeSchema,
  content: z.string().nullable(),
  templateName: z.string().nullable(),
  variables: z.array(variableSchema).nullable().default([]),
  sentCount: z.number(),
  createdAt: z.date(),
});

const campaignTypeSchema = z.enum(["manual", "birthday"]);

const campaignDbSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  channelId: z.string(),
  name: z.string(),
  type: campaignTypeSchema,
  status: campaignStatusSchema,
  filterLabelIds: z.array(z.string()).nullable().default([]),
  minIntervalMs: z.number(),
  maxIntervalMs: z.number(),
  scheduledAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdBy: z.string().nullable(),
  totalRecipients: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ListCampaignsInputDTO = {
  workspaceId: string;
  status?: Campaign.Status[];
  pageIndex?: number;
  pageSize?: number;
};

export type ListCampaignsOutputDTO = {
  campaigns: Campaign[];
  total: number;
  pageIndex: number;
  pageSize: number;
};

export class CampaignsDatabaseRepository {
  private parseCampaignFromDb(
    campaignData: unknown,
    messagesData: unknown[]
  ): Campaign {
    const parsedCampaign = campaignDbSchema.parse(campaignData);
    const parsedMessages = messagesData.map((m) => campaignMessageSchema.parse(m));

    return Campaign.fromRaw({
      id: parsedCampaign.id,
      workspaceId: parsedCampaign.workspaceId,
      channelId: parsedCampaign.channelId,
      name: parsedCampaign.name,
      type: parsedCampaign.type,
      status: parsedCampaign.status,
      filterLabelIds: parsedCampaign.filterLabelIds ?? [],
      minIntervalMs: parsedCampaign.minIntervalMs,
      maxIntervalMs: parsedCampaign.maxIntervalMs,
      scheduledAt: parsedCampaign.scheduledAt,
      startedAt: parsedCampaign.startedAt,
      completedAt: parsedCampaign.completedAt,
      createdBy: parsedCampaign.createdBy,
      totalRecipients: parsedCampaign.totalRecipients,
      sentCount: parsedCampaign.sentCount,
      failedCount: parsedCampaign.failedCount,
      messages: parsedMessages.map((m) => ({
        id: m.id,
        campaignId: m.campaignId,
        variationLabel: m.variationLabel,
        type: m.type,
        content: m.content,
        templateName: m.templateName,
        variables: m.variables ?? [],
        sentCount: m.sentCount,
        createdAt: m.createdAt,
      })),
      createdAt: parsedCampaign.createdAt,
      updatedAt: parsedCampaign.updatedAt,
    });
  }

  async list(input: ListCampaignsInputDTO): Promise<ListCampaignsOutputDTO> {
    if (!input.workspaceId) {
      return { campaigns: [], total: 0, pageIndex: 0, pageSize: 20 };
    }

    const db = createDatabaseConnection();
    const pageSize = input.pageSize ?? 20;
    const pageIndex = input.pageIndex ?? 0;
    const offset = pageIndex * pageSize;

    const conditions = [eq(campaigns.workspaceId, input.workspaceId)];

    if (input.status && input.status.length > 0) {
      conditions.push(inArray(campaigns.status, input.status));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    const campaignsList = await db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (campaignsList.length === 0) {
      return { campaigns: [], total, pageIndex, pageSize };
    }

    const campaignIds = campaignsList.map((c) => c.id);
    const allMessages = await db
      .select()
      .from(campaignMessages)
      .where(inArray(campaignMessages.campaignId, campaignIds));

    const messagesByCampaignId = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const existing = messagesByCampaignId.get(msg.campaignId) ?? [];
      existing.push(msg);
      messagesByCampaignId.set(msg.campaignId, existing);
    }

    const campaignsWithMessages = campaignsList.map((c) => {
      const messagesData = messagesByCampaignId.get(c.id) ?? [];
      return this.parseCampaignFromDb(c, messagesData);
    });

    return {
      campaigns: campaignsWithMessages,
      total,
      pageIndex,
      pageSize,
    };
  }

  async retrieve(id: string): Promise<Campaign | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [campaignData] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));

    if (!campaignData) return null;

    const messagesData = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.campaignId, id));

    return this.parseCampaignFromDb(campaignData, messagesData);
  }

  async retrieveByWorkspace(
    id: string,
    workspaceId: string
  ): Promise<Campaign | null> {
    if (!id || !workspaceId) return null;

    const db = createDatabaseConnection();

    const [campaignData] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId)));

    if (!campaignData) return null;

    const messagesData = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.campaignId, id));

    return this.parseCampaignFromDb(campaignData, messagesData);
  }

  async create(campaign: Campaign): Promise<void> {
    const db = createDatabaseConnection();

    await db.transaction(async (tx) => {
      await tx.insert(campaigns).values({
        id: campaign.id,
        workspaceId: campaign.workspaceId,
        channelId: campaign.channelId,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        filterLabelIds: campaign.filterLabelIds,
        minIntervalMs: campaign.minIntervalMs,
        maxIntervalMs: campaign.maxIntervalMs,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        createdBy: campaign.createdBy,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      });

      if (campaign.messages.length > 0) {
        await tx.insert(campaignMessages).values(
          campaign.messages.map((m) => ({
            id: m.id,
            campaignId: m.campaignId,
            variationLabel: m.variationLabel,
            type: m.type,
            content: m.content,
            templateName: m.templateName,
            variables: m.variables,
            sentCount: m.sentCount,
            createdAt: m.createdAt,
          }))
        );
      }
    });
  }

  async createWithRecipients(
    campaign: Campaign,
    recipients: CampaignRecipient[]
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db.transaction(async (tx) => {
      await tx.insert(campaigns).values({
        id: campaign.id,
        workspaceId: campaign.workspaceId,
        channelId: campaign.channelId,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        filterLabelIds: campaign.filterLabelIds,
        minIntervalMs: campaign.minIntervalMs,
        maxIntervalMs: campaign.maxIntervalMs,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        createdBy: campaign.createdBy,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      });

      if (campaign.messages.length > 0) {
        await tx.insert(campaignMessages).values(
          campaign.messages.map((m) => ({
            id: m.id,
            campaignId: m.campaignId,
            variationLabel: m.variationLabel,
            type: m.type,
            content: m.content,
            templateName: m.templateName,
            variables: m.variables,
            sentCount: m.sentCount,
            createdAt: m.createdAt,
          }))
        );
      }

      if (recipients.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          await tx.insert(campaignRecipients).values(
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
    });
  }

  async update(campaign: Campaign): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(campaigns)
      .set({
        name: campaign.name,
        status: campaign.status,
        filterLabelIds: campaign.filterLabelIds,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        updatedAt: campaign.updatedAt,
      })
      .where(eq(campaigns.id, campaign.id));
  }

  async incrementCounters(
    id: string,
    sentDelta: number,
    failedDelta: number
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(campaigns)
      .set({
        sentCount: sql`${campaigns.sentCount} + ${sentDelta}`,
        failedCount: sql`${campaigns.failedCount} + ${failedDelta}`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));
  }

  async updateStatus(id: string, status: Campaign.Status): Promise<void> {
    const db = createDatabaseConnection();

    const now = new Date();

    type CampaignStatusUpdate = {
      status: Campaign.Status;
      updatedAt: Date;
      startedAt?: Date;
      completedAt?: Date;
    };

    const updates: CampaignStatusUpdate = {
      status,
      updatedAt: now,
    };

    if (status === "running") {
      updates.startedAt = now;
    } else if (
      status === "completed" ||
      status === "cancelled" ||
      status === "failed"
    ) {
      updates.completedAt = now;
    }

    await db.update(campaigns).set(updates).where(eq(campaigns.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  async retrieveScheduledCampaigns(beforeDate: Date): Promise<Campaign[]> {
    const db = createDatabaseConnection();

    const scheduledList = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "scheduled"),
          lte(campaigns.scheduledAt, beforeDate)
        )
      );

    if (scheduledList.length === 0) return [];

    const campaignIds = scheduledList.map((c) => c.id);
    const allMessages = await db
      .select()
      .from(campaignMessages)
      .where(inArray(campaignMessages.campaignId, campaignIds));

    const messagesByCampaignId = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const existing = messagesByCampaignId.get(msg.campaignId) ?? [];
      existing.push(msg);
      messagesByCampaignId.set(msg.campaignId, existing);
    }

    return scheduledList.map((c) => {
      const messagesData = messagesByCampaignId.get(c.id) ?? [];
      return this.parseCampaignFromDb(c, messagesData);
    });
  }

  async listRunningCampaigns(): Promise<Campaign[]> {
    const db = createDatabaseConnection();

    const runningList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "running"))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    if (runningList.length === 0) return [];

    const campaignIds = runningList.map((c) => c.id);
    const allMessages = await db
      .select()
      .from(campaignMessages)
      .where(inArray(campaignMessages.campaignId, campaignIds));

    const messagesByCampaignId = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const existing = messagesByCampaignId.get(msg.campaignId) ?? [];
      existing.push(msg);
      messagesByCampaignId.set(msg.campaignId, existing);
    }

    return runningList.map((c) => {
      const messagesData = messagesByCampaignId.get(c.id) ?? [];
      return this.parseCampaignFromDb(c, messagesData);
    });
  }

  async listRunningBirthdayCampaigns(): Promise<Campaign[]> {
    const db = createDatabaseConnection();

    const runningList = await db
      .select()
      .from(campaigns)
      .where(
        and(eq(campaigns.status, "running"), eq(campaigns.type, "birthday"))
      )
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    if (runningList.length === 0) return [];

    const campaignIds = runningList.map((c) => c.id);
    const allMessages = await db
      .select()
      .from(campaignMessages)
      .where(inArray(campaignMessages.campaignId, campaignIds));

    const messagesByCampaignId = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const existing = messagesByCampaignId.get(msg.campaignId) ?? [];
      existing.push(msg);
      messagesByCampaignId.set(msg.campaignId, existing);
    }

    return runningList.map((c) => {
      const messagesData = messagesByCampaignId.get(c.id) ?? [];
      return this.parseCampaignFromDb(c, messagesData);
    });
  }

  static instance(): CampaignsDatabaseRepository {
    return new CampaignsDatabaseRepository();
  }
}
