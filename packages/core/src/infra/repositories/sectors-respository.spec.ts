import { describe, expect, it, vi, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { createDatabaseConnection } from "../database";
import { sectors } from "../database/schemas";
import { SectorsDatabaseRepository } from "./sectors-respository";

vi.mock("../database", async () => {
  const actual = await vi.importActual<typeof import("../database")>(
    "../database"
  );

  return {
    ...actual,
    createDatabaseConnection: vi.fn(),
  };
});

describe("SectorsDatabaseRepository.retrieve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out removed sectors", async () => {
    let capturedCondition: unknown;

    const where = vi.fn(async (condition: unknown) => {
      capturedCondition = condition;
      return [];
    });

    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    vi.mocked(createDatabaseConnection).mockReturnValue({
      select,
    } as any);

    const repository = new SectorsDatabaseRepository();

    await repository.retrieve("sector-1");

    expect(createDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith(sectors);
    expect(where).toHaveBeenCalledTimes(1);

    const dialect = new PgDialect();
    const rendered = dialect.sqlToQuery(
      sql`select * from ${sectors} where ${capturedCondition}`
    );
    const query = rendered.sql.toLowerCase();

    expect(query).toContain("\"sectors\".\"id\"");
    expect(query).toContain("\"sectors\".\"removed\"");
    expect(rendered.params).toContain("sector-1");
    expect(rendered.params).toContain(false);
  });
});
