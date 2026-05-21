import { and, eq, inArray } from "drizzle-orm";
import { Flow } from "../../domain/entities/flow";
import { createDatabaseConnection } from "../database";
import { flows, flowsInChannels } from "../database/schemas";

export class FlowsInChannelsDatabaseRepository {
  async addRelationsToFlow(flowId: string, channelIds: string[]) {
    if (!flowId || !channelIds?.length) return null;

    const db = createDatabaseConnection();

    const values = channelIds.map((channelId) => ({
      flowId,
      channelId,
    }));

    try {
      const result = await db
        .insert(flowsInChannels)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações fluxo-conexão:", error);
      return null;
    }
  }

  async addRelationsToChannel(channelId: string, flowIds: string[]) {
    if (!channelId || !flowIds?.length) return null;

    const db = createDatabaseConnection();

    const values = flowIds.map((flowId) => ({
      flowId,
      channelId,
    }));

    try {
      const result = await db
        .insert(flowsInChannels)
        .values(values)
        .onConflictDoNothing();

      return result;
    } catch (error) {
      console.error("Erro ao criar relações fluxo-conexão:", error);
      return null;
    }
  }

  async listByFlow(flowId: string) {
    if (!flowId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        flowId: flowsInChannels.flowId,
        channelId: flowsInChannels.channelId,
      })
      .from(flowsInChannels)
      .where(eq(flowsInChannels.flowId, flowId));

    return response;
  }

  async listByChannel(channelId: string) {
    if (!channelId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        flowId: flowsInChannels.flowId,
        channelId: flowsInChannels.channelId,
      })
      .from(flowsInChannels)
      .where(eq(flowsInChannels.channelId, channelId));

    return response;
  }

  async deleteRelationsFromFlow(channelIds: string[], flowId: string) {
    if (!flowId || !channelIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInChannels)
        .where(
          and(
            eq(flowsInChannels.flowId, flowId),
            inArray(flowsInChannels.channelId, channelIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações fluxo-conexão:", error);
      return null;
    }
  }

  async deleteRelationsFromChannel(flowIds: string[], channelId: string) {
    if (!channelId || !flowIds?.length) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInChannels)
        .where(
          and(
            eq(flowsInChannels.channelId, channelId),
            inArray(flowsInChannels.flowId, flowIds)
          )
        );

      return result;
    } catch (error) {
      console.error("Erro ao deletar relações fluxo-conexão:", error);
      return null;
    }
  }

  async deleteAllRelationsFromFlow(flowId: string) {
    if (!flowId) return null;

    const db = createDatabaseConnection();

    try {
      const result = await db
        .delete(flowsInChannels)
        .where(eq(flowsInChannels.flowId, flowId));

      return result;
    } catch (error) {
      console.error("Erro ao deletar todas as relações do fluxo:", error);
      return null;
    }
  }

  async findActiveFlowForChannel(channelId: string): Promise<Flow | null> {
    if (!channelId) return null;

    const db = createDatabaseConnection();

    const result = await db
      .select({
        id: flows.id,
        workspaceId: flows.workspaceId,
        name: flows.name,
        status: flows.status,
        nodes: flows.nodes,
        connections: flows.connections,
        createdAt: flows.createdAt,
        updatedAt: flows.updatedAt,
      })
      .from(flowsInChannels)
      .innerJoin(flows, eq(flowsInChannels.flowId, flows.id))
      .where(
        and(
          eq(flowsInChannels.channelId, channelId),
          eq(flows.status, "active")
        )
      )
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return Flow.fromRaw({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      status: row.status as Flow.Status,
      nodes: row.nodes as Flow.Raw["nodes"],
      connections: row.connections as Flow.Raw["connections"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static instance() {
    return new FlowsInChannelsDatabaseRepository();
  }
}
