import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult, MenuOption } from "../types";
import { resolveVariables, delay } from "../types";

export const menuExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "menu",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      content?: string;
      options?: Array<{ id: string; label: string; value: string }>;
      label?: string;
    };

    const content = data.content ?? "";
    const options = data.options ?? [];

    const resolvedContent = resolveVariables(
      content,
      context.variables,
      context.simulatedContact
    );

    const menuOptions: MenuOption[] = options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      value: opt.value,
    }));

    const optionsText = menuOptions
      .map((opt, idx) => `${idx + 1}. ${opt.label}`)
      .join("\n");

    const fullContent = resolvedContent
      ? `${resolvedContent}\n\n${optionsText}`
      : optionsText;

    context.addMessage({
      type: "bot",
      content: fullContent,
      nodeId: node.id,
      metadata: {
        nodeType: "menu",
        options: menuOptions,
      },
    });

    await delay(300);

    return {
      nextNodeId: null,
      waitForInput: true,
      inputType: "menu",
      menuOptions,
    };
  },
};
