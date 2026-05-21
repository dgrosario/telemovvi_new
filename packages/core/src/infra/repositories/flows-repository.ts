import { and, desc, eq } from "drizzle-orm";
import { Flow } from "../../domain/entities/flow";
import { FlowConnection } from "../../domain/entities/flow-connection";
import { FlowNode } from "../../domain/entities/flow-node";
import { createDatabaseConnection } from "../database";
import { flows } from "../database/schemas";

export type ListFlowsInputDTO = {
  workspaceId: string;
};

export type GetFlowOutputDTO = {
  flow: Flow;
} | null;

export class FlowsDatabaseRepository {
  async list(input: ListFlowsInputDTO): Promise<Flow[]> {
    if (!input.workspaceId) {
      return [];
    }

    const db = createDatabaseConnection();

    const flowsList = await db
      .select()
      .from(flows)
      .where(eq(flows.workspaceId, input.workspaceId))
      .orderBy(desc(flows.updatedAt));

    return flowsList.map((flowData) => {
      const nodesData = Array.isArray(flowData.nodes) ? flowData.nodes : [];
      const connectionsData = Array.isArray(flowData.connections)
        ? flowData.connections
        : [];

      return Flow.fromRaw({
        id: flowData.id,
        workspaceId: flowData.workspaceId,
        name: flowData.name,
        status: flowData.status as Flow.Status,
        nodes: nodesData.map((node: FlowNode.Raw) => node),
        connections: connectionsData.map((conn: FlowConnection.Raw) => conn),
        createdAt: flowData.createdAt,
        updatedAt: flowData.updatedAt,
      });
    });
  }

  async retrieve(id: string): Promise<Flow | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [flowData] = await db.select().from(flows).where(eq(flows.id, id));

    if (!flowData) return null;

    const nodesData = Array.isArray(flowData.nodes) ? flowData.nodes : [];
    const connectionsData = Array.isArray(flowData.connections)
      ? flowData.connections
      : [];

    return Flow.fromRaw({
      id: flowData.id,
      workspaceId: flowData.workspaceId,
      name: flowData.name,
      status: flowData.status as Flow.Status,
      nodes: nodesData.map((node: FlowNode.Raw) => node),
      connections: connectionsData.map((conn: FlowConnection.Raw) => conn),
      createdAt: flowData.createdAt,
      updatedAt: flowData.updatedAt,
    });
  }

  async retrieveByWorkspace(
    id: string,
    workspaceId: string
  ): Promise<Flow | null> {
    if (!id || !workspaceId) return null;

    const db = createDatabaseConnection();

    const [flowData] = await db
      .select()
      .from(flows)
      .where(and(eq(flows.id, id), eq(flows.workspaceId, workspaceId)));

    if (!flowData) return null;

    const nodesData = Array.isArray(flowData.nodes) ? flowData.nodes : [];
    const connectionsData = Array.isArray(flowData.connections)
      ? flowData.connections
      : [];

    return Flow.fromRaw({
      id: flowData.id,
      workspaceId: flowData.workspaceId,
      name: flowData.name,
      status: flowData.status as Flow.Status,
      nodes: nodesData.map((node: FlowNode.Raw) => node),
      connections: connectionsData.map((conn: FlowConnection.Raw) => conn),
      createdAt: flowData.createdAt,
      updatedAt: flowData.updatedAt,
    });
  }

  async create(flow: Flow): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(flows).values({
      id: flow.id,
      workspaceId: flow.workspaceId,
      name: flow.name,
      status: flow.status,
      nodes: flow.nodes.map((node) => node.raw()),
      connections: flow.connections.map((conn) => conn.raw()),
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    });
  }

  async update(flow: Flow): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(flows)
      .set({
        name: flow.name,
        status: flow.status,
        nodes: flow.nodes.map((node) => node.raw()),
        connections: flow.connections.map((conn) => conn.raw()),
        updatedAt: flow.updatedAt,
      })
      .where(eq(flows.id, flow.id));
  }

  async delete(id: string): Promise<void> {
    const db = createDatabaseConnection();

    await db.delete(flows).where(eq(flows.id, id));
  }

  async duplicate(originalId: string, newFlow: Flow): Promise<void> {
    const original = await this.retrieve(originalId);

    if (!original) {
      throw new Error("Original flow not found");
    }

    await this.create(newFlow);
  }

  static instance() {
    return new FlowsDatabaseRepository();
  }
}
