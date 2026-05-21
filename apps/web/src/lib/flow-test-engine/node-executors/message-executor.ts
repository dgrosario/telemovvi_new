import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";
import { resolveVariables, delay } from "../types";

export const messageExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "message",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      content?: string;
      label?: string;
    };

    const content = data.content ?? "";
    const resolvedContent = resolveVariables(
      content,
      context.variables,
      context.simulatedContact
    );

    context.addMessage({
      type: "bot",
      content: resolvedContent,
      nodeId: node.id,
      metadata: {
        nodeType: "message",
      },
    });

    await delay(500);

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
