import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finalizeDeletedMessage,
  invalidateDeletedMessageQueries,
} from "./delete-message-side-effects";

describe("delete message side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes the message and emits message:deleted with the refreshed conversation", async () => {
    const deletedAt = new Date("2026-03-24T12:00:00.000Z");
    const softDelete = vi.fn().mockResolvedValue(undefined);
    const retrieve = vi.fn().mockResolvedValue({
      raw: () => ({
        id: "conv-1",
        teaser: "Mensagem excluída",
      }),
    });
    const emit = vi.fn();
    const socket = {
      to: vi.fn(() => ({ emit })),
    };

    const payload = await finalizeDeletedMessage({
      messageId: "msg-1",
      conversationId: "conv-1",
      workspaceId: "workspace-1",
      deletedAt,
      messagesRepository: { softDelete },
      conversationsRepository: { retrieve },
      socket: socket as any,
    });

    expect(softDelete).toHaveBeenCalledWith("msg-1", deletedAt);
    expect(retrieve).toHaveBeenCalledWith("conv-1");
    expect(socket.to).toHaveBeenCalledWith("workspace:workspace-1");
    expect(emit).toHaveBeenCalledWith("message:deleted", {
      messageId: "msg-1",
      conversationId: "conv-1",
      deletedAt: "2026-03-24T12:00:00.000Z",
      conversation: {
        id: "conv-1",
        teaser: "Mensagem excluída",
      },
    });
    expect(payload.deletedAt).toBe("2026-03-24T12:00:00.000Z");
  });

  it("invalidates the open conversation and list queries after delete success", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateDeletedMessageQueries(
      { invalidateQueries } as any,
      "conv-1"
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["conversations-paginated"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["messages-paginated", "conv-1"],
      refetchType: "active",
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ["retrieve-conversation", "conv-1"],
      refetchType: "active",
    });
  });
});
