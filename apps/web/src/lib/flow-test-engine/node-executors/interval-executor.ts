import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";
import { delay } from "../types";

const TEST_DELAY_FACTOR = 0.1;
const MAX_TEST_DELAY = 2000;

export const intervalExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "interval",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      delay?: number;
      unit?: "seconds" | "minutes" | "hours";
      label?: string;
    };

    const delayValue = data.delay ?? 5;
    const unit = data.unit ?? "seconds";

    let delayMs = delayValue * 1000;
    if (unit === "minutes") delayMs = delayValue * 60 * 1000;
    if (unit === "hours") delayMs = delayValue * 60 * 60 * 1000;

    const testDelay = Math.min(delayMs * TEST_DELAY_FACTOR, MAX_TEST_DELAY);

    const unitLabel = {
      seconds: "segundos",
      minutes: "minutos",
      hours: "horas",
    }[unit];

    context.addMessage({
      type: "system",
      content: `Aguardando ${delayValue} ${unitLabel}... (simulado: ${Math.round(testDelay)}ms)`,
      nodeId: node.id,
    });

    await delay(testDelay);

    const nextNodeId = context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
