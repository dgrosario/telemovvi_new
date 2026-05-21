import { Channel } from "../../../domain/entities/channel";
import { Conversation } from "../../../domain/entities/conversation";
import { Flow } from "../../../domain/entities/flow";
import { FlowConnection } from "../../../domain/entities/flow-connection";
import { FlowExecution } from "../../../domain/entities/flow-execution";
import { FlowNode } from "../../../domain/entities/flow-node";
import { SystemVariable } from "../../../domain/entities/system-variable";
import { NotFound } from "../../../domain/errors/not-found";
import { VariableResolverService } from "../../../domain/services/variable-resolver-service";
import { ConversationsDatabaseRepository } from "../../repositories/conversations-repository";
import { FlowExecutionsDatabaseRepository } from "../../repositories/flow-executions-repository";
import { FlowsDatabaseRepository } from "../../repositories/flows-repository";
import { PartnersDatabaseRepository } from "../../repositories/partners-repository";
import { SystemVariablesDatabaseRepository } from "../../repositories/system-variables-repository";
import { DistributedLockDriver } from "../distributed-lock-driver";
import { RabbitMQMessagingDriver } from "../messaging-driver";
import { NodeHandlerRegistry } from "./node-handler-registry";
import { ExecutionCache, ExecutionContext } from "./types";

interface FlowsRepository {
  retrieve(id: string): Promise<Flow | null>;
}

interface FlowExecutionsRepository {
  retrieve(id: string): Promise<FlowExecution | null>;
  create(execution: FlowExecution): Promise<void>;
  update(execution: FlowExecution): Promise<void>;
  createLog(input: {
    executionId: string;
    nodeId: string;
    status: "success" | "failed";
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void>;
}

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
  setActiveFlowExecutionIdIfNull(
    conversationId: string,
    executionId: string
  ): Promise<boolean>;
}

interface PartnersMetadataRepository {
  getPartnerEmailByContactId(contactId: string): Promise<string | null>;
}

interface SystemVariablesRepository {
  listForWorkspace(workspaceId: string): Promise<SystemVariable[]>;
}

export class FlowExecutorDriver {
  private readonly handlerRegistry: NodeHandlerRegistry;
  private readonly variableResolver: VariableResolverService;
  private readonly lockDriver: DistributedLockDriver;

  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly systemVariablesRepository: SystemVariablesRepository,
    private readonly partnersMetadataRepository: PartnersMetadataRepository,
    lockDriver?: DistributedLockDriver
  ) {
    this.handlerRegistry = NodeHandlerRegistry.instance();
    this.variableResolver = VariableResolverService.instance();
    this.lockDriver = lockDriver ?? DistributedLockDriver.instance();
  }

  private findNextNode(
    currentNodeId: string,
    connections: FlowConnection[],
    sourceHandle?: string | null
  ): string | null {
    const outgoingConnections = connections.filter(
      (conn) => conn.source === currentNodeId
    );

    if (outgoingConnections.length === 0) {
      return null;
    }

    if (sourceHandle) {
      const byHandle = outgoingConnections.find(
        (conn) => conn.sourceHandle === sourceHandle
      );
      if (byHandle) {
        return byHandle.target;
      }

      // Compatibilidade: alguns fluxos legados podem persistir o alvo no nextNodeId
      const byLegacyTarget = outgoingConnections.find(
        (conn) => conn.target === sourceHandle
      );
      if (byLegacyTarget) {
        return byLegacyTarget.target;
      }

      // Fallback seguro quando existe apenas uma saída sem handle
      const withoutHandle = outgoingConnections.filter(
        (conn) => !conn.sourceHandle
      );
      if (withoutHandle.length === 1) {
        return withoutHandle[0]?.target ?? null;
      }

      return null;
    }

    return outgoingConnections[0]?.target ?? null;
  }

