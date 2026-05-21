import { describe, expect, it, vi } from "vitest";
import { FlowExecution } from "@omnichannel/core/domain/entities/flow-execution";
import { FlowResumeConsumer } from "./flow-resume-consumer";

describe("FlowResumeConsumer", () => {
  it("cancels scheduled resume when conversation already has attendant", async () => {
    const flowExecutionsRepository = {
      retrieve: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const conversationsRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
      clearActiveFlowExecution: vi.fn().mockResolvedValue(undefined),
    };
    const channelsRepository = {
      retrieve: vi.fn(),
    };
    const flowExecutor = {
      resumeFlow: vi.fn().mockResolvedValue(undefined),
    };

    const execution = FlowExecution.create({
      flowId: "flow-1",
      conversationId: "conversation-1",
      initialNodeId: "node-1",
    });
    execution.pause();

    flowExecutionsRepository.retrieve.mockResolvedValue(execution);
    conversationsRepository.retrieve.mockResolvedValue({
      id: "conversation-1",
      attendant: { id: "user-1", name: "Agent" },
    });
    channelsRepository.retrieve.mockResolvedValue(null);

    const consumer = new FlowResumeConsumer() as any;
    consumer.FlowExecutionsRepository = {
      instance: () => flowExecutionsRepository,
    };
    consumer.ConversationsRepository = {
      instance: () => conversationsRepository,
    };
    consumer.ChannelsRepository = {
      instance: () => channelsRepository,
    };
    consumer.FlowExecutorDriver = {
      instance: () => flowExecutor,
    };

    await consumer.handleFlowResume({
      content: Buffer.from(
        JSON.stringify({
          executionId: execution.id,
          conversationId: "conversation-1",
          channelId: "channel-1",
          workspaceId: "workspace-1",
          scheduledAt: new Date().toISOString(),
        }),
      ),
    });

    expect(flowExecutionsRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: execution.id,
        status: "completed",
      }),
    );
    expect(conversationsRepository.clearActiveFlowExecution).toHaveBeenCalledWith(
      "conversation-1",
    );
    expect(flowExecutor.resumeFlow).not.toHaveBeenCalled();
  });
});
