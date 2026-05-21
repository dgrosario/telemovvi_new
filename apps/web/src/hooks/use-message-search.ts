import { searchMessages } from "@/app/actions/messages";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { Message } from "@omnichannel/core/domain/entities/message";
import { useState, useCallback } from "react";

export function useMessageSearch(conversationId: string | undefined) {
  const [results, setResults] = useState<Message.Raw[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const searchAction = useServerActionMutation(searchMessages, {
    onSuccess: (data) => {
      setResults(data);
      setCurrentIndex(0);
    },
  });

  const search = useCallback(
    async (term: string) => {
      if (!conversationId || term.length < 2) {
        setResults([]);
        return;
      }
      await searchAction.mutateAsync({ conversationId, searchTerm: term });
    },
    [conversationId, searchAction]
  );

  const clearSearch = useCallback(() => {
    setResults([]);
    setSearchOpen(false);
    setCurrentIndex(0);
  }, []);

  const navigateNext = useCallback(() => {
    if (results.length === 0) return null;
    const newIndex = (currentIndex + 1) % results.length;
    setCurrentIndex(newIndex);
    return results[newIndex]?.id ?? null;
  }, [currentIndex, results]);

  const navigatePrevious = useCallback(() => {
    if (results.length === 0) return null;
    const newIndex = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(newIndex);
    return results[newIndex]?.id ?? null;
  }, [currentIndex, results]);

  const getCurrentMessageId = useCallback(() => {
    if (results.length === 0) return null;
    return results[currentIndex]?.id ?? null;
  }, [currentIndex, results]);

  return {
    results,
    isSearching: searchAction.isPending,
    search,
    clearSearch,
    searchOpen,
    setSearchOpen,
    currentIndex,
    navigateNext,
    navigatePrevious,
    getCurrentMessageId,
    totalResults: results.length,
  };
}
