import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "node:path";

export default defineConfig({
  out: "drizzle",
  schema: "./src/infra/database/schemas.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    schema: "public",
    table: "migrationsHistory",
  },
});
