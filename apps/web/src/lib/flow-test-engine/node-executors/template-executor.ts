import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";
import { resolveVariables, delay } from "../types";

export const templateExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "template",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      templateId?: string;
      templateName?: string;
      templateContent?: string;
      variables?: Record<string, string>;
      label?: string;
    };

    const templateName = data.templateName ?? data.label ?? "Template";
    const templateContent = data.templateContent ?? "";

    const resolvedContent = resolveVariables(
      templateContent,
      context.variables,
      context.simulatedContact
    );

    if (resolvedContent) {
      context.addMessage({
        type: "bot",
        content: resolvedContent,
        nodeId: node.id,
        metadata: {
          nodeType: "template",
        },
      });
    } else {
      context.addMessage({
        type: "system",
        content: `[Simulacao] Template enviado: ${templateName}`,
        nodeId: node.id,
      });
    }

    await delay(500);

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
