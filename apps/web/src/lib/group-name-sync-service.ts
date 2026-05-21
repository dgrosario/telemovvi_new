import { getSocketServer } from "@/lib/io-server";
import { gatewayActions } from "@/lib/gateway-client";
import type { GatewayResponse, GroupInfoResponse } from "@/lib/gateway-client";
import {
  ConversationsDatabaseRepository,
  type GroupNameSyncCandidateDTO,
} from "@omnichannel/core/infra/repositories/conversations-repository";

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_CONCURRENCY = 5;

export type GroupNameSyncSummary = {
  totalGroups: number;
  processedGroups: number;
  updatedGroups: number;
  updatedConversations: number;
  failedGroups: number;
  skippedGroups: number;
};

type GroupNameSyncDependencies = {
  listGroups: (
    limit: number,
    offset: number
  ) => Promise<GroupNameSyncCandidateDTO[]>;
  getGroupInfo: (
    workspaceId: string,
    channelId: string,
    groupJid: string
  ) => Promise<GatewayResponse<GroupInfoResponse>>;
  updateGroupName: (
    workspaceId: string,
    channelId: string,
    groupJid: string,
    name: string
  ) => Promise<void>;
  listConversationIds: (
    workspaceId: string,
    channelId: string,
    groupJid: string
  ) => Promise<string[]>;
  emitConversationUpdated: (
    workspaceId: string,
    conversationId: string,
    name: string
  ) => void;
};

type SyncOptions = {
  batchSize?: number;
  concurrency?: number;
};

type SyncGroupNamesInput = SyncOptions & {
  dependencies?: Partial<GroupNameSyncDependencies>;
};

function createDefaultDependencies(): GroupNameSyncDependencies {
  const repository = ConversationsDatabaseRepository.instance();

  return {
    listGroups: (limit, offset) =>
      repository.listDistinctWhatsappGroupsForNameSync(limit, offset),
    getGroupInfo: (workspaceId, channelId, groupJid) =>
      gatewayActions.getGroupInfo(workspaceId, channelId, groupJid),
    updateGroupName: (workspaceId, channelId, groupJid, name) =>
      repository.updateNameByWorkspaceChannelGroup(
        workspaceId,
        channelId,
        groupJid,
        name
      ),
    listConversationIds: (workspaceId, channelId, groupJid) =>
      repository.listIdsByWorkspaceChannelGroup(workspaceId, channelId, groupJid),
    emitConversationUpdated: (workspaceId, conversationId, name) => {
      const socket = getSocketServer();
      socket?.to(`workspace:${workspaceId}`).emit("conversation:updated", {
        conversationId,
        name,
      });
    },
  };
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map((item) => handler(item)));
  }
}

export async function syncGroupNames({
  batchSize = DEFAULT_BATCH_SIZE,
  concurrency = DEFAULT_CONCURRENCY,
  dependencies = {},
}: SyncGroupNamesInput = {}): Promise<GroupNameSyncSummary> {
  const deps: GroupNameSyncDependencies = {
    ...createDefaultDependencies(),
    ...dependencies,
  };

  const normalizedBatchSize = Math.max(1, batchSize);
  const normalizedConcurrency = Math.max(1, concurrency);

  const summary: GroupNameSyncSummary = {
    totalGroups: 0,
    processedGroups: 0,
    updatedGroups: 0,
    updatedConversations: 0,
    failedGroups: 0,
    skippedGroups: 0,
  };

  let offset = 0;

  while (true) {
    const groups = await deps.listGroups(normalizedBatchSize, offset);

    if (groups.length === 0) {
      break;
    }

    summary.totalGroups += groups.length;

    await processWithConcurrency(groups, normalizedConcurrency, async (group) => {
      summary.processedGroups += 1;

      try {
        const response = await deps.getGroupInfo(
          group.workspaceId,
          group.channelId,
          group.groupJid
        );

        if (!response.success) {
          summary.failedGroups += 1;
          return;
        }

        const subject = response.data?.subject?.trim();

        if (!subject) {
          summary.failedGroups += 1;
          return;
        }

        const currentName = group.currentName?.trim() ?? "";
        if (currentName === subject) {
          summary.skippedGroups += 1;
          return;
        }

        await deps.updateGroupName(
          group.workspaceId,
          group.channelId,
          group.groupJid,
          subject
        );

        const conversationIds = await deps.listConversationIds(
          group.workspaceId,
          group.channelId,
          group.groupJid
        );

        for (const conversationId of conversationIds) {
          deps.emitConversationUpdated(
            group.workspaceId,
            conversationId,
            subject
          );
        }

        summary.updatedGroups += 1;
        summary.updatedConversations += conversationIds.length;
      } catch (error) {
        summary.failedGroups += 1;
        console.error(
          `[GroupNameSync] Falha ao sincronizar grupo ${group.groupJid}:`,
          error
        );
      }
    });

    if (groups.length < normalizedBatchSize) {
      break;
    }

    offset += groups.length;
  }

  return summary;
}
