import {
  listStarredMessages,
  starMessage,
  unstarMessage,
} from "@/app/actions/starred-messages";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "react-toastify";

export function useStarredMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  const queryKey = ["starred-messages", conversationId];

  const { data: starredMessageIds = [], isLoading } = useQuery<string[]>({
    queryKey,
    queryFn: async (): Promise<string[]> => {
      if (!conversationId) return [];
      const [data, error] = await listStarredMessages({ conversationId });
      if (error) {
        console.error("Error fetching starred messages:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!conversationId,
  });

  const starMutation = useServerActionMutation(starMessage, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error("Erro ao favoritar mensagem:", error);
      toast.error(`Erro ao favoritar: ${error.message}`);
    },
  });

  const unstarMutation = useServerActionMutation(unstarMessage, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error("Erro ao desfavoritar mensagem:", error);
      toast.error(`Erro ao desfavoritar: ${error.message}`);
    },
  });

  const starredSet = useMemo(
    () => new Set(starredMessageIds),
    [starredMessageIds]
  );

  const isStarred = useCallback(
    (messageId: string) => starredSet.has(messageId),
    [starredSet]
  );

  const toggleStar = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;

      if (isStarred(messageId)) {
        await unstarMutation.mutateAsync({ messageId });
      } else {
        await starMutation.mutateAsync({ messageId, conversationId });
      }
    },
    [conversationId, isStarred, starMutation, unstarMutation]
  );

  return {
    starredMessageIds,
    isLoading,
    isStarred,
    toggleStar,
    isToggling: starMutation.isPending || unstarMutation.isPending,
  };
}
