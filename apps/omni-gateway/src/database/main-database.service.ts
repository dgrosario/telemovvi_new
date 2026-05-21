import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import postgres from "postgres";

@Injectable()
export class MainDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(MainDatabaseService.name);
  private readonly sql: ReturnType<typeof postgres> | null = null;

  constructor() {
    const databaseUrl = process.env.MAIN_DATABASE_URL;

    if (!databaseUrl) {
      this.logger.warn(
        "MAIN_DATABASE_URL not configured - main database access disabled"
      );
      return;
    }

    this.sql = postgres(databaseUrl, { max: 5 });
    this.logger.log("Main database connection established");
  }

  getConnection(): ReturnType<typeof postgres> | null {
    return this.sql;
  }

  isConnected(): boolean {
    return this.sql !== null;
  }

  async healthCheck(): Promise<void> {
    if (!this.sql) {
      throw new Error("Main database not configured");
    }
    await this.sql`SELECT 1`;
  }

  async onModuleDestroy() {
    if (this.sql) {
      await this.sql.end();
      this.logger.log("Main database connection closed");
    }
  }
}
