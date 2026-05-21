import type { Node, Edge } from "reactflow";
import type { TestMessage, ExecutionLogEntry } from "@/stores/flow-test-store";

export interface MenuOption {
  id: string;
  label: string;
  value: string;
}

export interface ExecutionResult {
  nextNodeId: string | null;
  waitForInput: boolean;
  inputType?: "text" | "menu";
  menuOptions?: MenuOption[];
  error?: string;
}

export interface ExecutionContext {
  nodes: Node[];
  edges: Edge[];
  variables: Record<string, string | number | boolean>;
  simulatedContact: {
    name: string;
    phone: string;
  };
  addMessage: (message: Omit<TestMessage, "id" | "timestamp">) => void;
  addLogEntry: (entry: Omit<ExecutionLogEntry, "id" | "timestamp">) => void;
  setVariable: (key: string, value: string | number | boolean) => void;
  findNextNode: (nodeId: string, handleId?: string) => string | null;
}

export interface NodeExecutor {
  canHandle: (nodeType: string) => boolean;
  execute: (node: Node, context: ExecutionContext) => Promise<ExecutionResult>;
}

export interface TestEngineCallbacks {
  onNodeEnter: (nodeId: string) => void;
  onNodeExit: (nodeId: string) => void;
  onMessage: (message: Omit<TestMessage, "id" | "timestamp">) => void;
  onLogEntry: (entry: Omit<ExecutionLogEntry, "id" | "timestamp">) => void;
  onVariableSet: (key: string, value: string | number | boolean) => void;
  onWaitForInput: (nodeId: string, inputType: "text" | "menu", options?: MenuOption[]) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export interface TestEngineConfig {
  nodes: Node[];
  edges: Edge[];
  callbacks: TestEngineCallbacks;
  simulatedContact: {
    name: string;
    phone: string;
  };
  executionDelay?: number;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function findNextNodeInEdges(
  edges: Edge[],
  sourceNodeId: string,
  sourceHandle?: string
): string | null {
  const edge = edges.find((e) => {
    if (sourceHandle) {
      return e.source === sourceNodeId && e.sourceHandle === sourceHandle;
    }
    return e.source === sourceNodeId;
  });
  return edge?.target ?? null;
}

export function resolveVariables(
  content: string,
  variables: Record<string, string | number | boolean>,
  contact: { name: string; phone: string }
): string {
  let resolved = content;

  resolved = resolved.replace(/\{\{contact\.name\}\}/gi, contact.name);
  resolved = resolved.replace(/\{\{contact\.phone\}\}/gi, contact.phone);
  resolved = resolved.replace(/\{\{partner\.name\}\}/gi, contact.name);

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    resolved = resolved.replace(regex, String(value));
  }

  return resolved;
}