  async executeFlow(input: ExecuteFlowInput): Promise<void> {
    const lockResource = `flow:conversation:${input.conversation.id}`;
    const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const lockTtlMs = 60000;

    const lockAcquired = await this.lockDriver.acquire(lockResource, lockId, lockTtlMs);

    if (!lockAcquired) {
      console.log(
        "[FlowExecutorDriver] Could not acquire lock for conversation:",
        input.conversation.id
      );
      return;
    }

    try {
      const flow = await this.flowsRepository.retrieve(input.flowId);

      if (!flow) throw NotFound.throw("Flow");

      const startNode = flow.nodes.find((n) => n.type === "start");

      if (!startNode) {
        throw new Error("Flow must have a start node");
      }

      const execution = FlowExecution.create({
        flowId: flow.id,
        conversationId: input.conversation.id,
        initialNodeId: startNode.id,
      });

      await this.flowExecutionsRepository.create(execution);

      const dbAcquired = await this.conversationsRepository.setActiveFlowExecutionIdIfNull(
        input.conversation.id,
        execution.id
      );

      if (!dbAcquired) {
        console.log(
          "[FlowExecutorDriver] Flow already active for conversation, skipping:",
          input.conversation.id
        );
        execution.fail("Flow already active for this conversation");
        await this.flowExecutionsRepository.update(execution);
        return;
      }

      input.conversation.activeFlowExecutionId = execution.id;

      console.log(
        "[FlowExecutorDriver] Flow execution started:",
        execution.id,
        "for conversation:",
        input.conversation.id
      );

      await this.executeFromNode(
        execution,
        flow,
        startNode.id,
        input.conversation,
        input.channel,
        input.workspaceId,
        input.userMessage
      );
    } finally {
      await this.lockDriver.release(lockResource, lockId);
    }
  }

  async resumeFlow(input: ResumeFlowInput): Promise<void> {
    const { execution, conversation, channel, workspaceId, userMessage } = input;

    const flow = await this.flowsRepository.retrieve(execution.flowId);

    if (!flow) throw NotFound.throw("Flow");

    if (!execution.currentNodeId) {
      throw new Error("No current node to resume from");
    }

    execution.resume();
    await this.flowExecutionsRepository.update(execution);

    await this.executeFromNode(
      execution,
      flow,
      execution.currentNodeId,
      conversation,
      channel,
      workspaceId,
      userMessage
    );
  }

