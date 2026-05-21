import { FlowNode } from "../../../../domain/entities/flow-node";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

export class StartNodeHandler implements NodeHandler {
  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "start";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  static instance() {
    return new StartNodeHandler();
  }
}
