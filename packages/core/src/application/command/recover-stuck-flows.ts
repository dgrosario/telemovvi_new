import { Channel } from "../../domain/entities/channel";
import { Conversation } from "../../domain/entities/conversation";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { FlowExecutorDriver } from "../../infra/drivers/flow-executor";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";

interface FlowExecutionsRepository {
  listAllPausedWithWorkspace(
    limit?: number,
    workspaceId?: string
  ): Promise<
    Array<{ execution: FlowExecution; workspaceId: string; channelId: string | null }>
  >;
  update(execution: FlowExecution): Promise<void>;
}

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

interface FlowExecutor {
  resumeFlow(input: {
    execution: FlowExecution;
    conversation: Conversation;
    channel: Channel;
    workspaceId: string;
    userMessage?: string;
  }): Promise<void>;
}

type RecoveredFlow = {
  executionId: string;
  conversationId: string;
  nodeId: string | null;
  resumeAt: string;
  status: "recovered" | "failed";
  error?: string;
};

export class RecoverStuckFlows {
  constructor(
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly flowExecutor: FlowExecutor
  ) {}

  private static readonly BATCH_SIZE = 5;
  private static readonly QUERY_LIMIT = 100;

  async execute(input: InputDTO): Promise<OutputDTO> {
    const pausedExecutions =
      await this.flowExecutionsRepository.listAllPausedWithWorkspace(
        RecoverStuckFlows.QUERY_LIMIT,
        input.workspaceId
      );
    const now = new Date();
    const results: RecoveredFlow[] = [];

    const stuckExecutions = pausedExecutions.filter(({ execution }) => {
      const resumeAtKey = this.findResumeAtKey(execution.variables);
      if (!resumeAtKey) {
        return false;
      }

      const resumeAtValue = execution.variables[resumeAtKey];
      if (typeof resumeAtValue !== "string") {
        return false;
      }

      const resumeAt = new Date(resumeAtValue);
      if (isNaN(resumeAt.getTime())) {
        results.push({
          executionId: execution.id,
          conversationId: execution.conversationId,
          nodeId: execution.currentNodeId,
          resumeAt: resumeAtValue,
          status: "failed",
          error: "Invalid resumeAt date format",
        });
        return false;
      }

      return resumeAt <= now;
    });

    for (let i = 0; i < stuckExecutions.length; i += RecoverStuckFlows.BATCH_SIZE) {
      const batch = stuckExecutions.slice(i, i + RecoverStuckFlows.BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(({ execution, workspaceId, channelId }) =>
          this.recoverSingleFlow(execution, workspaceId, channelId)
        )
      );
      results.push(...batchResults);
    }

    return {
      totalPaused: pausedExecutions.length,
      totalStuck: results.length,
      recovered: results.filter((r) => r.status === "recovered").length,
      failed: results.filter((r) => r.status === "failed").length,
      details: results,
    };
  }

  private async recoverSingleFlow(
    execution: FlowExecution,
    workspaceId: string,
    channelId: string | null
  ): Promise<RecoveredFlow> {
    const resumeAtKey = this.findResumeAtKey(execution.variables);
    const resumeAtValue = resumeAtKey
      ? (execution.variables[resumeAtKey] as string)
      : "unknown";

    const conversation = await this.conversationsRepository.retrieve(
      execution.conversationId
    );

    if (!conversation) {
      return {
        executionId: execution.id,
        conversationId: execution.conversationId,
        nodeId: execution.currentNodeId,
        resumeAt: resumeAtValue,
        status: "failed",
        error: "Conversation not found",
      };
    }

    if (!channelId) {
      return {
        executionId: execution.id,
        conversationId: execution.conversationId,
        nodeId: execution.currentNodeId,
        resumeAt: resumeAtValue,
        status: "failed",
        error: "Conversation has no channel",
      };
    }

    const channel = await this.channelsRepository.retrieve(
      channelId,
      workspaceId
    );

    if (!channel) {
      return {
        executionId: execution.id,
        conversationId: execution.conversationId,
        nodeId: execution.currentNodeId,
        resumeAt: resumeAtValue,
        status: "failed",
        error: "Channel not found",
      };
    }

    const originalStatus = execution.status;

    try {
      await this.flowExecutor.resumeFlow({
        execution,
        conversation,
        channel,
        workspaceId,
        userMessage: undefined,
      });

      await this.conversationsRepository.upsert(conversation, workspaceId);

      return {
        executionId: execution.id,
        conversationId: execution.conversationId,
        nodeId: execution.currentNodeId,
        resumeAt: resumeAtValue,
        status: "recovered",
      };
    } catch (error) {
      if (execution.status !== originalStatus && execution.status === "running") {
        try {
          execution.pause();
          await this.flowExecutionsRepository.update(execution);
        } catch (rollbackError) {
          console.error(
            `[RecoverStuckFlows] Failed to rollback execution ${execution.id} to paused state:`,
            rollbackError instanceof Error ? rollbackError.message : rollbackError
          );
        }
      }

      return {
        executionId: execution.id,
        conversationId: execution.conversationId,
        nodeId: execution.currentNodeId,
        resumeAt: resumeAtValue,
        status: "failed",
        error: this.sanitizeErrorMessage(error),
      };
    }
  }

  private findResumeAtKey(variables: Record<string, unknown>): string | null {
    for (const key of Object.keys(variables)) {
      if (key.startsWith("_intervalResumeAt_") || key === "_pauseResumeAt") {
        return key;
      }
    }
    return null;
  }

  private sanitizeErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "Unknown error";
    }

    const message = error.message;

    const sanitizedPatterns: Array<{ pattern: RegExp; replacement: string }> = [
      { pattern: /\/[^\s]+\.(ts|js|tsx|jsx):\d+:\d+/g, replacement: "[file]" },
      { pattern: /at\s+\S+\s+\([^)]+\)/g, replacement: "" },
      { pattern: /password[=:]\s*\S+/gi, replacement: "password=[REDACTED]" },
      { pattern: /token[=:]\s*\S+/gi, replacement: "token=[REDACTED]" },
      { pattern: /key[=:]\s*\S+/gi, replacement: "key=[REDACTED]" },
      { pattern: /secret[=:]\s*\S+/gi, replacement: "secret=[REDACTED]" },
    ];

    let sanitized = message;
    for (const { pattern, replacement } of sanitizedPatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    const maxLength = 200;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + "...";
    }

    return sanitized.trim() || "Error during flow recovery";
  }

  static instance() {
    return new RecoverStuckFlows(
      FlowExecutionsDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      FlowExecutorDriver.instance()
    );
  }
}

type InputDTO = {
  workspaceId: string;
};

type OutputDTO = {
  totalPaused: number;
  totalStuck: number;
  recovered: number;
  failed: number;
  details: RecoveredFlow[];
};
