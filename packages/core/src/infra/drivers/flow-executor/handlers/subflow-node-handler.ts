import { Flow } from "../../../../domain/entities/flow";
import { FlowConnection } from "../../../../domain/entities/flow-connection";
import { FlowExecution } from "../../../../domain/entities/flow-execution";
import { FlowNode } from "../../../../domain/entities/flow-node";
import { FlowExecutionsDatabaseRepository } from "../../../repositories/flow-executions-repository";
import { FlowsDatabaseRepository } from "../../../repositories/flows-repository";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

interface FlowsRepository {
  retrieve(id: string): Promise<Flow | null>;
}

interface FlowExecutionsRepository {
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

interface HandlerRegistry {
  getHandler(nodeType: FlowNode.Type): NodeHandler | null;
}

export class SubflowNodeHandler implements NodeHandler {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly getHandlerRegistry: () => HandlerRegistry
  ) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "subflow";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.SubflowData;

    if (!nodeData.targetFlowId) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Nenhum fluxo alvo selecionado",
      };
    }

    const targetFlow = await this.flowsRepository.retrieve(nodeData.targetFlowId);

    if (!targetFlow) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Fluxo alvo nao encontrado",
      };
    }

    if (targetFlow.status !== "active") {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: `Fluxo alvo "${targetFlow.name}" nao esta ativo`,
      };
    }

    const startNode = targetFlow.nodes.find((n) => n.type === "start");

    if (!startNode) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Fluxo alvo nao possui no de inicio",
      };
    }

    if (nodeData.waitForCompletion) {
      const subExecution = FlowExecution.create({
        flowId: targetFlow.id,
        conversationId: context.conversation.id,
        initialNodeId: startNode.id,
      });

      await this.flowExecutionsRepository.create(subExecution);

      await this.executeSubflow(
        subExecution,
        targetFlow,
        startNode.id,
        context
      );
    }

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
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

      const byLegacyTarget = outgoingConnections.find(
        (conn) => conn.target === sourceHandle
      );
      if (byLegacyTarget) {
        return byLegacyTarget.target;
      }

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

  private async executeSubflow(
    execution: FlowExecution,
    flow: Flow,
    startNodeId: string,
    parentContext: ExecutionContext
  ): Promise<void> {
    const handlerRegistry = this.getHandlerRegistry();
    let currentNodeId: string | null = startNodeId;

    while (currentNodeId) {
      const currentNode = flow.nodes.find((n) => n.id === currentNodeId);

      if (!currentNode) {
        execution.fail("Node not found in subflow");
        await this.flowExecutionsRepository.update(execution);
        break;
      }

      execution.moveToNode(currentNode.id);
      await this.flowExecutionsRepository.update(execution);

      const handler = handlerRegistry.getHandler(currentNode.type);

      if (!handler) {
        execution.fail(`No handler for node type: ${currentNode.type}`);
        await this.flowExecutionsRepository.update(execution);
        await this.flowExecutionsRepository.createLog({
          executionId: execution.id,
          nodeId: currentNode.id,
          status: "failed",
          errorMessage: `No handler for node type: ${currentNode.type}`,
        });
        break;
      }

      const context: ExecutionContext = {
        flowExecution: execution,
        currentNode,
        conversation: parentContext.conversation,
        channel: parentContext.channel,
        workspaceId: parentContext.workspaceId,
        userMessage: parentContext.userMessage,
        resolvedSystemVariables: parentContext.resolvedSystemVariables,
        cache: parentContext.cache,
      };

      try {
        const result = await handler.execute(context);

        if (!result.success) {
          execution.fail(result.error ?? "Unknown error");
          await this.flowExecutionsRepository.update(execution);
          await this.flowExecutionsRepository.createLog({
            executionId: execution.id,
            nodeId: currentNode.id,
            status: "failed",
            errorMessage: result.error,
          });
          break;
        }

        await this.flowExecutionsRepository.createLog({
          executionId: execution.id,
          nodeId: currentNode.id,
          status: "success",
        });

        if (result.shouldPause) {
          execution.pause();
          await this.flowExecutionsRepository.update(execution);
          break;
        }

        if (result.nextNodeId) {
          currentNodeId = this.findNextNode(
            currentNode.id,
            flow.connections,
            result.nextNodeId
          );
        } else {
          currentNodeId = this.findNextNode(currentNode.id, flow.connections);
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
        console.error(
          "[SubflowNodeHandler] Subflow execution failed:",
          execution.id,
          errorMessage
        );
        break;
      }
    }

    if (!currentNodeId && execution.status !== "paused" && execution.status !== "failed") {
      execution.complete();
      await this.flowExecutionsRepository.update(execution);
      console.log("[SubflowNodeHandler] Subflow execution completed:", execution.id);
    }
  }

  static instance(getHandlerRegistry: () => HandlerRegistry) {
    return new SubflowNodeHandler(
      FlowsDatabaseRepository.instance(),
      FlowExecutionsDatabaseRepository.instance(),
      getHandlerRegistry
    );
  }
}
