import { FlowsDatabaseRepository } from "../../infra/repositories/flows-repository";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { FlowExecutorDriver } from "../../infra/drivers/flow-executor/flow-executor-driver";
import { NotFound } from "../../domain/errors/not-found";

interface FlowsRepository {
  retrieveByWorkspace(id: string, workspaceId: string): Promise<any | null>;
}

interface FlowExecutionsRepository {
  create(execution: any): Promise<void>;
}

interface ConversationsRepository {
  retrieve(id: string): Promise<any | null>;
  upsert(conversation: any, workspaceId: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string): Promise<any | null>;
}

export class StartFlowInConversation {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly flowExecutor: FlowExecutorDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const flow = await this.flowsRepository.retrieveByWorkspace(
      input.flowId,
      input.workspaceId
    );

    if (!flow) {
      throw NotFound.throw("Flow");
    }

    if (flow.status !== "active") {
      throw new Error("Flow must be active to be executed");
    }

    const conversation = await this.conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      throw NotFound.throw("Conversation");
    }

    const channel = await this.channelsRepository.retrieve(
      conversation.channel.id
    );

    if (!channel) {
      throw NotFound.throw("Channel");
    }

    await this.flowExecutor.executeFlow({
      flowId: flow.id,
      conversation,
      channel,
      workspaceId: input.workspaceId,
    });

    return {
      success: true,
      flowId: flow.id,
      conversationId: conversation.id,
    };
  }

  static instance() {
    return new StartFlowInConversation(
      FlowsDatabaseRepository.instance(),
      FlowExecutionsDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      FlowExecutorDriver.instance()
    );
  }
}

type InputDTO = {
  flowId: string;
  conversationId: string;
  workspaceId: string;
};

type OutputDTO = {
  success: boolean;
  flowId: string;
  conversationId: string;
};
