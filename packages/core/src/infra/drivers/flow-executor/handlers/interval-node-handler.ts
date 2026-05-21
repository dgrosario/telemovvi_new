import { FlowNode } from "../../../../domain/entities/flow-node";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

export class IntervalNodeHandler implements NodeHandler {
  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "interval";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.IntervalData;

    const delay = nodeData.delay || 0;

    if (delay < 0) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Interval delay must be positive",
      };
    }

    if (delay === 0) {
      return {
        success: true,
        shouldPause: false,
        nextNodeId: null,
      };
    }

    const resumeAtKey = `_intervalResumeAt_${context.currentNode.id}`;
    const existingResumeAt = context.flowExecution.getVariable(resumeAtKey);

    if (existingResumeAt && typeof existingResumeAt === "string") {
      const resumeAtDate = new Date(existingResumeAt);
      const now = new Date();

      if (now >= resumeAtDate) {
        delete context.flowExecution.variables[resumeAtKey];

        return {
          success: true,
          shouldPause: false,
          nextNodeId: null,
        };
      }

      return {
        success: true,
        shouldPause: true,
        nextNodeId: null,
        pauseUntil: resumeAtDate,
      };
    }

    const resumeAt = new Date(Date.now() + delay * 1000);
    context.flowExecution.setVariable(resumeAtKey, resumeAt.toISOString());

    return {
      success: true,
      shouldPause: true,
      nextNodeId: null,
      pauseUntil: resumeAt,
    };
  }

  static instance() {
    return new IntervalNodeHandler();
  }
}
