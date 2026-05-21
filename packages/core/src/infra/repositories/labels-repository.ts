import { and, eq, inArray, ne } from "drizzle-orm";
import { Label } from "../../domain/entities/label";
import { createDatabaseConnection } from "../database";
import { labels } from "../database/schemas";

export class LabelsDatabaseRepository {
  async retrieve(labelId: string, workspaceId: string): Promise<Label | null> {
    const db = createDatabaseConnection();
    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.id, labelId), eq(labels.workspaceId, workspaceId)));

    if (!label) return null;

    return Label.instance(label);
  }

  async list(workspaceId: string): Promise<Label.Raw[]> {
    const db = createDatabaseConnection();

    const response = await db
      .select()
      .from(labels)
      .where(eq(labels.workspaceId, workspaceId))
      .orderBy(labels.name);

    return response;
  }

  async upsert(label: Label): Promise<void> {
    const db = createDatabaseConnection();

    const labelData = label.raw();

    await db
      .insert(labels)
      .values({
        id: labelData.id,
        name: labelData.name,
        color: labelData.color,
        workspaceId: labelData.workspaceId,
        createdAt: labelData.createdAt,
        updatedAt: labelData.updatedAt,
      })
      .onConflictDoUpdate({
        set: {
          name: labelData.name,
          color: labelData.color,
          updatedAt: new Date(),
        },
        target: labels.id,
      });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(labels)
      .where(and(eq(labels.id, id), eq(labels.workspaceId, workspaceId)));
  }

  async removeMany(ids: string[], workspaceId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(labels)
      .where(and(inArray(labels.id, ids), eq(labels.workspaceId, workspaceId)));
  }

  async exists(name: string, workspaceId: string, excludeId?: string): Promise<boolean> {
    const db = createDatabaseConnection();

    const conditions = [eq(labels.name, name), eq(labels.workspaceId, workspaceId)];

    if (excludeId) {
      conditions.push(ne(labels.id, excludeId));
    }

    const [existing] = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(...conditions));

    return !!existing;
  }

  static instance(): LabelsDatabaseRepository {
    return new LabelsDatabaseRepository();
  }
}
