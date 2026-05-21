"use client";

import { useCallback, useState, useEffect } from "react";
import { useServerActionMutation } from "./server-action-hooks";
import {
  toggleMessageReaction,
  getMessagesReactions,
} from "@/app/actions/messages";
import { Message } from "@omnichannel/core/domain/entities/message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/providers/socket-provider";
import { toast } from "react-toastify";
import { applyReactionEvent } from "@/lib/message-reaction-events";

interface UseMessageReactionsOptions {
  conversationId: string | undefined | null;
  messageIds: string[];
  enabled?: boolean;
  channelId?: string | null;
  channelType?: string | null;
  remoteJid?: string | null;
}

interface ReactionEvent {
  messageId: string;
  conversationId: string;
  action: "added" | "removed";
  reaction: Message.Reaction | null;
  removedBy: string | null;
}

export function useMessageReactions({
  conversationId,
  messageIds,
  enabled = true,
  channelId,
  channelType,
  remoteJid,
}: UseMessageReactionsOptions) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const [togglingMessageId, setTogglingMessageId] = useState<string | null>(null);

  const queryKey = ["message-reactions", conversationId, messageIds.join(",")];

  const { data: reactionsMap = {}, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!messageIds.length) return {};
      const [result, error] = await getMessagesReactions({ messageIds });
      if (error) throw error;
      return result || {};
    },
    enabled: enabled && !!conversationId && messageIds.length > 0,
    staleTime: 30 * 1000,
  });

  const toggleReactionMutation = useServerActionMutation(toggleMessageReaction, {
    onMutate: async ({ messageId }) => {
      setTogglingMessageId(messageId);
      await queryClient.cancelQueries({ queryKey });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a reação. O estado foi restaurado.";
      toast.error(message);
      queryClient.invalidateQueries({ queryKey });
      setTogglingMessageId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setTogglingMessageId(null);
    },
    onSettled: () => {
      setTogglingMessageId(null);
    },
  });

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReactionEvent = (event: ReactionEvent) => {
      if (event.conversationId !== conversationId) return;

      queryClient.setQueryData<Record<string, Message.Reaction[]>>(
        queryKey,
        (old) => {
          if (!old) return old;

          const newData = { ...old };
          const currentReactions = newData[event.messageId] || [];
          newData[event.messageId] = applyReactionEvent(currentReactions, event);

          return newData;
        }
      );
    };

    socket.on("message:reaction", handleReactionEvent);

    return () => {
      socket.off("message:reaction", handleReactionEvent);
    };
  }, [socket, isConnected, conversationId, queryClient, queryKey]);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string, fromMe: boolean, messageRemoteJid?: string | null) => {
      const effectiveRemoteJid = messageRemoteJid || remoteJid;

      if (!conversationId || !channelId || !effectiveRemoteJid) {
        return;
      }
      toggleReactionMutation.mutate({
        messageId,
        emoji,
        conversationId,
        channelId,
        remoteJid: effectiveRemoteJid,
        channelType: channelType || undefined,
        fromMe,
      });
    },
    [conversationId, channelId, channelType, remoteJid, toggleReactionMutation]
  );

  const getReactions = useCallback(
    (messageId: string): Message.Reaction[] => {
      return reactionsMap[messageId] || [];
    },
    [reactionsMap]
  );

  return {
    reactionsMap,
    isLoading,
    toggleReaction,
    getReactions,
    isToggling: (messageId: string) => togglingMessageId === messageId,
  };
}
