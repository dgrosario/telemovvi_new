import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";

export const subflowExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "subflow",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      targetFlowId?: string | null;
      targetFlowName?: string | null;
      waitForCompletion?: boolean;
      label?: string;
    };

    if (!data.targetFlowId) {
      context.addMessage({
        type: "system",
        content: "[Erro] Nenhum fluxo alvo selecionado para este subfluxo",
        nodeId: node.id,
      });

      return {
        nextNodeId: null,
        waitForInput: false,
        error: "Nenhum fluxo alvo selecionado",
      };
    }

    const flowName = data.targetFlowName || "Fluxo sem nome";
    const waitMode = data.waitForCompletion !== false;

    if (waitMode) {
      context.addMessage({
        type: "system",
        content: `[Simulação] Executando subfluxo "${flowName}" (síncrono - aguardando conclusão)`,
        nodeId: node.id,
      });

      context.addLogEntry({
        nodeId: node.id,
        nodeType: "subflow",
        nodeLabel: data.label || "Subfluxo",
        action: "exit",
        details: `Executando subfluxo: ${flowName} (modo síncrono)`,
      });
    } else {
      context.addMessage({
        type: "system",
        content: `[Simulação] Disparando subfluxo "${flowName}" (assíncrono - fire and forget)`,
        nodeId: node.id,
      });

      context.addLogEntry({
        nodeId: node.id,
        nodeType: "subflow",
        nodeLabel: data.label || "Subfluxo",
        action: "exit",
        details: `Disparando subfluxo: ${flowName} (modo assíncrono)`,
      });
    }

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
