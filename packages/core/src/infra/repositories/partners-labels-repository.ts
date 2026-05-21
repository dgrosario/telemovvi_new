import { and, eq, inArray } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import { labels, partners, partnersLabels } from "../database/schemas";
import { NotAuthorized } from "../../domain/errors/not-authorized";
import { NotFound } from "../../domain/errors/not-found";

export class PartnersLabelsDatabaseRepository {
  private async validatePartnerWorkspace(
    db: ReturnType<typeof createDatabaseConnection>,
    partnerId: string,
    workspaceId: string
  ): Promise<boolean> {
    const [partner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.id, partnerId), eq(partners.workspaceId, workspaceId)))
      .limit(1);

    return !!partner;
  }

  private async validateLabelsWorkspace(
    db: ReturnType<typeof createDatabaseConnection>,
    labelIds: string[],
    workspaceId: string
  ): Promise<boolean> {
    if (labelIds.length === 0) return true;

    const validLabels = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId)));

    return validLabels.length === labelIds.length;
  }

  async addLabelToPartner(
    partnerId: string,
    labelId: string,
    workspaceId: string
  ): Promise<void> {
    const db = createDatabaseConnection();

    const [partnerValid, labelsValid] = await Promise.all([
      this.validatePartnerWorkspace(db, partnerId, workspaceId),
      this.validateLabelsWorkspace(db, [labelId], workspaceId),
    ]);

    if (!partnerValid) {
      throw new NotFound("Partner");
    }

    if (!labelsValid) {
      throw new NotAuthorized("Labels do not belong to workspace");
    }

    await db
      .insert(partnersLabels)
      .values({ partnerId, labelId })
      .onConflictDoNothing();
  }

  async addLabelsToPartner(
    partnerId: string,
    labelIds: string[],
    workspaceId: string
  ): Promise<void> {
    if (labelIds.length === 0) return;

    const db = createDatabaseConnection();

    const [partnerValid, labelsValid] = await Promise.all([
      this.validatePartnerWorkspace(db, partnerId, workspaceId),
      this.validateLabelsWorkspace(db, labelIds, workspaceId),
    ]);

    if (!partnerValid) {
      throw new NotFound("Partner");
    }

    if (!labelsValid) {
      throw new NotAuthorized("Labels do not belong to workspace");
    }

    await db
      .insert(partnersLabels)
      .values(labelIds.map((labelId) => ({ partnerId, labelId })))
      .onConflictDoNothing();
  }

  async removeLabelFromPartner(
    partnerId: string,
    labelId: string,
    workspaceId: string
  ): Promise<void> {
    const db = createDatabaseConnection();

    const partnerValid = await this.validatePartnerWorkspace(db, partnerId, workspaceId);
    if (!partnerValid) {
      throw new NotFound("Partner");
    }

    await db
      .delete(partnersLabels)
      .where(
        and(
          eq(partnersLabels.partnerId, partnerId),
          eq(partnersLabels.labelId, labelId)
        )
      );
  }

  async removeAllLabelsFromPartner(
    partnerId: string,
    workspaceId: string
  ): Promise<void> {
    const db = createDatabaseConnection();

    const partnerValid = await this.validatePartnerWorkspace(db, partnerId, workspaceId);
    if (!partnerValid) {
      throw new NotFound("Partner");
    }

    await db
      .delete(partnersLabels)
      .where(eq(partnersLabels.partnerId, partnerId));
  }

  async setPartnerLabels(
    partnerId: string,
    labelIds: string[],
    workspaceId: string
  ): Promise<void> {
    const db = createDatabaseConnection();

    const [partnerValid, labelsValid] = await Promise.all([
      this.validatePartnerWorkspace(db, partnerId, workspaceId),
      this.validateLabelsWorkspace(db, labelIds, workspaceId),
    ]);

    if (!partnerValid) {
      throw new NotFound("Partner");
    }

    if (!labelsValid) {
      throw new NotAuthorized("Labels do not belong to workspace");
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(partnersLabels)
        .where(eq(partnersLabels.partnerId, partnerId));

      if (labelIds.length > 0) {
        await tx
          .insert(partnersLabels)
          .values(labelIds.map((labelId) => ({ partnerId, labelId })))
          .onConflictDoNothing();
      }
    });
  }

  async listLabelsByPartner(
    partnerId: string,
    workspaceId: string
  ): Promise<typeof labels.$inferSelect[]> {
    const db = createDatabaseConnection();

    const result = await db
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        workspaceId: labels.workspaceId,
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
      })
      .from(partnersLabels)
      .innerJoin(labels, eq(partnersLabels.labelId, labels.id))
      .innerJoin(partners, eq(partnersLabels.partnerId, partners.id))
      .where(
        and(
          eq(partnersLabels.partnerId, partnerId),
          eq(partners.workspaceId, workspaceId)
        )
      )
      .orderBy(labels.name);

    return result;
  }

  async listPartnerIdsByLabel(
    labelId: string,
    workspaceId: string
  ): Promise<string[]> {
    const db = createDatabaseConnection();

    const result = await db
      .select({ partnerId: partnersLabels.partnerId })
      .from(partnersLabels)
      .innerJoin(labels, eq(partnersLabels.labelId, labels.id))
      .where(
        and(
          eq(partnersLabels.labelId, labelId),
          eq(labels.workspaceId, workspaceId)
        )
      );

    return result.map((r) => r.partnerId);
  }

  async countPartnersByLabel(
    labelId: string,
    workspaceId: string
  ): Promise<number> {
    const db = createDatabaseConnection();

    const result = await db
      .select({ partnerId: partnersLabels.partnerId })
      .from(partnersLabels)
      .innerJoin(labels, eq(partnersLabels.labelId, labels.id))
      .where(
        and(
          eq(partnersLabels.labelId, labelId),
          eq(labels.workspaceId, workspaceId)
        )
      );

    return result.length;
  }

  static instance(): PartnersLabelsDatabaseRepository {
    return new PartnersLabelsDatabaseRepository();
  }
}
