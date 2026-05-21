import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { createDatabaseConnection } from "../database";
import {
  conversations,
  flowExecutionLogs,
  flowExecutions,
} from "../database/schemas";

export type ListExecutionsInputDTO = {
  conversationId: string;
};

export type CreateLogInputDTO = {
  executionId: string;
  nodeId: string;
  status: "success" | "failed";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
};

export class FlowExecutionsDatabaseRepository {
  async list(input: ListExecutionsInputDTO): Promise<FlowExecution[]> {
    if (!input.conversationId) {
      return [];
    }

    const db = createDatabaseConnection();

    const executionsList = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.conversationId, input.conversationId))
      .orderBy(desc(flowExecutions.startedAt));

    return executionsList.map((execution) =>
      FlowExecution.fromRaw({
        id: execution.id,
        flowId: execution.flowId,
        conversationId: execution.conversationId,
        currentNodeId: execution.currentNodeId,
        status: execution.status as FlowExecution.Status,
        variables: (execution.variables as FlowExecution.Variables) || {},
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        failedAt: execution.failedAt,
        errorMessage: execution.errorMessage,
      })
    );
  }

  async retrieve(id: string): Promise<FlowExecution | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, id));

    if (!execution) return null;

    return FlowExecution.fromRaw({
      id: execution.id,
      flowId: execution.flowId,
      conversationId: execution.conversationId,
      currentNodeId: execution.currentNodeId,
      status: execution.status as FlowExecution.Status,
      variables: (execution.variables as FlowExecution.Variables) || {},
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      errorMessage: execution.errorMessage,
    });
  }

  async retrieveActiveByConversation(
    conversationId: string
  ): Promise<FlowExecution | null> {
    if (!conversationId) return null;

    const db = createDatabaseConnection();

    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(
        and(
          eq(flowExecutions.conversationId, conversationId),
          eq(flowExecutions.status, "running")
        )
      )
      .orderBy(desc(flowExecutions.startedAt))
      .limit(1);

    if (!execution) return null;

    return FlowExecution.fromRaw({
      id: execution.id,
      flowId: execution.flowId,
      conversationId: execution.conversationId,
      currentNodeId: execution.currentNodeId,
      status: execution.status as FlowExecution.Status,
      variables: (execution.variables as FlowExecution.Variables) || {},
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      errorMessage: execution.errorMessage,
    });
  }

  async retrievePausedByConversation(
    conversationId: string
  ): Promise<FlowExecution | null> {
    if (!conversationId) return null;

    const db = createDatabaseConnection();

    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(
        and(
          eq(flowExecutions.conversationId, conversationId),
          eq(flowExecutions.status, "paused")
        )
      )
      .orderBy(desc(flowExecutions.startedAt))
      .limit(1);

    if (!execution) return null;

    return FlowExecution.fromRaw({
      id: execution.id,
      flowId: execution.flowId,
      conversationId: execution.conversationId,
      currentNodeId: execution.currentNodeId,
      status: execution.status as FlowExecution.Status,
      variables: (execution.variables as FlowExecution.Variables) || {},
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      errorMessage: execution.errorMessage,
    });
  }

  async listPausedByConversation(
    conversationId: string
  ): Promise<FlowExecution[]> {
    if (!conversationId) return [];

    const db = createDatabaseConnection();

    const executionsList = await db
      .select()
      .from(flowExecutions)
      .where(
        and(
          eq(flowExecutions.conversationId, conversationId),
          eq(flowExecutions.status, "paused")
        )
      )
      .orderBy(desc(flowExecutions.startedAt));

    return executionsList.map((execution) =>
      FlowExecution.fromRaw({
        id: execution.id,
        flowId: execution.flowId,
        conversationId: execution.conversationId,
        currentNodeId: execution.currentNodeId,
        status: execution.status as FlowExecution.Status,
        variables: (execution.variables as FlowExecution.Variables) || {},
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        failedAt: execution.failedAt,
        errorMessage: execution.errorMessage,
      })
    );
  }

  async create(execution: FlowExecution): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(flowExecutions).values({
      id: execution.id,
      flowId: execution.flowId,
      conversationId: execution.conversationId,
      currentNodeId: execution.currentNodeId,
      status: execution.status,
      variables: execution.variables,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      errorMessage: execution.errorMessage,
    });
  }

  async update(execution: FlowExecution): Promise<void> {
    const db = createDatabaseConnection();

    const canTransitionFrom = (() => {
      if (execution.status === "running" || execution.status === "paused") {
        return ["running", "paused"] as const;
      }

      return ["running", "paused", "completed", "failed"] as const;
    })();

    await db
      .update(flowExecutions)
      .set({
        currentNodeId: execution.currentNodeId,
        status: execution.status,
        variables: execution.variables,
        completedAt: execution.completedAt,
        failedAt: execution.failedAt,
        errorMessage: execution.errorMessage,
      })
      .where(
        and(
          eq(flowExecutions.id, execution.id),
          inArray(flowExecutions.status, canTransitionFrom)
        )
      );
  }

  async createLog(input: CreateLogInputDTO): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(flowExecutionLogs).values({
      id: crypto.randomUUID().toString(),
      executionId: input.executionId,
      nodeId: input.nodeId,
      status: input.status,
      input: input.input || null,
      output: input.output || null,
      errorMessage: input.errorMessage || null,
      executedAt: new Date(),
    });
  }

  async listAllPaused(): Promise<FlowExecution[]> {
    const db = createDatabaseConnection();

    const executionsList = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.status, "paused"))
      .orderBy(desc(flowExecutions.startedAt));

    return executionsList.map((execution) =>
      FlowExecution.fromRaw({
        id: execution.id,
        flowId: execution.flowId,
        conversationId: execution.conversationId,
        currentNodeId: execution.currentNodeId,
        status: execution.status as FlowExecution.Status,
        variables: (execution.variables as FlowExecution.Variables) || {},
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        failedAt: execution.failedAt,
        errorMessage: execution.errorMessage,
      })
    );
  }

  async listAllPausedWithWorkspace(
    limit?: number,
    workspaceId?: string
  ): Promise<
    Array<{ execution: FlowExecution; workspaceId: string; channelId: string | null }>
  > {
    const db = createDatabaseConnection();

    const whereConditions = workspaceId
      ? and(
          eq(flowExecutions.status, "paused"),
          eq(conversations.workspaceId, workspaceId)
        )
      : eq(flowExecutions.status, "paused");

    let query = db
      .select({
        id: flowExecutions.id,
        flowId: flowExecutions.flowId,
        conversationId: flowExecutions.conversationId,
        currentNodeId: flowExecutions.currentNodeId,
        status: flowExecutions.status,
        variables: flowExecutions.variables,
        startedAt: flowExecutions.startedAt,
        completedAt: flowExecutions.completedAt,
        failedAt: flowExecutions.failedAt,
        errorMessage: flowExecutions.errorMessage,
        workspaceId: conversations.workspaceId,
        channelId: conversations.channel,
      })
      .from(flowExecutions)
      .innerJoin(
        conversations,
        eq(flowExecutions.conversationId, conversations.id)
      )
      .where(whereConditions)
      .orderBy(desc(flowExecutions.startedAt))
      .$dynamic();

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const executionsList = await query;

    return executionsList.map((row) => ({
      execution: FlowExecution.fromRaw({
        id: row.id,
        flowId: row.flowId,
        conversationId: row.conversationId,
        currentNodeId: row.currentNodeId,
        status: row.status as FlowExecution.Status,
        variables: (row.variables as FlowExecution.Variables) || {},
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        failedAt: row.failedAt,
        errorMessage: row.errorMessage,
      }),
      workspaceId: row.workspaceId,
      channelId: row.channelId,
    }));
  }

  async terminateByChannel(channelId: string): Promise<number> {
    if (!channelId) return 0;

    const db = createDatabaseConnection();

    const conversationIds = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.channel, channelId));

    const result = await db
      .update(flowExecutions)
      .set({
        status: "completed",
        completedAt: new Date(),
        currentNodeId: null,
      })
      .where(
        and(
          inArray(flowExecutions.conversationId, conversationIds),
          or(
            eq(flowExecutions.status, "running"),
            eq(flowExecutions.status, "paused")
          )
        )
      )
      .returning({ id: flowExecutions.id });

    return result.length;
  }

  static instance() {
    return new FlowExecutionsDatabaseRepository();
  }
}
