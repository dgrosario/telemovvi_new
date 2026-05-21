import { FlowNode } from "../../../../domain/entities/flow-node";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

export class EndNodeHandler implements NodeHandler {
  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "end";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.EndData;

    // Mark flow as completed to prevent re-execution
    context.conversation.markFlowCompleted();

    // If closeConversation is enabled, mark conversation to be closed
    if (nodeData.closeConversation) {
      context.conversation.close();
    }

    // Return success with no next node - this will complete the flow
    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  static instance(): EndNodeHandler {
    return new EndNodeHandler();
  }
}
