"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listInternalConversations } from "@/app/actions/internal-conversations";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";

type UseInternalConversationsQueryOptions = {
  enabled?: boolean;
};

export function useInternalConversationsQuery({
  enabled = true,
}: UseInternalConversationsQueryOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["internal-conversations"],
    queryFn: async () => {
      const [result, error] = await listInternalConversations();

      if (error) {
        throw error;
      }

      return result?.conversations ?? [];
    },
    staleTime: 30_000,
    enabled,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["internal-conversations"] });
  };

  return {
    conversations: (query.data ?? []) as Conversation.Raw[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
