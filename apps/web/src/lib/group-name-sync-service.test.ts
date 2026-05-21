import type { GatewayResponse, GroupInfoResponse } from "@/lib/gateway-client";
import { describe, expect, it, vi } from "vitest";
import type { GroupNameSyncCandidateDTO } from "@omnichannel/core/infra/repositories/conversations-repository";
import { syncGroupNames } from "./group-name-sync-service";

function createGroupInfoResponse(
  subject: string
): GatewayResponse<GroupInfoResponse> {
  return {
    correlationId: crypto.randomUUID(),
    success: true,
    data: {
      id: "group-id",
      subject,
      description: null,
      owner: null,
      size: 10,
      creation: null,
      pictureUrl: null,
      participants: [],
    },
  };
}

function createGroupCandidate(
  overrides: Partial<GroupNameSyncCandidateDTO> = {}
): GroupNameSyncCandidateDTO {
  return {
    workspaceId: "workspace-1",
    channelId: "channel-1",
    groupJid: "123@g.us",
    currentName: "Grupo Antigo",
    ...overrides,
  };
}

describe("syncGroupNames", () => {
  it("atualiza quando o nome remoto é diferente", async () => {
    const listGroups = vi
      .fn()
      .mockResolvedValueOnce([createGroupCandidate()])
      .mockResolvedValueOnce([]);
    const getGroupInfo = vi.fn().mockResolvedValue(createGroupInfoResponse("Grupo Novo"));
    const updateGroupName = vi.fn().mockResolvedValue(undefined);
    const listConversationIds = vi.fn().mockResolvedValue(["conv-1", "conv-2"]);
    const emitConversationUpdated = vi.fn();

    const result = await syncGroupNames({
      batchSize: 50,
      dependencies: {
        listGroups,
        getGroupInfo,
        updateGroupName,
        listConversationIds,
        emitConversationUpdated,
      },
    });

    expect(result).toEqual({
      totalGroups: 1,
      processedGroups: 1,
      updatedGroups: 1,
      updatedConversations: 2,
      failedGroups: 0,
      skippedGroups: 0,
    });
    expect(updateGroupName).toHaveBeenCalledWith(
      "workspace-1",
      "channel-1",
      "123@g.us",
      "Grupo Novo"
    );
    expect(emitConversationUpdated).toHaveBeenCalledTimes(2);
  });

  it("não atualiza quando o nome já está igual", async () => {
    const listGroups = vi
      .fn()
      .mockResolvedValueOnce([createGroupCandidate({ currentName: "Grupo Atual" })])
      .mockResolvedValueOnce([]);
    const getGroupInfo = vi.fn().mockResolvedValue(createGroupInfoResponse("Grupo Atual"));
    const updateGroupName = vi.fn().mockResolvedValue(undefined);
    const listConversationIds = vi.fn().mockResolvedValue(["conv-1"]);
    const emitConversationUpdated = vi.fn();

    const result = await syncGroupNames({
      dependencies: {
        listGroups,
        getGroupInfo,
        updateGroupName,
        listConversationIds,
        emitConversationUpdated,
      },
    });

    expect(result).toEqual({
      totalGroups: 1,
      processedGroups: 1,
      updatedGroups: 0,
      updatedConversations: 0,
      failedGroups: 0,
      skippedGroups: 1,
    });
    expect(updateGroupName).not.toHaveBeenCalled();
    expect(emitConversationUpdated).not.toHaveBeenCalled();
  });

  it("continua processamento quando um grupo falha", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const listGroups = vi
      .fn()
      .mockResolvedValueOnce([
        createGroupCandidate({ groupJid: "1@g.us" }),
        createGroupCandidate({ groupJid: "2@g.us" }),
        createGroupCandidate({ groupJid: "3@g.us" }),
      ])
      .mockResolvedValueOnce([]);
    const getGroupInfo = vi
      .fn()
      .mockResolvedValueOnce({ correlationId: "a", success: false, error: "Fail" })
      .mockRejectedValueOnce(new Error("Boom"))
      .mockResolvedValueOnce(createGroupInfoResponse("Grupo 3"));
    const updateGroupName = vi.fn().mockResolvedValue(undefined);
    const listConversationIds = vi.fn().mockResolvedValue(["conv-3"]);
    const emitConversationUpdated = vi.fn();

    const result = await syncGroupNames({
      dependencies: {
        listGroups,
        getGroupInfo,
        updateGroupName,
        listConversationIds,
        emitConversationUpdated,
      },
    });

    expect(result).toEqual({
      totalGroups: 3,
      processedGroups: 3,
      updatedGroups: 1,
      updatedConversations: 1,
      failedGroups: 2,
      skippedGroups: 0,
    });
    expect(updateGroupName).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });

  it("respeita paginação por offset e batch size", async () => {
    const firstBatch = [
      createGroupCandidate({ groupJid: "1@g.us" }),
      createGroupCandidate({ groupJid: "2@g.us" }),
    ];
    const secondBatch = [createGroupCandidate({ groupJid: "3@g.us" })];

    const listGroups = vi
      .fn()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);
    const getGroupInfo = vi.fn().mockResolvedValue(createGroupInfoResponse("Nome Atualizado"));
    const updateGroupName = vi.fn().mockResolvedValue(undefined);
    const listConversationIds = vi.fn().mockResolvedValue(["conv-1"]);
    const emitConversationUpdated = vi.fn();

    const result = await syncGroupNames({
      batchSize: 2,
      dependencies: {
        listGroups,
        getGroupInfo,
        updateGroupName,
        listConversationIds,
        emitConversationUpdated,
      },
    });

    expect(listGroups).toHaveBeenNthCalledWith(1, 2, 0);
    expect(listGroups).toHaveBeenNthCalledWith(2, 2, 2);
    expect(result.totalGroups).toBe(3);
    expect(result.processedGroups).toBe(3);
  });
});
