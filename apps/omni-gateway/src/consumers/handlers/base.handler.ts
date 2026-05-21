import { Logger } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { GatewayResponse } from "../interfaces/gateway-request.interface";

export interface ChannelRecord {
  id: string;
  type: string;
  name: string;
  payload: Record<string, unknown>;
}

export abstract class BaseHandler {
  protected readonly logger: Logger;

  constructor(
    protected readonly mainDatabaseService: MainDatabaseService,
    loggerContext: string
  ) {
    this.logger = new Logger(loggerContext);
  }

  protected async getChannelById(channelId: string): Promise<ChannelRecord | null> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return null;

    const result = await sql<{ id: string; type: string; name: string; payload: Record<string, unknown> }[]>`
      SELECT id, type, name, payload FROM channels WHERE id = ${channelId} LIMIT 1
    `;

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      type: result[0].type,
      name: result[0].name,
      payload: result[0].payload,
    };
  }

  protected async getChannelsByWorkspace(
    workspaceId: string,
    channelType?: string
  ): Promise<ChannelRecord[]> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return [];

    const result = channelType
      ? await sql<{ id: string; type: string; name: string; payload: Record<string, unknown> }[]>`
          SELECT id, type, name, payload FROM channels WHERE workspace_id = ${workspaceId} AND type = ${channelType}
        `
      : await sql<{ id: string; type: string; name: string; payload: Record<string, unknown> }[]>`
          SELECT id, type, name, payload FROM channels WHERE workspace_id = ${workspaceId}
        `;

    return result.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      payload: row.payload,
    }));
  }

  protected async updateChannelStatus(
    channelId: string,
    status: "connected" | "disconnected"
  ): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return;

    await sql`UPDATE channels SET status = ${status} WHERE id = ${channelId}`;
  }

  protected async updateChannelPayload(
    channelId: string,
    payload: Record<string, unknown>,
    channelType?: string
  ): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return;

    try {
      const connected = payload.connected === true;
      const channelName = payload.name as string | undefined;
      const payloadToStore = { ...payload };
      delete payloadToStore.connected;
      delete payloadToStore.name;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonPayload = payloadToStore as any;

      if (channelType) {
        if (channelName) {
          await sql`UPDATE channels SET payload = ${sql.json(jsonPayload)}, status = ${connected ? "connected" : "disconnected"}, type = ${channelType}, name = ${channelName} WHERE id = ${channelId}`;
        } else {
          await sql`UPDATE channels SET payload = ${sql.json(jsonPayload)}, status = ${connected ? "connected" : "disconnected"}, type = ${channelType} WHERE id = ${channelId}`;
        }
      } else {
        if (channelName) {
          await sql`UPDATE channels SET payload = ${sql.json(jsonPayload)}, status = ${connected ? "connected" : "disconnected"}, name = ${channelName} WHERE id = ${channelId}`;
        } else {
          await sql`UPDATE channels SET payload = ${sql.json(jsonPayload)}, status = ${connected ? "connected" : "disconnected"} WHERE id = ${channelId}`;
        }
      }

      if (channelName) {
        this.logger.log(`Updated channel ${channelId} name to: ${channelName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update channel payload: ${error}`);
    }
  }

  protected errorResponse(correlationId: string, error: string): GatewayResponse {
    return { correlationId, success: false, error };
  }

  protected successResponse<T>(correlationId: string, data?: T): GatewayResponse<T> {
    return { correlationId, success: true, data };
  }
}
