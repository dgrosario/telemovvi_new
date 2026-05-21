"use client";

import { getGroupInfo, GroupInfoResponse } from "@/app/actions/groups";
import { updateConversationName } from "@/app/actions/conversations";
import { useServerActionQuery, useServerActionMutation } from "@/hooks/server-action-hooks";
import { useConversationStore } from "@/hooks/use-conversation-store";
import { useEffect, useRef } from "react";

interface UseGroupParticipantsProps {
  channelId: string | null | undefined;
  groupJid: string | null | undefined;
  conversationId?: string | null | undefined;
  currentName?: string | null | undefined;
  enabled?: boolean;
}

export function useGroupParticipants({
  channelId,
  groupJid,
  conversationId,
  currentName,
  enabled = true,
}: UseGroupParticipantsProps) {
  const hasUpdatedName = useRef(false);
  const updateConversationInStore = useConversationStore((state) => state.updateConversation);

  const query = useServerActionQuery(getGroupInfo, {
    queryKey: ["group-info", channelId, groupJid],
    input: {
      channelId: channelId ?? "",
      groupJid: groupJid ?? "",
    },
    enabled: enabled && !!channelId && !!groupJid,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const updateNameMutation = useServerActionMutation(updateConversationName, {
    onSuccess: (_, variables) => {
      // Update the conversation directly in the store (no refetch needed)
      updateConversationInStore(variables.conversationId, {
        name: variables.name,
      });
    },
  });

  // Update conversation name when group info is loaded and name differs
  useEffect(() => {
    if (
      !hasUpdatedName.current &&
      query.data?.subject &&
      conversationId &&
      (!currentName || currentName !== query.data.subject)
    ) {
      hasUpdatedName.current = true;
      updateNameMutation.mutate({
        conversationId,
        name: query.data.subject,
      });
    }
  }, [query.data?.subject, conversationId, currentName, updateNameMutation]);

  // Reset flag when conversation changes
  useEffect(() => {
    hasUpdatedName.current = false;
  }, [conversationId]);

  return {
    groupInfo: query.data as GroupInfoResponse | null | undefined,
    participants: query.data?.participants ?? [],
    participantCount: query.data?.size ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
