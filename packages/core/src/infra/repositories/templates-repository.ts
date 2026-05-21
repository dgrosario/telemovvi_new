import { and, eq, inArray, isNull } from "drizzle-orm";
import { Channel, parseChannelPayload } from "../../domain/entities/channel";
import { Template } from "../../domain/entities/template";
import { createDatabaseConnection } from "../database";
import { channels, templates } from "../database/schemas";

export class TemplatesDatabaseRepository {
  static instance() {
    return new TemplatesDatabaseRepository();
  }

  async retrieveGeneralTemplate(id: string): Promise<Template.Raw | null> {
    const db = createDatabaseConnection();

    const row = await db
      .select({
        id: templates.id,
        name: templates.name,
        status: templates.status,
        language: templates.language,
        category: templates.category,
        text: templates.text,

        channel: {
          id: channels.id,
          name: channels.name,
          status: channels.status,
          createdAt: channels.createdAt,
          type: channels.type,
          payload: channels.payload,
          deletedAt: channels.deletedAt,
        },
      })
      .from(templates)
      .innerJoin(channels, eq(channels.id, templates.channelId))
      .where(eq(templates.id, id))
      .limit(1);

    if (row.length === 0) return null;

    const tpl = row[0]!;

    return Template.instance({
      id: tpl.id,
      name: tpl.name,
      status: tpl.status,
      language: tpl.language,
      category: tpl.category,
      text: tpl.text,

      channel: Channel.instance({
        id: tpl.channel.id,
        name: tpl.channel.name,
        status: tpl.channel.status,
        createdAt: tpl.channel.createdAt,
        type: tpl.channel.type,
        payload: parseChannelPayload(tpl.channel.payload),
        responseChannel: null,
        deletedAt: tpl.channel.deletedAt,
      }),

      variables: [],
    }).raw();
  }
  async list(channelIds: string[]): Promise<Template.Raw[]> {
    const db = createDatabaseConnection();

    if (channelIds.length === 0) return [];

    const rows = await db
      .select({
        id: templates.id,
        name: templates.name,
        status: templates.status,
        language: templates.language,
        category: templates.category,
        text: templates.text,

        channel: {
          id: channels.id,
          name: channels.name,
          status: channels.status,
          createdAt: channels.createdAt,
          type: channels.type,
          payload: channels.payload,
          deletedAt: channels.deletedAt,
        },
      })
      .from(templates)
      .innerJoin(channels, eq(channels.id, templates.channelId))
      .where(inArray(templates.channelId, channelIds));

    return rows.map((row) =>
      Template.instance({
        id: row.id,
        name: row.name,
        status: row.status,
        language: row.language,
        category: row.category,
        text: row.text,

        channel: Channel.instance({
          id: row.channel.id,
          name: row.channel.name,
          status: row.channel.status,
          createdAt: row.channel.createdAt,
          type: row.channel.type,
          payload: parseChannelPayload(row.channel.payload),
          responseChannel: null,
          deletedAt: row.channel.deletedAt,
        }),

        variables: [],
      }).raw()
    );
  }

  async addGeneralTemplate(data: {
    name: string;
    status: string;
    language: "pt_BR" | "en_US";
    category: string;
    text: string;
    channelId: string;
  }) {
    const db = createDatabaseConnection();

    const [channelRow] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, data.channelId), isNull(channels.deletedAt)));

    if (!channelRow) {
      throw new Error("Canal não encontrado.");
    }

    const allowedLanguages: readonly string[] = ["pt_BR", "en_US"];

    if (!allowedLanguages.includes(data.language)) {
      throw new Error("Linguagem inválida. Use pt_BR ou en_US.");
    }

    const [inserted] = await db
      .insert(templates)
      .values({
        id: crypto.randomUUID(),
        name: data.name,
        status: data.status,
        language: data.language as "pt_BR" | "en_US",
        category: data.category,
        text: data.text,
        channelId: data.channelId,
      })
      .returning({
        id: templates.id,
        name: templates.name,
        status: templates.status,
        language: templates.language,
        category: templates.category,
        text: templates.text,
      });
  }

  async deleteGeneralTemplates(ids: string[]) {
    const db = createDatabaseConnection();

    if (ids.length === 0) return [];

    const existing = await db
      .select({
        id: templates.id,
        name: templates.name,
      })
      .from(templates)
      .where(inArray(templates.id, ids));

    if (existing.length === 0) {
      throw new Error("Nenhum template encontrado para deletar.");
    }

    await db.delete(templates).where(inArray(templates.id, ids));
  }

  async updateGeneralTemplate(
    id: string,
    data: {
      name?: string;
      status?: string;
      language?: "pt_BR" | "en_US";
      category?: string;
      text?: string;
      channelId?: string;
    }
  ) {
    const db = createDatabaseConnection();

    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id));

    if (!existing) {
      throw new Error("Template não encontrado.");
    }

    if (data.channelId) {
      const [channelRow] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, data.channelId));

      if (!channelRow) {
        throw new Error("Canal não encontrado.");
      }
    }

    const allowedLanguages = ["pt_BR", "en_US"] as const;
    if (data.language && !allowedLanguages.includes(data.language)) {
      throw new Error("Linguagem inválida. Use pt_BR ou en_US.");
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const [updated] = await db
      .update(templates)
      .set(updateData)
      .where(eq(templates.id, id))
      .returning({
        id: templates.id,
        name: templates.name,
        status: templates.status,
        language: templates.language,
        category: templates.category,
        text: templates.text,
      });
  }
}
