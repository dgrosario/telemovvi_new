"use client";

import { Button } from "@/components/ui/button";
import { Search, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useMessageSearch } from "@/hooks/use-message-search";
import { useState, useCallback, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

interface MessageSearchProps {
  conversationId: string | undefined;
  onNavigateToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function MessageSearch({
  conversationId,
  onNavigateToMessage,
  onClose,
}: MessageSearchProps) {
  const {
    results,
    isSearching,
    search,
    clearSearch,
    currentIndex,
    navigateNext,
    navigatePrevious,
    totalResults,
  } = useMessageSearch(conversationId);

  const [searchTerm, setSearchTerm] = useState("");

  const debouncedSearch = useDebouncedCallback((term: string) => {
    search(term);
  }, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  };

  const handleNavigateUp = useCallback(() => {
    const messageId = navigatePrevious();
    if (messageId) {
      onNavigateToMessage(messageId);
    }
  }, [navigatePrevious, onNavigateToMessage]);

  const handleNavigateDown = useCallback(() => {
    const messageId = navigateNext();
    if (messageId) {
      onNavigateToMessage(messageId);
    }
  }, [navigateNext, onNavigateToMessage]);

  const handleClose = useCallback(() => {
    setSearchTerm("");
    clearSearch();
    onClose();
  }, [clearSearch, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        handleNavigateDown();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [results.length, handleNavigateDown, handleClose]
  );

  useEffect(() => {
    if (results.length > 0 && results[currentIndex]) {
      onNavigateToMessage(results[currentIndex].id);
    }
  }, [currentIndex, results, onNavigateToMessage]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b">
      <Search className="size-4 text-muted-foreground shrink-0" />
      <input
        type="text"
        placeholder="Buscar na conversa..."
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent border-0 outline-none text-sm h-8 placeholder:text-muted-foreground"
        autoFocus
      />
      {isSearching && <Loader2 className="size-4 text-gray-400 animate-spin shrink-0" />}
      {totalResults > 0 && (
        <>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {currentIndex + 1} de {totalResults}
          </span>
          <Button
            variant="ghost"
            className="size-8 p-0 min-w-[32px]"
            onClick={handleNavigateUp}
            title="Resultado anterior"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="size-8 p-0 min-w-[32px]"
            onClick={handleNavigateDown}
            title="Proximo resultado"
          >
            <ChevronDown className="size-4" />
          </Button>
        </>
      )}
      {searchTerm && totalResults === 0 && !isSearching && (
        <span className="text-sm text-gray-400 whitespace-nowrap">Nenhum resultado</span>
      )}
      <Button
        variant="ghost"
        className="size-8 p-0 min-w-[32px] shrink-0"
        onClick={handleClose}
        title="Fechar busca"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
