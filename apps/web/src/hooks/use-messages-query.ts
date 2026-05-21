"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { loadMessagesPaginated } from "@/app/actions/conversations";
import { useChat } from "./use-chat";

type UseMessagesQueryOptions = {
  conversationId: string | null;
  limit?: number;
  enabled?: boolean;
};

export function useMessagesQuery({
  conversationId,
  limit = 50,
  enabled = true,
}: UseMessagesQueryOptions) {
  const { setMessages, prependMessages } = useChat();

  const queryKey = ["messages-paginated", conversationId];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { messages: [], hasMore: false, oldestId: null };
      }

      const [result, error] = await loadMessagesPaginated({
        conversationId,
        limit,
        beforeId: pageParam,
      });

      if (error) {
        console.error("[useMessagesQuery] Erro ao carregar mensagens:", error);
        throw error;
      }

      console.log("[useMessagesQuery] Resultado recebido:", {
        conversationId,
        messagesCount: result.messages.length,
        hasMore: result.hasMore,
        oldestId: result.oldestId,
      });

      return result;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore ? lastPage.oldestId : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
    enabled: enabled && !!conversationId,
  });

  useEffect(() => {
    if (!query.data?.pages) return;

    const pages = query.data.pages;
    const firstPage = pages[0];

    if (!firstPage) return;

    if (pages.length === 1) {
      setMessages(firstPage.messages);
    } else {
      const lastPage = pages[pages.length - 1];
      if (lastPage && lastPage.messages.length > 0) {
        prependMessages(lastPage.messages);
      }
    }
  }, [query.data, setMessages, prependMessages]);

  const fetchOlderMessages = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      return query.fetchNextPage();
    }
    return Promise.resolve();
  }, [query]);

  return {
    isLoading: query.isLoading,
    isLoadingOlder: query.isFetchingNextPage,
    hasOlder: query.hasNextPage ?? false,
    isError: query.isError,
    error: query.error,
    fetchOlderMessages,
    refetch: query.refetch,
  };
}
