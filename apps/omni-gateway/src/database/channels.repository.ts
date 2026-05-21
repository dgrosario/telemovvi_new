import { Injectable, Logger } from "@nestjs/common";
import { MainDatabaseService } from "./main-database.service";

export interface ChannelByPhoneId {
  id: string;
  channelType: string;
  appSecret: string | null;
}

export interface ChannelByVerifyToken {
  id: string;
  phoneId: string;
}

export interface ChannelWithSecret {
  id: string;
  type: string;
  channelType: string;
  appSecret: string | null;
  verifyToken?: string;
}

@Injectable()
export class ChannelsRepository {
  private readonly logger = new Logger(ChannelsRepository.name);

  constructor(private readonly mainDatabaseService: MainDatabaseService) {}

  async findByPhoneId(phoneId: string): Promise<ChannelByPhoneId | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return null;
    }

    try {
      const result = await sql`
        SELECT
          c.id,
          c.type as "channelType",
          c.payload->>'appSecret' as "appSecret"
        FROM channels c
        WHERE c.payload->>'phoneId' = ${phoneId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return result[0] as ChannelByPhoneId;
    } catch (error) {
      this.logger.error(`Error finding channel by phoneId: ${phoneId}`, error);
      return null;
    }
  }

  async findByPhoneIdWithSecret(
    phoneId: string,
  ): Promise<ChannelWithSecret | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return null;
    }

    try {
      const result = await sql`
        SELECT
          c.id,
          c.type,
          c.type as "channelType",
          c.payload->>'appSecret' as "appSecret",
          c.payload->>'verifyToken' as "verifyToken"
        FROM channels c
        WHERE c.payload->>'phoneId' = ${phoneId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return result[0] as ChannelWithSecret;
    } catch (error) {
      this.logger.error(`Error finding channel by phoneId: ${phoneId}`, error);
      return null;
    }
  }

  async findEvolutionInstances(): Promise<
    Array<{ id: string; instanceName: string }>
  > {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return [];
    }

    try {
      const result = await sql`
        SELECT
          c.id,
          c.payload->>'instanceName' as "instanceName"
        FROM channels c
        WHERE c.type = 'evolution'
          AND c.payload->>'instanceName' IS NOT NULL
      `;

      return result.map((row) => ({
        id: row.id as string,
        instanceName: row.instanceName as string,
      }));
    } catch (error) {
      this.logger.error("Error finding Evolution instances", error);
      return [];
    }
  }

  public findAvailableEvolutionInstances() {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return [];
    }

    return sql`
      SELECT
        c.payload->>'instanceName' as "instanceName"
      FROM channels c
      WHERE c.type = 'evolution'
        AND c.payload->>'status' = 'available'
        AND c.payload->>'instanceName' IS NOT NULL
    `;
  }

  async findByVerifyToken(token: string): Promise<ChannelByVerifyToken | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return null;
    }

    try {
      const result = await sql`
        SELECT
          c.id,
          c.payload->>'phoneId' as "phoneId"
        FROM channels c
        WHERE c.payload->>'verifyToken' = ${token}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return result[0] as ChannelByVerifyToken;
    } catch (error) {
      this.logger.error(`Error finding channel by verifyToken`, error);
      return null;
    }
  }
}
