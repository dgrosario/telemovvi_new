import { eq, sql } from "drizzle-orm";
import { CampaignMessage } from "../../domain/entities/campaign-message";
import { createDatabaseConnection } from "../database";
import { campaignMessages } from "../database/schemas";

export class CampaignMessagesDatabaseRepository {
  async createBatch(messages: CampaignMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const db = createDatabaseConnection();

    await db.insert(campaignMessages).values(
      messages.map((m) => ({
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

  async findByCampaign(campaignId: string): Promise<CampaignMessage[]> {
    if (!campaignId) return [];

    const db = createDatabaseConnection();

    const results = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.campaignId, campaignId));

    return results.map((m) =>
      CampaignMessage.fromRaw({
        id: m.id,
        campaignId: m.campaignId,
        variationLabel: m.variationLabel as CampaignMessage.VariationLabel,
        type: m.type as CampaignMessage.MessageType,
        content: m.content,
        templateName: m.templateName,
        variables: (m.variables as CampaignMessage.Variable[]) ?? [],
        sentCount: m.sentCount,
        createdAt: m.createdAt,
      })
    );
  }

  async retrieve(id: string): Promise<CampaignMessage | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [result] = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.id, id));

    if (!result) return null;

    return CampaignMessage.fromRaw({
      id: result.id,
      campaignId: result.campaignId,
      variationLabel: result.variationLabel as CampaignMessage.VariationLabel,
      type: result.type as CampaignMessage.MessageType,
      content: result.content,
      templateName: result.templateName,
      variables: (result.variables as CampaignMessage.Variable[]) ?? [],
      sentCount: result.sentCount,
      createdAt: result.createdAt,
    });
  }

  async incrementSentCount(id: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(campaignMessages)
      .set({
        sentCount: sql`${campaignMessages.sentCount} + 1`,
      })
      .where(eq(campaignMessages.id, id));
  }

  async update(message: CampaignMessage): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(campaignMessages)
      .set({
        content: message.content,
        templateName: message.templateName,
        variables: message.variables,
        sentCount: message.sentCount,
      })
      .where(eq(campaignMessages.id, message.id));
  }

  async deleteByCampaign(campaignId: string): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .delete(campaignMessages)
      .where(eq(campaignMessages.campaignId, campaignId));
  }

  static instance(): CampaignMessagesDatabaseRepository {
    return new CampaignMessagesDatabaseRepository();
  }
}
