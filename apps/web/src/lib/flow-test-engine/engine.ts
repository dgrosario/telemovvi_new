import type { Node, Edge } from "reactflow";
import type {
  TestEngineConfig,
  ExecutionContext,
  ExecutionResult,
  NodeExecutor,
  MenuOption,
} from "./types";
import { delay, findNextNodeInEdges } from "./types";
import { startExecutor } from "./node-executors/start-executor";
import { messageExecutor } from "./node-executors/message-executor";
import { menuExecutor } from "./node-executors/menu-executor";
import { intervalExecutor } from "./node-executors/interval-executor";
import { conditionalExecutor } from "./node-executors/conditional-executor";
import { actionExecutor } from "./node-executors/action-executor";
import { transferExecutor } from "./node-executors/transfer-executor";
import { templateExecutor } from "./node-executors/template-executor";
import { subflowExecutor } from "./node-executors/subflow-executor";

export class FlowTestEngine {
  private config: TestEngineConfig;
  private variables: Record<string, string | number | boolean> = {};
  private currentNodeId: string | null = null;
  private isRunning = false;
  private pendingInputResolve: ((value: string) => void) | null = null;
  private executors: NodeExecutor[];

  constructor(config: TestEngineConfig) {
    this.config = config;
    this.executors = [
      startExecutor,
      messageExecutor,
      menuExecutor,
      intervalExecutor,
      conditionalExecutor,
      actionExecutor,
      transferExecutor,
      templateExecutor,
      subflowExecutor,
    ];
  }

  private createContext(): ExecutionContext {
    return {
      nodes: this.config.nodes,
      edges: this.config.edges,
      variables: this.variables,
      simulatedContact: this.config.simulatedContact,
      addMessage: (message) => {
        this.config.callbacks.onMessage(message);
      },
      addLogEntry: (entry) => {
        this.config.callbacks.onLogEntry(entry);
      },
      setVariable: (key, value) => {
        this.variables[key] = value;
        this.config.callbacks.onVariableSet(key, value);
      },
      findNextNode: (nodeId, handleId) => {
        return findNextNodeInEdges(this.config.edges, nodeId, handleId);
      },
    };
  }

  private findStartNode(): Node | null {
    return this.config.nodes.find((n) => n.type === "start") ?? null;
  }

  private findNodeById(nodeId: string): Node | null {
    return this.config.nodes.find((n) => n.id === nodeId) ?? null;
  }

  private getExecutor(nodeType: string): NodeExecutor | null {
    return this.executors.find((e) => e.canHandle(nodeType)) ?? null;
  }

  async start(): Promise<void> {
    const startNode = this.findStartNode();
    if (!startNode) {
      this.config.callbacks.onError("O fluxo deve ter um bloco de início");
      return;
    }

    this.isRunning = true;
    this.variables = {};

    await this.executeNode(startNode.id);
  }

  private async executeNode(nodeId: string): Promise<void> {
    if (!this.isRunning) return;

    const node = this.findNodeById(nodeId);
    if (!node) {
      this.config.callbacks.onError(`Bloco não encontrado: ${nodeId}`);
      this.isRunning = false;
      return;
    }

    this.currentNodeId = nodeId;
    this.config.callbacks.onNodeEnter(nodeId);

    const context = this.createContext();
    const nodeLabel = (node.data as { label?: string })?.label ?? node.type ?? "Bloco";

    context.addLogEntry({
      nodeId,
      nodeType: node.type ?? "unknown",
      nodeLabel,
      action: "enter",
    });

    const executor = this.getExecutor(node.type ?? "");
    if (!executor) {
      context.addLogEntry({
        nodeId,
        nodeType: node.type ?? "unknown",
        nodeLabel,
        action: "error",
          details: `Executor não encontrado para tipo: ${node.type}`,
      });
      this.config.callbacks.onError(`Tipo de bloco não suportado: ${node.type}`);
      this.isRunning = false;
      return;
    }

    try {
      const result = await executor.execute(node, context);

      if (result.error) {
        context.addLogEntry({
          nodeId,
          nodeType: node.type ?? "unknown",
          nodeLabel,
          action: "error",
          details: result.error,
        });
        this.config.callbacks.onError(result.error);
        this.isRunning = false;
        return;
      }

      context.addLogEntry({
        nodeId,
        nodeType: node.type ?? "unknown",
        nodeLabel,
        action: "exit",
      });

      this.config.callbacks.onNodeExit(nodeId);

      if (result.waitForInput) {
        context.addLogEntry({
          nodeId,
          nodeType: node.type ?? "unknown",
          nodeLabel,
          action: "wait",
          details: `Aguardando entrada do usuário (${result.inputType})`,
        });

        this.config.callbacks.onWaitForInput(
          nodeId,
          result.inputType ?? "text",
          result.menuOptions
        );

        const userInput = await this.waitForUserInput();

        if (!this.isRunning) return;

        context.addMessage({
          type: "user",
          content: userInput,
        });

        const nextNodeId = this.determineNextNode(node, result, userInput);
        if (nextNodeId) {
          await delay(this.config.executionDelay ?? 300);
          await this.executeNode(nextNodeId);
        } else {
          this.complete();
        }
      } else if (result.nextNodeId) {
        await delay(this.config.executionDelay ?? 300);
        await this.executeNode(result.nextNodeId);
      } else {
        const defaultNext = findNextNodeInEdges(this.config.edges, nodeId);
        if (defaultNext) {
          await delay(this.config.executionDelay ?? 300);
          await this.executeNode(defaultNext);
        } else {
          this.complete();
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      context.addLogEntry({
        nodeId,
        nodeType: node.type ?? "unknown",
        nodeLabel,
        action: "error",
        details: errorMessage,
      });
      this.config.callbacks.onError(errorMessage);
      this.isRunning = false;
    }
  }

  private determineNextNode(
    node: Node,
    result: ExecutionResult,
    userInput: string
  ): string | null {
    if (node.type === "menu" && result.menuOptions) {
      const selectedOption = result.menuOptions.find(
        (opt) => opt.value === userInput || opt.label === userInput
      );
      if (selectedOption) {
        return findNextNodeInEdges(this.config.edges, node.id, selectedOption.id);
      }
    }
    return findNextNodeInEdges(this.config.edges, node.id);
  }

  private waitForUserInput(): Promise<string> {
    return new Promise((resolve) => {
      this.pendingInputResolve = resolve;
    });
  }

  provideUserInput(input: string): void {
    if (this.pendingInputResolve) {
      const resolve = this.pendingInputResolve;
      this.pendingInputResolve = null;
      resolve(input);
    }
  }

  private complete(): void {
    this.isRunning = false;
    this.config.callbacks.onComplete();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pendingInputResolve) {
      this.pendingInputResolve = null;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  getVariables(): Record<string, string | number | boolean> {
    return { ...this.variables };
  }
}
