"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGroupedMessagesByContact } from "@/app/actions/conversations";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { formatRelative, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Message } from "@omnichannel/core/domain/entities/message";
import { HistoryBubbleRenderer } from "./history-bubble-renderer";

type Props = {
  contactId: string;
};

export function GroupedHistoryView({ contactId }: Props) {
  const [allMessages, setAllMessages] = useState<Message.GroupedRaw[]>([]);
  const [beforeId, setBeforeId] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const { data, isLoading, isError } = useServerActionQuery(loadGroupedMessagesByContact, {
    input: { contactId, limit: 50 },
    queryKey: ["grouped-history-messages", contactId],
    enabled: !!contactId,
  });

  useEffect(() => {
    if (data && !initialLoadDone.current) {
      setAllMessages(data.messages);
      setHasMore(data.hasMore);
      if (data.messages.length > 0) {
        setBeforeId(data.messages[0]?.id);
      }
      initialLoadDone.current = true;

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [data]);

  useEffect(() => {
    initialLoadDone.current = false;
    setAllMessages([]);
    setBeforeId(undefined);
    setHasMore(true);
  }, [contactId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !beforeId) return;
    setIsLoadingMore(true);
    setLoadError(false);

    const scrollEl = scrollRef.current;
    const scrollHeightBefore = scrollEl?.scrollHeight ?? 0;

    try {
      const [result] = await loadGroupedMessagesByContact({
        contactId,
        limit: 50,
        beforeId,
      });

      if (result) {
        setAllMessages((prev) => [...result.messages, ...prev]);
        setHasMore(result.hasMore);
        if (result.messages.length > 0) {
          setBeforeId(result.messages[0]?.id);
        }

        requestAnimationFrame(() => {
          if (scrollEl) {
            const scrollHeightAfter = scrollEl.scrollHeight;
            scrollEl.scrollTop += scrollHeightAfter - scrollHeightBefore;
          }
        });
      }
    } catch (error) {
      console.error("[GroupedHistoryView] Falha ao carregar mensagens anteriores:", error);
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, beforeId, contactId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 150 && hasMore && !isLoadingMore) {
      loadOlder();
    }
  }, [hasMore, isLoadingMore, loadOlder]);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex items-center justify-center py-12 flex-1">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <p className="text-center text-sm text-destructive py-12 flex-1">
          Erro ao carregar as mensagens. Tente novamente.
        </p>
      ) : allMessages.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12 flex-1">
          Nenhuma mensagem encontrada para este contato
        </p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto pr-1 flex-1"
        >
          {isLoadingMore && (
            <div className="flex items-center justify-center py-3">
              <Spinner size="sm" />
            </div>
          )}
          {loadError && (
            <p className="text-center text-xs text-destructive py-2">
              Erro ao carregar mensagens anteriores.
            </p>
          )}
          {!hasMore && allMessages.length > 0 && (
            <div className="flex items-center justify-center py-2">
              <span className="text-xs text-muted-foreground">Início das mensagens</span>
            </div>
          )}
          {allMessages.map((message, i) => {
            const prevMessage = allMessages[i - 1];
            const isNewDay =
              i === 0 ||
              !isSameDay(
                new Date(message.createdAt),
                new Date(prevMessage?.createdAt)
              );

            return (
              <div key={message.id}>
                {isNewDay && (
                  <div className="flex items-center justify-center my-2">
                    <Badge
                      variant="outline"
                      className="bg-[#fefdfd] !rounded text-[#7f7e7e] border-0 px-2 text-xs py-0.5"
                    >
                      {formatRelative(new Date(message.createdAt), new Date(), {
                        locale: ptBR,
                      })}
                    </Badge>
                  </div>
                )}
                <HistoryBubbleRenderer
                  message={message}
                  channelId={message.channel?.id}
                  channelType={message.channel?.type}
                  channelName={message.channel?.name}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
