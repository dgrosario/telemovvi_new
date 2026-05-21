import { FlowExecution } from "../../domain/entities/flow-execution";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";

interface FlowExecutionsRepository {
  retrieveActiveByConversation(conversationId: string): Promise<FlowExecution | null>;
  listPausedByConversation(conversationId: string): Promise<FlowExecution[]>;
  update(execution: FlowExecution): Promise<void>;
}

interface ConversationsRepository {
  clearActiveFlowExecution(conversationId: string): Promise<void>;
}

export class HumanTakeoverFlowTerminator {
  constructor(
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async terminateForConversation(conversationId: string): Promise<void> {
    if (!conversationId) return;

    const runningExecution =
      await this.flowExecutionsRepository.retrieveActiveByConversation(
        conversationId
      );
    const pausedExecutions =
      await this.flowExecutionsRepository.listPausedByConversation(conversationId);

    const executionsToTerminate = new Map<string, FlowExecution>();

    if (runningExecution) {
      executionsToTerminate.set(runningExecution.id, runningExecution);
    }

    for (const pausedExecution of pausedExecutions) {
      executionsToTerminate.set(pausedExecution.id, pausedExecution);
    }

    for (const execution of executionsToTerminate.values()) {
      execution.complete();
      await this.flowExecutionsRepository.update(execution);
    }

    await this.conversationsRepository.clearActiveFlowExecution(conversationId);
  }

  static instance() {
    return new HumanTakeoverFlowTerminator(
      FlowExecutionsDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance()
    );
  }
}
