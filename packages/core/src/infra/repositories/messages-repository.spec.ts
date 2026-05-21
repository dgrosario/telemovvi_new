import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { createDatabaseConnection } from "../database";
import { messages } from "../database/schemas";
import { MessagesDatabaseRepository } from "./messages-repository";

vi.mock("../database", async () => {
  const actual = await vi.importActual<typeof import("../database")>(
    "../database"
  );

  return {
    ...actual,
    createDatabaseConnection: vi.fn(),
  };
});

describe("MessagesDatabaseRepository.resolveMessageReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the exact message id when it exists", async () => {
    const conditions: unknown[] = [];

    const where = vi.fn(async (condition: unknown) => {
      conditions.push(condition);
      return [{ id: "msg-1", conversationId: "conv-1", workspaceId: "workspace-1" }];
    });

    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));

    vi.mocked(createDatabaseConnection).mockReturnValue({
      select,
    } as any);

    const repository = new MessagesDatabaseRepository();

    const result = await repository.resolveMessageReference("msg-1", "instance-a");

    expect(result).toEqual({
      id: "msg-1",
      conversationId: "conv-1",
      workspaceId: "workspace-1",
    });
    expect(where).toHaveBeenCalledTimes(1);

    const dialect = new PgDialect();
    const rendered = dialect.sqlToQuery(
      sql`select * from ${messages} where ${conditions[0]}`
    );

    expect(rendered.sql.toLowerCase()).toContain("\"messages\".\"id\"");
    expect(rendered.params).toContain("msg-1");
  });

  it("falls back to the instance-suffixed id when the original id is not found", async () => {
    const conditions: unknown[] = [];

    const where = vi.fn(async (condition: unknown) => {
      conditions.push(condition);

      if (conditions.length === 1) {
        return [];
      }

      return [{
        id: "msg-1:instance-a",
        conversationId: "conv-1",
        workspaceId: "workspace-1",
      }];
    });

    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));

    vi.mocked(createDatabaseConnection).mockReturnValue({
      select,
    } as any);

    const repository = new MessagesDatabaseRepository();

    const result = await repository.resolveMessageReference("msg-1", "instance-a");

    expect(result).toEqual({
      id: "msg-1:instance-a",
      conversationId: "conv-1",
      workspaceId: "workspace-1",
    });
    expect(where).toHaveBeenCalledTimes(2);

    const dialect = new PgDialect();
    const firstRendered = dialect.sqlToQuery(
      sql`select * from ${messages} where ${conditions[0]}`
    );
    const secondRendered = dialect.sqlToQuery(
      sql`select * from ${messages} where ${conditions[1]}`
    );

    expect(firstRendered.params).toContain("msg-1");
    expect(secondRendered.params).toContain("msg-1:instance-a");
  });
});
