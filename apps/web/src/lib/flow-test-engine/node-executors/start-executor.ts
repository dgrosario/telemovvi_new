import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";

export const startExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "start",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    context.addMessage({
      type: "system",
      content: "Fluxo iniciado",
      nodeId: node.id,
    });

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
