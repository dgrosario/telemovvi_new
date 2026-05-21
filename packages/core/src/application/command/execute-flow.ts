import { Channel } from "../../domain/entities/channel";
import { Conversation } from "../../domain/entities/conversation";
import { Flow } from "../../domain/entities/flow";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { NotFound } from "../../domain/errors/not-found";
import { FlowExecutorDriver } from "../../infra/drivers/flow-executor";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";
import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";

interface FlowsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<Flow | null>;
}

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

interface FlowExecutionsRepository {
  listPausedByConversation(conversationId: string): Promise<FlowExecution[]>;
  update(execution: FlowExecution): Promise<void>;
}

interface FlowExecutor {
  executeFlow(input: {
    flowId: string;
    conversation: Conversation;
    channel: Channel;
    workspaceId: string;
  }): Promise<void>;
}

export class ExecuteFlow {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly flowExecutor: FlowExecutor,
    private readonly flowExecutionsRepository: FlowExecutionsRepository
  ) {}

  async execute(input: InputDTO): Promise<void> {
    const flow = await this.flowsRepository.retrieveByWorkspace(
      input.flowId,
      input.workspaceId
    );

    if (!flow) throw NotFound.throw("Flow");

    if (flow.status !== "active") {
      throw new Error("Flow must be active to execute");
    }

    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) throw NotFound.throw("Conversation");

    if (!conversation.channel) {
      throw new Error("Cannot execute flow on internal conversations");
    }

    const channel = await this.channelsRepository.retrieve(
      conversation.channel.id,
      input.workspaceId
    );

    if (!channel) throw NotFound.throw("Channel");

    const pausedExecutions =
      await this.flowExecutionsRepository.listPausedByConversation(
        conversation.id
      );

    for (const execution of pausedExecutions) {
      if (execution.currentNodeId?.startsWith("interval-")) {
        continue;
      }

      execution.complete();
      await this.flowExecutionsRepository.update(execution);
      console.log(
        "[ExecuteFlow] Completed paused flow execution:",
        execution.id,
        "for conversation:",
        conversation.id
      );
    }

    if (conversation.activeFlowExecutionId) {
      conversation.activeFlowExecutionId = null;
    }

    await this.flowExecutor.executeFlow({
      flowId: flow.id,
      conversation,
      channel,
      workspaceId: input.workspaceId,
    });

    await this.conversationsRepository.upsert(conversation, input.workspaceId);
  }

  static instance() {
    return new ExecuteFlow(
      FlowsDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      FlowExecutorDriver.instance(),
      FlowExecutionsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  flowId: string;
  conversationId: string;
  workspaceId: string;
};
