import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export { eq, and, or, not, desc, asc, inArray, sql, isNull } from "drizzle-orm";

export const createDatabaseConnection = () => {
  const globalForDb = globalThis as unknown as {
    sql?: ReturnType<typeof postgres>;
    db?: ReturnType<typeof drizzle>;
  };

  if (!globalForDb.sql) {
    globalForDb.sql = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
    });
    globalForDb.db = drizzle(globalForDb.sql);
    (globalForDb.db as any).$client = globalForDb.sql;
  }

  return globalForDb.db!;
};
