"use client";

import { useCallback, useRef, useEffect } from "react";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useServerActionMutation } from "./server-action-hooks";
import { fetchProfilePicture } from "@/app/actions/contacts";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "./use-chat";

interface UseFetchProfilePictureOptions {
  conversation: Conversation.Raw | null;
  enabled?: boolean;
}

export function useFetchProfilePicture({
  conversation,
  enabled = true,
}: UseFetchProfilePictureOptions) {
  const queryClient = useQueryClient();
  const fetchedRef = useRef<Set<string>>(new Set());
  const { updateConversation } = useChat();

  const fetchMutation = useServerActionMutation(fetchProfilePicture, {
    onSuccess: (result, variables) => {
      if (result.success && result.profilePictureUrl && conversation) {
        queryClient.invalidateQueries({
          queryKey: ["partners"],
        });

        queryClient.invalidateQueries({
          queryKey: ["conversation", variables.conversationId],
        });

        updateConversation({
          ...conversation,
          contact: conversation.contact
            ? {
                ...conversation.contact,
                thumbnail: result.profilePictureUrl,
              }
            : null,
        });
      }
    },
  });

  const shouldFetch = useCallback((): boolean => {
    if (!conversation) return false;
    if (!enabled) return false;
    if (conversation.contact?.thumbnail) return false;
    if (conversation.channel?.type !== "evolution") return false;
    if (fetchedRef.current.has(conversation.id)) return false;
    return true;
  }, [conversation, enabled]);

  const fetchPicture = useCallback(() => {
    if (!conversation || !shouldFetch()) return;

    fetchedRef.current.add(conversation.id);

    fetchMutation.mutate({
      conversationId: conversation.id,
    });
  }, [conversation, shouldFetch, fetchMutation]);

  useEffect(() => {
    if (shouldFetch()) {
      fetchPicture();
    }
  }, [conversation?.id, shouldFetch, fetchPicture]);

  return {
    isLoading: fetchMutation.isPending,
    error: fetchMutation.error,
    fetchPicture,
  };
}
