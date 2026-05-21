import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecoverStuckFlows } from "./recover-stuck-flows";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { Conversation } from "../../domain/entities/conversation";
import { ConversationChannel } from "../../domain/entities/conversation-channel";
import { Channel } from "../../domain/entities/channel";

describe("RecoverStuckFlows", () => {
  let flowExecutionsRepository: {
    listAllPausedWithWorkspace: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let conversationsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let channelsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let flowExecutor: {
    resumeFlow: ReturnType<typeof vi.fn>;
  };
  let command: RecoverStuckFlows;

  const workspaceId = "workspace-123";

  const createMockExecution = (overrides: Partial<{
    id: string;
    status: FlowExecution.Status;
    variables: FlowExecution.Variables;
    currentNodeId: string | null;
  }> = {}): FlowExecution => {
    return FlowExecution.fromRaw({
      id: overrides.id ?? "exec-123",
      flowId: "flow-123",
      conversationId: "conv-123",
      currentNodeId: overrides.currentNodeId ?? "interval-node",
      status: overrides.status ?? "paused",
      variables: overrides.variables ?? {},
      startedAt: new Date(),
      completedAt: null,
      failedAt: null,
      errorMessage: null,
    });
  };

  const mockConversation = Conversation.instance({
    id: "conv-123",
    contact: null,
    attendant: null,
    status: "open",
    openedAt: null,
    firstOpenedAt: null,
    closedAt: null,
    sector: null,
    channel: ConversationChannel.instance({ id: "channel-123", name: "Test Channel", type: "whatsapp" }),
    teaser: "",
    messageToView: 0,
    lastMessageCreatedAt: null,
    lastClientMessageCreatedAt: null,
    waitingAt: null,
    activeFlowExecutionId: null,
    flowCompletedAt: null,
    receivedChannel: null,
    conversationType: "external",
    name: null,
    participants: [],
    groupJid: null,
  });

  const mockChannel = Channel.instance({
    id: "channel-123",
    name: "Test Channel",
    status: "connected",
    createdAt: new Date(),
    type: "whatsapp",
    payload: {},
    responseChannel: null,
    deletedAt: null,
  });

  beforeEach(() => {
    flowExecutionsRepository = {
      listAllPausedWithWorkspace: vi.fn(),
      update: vi.fn(),
    };
    conversationsRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn(),
    };
    channelsRepository = {
      retrieve: vi.fn(),
    };
    flowExecutor = {
      resumeFlow: vi.fn(),
    };

    command = new RecoverStuckFlows(
      flowExecutionsRepository,
      conversationsRepository,
      channelsRepository,
      flowExecutor
    );
  });

  describe("execute", () => {
    it("should return empty results when no paused executions exist", async () => {
      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([]);

      const result = await command.execute({ workspaceId });

      expect(result.totalPaused).toBe(0);
      expect(result.totalStuck).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toEqual([]);
    });

    it("should skip executions without resumeAt variable", async () => {
      const execution = createMockExecution({
        variables: { someVar: "value" },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);

      const result = await command.execute({ workspaceId });

      expect(result.totalPaused).toBe(1);
      expect(result.totalStuck).toBe(0);
      expect(flowExecutor.resumeFlow).not.toHaveBeenCalled();
    });

    it("should skip executions with future resumeAt date", async () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": futureDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);

      const result = await command.execute({ workspaceId });

      expect(result.totalPaused).toBe(1);
      expect(result.totalStuck).toBe(0);
      expect(flowExecutor.resumeFlow).not.toHaveBeenCalled();
    });

    it("should recover stuck execution with past resumeAt date", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);
      flowExecutor.resumeFlow.mockResolvedValue(undefined);

      const result = await command.execute({ workspaceId });

      expect(result.totalStuck).toBe(1);
      expect(result.recovered).toBe(1);
      expect(result.failed).toBe(0);
      expect(flowExecutor.resumeFlow).toHaveBeenCalledWith({
        execution,
        conversation: mockConversation,
        channel: mockChannel,
        workspaceId,
        userMessage: undefined,
      });
    });

    it("should mark as failed when conversation not found", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(null);

      const result = await command.execute({ workspaceId });

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.details[0]!.error).toBe("Conversation not found");
    });

    it("should mark as failed when channel not found", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(null);

      const result = await command.execute({ workspaceId });

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.details[0]!.error).toBe("Channel not found");
    });

    it("should mark as failed when channelId is null", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: null },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);

      const result = await command.execute({ workspaceId });

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.details[0]!.error).toBe("Conversation has no channel");
    });

    it("should mark as failed with invalid resumeAt date format", async () => {
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": "invalid-date" },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);

      const result = await command.execute({ workspaceId });

      expect(result.failed).toBe(1);
      expect(result.details[0]!.error).toBe("Invalid resumeAt date format");
    });

    it("should handle flowExecutor errors gracefully", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);
      flowExecutor.resumeFlow.mockRejectedValue(new Error("Connection failed"));

      const result = await command.execute({ workspaceId });

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.details[0]!.status).toBe("failed");
    });

    it("should pass workspaceId to repository query", async () => {
      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([]);

      await command.execute({ workspaceId });

      expect(flowExecutionsRepository.listAllPausedWithWorkspace).toHaveBeenCalledWith(
        100,
        workspaceId
      );
    });
  });

  describe("error message sanitization", () => {
    it("should sanitize file paths in error messages", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);
      flowExecutor.resumeFlow.mockRejectedValue(
        new Error("Error at /home/user/project/src/file.ts:123:45")
      );

      const result = await command.execute({ workspaceId });

      expect(result.details[0]!.error).not.toContain("/home/user/project");
      expect(result.details[0]!.error).toContain("[file]");
    });

    it("should redact sensitive data in error messages", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);
      flowExecutor.resumeFlow.mockRejectedValue(
        new Error("Failed with password=secret123 and token=abc123")
      );

      const result = await command.execute({ workspaceId });

      expect(result.details[0]!.error).not.toContain("secret123");
      expect(result.details[0]!.error).not.toContain("abc123");
      expect(result.details[0]!.error).toContain("[REDACTED]");
    });

    it("should truncate long error messages", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const execution = createMockExecution({
        variables: { "_intervalResumeAt_interval-node": pastDate },
      });

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue([
        { execution, workspaceId, channelId: "channel-123" },
      ]);
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);

      const longMessage = "x".repeat(500);
      flowExecutor.resumeFlow.mockRejectedValue(new Error(longMessage));

      const result = await command.execute({ workspaceId });

      expect(result.details[0]!.error!.length).toBeLessThanOrEqual(203);
      expect(result.details[0]!.error).toContain("...");
    });
  });

  describe("batch processing", () => {
    it("should process multiple executions in batches", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const executions = Array.from({ length: 12 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          variables: { "_intervalResumeAt_interval-node": pastDate },
        })
      );

      flowExecutionsRepository.listAllPausedWithWorkspace.mockResolvedValue(
        executions.map((execution) => ({
          execution,
          workspaceId,
          channelId: "channel-123",
        }))
      );
      conversationsRepository.retrieve.mockResolvedValue(mockConversation);
      channelsRepository.retrieve.mockResolvedValue(mockChannel);
      flowExecutor.resumeFlow.mockResolvedValue(undefined);

      const result = await command.execute({ workspaceId });

      expect(result.totalStuck).toBe(12);
      expect(result.recovered).toBe(12);
      expect(flowExecutor.resumeFlow).toHaveBeenCalledTimes(12);
    });
  });
});
