import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";

export const transferExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "transfer",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      sectorId?: string;
      sectorName?: string;
      label?: string;
    };

    const sectorName = data.sectorName ?? data.label ?? "Setor";

    context.addMessage({
      type: "system",
      content: `[Simulação] Transferência para setor: ${sectorName}`,
      nodeId: node.id,
    });

    return {
      nextNodeId: null,
      waitForInput: false,
    };
  },
};
