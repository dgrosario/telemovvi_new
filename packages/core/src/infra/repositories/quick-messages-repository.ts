import { and, eq, or, ilike } from "drizzle-orm";
import { QuickMessage } from "../../domain/entities/quick-message";
import { createDatabaseConnection } from "../database";
import { quickMessages } from "../database/schemas";

export class QuickMessagesDatabaseRepository {
  async create(quickMessage: QuickMessage): Promise<QuickMessage> {
    const db = createDatabaseConnection();

    const [inserted] = await db
      .insert(quickMessages)
      .values({
        id: quickMessage.id,
        shortcode: quickMessage.shortcode,
        message: quickMessage.message,
        mediaUrl: quickMessage.mediaUrl,
        mediaType: quickMessage.mediaType,
        mediaName: quickMessage.mediaName,
        isPublic: quickMessage.isPublic,
        userId: quickMessage.userId,
        workspaceId: quickMessage.workspaceId,
        createdAt: quickMessage.createdAt,
        updatedAt: quickMessage.updatedAt,
      })
      .returning();

    return QuickMessage.instance({
      id: inserted!.id,
      shortcode: inserted!.shortcode,
      message: inserted!.message,
      mediaUrl: inserted!.mediaUrl,
      mediaType: inserted!.mediaType as QuickMessage.MediaType | null,
      mediaName: inserted!.mediaName,
      isPublic: inserted!.isPublic,
      userId: inserted!.userId,
      workspaceId: inserted!.workspaceId,
      createdAt: inserted!.createdAt,
      updatedAt: inserted!.updatedAt,
    });
  }

  async update(
    id: string,
    data: Partial<QuickMessage.CreateProps>
  ): Promise<QuickMessage | null> {
    const db = createDatabaseConnection();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.shortcode !== undefined)
      updateData.shortcode = data.shortcode.toLowerCase().replace(/^\//, "");
    if (data.message !== undefined) updateData.message = data.message;
    if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl;
    if (data.mediaType !== undefined) updateData.mediaType = data.mediaType;
    if (data.mediaName !== undefined) updateData.mediaName = data.mediaName;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    const [updated] = await db
      .update(quickMessages)
      .set(updateData)
      .where(eq(quickMessages.id, id))
      .returning();

    if (!updated) return null;

    return QuickMessage.instance({
      id: updated.id,
      shortcode: updated.shortcode,
      message: updated.message,
      mediaUrl: updated.mediaUrl,
      mediaType: updated.mediaType as QuickMessage.MediaType | null,
      mediaName: updated.mediaName,
      isPublic: updated.isPublic,
      userId: updated.userId,
      workspaceId: updated.workspaceId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();
    await db.delete(quickMessages).where(eq(quickMessages.id, id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    const db = createDatabaseConnection();
    for (const id of ids) {
      await db.delete(quickMessages).where(eq(quickMessages.id, id));
    }
  }

  async findById(id: string): Promise<QuickMessage | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(quickMessages)
      .where(eq(quickMessages.id, id));

    if (!row) return null;

    return QuickMessage.instance({
      id: row.id,
      shortcode: row.shortcode,
      message: row.message,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType as QuickMessage.MediaType | null,
      mediaName: row.mediaName,
      isPublic: row.isPublic,
      userId: row.userId,
      workspaceId: row.workspaceId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByShortcode(
    workspaceId: string,
    userId: string,
    shortcode: string
  ): Promise<QuickMessage | null> {
    const db = createDatabaseConnection();
    const normalizedShortcode = shortcode.toLowerCase().replace(/^\//, "");

    const [row] = await db
      .select()
      .from(quickMessages)
      .where(
        and(
          eq(quickMessages.workspaceId, workspaceId),
          eq(quickMessages.shortcode, normalizedShortcode),
          or(eq(quickMessages.userId, userId), eq(quickMessages.isPublic, true))
        )
      );

    if (!row) return null;

    return QuickMessage.instance({
      id: row.id,
      shortcode: row.shortcode,
      message: row.message,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType as QuickMessage.MediaType | null,
      mediaName: row.mediaName,
      isPublic: row.isPublic,
      userId: row.userId,
      workspaceId: row.workspaceId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async listByWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<QuickMessage.Raw[]> {
    const db = createDatabaseConnection();

    const rows = await db
      .select()
      .from(quickMessages)
      .where(
        and(
          eq(quickMessages.workspaceId, workspaceId),
          or(eq(quickMessages.userId, userId), eq(quickMessages.isPublic, true))
        )
      )
      .orderBy(quickMessages.shortcode);

    return rows.map((row) =>
      QuickMessage.instance({
        id: row.id,
        shortcode: row.shortcode,
        message: row.message,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType as QuickMessage.MediaType | null,
        mediaName: row.mediaName,
        isPublic: row.isPublic,
        userId: row.userId,
        workspaceId: row.workspaceId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }).raw()
    );
  }

  async searchByShortcode(
    workspaceId: string,
    userId: string,
    query: string
  ): Promise<QuickMessage.Raw[]> {
    const db = createDatabaseConnection();
    const normalizedQuery = query.toLowerCase().replace(/^\//, "");

    const rows = await db
      .select()
      .from(quickMessages)
      .where(
        and(
          eq(quickMessages.workspaceId, workspaceId),
          or(
            ilike(quickMessages.shortcode, `%${normalizedQuery}%`),
            ilike(quickMessages.message, `%${normalizedQuery}%`)
          ),
          or(eq(quickMessages.userId, userId), eq(quickMessages.isPublic, true))
        )
      )
      .orderBy(quickMessages.shortcode)
      .limit(10);

    return rows.map((row) =>
      QuickMessage.instance({
        id: row.id,
        shortcode: row.shortcode,
        message: row.message,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType as QuickMessage.MediaType | null,
        mediaName: row.mediaName,
        isPublic: row.isPublic,
        userId: row.userId,
        workspaceId: row.workspaceId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }).raw()
    );
  }

  static instance() {
    return new QuickMessagesDatabaseRepository();
  }
}
