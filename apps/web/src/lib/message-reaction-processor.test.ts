import { beforeEach, describe, expect, it, vi } from "vitest";

const addReaction = vi.fn();
const removeReaction = vi.fn();
const removeReactionsByMessageAndReactor = vi.fn();

const reactionsRepository = {
  addReaction,
  removeReaction,
  removeReactionsByMessageAndReactor,
};

const selectConversation = vi.fn();
const selectWorkspace = vi.fn();

describe("processInboundMessageReaction", () => {
  const deps = {
    createDatabaseConnection: vi.fn(() => ({
      select: vi.fn((selection: Record<string, unknown>) => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => {
            if ("conversationId" in selection) {
              return selectConversation();
            }

            if ("workspaceId" in selection) {
              return selectWorkspace();
            }

            return [];
          }),
        })),
      })),
    })),
    eq: vi.fn(() => Symbol("eq")),
    conversations: {
      id: Symbol("conversation-id"),
      workspaceId: Symbol("conversation-workspace-id"),
    },
    messages: {
      id: Symbol("message-id"),
      conversationId: Symbol("message-conversation-id"),
    },
    reactionsRepository,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    selectConversation.mockReturnValue([{ conversationId: "conv-1" }]);
    selectWorkspace.mockReturnValue([{ workspaceId: "workspace-1" }]);
    addReaction.mockResolvedValue({
      id: "reaction-1",
      emoji: "❤️",
      reactorType: "contact",
      reactorId: "IGSID",
      reactorName: "Cliente",
      createdAt: new Date("2026-03-24T10:00:00.000Z"),
    });
    removeReaction.mockResolvedValue(true);
    removeReactionsByMessageAndReactor.mockResolvedValue(1);
  });

  it("adds an inbound Instagram reaction and emits the existing socket payload", async () => {
    const { processInboundMessageReaction } = await import("./message-reaction-processor");
    const emit = vi.fn();

    await processInboundMessageReaction({
      io: {
        to: vi.fn(() => ({ emit })),
      } as any,
      targetMessageId: "msg-1",
      emoji: "❤️",
      reactorId: "IGSID",
      reactorName: "Cliente",
      reactorType: "contact",
      isRemoval: false,
    }, deps);

    expect(addReaction).toHaveBeenCalledWith({
      messageId: "msg-1",
      emoji: "❤️",
      reactorType: "contact",
      reactorId: "IGSID",
      reactorName: "Cliente",
    });
    expect(emit).toHaveBeenCalledWith(
      "message:reaction",
      expect.objectContaining({
        messageId: "msg-1",
        conversationId: "conv-1",
        action: "added",
        removedBy: null,
      })
    );
  });

  it("removes all reactions from the same reactor when the provider sends unreact without emoji", async () => {
    const { processInboundMessageReaction } = await import("./message-reaction-processor");
    const emit = vi.fn();

    await processInboundMessageReaction({
      io: {
        to: vi.fn(() => ({ emit })),
      } as any,
      targetMessageId: "msg-1",
      emoji: "",
      reactorId: "IGSID",
      reactorName: "Cliente",
      reactorType: "contact",
      isRemoval: true,
    }, deps);

    expect(removeReactionsByMessageAndReactor).toHaveBeenCalledWith(
      "msg-1",
      "IGSID"
    );
    expect(emit).toHaveBeenCalledWith(
      "message:reaction",
      expect.objectContaining({
        messageId: "msg-1",
        conversationId: "conv-1",
        action: "removed",
        reaction: null,
        removedBy: "IGSID",
      })
    );
  });
});
