import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { channels, conversations } from "../database/schemas";
import { ConversationsDatabaseRepository } from "./conversations-repository";

describe("ConversationsDatabaseRepository channel/sector filters", () => {
  const repository = new ConversationsDatabaseRepository() as any;
  const dialect = new PgDialect();

  it("combines sector and channel filters with AND when both are provided", () => {
    const condition = repository.buildSectorChannelFilters({
      sectorFilters: ["sector-1", null],
      channelFilters: ["channel-1", null],
    });

    expect(condition).toBeDefined();

    const query = renderWhere(condition, dialect);
    expect(query).toContain("\"conversations\".\"sector_id\"");
    expect(query).toContain("\"conversations\".\"channel\"");
    expect(query).toContain(" and ");
  });

  it("builds only sector filter when no channel filters are provided", () => {
    const condition = repository.buildSectorChannelFilters({
      sectorFilters: ["sector-1", null],
      channelFilters: [],
    });

    expect(condition).toBeDefined();

    const query = renderWhere(condition, dialect);
    expect(query).toContain("\"conversations\".\"sector_id\"");
    expect(query).not.toContain("\"conversations\".\"channel\" in");
  });

  it("builds only channel filter when no sector filters are provided", () => {
    const condition = repository.buildSectorChannelFilters({
      sectorFilters: [],
      channelFilters: ["channel-1", null],
    });

    expect(condition).toBeDefined();

    const query = renderWhere(condition, dialect);
    expect(query).toContain("\"conversations\".\"channel\"");
    expect(query).not.toContain("\"conversations\".\"sector_id\" in");
  });

  it("returns undefined when both sector and channel filters are empty", () => {
    const condition = repository.buildSectorChannelFilters({
      sectorFilters: [],
      channelFilters: [],
    });

    expect(condition).toBeUndefined();
  });
});

describe("ConversationsDatabaseRepository expiration window", () => {
  const repository = new ConversationsDatabaseRepository() as any;
  const dialect = new PgDialect();

  it("uses template timestamp for official WhatsApp channels when expiring over 24h", () => {
    const condition = repository.buildExpirationWindowCondition();

    expect(condition).toBeDefined();

    const query = renderExpirationWhere(condition, dialect);
    expect(query).toContain("greatest");
    expect(query).toContain("m.type = 'template'");
    expect(query).toContain("m.sender_type = 'attendant'");
    expect(query).toContain("ch.type in ('whatsapp', 'meta_api')");
  });

  it("keeps Instagram expiration based on last client message with 7-day window", () => {
    const condition = repository.buildExpirationWindowCondition();

    const query = renderExpirationWhere(condition, dialect);
    expect(query).toContain("ch.type = 'instagram'");
    expect(query).toContain("m.sender_type = 'contact'");
    expect(query).toContain("interval '7 days'");
  });
});

describe("ConversationsDatabaseRepository cross-channel indicators", () => {
  const repository = new ConversationsDatabaseRepository() as any;
  const dialect = new PgDialect();

  it("detects another active external conversation using same contact or same partner", () => {
    const querySql = repository.buildCrossChannelIndicatorsQuery(
      ["contact-1"],
      "workspace-1"
    );

    const query = renderSql(querySql, dialect);
    expect(query).toContain("with origin_conversations as");
    expect(query).toContain("c_other.id != o.origin_conversation_id");
    expect(query).toContain("c_other.contact = o.origin_contact_id");
    expect(query).toContain("pc_other.partner_id = o.origin_partner_id");
    expect(query).toContain("c_other.status in ('open', 'waiting', 'expired')");
    expect(query).toContain("c_origin.status in ('open', 'waiting', 'expired')");
    expect(query).not.toContain("c_other.channel != o.origin_channel_id");
  });
});

describe("ConversationsDatabaseRepository deleted-message teaser", () => {
  const repository = new ConversationsDatabaseRepository() as any;
  const dialect = new PgDialect();

  it("renders a deleted-message teaser instead of the original content", () => {
    const teaserSql = repository.buildConversationTeaserSql("conversations.id");

    const query = renderSql(teaserSql, dialect);
    expect(query).toContain("m.deleted_at is not null");
    expect(query).toContain("mensagem excluída");
  });
});

function renderWhere(condition: unknown, dialect: PgDialect): string {
  const rendered = dialect.sqlToQuery(
    sql`select * from ${conversations} where ${condition}`
  );
  return rendered.sql.toLowerCase();
}

function renderExpirationWhere(condition: unknown, dialect: PgDialect): string {
  const rendered = dialect.sqlToQuery(sql`
    select c.id
    from ${conversations} c
    inner join ${channels} ch on c.channel = ch.id
    where ${condition}
  `);
  return rendered.sql.toLowerCase();
}

function renderSql(query: unknown, dialect: PgDialect): string {
  const rendered = dialect.sqlToQuery(query as any);
  return rendered.sql.toLowerCase();
}
