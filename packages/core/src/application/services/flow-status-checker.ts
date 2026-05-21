import { Conversation } from "../../domain/entities/conversation";
import { Flow } from "../../domain/entities/flow";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { FlowNode } from "../../domain/entities/flow-node";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowExecutionsRepository {
  retrieve(id: string): Promise<FlowExecution | null>;
  update(execution: FlowExecution): Promise<void>;
}

interface FlowsRepository {
  retrieve(id: string): Promise<Flow | null>;
}

export class FlowStatusChecker {
  constructor(
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly flowsRepository: FlowsRepository
  ) {}

  async checkAndTerminateIfNeeded(
    conversation: Conversation,
    _workspaceId: string
  ): Promise<boolean> {
    try {
      if (!conversation.activeFlowExecutionId) {
        return false;
      }

      const execution = await this.flowExecutionsRepository.retrieve(
        conversation.activeFlowExecutionId
      );

      if (!execution) {
        return false;
      }

      if (execution.status !== "running" && execution.status !== "paused") {
        return false;
      }

      const flow = await this.flowsRepository.retrieve(execution.flowId);
      if (!flow) {
        return false;
      }

      const startNode = flow.nodes.find((n) => n.type === "start");
      if (!startNode) {
        return false;
      }

      const startData = startNode.data as FlowNode.StartData;
      const allowedStatuses = startData.triggerOnStatuses;

      if (!allowedStatuses || allowedStatuses.length === 0) {
        return false;
      }

      if (conversation.status === "internal") {
        return false;
      }

      const currentStatus = conversation.status as FlowNode.TriggerStatus;
      if (!allowedStatuses.includes(currentStatus)) {
        execution.complete();
        await this.flowExecutionsRepository.update(execution);
        conversation.activeFlowExecutionId = null;
        return true;
      }

      return false;
    } catch (error) {
      console.error("[FlowStatusChecker] Failed to check/terminate flow:", error);
      return false;
    }
  }

  static instance() {
    return new FlowStatusChecker(
      FlowExecutionsDatabaseRepository.instance(),
      FlowsDatabaseRepository.instance()
    );
  }
}