  private async executeFromNode(
    execution: FlowExecution,
    flow: Flow,
    startNodeId: string,
    conversation: Conversation,
    channel: Channel,
    workspaceId: string,
    userMessage?: string
  ): Promise<void> {
    // Resolver variaveis de sistema antes de executar os nos
    const resolvedSystemVariables = await this.resolveSystemVariables(
      workspaceId,
      conversation
    );

    // Cache isolado por execucao de fluxo para evitar memory leaks e dados desatualizados
    const cache: ExecutionCache = {
      partners: new Map(),
      partnerLabels: new Map(),
    };

    // Carregar metadados do partner (email)
    const partnerMetadata: { email?: string } = {};
    if (conversation.contact?.id) {
      const email = await this.partnersMetadataRepository.getPartnerEmailByContactId(
        conversation.contact.id
      );
      if (email) {
        partnerMetadata.email = email;
      }
    }

    let currentNodeId: string | null = startNodeId;

    while (currentNodeId) {
      const persistedExecution = await this.flowExecutionsRepository.retrieve(
        execution.id
      );

      if (!persistedExecution || persistedExecution.status !== "running") {
        conversation.activeFlowExecutionId = null;
        break;
      }

      execution.currentNodeId = persistedExecution.currentNodeId;
      execution.status = persistedExecution.status;
      execution.variables = persistedExecution.variables;
      execution.startedAt = persistedExecution.startedAt;
      execution.completedAt = persistedExecution.completedAt;
      execution.failedAt = persistedExecution.failedAt;
      execution.errorMessage = persistedExecution.errorMessage;

      const currentNode = flow.nodes.find((n) => n.id === currentNodeId);

      if (!currentNode) {
        execution.fail("Node not found in flow");
        await this.flowExecutionsRepository.update(execution);
        conversation.activeFlowExecutionId = null;
        break;
      }

      execution.moveToNode(currentNode.id);
      await this.flowExecutionsRepository.update(execution);

      const handler = this.handlerRegistry.getHandler(currentNode.type);

      if (!handler) {
        execution.fail(`No handler for node type: ${currentNode.type}`);
        await this.flowExecutionsRepository.update(execution);
        await this.flowExecutionsRepository.createLog({
          executionId: execution.id,
          nodeId: currentNode.id,
          status: "failed",
          errorMessage: `No handler for node type: ${currentNode.type}`,
        });
        conversation.activeFlowExecutionId = null;
        break;
      }

      const context: ExecutionContext = {
        flowExecution: execution,
        currentNode,
        conversation,
        channel,
        workspaceId,
        userMessage,
        resolvedSystemVariables,
        cache,
        partnerMetadata,
      };

      try {
        const result = await handler.execute(context);

        if (!result.success) {
          execution.fail(result.error || "Unknown error");
          await this.flowExecutionsRepository.update(execution);
          await this.flowExecutionsRepository.createLog({
            executionId: execution.id,
            nodeId: currentNode.id,
            status: "failed",
            errorMessage: result.error,
          });
          conversation.activeFlowExecutionId = null;
          break;
        }

        await this.flowExecutionsRepository.createLog({
          executionId: execution.id,
          nodeId: currentNode.id,
          status: "success",
        });

        if (result.shouldPause) {
          // Schedule resume BEFORE pausing to prevent stuck flows
          if (result.pauseUntil) {
            const delayMs = result.pauseUntil.getTime() - Date.now();
            if (delayMs > 0) {
              const scheduleStartTime = Date.now();
              const messagingDriver = RabbitMQMessagingDriver.instance();
              const scheduled = await messagingDriver.scheduleFlowResume({
                executionId: execution.id,
                conversationId: conversation.id,
                channelId: channel.id,
                workspaceId,
                delayMs,
              });

              const scheduleDuration = Date.now() - scheduleStartTime;

              if (!scheduled) {
                // ROLLBACK: Don't pause if we can't schedule the resume
                console.error(
                  `[FlowExecutorDriver] Failed to schedule resume for ${execution.id} - skipping pause to prevent stuck flow (took ${scheduleDuration}ms)`
                );
                // Continue execution without pausing (safe fallback)
                break;
              }

              // Monitor slow schedule operations (potential TOCTOU risk)
              if (scheduleDuration > 1000) {
                console.warn(
                  `[FlowExecutorDriver] Slow schedule operation for ${execution.id}: ${scheduleDuration}ms`
                );
              }

              console.log(
                `[FlowExecutorDriver] Scheduled flow resume for execution ${execution.id} in ${delayMs}ms (schedule took ${scheduleDuration}ms)`
              );
            }
          }

          // Only pause after successful schedule (or if no schedule needed)
          execution.pause();
          await this.flowExecutionsRepository.update(execution);
          break;
        }

        if (result.nextNodeId) {
          // nextNodeId can be a sourceHandle for nodes with multiple outputs
          // Use it to find the correct target node from connections
          currentNodeId = this.findNextNode(
            currentNode.id,
            flow.connections,
            result.nextNodeId
          );
        } else {
          currentNodeId = this.findNextNode(
            currentNode.id,
            flow.connections
          );
        }

        if (!currentNodeId) {
          execution.complete();
          await this.flowExecutionsRepository.update(execution);
          conversation.activeFlowExecutionId = null;
          console.log(
            "[FlowExecutorDriver] Flow execution completed:",
            execution.id
          );
          break;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        execution.fail(errorMessage);
        await this.flowExecutionsRepository.update(execution);
        await this.flowExecutionsRepository.createLog({
          executionId: execution.id,
          nodeId: currentNode.id,
          status: "failed",
          errorMessage,
        });
        conversation.activeFlowExecutionId = null;
        console.error(
          "[FlowExecutorDriver] Flow execution failed:",
          execution.id,
          errorMessage
        );
        break;
      }
    }
  }

  private async resolveSystemVariables(
    workspaceId: string,
    conversation: Conversation
  ): Promise<Record<string, string>> {
    const systemVariables =
      await this.systemVariablesRepository.listForWorkspace(workspaceId);

    const resolutionContext = VariableResolverService.buildContext(
      {
        contact: conversation.contact
          ? { name: conversation.contact.name, value: conversation.contact.value }
          : null,
        attendant: conversation.attendant
          ? { id: conversation.attendant.id, name: conversation.attendant.name }
          : null,
        sector: conversation.sector ? { name: conversation.sector.name } : null,
        id: conversation.id,
      },
      workspaceId
    );

    const resolved: Record<string, string> = {};

    for (const variable of systemVariables) {
      if (variable.isActive) {
        resolved[variable.key] = this.variableResolver.resolve(
          variable,
          resolutionContext
        );
      }
    }

    return resolved;
  }

  static instance() {
    return new FlowExecutorDriver(
      FlowsDatabaseRepository.instance(),
      FlowExecutionsDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      SystemVariablesDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance()
    );
  }
}

export type ExecuteFlowInput = {
  flowId: string;
  conversation: Conversation;
  channel: Channel;
  workspaceId: string;
  userMessage?: string;
};

export type ResumeFlowInput = {
  execution: FlowExecution;
  conversation: Conversation;
  channel: Channel;
  workspaceId: string;
  userMessage?: string;
};
