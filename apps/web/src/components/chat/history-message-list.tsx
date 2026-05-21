"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMessagesPaginated } from "@/app/actions/conversations";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatRelative, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Conversation } from "@omnichannel/core/domain/entities/conversation";
import type { Message } from "@omnichannel/core/domain/entities/message";
import { typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";
import type { Channel } from "@omnichannel/core/domain/entities/channel";
import { conversationStatusConfig } from "./message-utils";
import { HistoryBubbleRenderer } from "./history-bubble-renderer";

type Props = {
  conversation: Conversation.Raw;
};

const statusConfig = conversationStatusConfig;

export function HistoryMessageList({ conversation }: Props) {
  const [allMessages, setAllMessages] = useState<Message.Raw[]>([]);
  const [beforeId, setBeforeId] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const { data, isLoading } = useServerActionQuery(loadMessagesPaginated, {
    input: { conversationId: conversation.id, limit: 50 },
    queryKey: ["history-messages", conversation.id],
    enabled: !!conversation.id,
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
  }, [conversation.id]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !beforeId) return;
    setIsLoadingMore(true);
    setLoadError(false);

    const scrollEl = scrollRef.current;
    const scrollHeightBefore = scrollEl?.scrollHeight ?? 0;

    try {
      const [result] = await loadMessagesPaginated({
        conversationId: conversation.id,
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
      console.error("[HistoryMessageList] Falha ao carregar mensagens anteriores:", error);
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, beforeId, conversation.id]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 150 && hasMore && !isLoadingMore) {
      loadOlder();
    }
  }, [hasMore, isLoadingMore, loadOlder]);

  const channelType = conversation.channel?.type as Channel.Type | undefined;
  const typeConfig = channelType ? typeChannelsAvailable.get(channelType) : null;
  const status = statusConfig[conversation.status ?? ""] ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 border-b pb-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {typeConfig && (
            <i className={cn(typeConfig.icon, "text-lg shrink-0")} />
          )}
          <span className="text-sm font-medium">
            {conversation.channel?.name ?? typeConfig?.name ?? "Canal desconhecido"}
          </span>
          {status && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px]",
                status.color,
                status.bg,
                "border-transparent"
              )}
            >
              {status.label}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {conversation.attendant && (
            <span className="flex items-center gap-1">
              <i className="tabler-user text-xs shrink-0" />
              {conversation.attendant.name}
            </span>
          )}
          {conversation.sector && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: conversation.sector.color ?? "#3B82F6" }}
              />
              {conversation.sector.name}
            </span>
          )}
          {conversation.openedAt && (
            <span>Aberta em: {format(new Date(conversation.openedAt), "dd/MM/yyyy HH:mm")}</span>
          )}
          {conversation.closedAt && (
            <span>Fechada em: {format(new Date(conversation.closedAt), "dd/MM/yyyy HH:mm")}</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 flex-1">
          <Spinner size="md" />
        </div>
      ) : allMessages.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12 flex-1">
          Nenhuma mensagem nesta conversa
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
              <span className="text-xs text-muted-foreground">Início da conversa</span>
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
                  channelId={conversation.channel?.id}
                  channelType={channelType}
                  channelName={conversation.channel?.name}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
