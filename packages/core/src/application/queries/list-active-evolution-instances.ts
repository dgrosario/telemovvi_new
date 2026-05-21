import { and, eq, isNull } from "drizzle-orm";
import { isEvolutionPayload, parseChannelPayload } from "../../domain/entities/channel";
import { createDatabaseConnection } from "../../infra/database";
import { channels } from "../../infra/database/schemas";

export interface EvolutionInstanceInfo {
  channelId: string;
  instanceName: string;
  workspaceId: string;
}

export class ListActiveEvolutionInstances {
  async execute(): Promise<EvolutionInstanceInfo[]> {
    const db = createDatabaseConnection();

    const result = await db
      .select({
        channelId: channels.id,
        workspaceId: channels.workspaceId,
        payload: channels.payload,
      })
      .from(channels)
      .where(and(eq(channels.type, "evolution"), isNull(channels.deletedAt)));

    const instances: EvolutionInstanceInfo[] = [];

    for (const row of result) {
      const payload = parseChannelPayload(row.payload);
      if (isEvolutionPayload(payload) && payload.instanceName) {
        instances.push({
          channelId: row.channelId,
          instanceName: payload.instanceName,
          workspaceId: row.workspaceId,
        });
      }
    }

    return instances;
  }

  static instance(): ListActiveEvolutionInstances {
    return new ListActiveEvolutionInstances();
  }
}
