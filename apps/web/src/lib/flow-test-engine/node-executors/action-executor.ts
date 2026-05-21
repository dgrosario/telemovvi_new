import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";

type ActionType = "tag_contact" | "assign_conversation" | "set_variable" | "close_conversation" | "send_message" | "send_template" | "transfer" | "pause_flow" | "capture_input";

interface SingleAction {
  id: string;
  actionType: ActionType;
  tagOperation?: "add" | "remove";
  labelIds?: string[];
  attendantId?: string;
  variableName?: string;
  variableValue?: string;
  content?: string;
  messageType?: string;
  sectorId?: string;
  sectorName?: string;
  pauseDuration?: number;
  pauseUnit?: string;
  question?: string;
  templateId?: string;
}

export const actionExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "action",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      actionType?: ActionType;
      actions?: SingleAction[];
      tagOperation?: "add" | "remove";
      labelIds?: string[];
      attendantId?: string;
      variableName?: string;
      variableValue?: string;
      content?: string;
      messageType?: string;
      sectorId?: string;
      sectorName?: string;
      pauseDuration?: number;
      pauseUnit?: string;
      question?: string;
      templateId?: string;
      label?: string;
    };

    // Check if we have multiple actions
    if (data.actions && data.actions.length > 0) {
      // Execute all actions sequentially
      for (let i = 0; i < data.actions.length; i++) {
        const action = data.actions[i]!;
        await executeSingleAction(action, node.id, context, i + 1, data.actions.length);
      }
    } else {
      // Legacy single action format
      await executeSingleAction(data as SingleAction, node.id, context);
    }

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};

async function executeSingleAction(
  action: SingleAction | { actionType?: ActionType; [key: string]: any },
  nodeId: string,
  context: ExecutionContext,
  actionIndex?: number,
  totalActions?: number
): Promise<void> {
  const actionType = action.actionType;
  const prefix = actionIndex && totalActions && totalActions > 1 
    ? `[Ação ${actionIndex}/${totalActions}] ` 
    : "";

  switch (actionType) {
    case "tag_contact": {
      const operation = action.tagOperation ?? "add";
      const labelIds = action.labelIds ?? [];
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] ${operation === "add" ? "Adicionando" : "Removendo"} ${labelIds.length} etiqueta(s)`,
        nodeId,
      });
      break;
    }

    case "assign_conversation": {
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Conversa atribuída ao atendente`,
        nodeId,
      });
      break;
    }

    case "set_variable": {
      const varName = action.variableName ?? "";
      const varValue = action.variableValue ?? "";
      if (varName) {
        context.setVariable(varName, varValue);
        context.addMessage({
          type: "system",
          content: `${prefix}Variável definida: ${varName} = "${varValue}"`,
          nodeId,
        });
      }
      break;
    }

    case "close_conversation": {
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Conversa encerrada`,
        nodeId,
      });
      break;
    }

    case "send_message": {
      const messageType = action.messageType || "text";
      const content = action.content || "";
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Enviando ${messageType === "text" ? "mensagem" : messageType}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
        nodeId,
      });
      break;
    }

    case "send_template": {
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Enviando template: ${action.templateId || "não configurado"}`,
        nodeId,
      });
      break;
    }

    case "transfer": {
      const sectorName = action.sectorName || "qualquer setor";
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Transferindo para: ${sectorName}`,
        nodeId,
      });
      break;
    }

    case "pause_flow": {
      const duration = action.pauseDuration || 5;
      const unit = action.pauseUnit || "minutes";
      const unitLabels: Record<string, string> = {
        minutes: "minutos",
        hours: "horas",
        days: "dias",
      };
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Pausando por ${duration} ${unitLabels[unit] || unit}`,
        nodeId,
      });
      break;
    }

    case "capture_input": {
      const question = action.question || "";
      context.addMessage({
        type: "system",
        content: `${prefix}[Simulação] Capturando entrada: ${question.substring(0, 50)}${question.length > 50 ? "..." : ""}`,
        nodeId,
      });
      break;
    }

    default: {
      context.addMessage({
        type: "system",
        content: `${prefix}Ação desconhecida: ${actionType}`,
        nodeId,
      });
    }
  }
}
