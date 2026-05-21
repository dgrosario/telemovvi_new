import { FlowNode } from "../../../../domain/entities/flow-node";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

export class RandomNodeHandler implements NodeHandler {
  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "random";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.RandomData;

    if (!nodeData.outputs || nodeData.outputs.length === 0) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "No outputs defined for random node",
      };
    }

    const random = Math.random() * 100;

    let accumulated = 0;
    for (const output of nodeData.outputs) {
      accumulated += output.percentage;
      if (random <= accumulated) {
        return {
          success: true,
          shouldPause: false,
          nextNodeId: output.id,
        };
      }
    }

    const lastOutput = nodeData.outputs[nodeData.outputs.length - 1];
    return {
      success: true,
      shouldPause: false,
      nextNodeId: lastOutput?.id ?? null,
    };
  }

  static instance() {
    return new RandomNodeHandler();
  }
}
