"use client";
import { toast } from "react-toastify";
import { deleteMessage, editMessage, markConversationAsRead, loadMessagesUntilId } from "@/app/actions/conversations";
import { markLastMessagesContactAsViewed } from "@/app/actions/messages";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { useConversationStore } from "@/hooks/use-conversation-store";
import { useMessagesQuery } from "@/hooks/use-messages-query";
import { useStarredMessages } from "@/hooks/use-starred-messages";
import { useMessageReactions } from "@/hooks/use-message-reactions";
import { useForwardMessage } from "@/hooks/use-forward-message";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { invalidateDeletedMessageQueries } from "@/lib/delete-message-side-effects";
import { CircularProgress } from "@mui/material";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useQueryClient } from "@tanstack/react-query";
import { formatRelative, isSameDay } from "date-fns";
import { pt } from "date-fns/locale/pt";
import React, { RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Badge } from "../ui/badge";
import { AudioBubble } from "./audio-bubble";
import { FileBubble } from "./file-bubble";
import { ImageBubble } from "./image-bubble";
import { MessageLoading } from "./message-loading";
import { StickerBubble } from "./sticker-bubble";
import { TextBubble } from "./text-bubble";
import { VideoBubble } from "./video-bubble";
import { LocationBubble } from "./location-bubble";

type Props = {
  conversation?: Conversation.Raw;
  containerMessages: RefObject<HTMLDivElement | null>;
};

export type ContainerMessagesHandle = {
  scrollToMessage: (messageId: string) => void;
};

export const ContainerMessages = forwardRef<ContainerMessagesHandle, Props>(({
  conversation,
  containerMessages,
}, ref) => {
  const { conversationOpenedId, ...store } = useChat();
  const queryClient = useQueryClient();
  // Verifica se tem permissão para excluir qualquer mensagem
  const { hasPermission: isAdmin } = usePermissionCheck(["delete:any-message"]);
  
  const markLastMessagesContactAsViewedAction = useServerActionMutation(
    markLastMessagesContactAsViewed,
    {
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
        });
      },
    }
  );

  const markConversationAsReadAction = useServerActionMutation(markConversationAsRead);

  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const deleteMessageAction = useServerActionMutation(deleteMessage, {
    onSuccess: async () => {
      try {
        await invalidateDeletedMessageQueries(queryClient, conversationOpenedId);
      } finally {
        setDeletingMessageId(null);
      }
    },
    onError: (error) => {
      toast.error((error as Error).message || "Erro ao apagar mensagem");
      setDeletingMessageId(null);
    },
  });

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (!conversationOpenedId || !conversation?.channel?.id) return;
    setDeletingMessageId(messageId);
    deleteMessageAction.mutate({
      messageId,
      conversationId: conversationOpenedId,
      channelId: conversation.channel.id,
    });
  }, [conversationOpenedId, conversation?.channel?.id, deleteMessageAction]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [expandedHistoryMessageId, setExpandedHistoryMessageId] = useState<string | null>(null);

  const editMessageAction = useServerActionMutation(editMessage, {
    onSuccess: () => {
      setEditingMessageId(null);
      setEditContent("");
    },
    onError: () => {
      setEditingMessageId(null);
    },
  });

  const handleStartEdit = useCallback((messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditContent(currentContent);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMessageId || !editContent.trim() || !conversationOpenedId || !conversation?.channel?.id) return;

    editMessageAction.mutate({
      messageId: editingMessageId,
      conversationId: conversationOpenedId,
      channelId: conversation.channel.id,
      newContent: editContent.trim(),
    });
  }, [editingMessageId, editContent, conversationOpenedId, conversation?.channel?.id, editMessageAction]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditContent("");
  }, []);

  const handleReply = useCallback((message: typeof messages[0]) => {
    store.setReplyingTo(message.raw());
  }, [store]);

  const handleToggleHistory = useCallback((messageId: string) => {
    setExpandedHistoryMessageId(prev => prev === messageId ? null : messageId);
  }, []);

  const { isStarred, toggleStar, isToggling: isTogglingStarred } = useStarredMessages(conversationOpenedId);
  const { setMessageToForward } = useForwardMessage();

  const handleForward = useCallback((message: typeof messages[0]) => {
    setMessageToForward(message.raw());
    // Voltar para a lista de conversas
    store.setConversationOpenedId(null);
  }, [setMessageToForward, store]);

  const messages = useMemo(
    () => Array.from(store.messages.values()),
    [store.messages]
  );

  const messageIds = useMemo(
    () => messages.map((m) => m.id),
    [messages]
  );

  const remoteJid = useMemo(() => {
    if (!conversation) return null;
    if (conversation.conversationType === "whatsapp-group") {
      return conversation.groupJid;
    }
    if (conversation.contact?.value) {
      return `${conversation.contact.value}@s.whatsapp.net`;
    }
    return null;
  }, [conversation]);

  const { getReactions, toggleReaction } = useMessageReactions({
    conversationId: conversationOpenedId,
    messageIds,
    enabled: !!conversationOpenedId && messages.length > 0,
    channelId: conversation?.channel?.id,
    channelType: conversation?.channel?.type,
    remoteJid,
  });

  const previousMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const scrollHeightBeforeLoadRef = useRef(0);
  const isLoadingOlderRef = useRef(false);
  const isFollowingRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const { isLoading, isLoadingOlder, hasOlder, fetchOlderMessages, refetch, isError } =
    useMessagesQuery({
      conversationId: conversationOpenedId,
      limit: 50,
      enabled: !!conversationOpenedId,
    });

  const handleScroll = useCallback(() => {
    const container = containerMessages.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    const isNearBottom = distanceFromBottom < 150;
    const scrolledUp = scrollTop < lastScrollTopRef.current;

    if (scrolledUp && !isNearBottom) {
      isFollowingRef.current = false;
    } else if (isNearBottom) {
      isFollowingRef.current = true;
    }

    lastScrollTopRef.current = scrollTop;

    const threshold = 200;
    if (scrollTop < threshold && hasOlder && !isLoadingOlder && !isLoadingOlderRef.current) {
      isLoadingOlderRef.current = true;
      scrollHeightBeforeLoadRef.current = scrollHeight;

      fetchOlderMessages().finally(() => {
        isLoadingOlderRef.current = false;
      });
    }
  }, [hasOlder, isLoadingOlder, fetchOlderMessages, containerMessages]);

  useEffect(() => {
    const container = containerMessages.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll, containerMessages]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const markConversationAsReadRef = useRef(markConversationAsReadAction.mutate);
  markConversationAsReadRef.current = markConversationAsReadAction.mutate;

  useEffect(() => {
    if (conversationOpenedId) {
      isInitialLoadRef.current = true;
      previousMessageCountRef.current = 0;
      isFollowingRef.current = true;
      lastScrollTopRef.current = 0;
      refetchRef.current();

      const convStore = useConversationStore.getState();
      const conv = convStore.byId[conversationOpenedId];
      if (conv && conv.messageToView > 0) {
        convStore.markConversationAsRead(conversationOpenedId);
        markConversationAsReadRef.current({ conversationId: conversationOpenedId });
      }
    }
  }, [conversationOpenedId]);

  const markMessagesAsViewed = useCallback(() => {
    if (
      conversation?.attendant?.id === store.user?.id &&
      messages.filter(
        (m) => m.status !== "viewed" && m.sender.type === "contact"
      ).length > 0 &&
      conversation?.channel?.id &&
      conversation?.contact?.id
    ) {
      markLastMessagesContactAsViewedAction.mutate({
        channelId: conversation?.channel?.id,
        contactId: conversation?.contact?.id,
      });
      store.markAllMessagesViewed();
    }
  }, [conversation, messages, store, markLastMessagesContactAsViewedAction]);

  const markMessagesAsViewedRef = useRef(markMessagesAsViewed);
  markMessagesAsViewedRef.current = markMessagesAsViewed;

  useEffect(() => {
    const container = containerMessages.current;
    if (!container) return;

    const currentCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    const hasNewMessages = currentCount > previousCount;
    const lastSentId = store.lastSentMessageId;

    if (isInitialLoadRef.current && currentCount > 0) {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "instant",
        });
        isFollowingRef.current = true;
        // scrollTop after scrolling to bottom is scrollHeight - clientHeight
        lastScrollTopRef.current = container.scrollHeight - container.clientHeight;
      }, 100);
      isInitialLoadRef.current = false;
    } else if (lastSentId && messages.some(m => m.id === lastSentId)) {
      if (isFollowingRef.current) {
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      }
      store.setLastSentMessageId(null);
    } else if (hasNewMessages && !isLoadingOlderRef.current) {
      const scrollHeightBefore = scrollHeightBeforeLoadRef.current;
      if (scrollHeightBefore > 0) {
        const newScrollHeight = container.scrollHeight;
        const diff = newScrollHeight - scrollHeightBefore;
        container.scrollTop += diff;
        scrollHeightBeforeLoadRef.current = 0;
      } else if (isFollowingRef.current) {
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      }
    }

    previousMessageCountRef.current = currentCount;
    markMessagesAsViewedRef.current();
  }, [messages, containerMessages, store]);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = containerMessages.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-primary/10");
      setTimeout(() => element.classList.remove("bg-primary/10"), 2000);
    }
  }, [containerMessages]);

  const scrollToMessageId = useChat((state) => state.scrollToMessageId);
  const setScrollToMessageId = useChat((state) => state.setScrollToMessageId);
  const [isLoadingTargetMessage, setIsLoadingTargetMessage] = useState(false);

  useEffect(() => {
    if (!scrollToMessageId || !conversationOpenedId || isLoadingTargetMessage) return;

    const element = containerMessages.current?.querySelector(`[data-message-id="${scrollToMessageId}"]`);

    if (element) {
      setTimeout(() => {
        scrollToMessage(scrollToMessageId);
        setScrollToMessageId(null);
      }, 100);
      return;
    }

    const loadAndScroll = async () => {
      setIsLoadingTargetMessage(true);

      const oldestMessage = messages[0];
      const currentOldestId = oldestMessage?.id;

      const [result, error] = await loadMessagesUntilId({
        conversationId: conversationOpenedId,
        targetMessageId: scrollToMessageId,
        currentOldestId,
      });

      if (error || !result?.targetFound) {
        console.error("Mensagem nao encontrada:", error);
        setScrollToMessageId(null);
        setIsLoadingTargetMessage(false);
        return;
      }

      if (result.messages.length > 0) {
        store.prependMessages(result.messages);
      }

      setTimeout(() => {
        scrollToMessage(scrollToMessageId);
        setScrollToMessageId(null);
        setIsLoadingTargetMessage(false);
      }, 300);
    };

    loadAndScroll();
  }, [scrollToMessageId, conversationOpenedId, containerMessages, messages, store, scrollToMessage, setScrollToMessageId, isLoadingTargetMessage]);

  useImperativeHandle(ref, () => ({
    scrollToMessage,
  }), [scrollToMessage]);

  const channelId = conversation?.channel?.id;
  const channelType = conversation?.channel?.type;
  const channelName = conversation?.channel?.name;
  const isWhatsAppGroup = conversation?.conversationType === "whatsapp-group";
  const currentUserId = store.user?.id;

  return (
    <div>
      <div className="flex-1 flex flex-col gap-1 p-3 md:p-6 pt-24 pb-6">
        {isLoadingOlder && (
          <div className="flex items-center justify-center py-4">
            <CircularProgress size={24} />
          </div>
        )}
        {messages.map((message, i) => {
          const lastMessage = messages?.[i - 1];
          const nextMessage = messages?.[i + 1];

          const isNewDay =
            !isSameDay(message.createdAt, lastMessage?.createdAt) || i === 0;

          const hiddenAvatar = message.sender.id === nextMessage?.sender?.id;

          return (
            <div key={message.id} data-message-id={message.id} className="transition-colors duration-500">
              <div
                data-hidden={!isNewDay}
                className="w-full flex items-center justify-center"
              >
                <Badge
                  variant="outline"
                  className="bg-[#fefdfd] !rounded text-[#7f7e7e] border-0 px-2 text-xs py-0.5"
                >
                  {formatRelative(message.createdAt, new Date(), {
                    locale: pt,
                  })}
                </Badge>
              </div>
              {message?.type === "audio" ? (
                <AudioBubble
                  key={message.id}
                  message={message}
                  channel={channelId!}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : message?.type === "image" ? (
                <ImageBubble
                  channel={channelId!}
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : message?.type === "sticker" ? (
                <StickerBubble
                  channel={channelId!}
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : message?.type === "document" ? (
                <FileBubble
                  channel={channelId!}
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationAttendantId={conversation?.attendant?.id ?? null}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : message?.type === "video" ? (
                <VideoBubble
                  channel={channelId!}
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : message?.type === "location" ? (
                <LocationBubble
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onReply={() => handleReply(message)}
                  isDeleting={deletingMessageId === message.id}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              ) : (
                <TextBubble
                  message={message}
                  hiddenAvatar={hiddenAvatar}
                  channelType={channelType}
                  channelName={channelName}
                  isWhatsAppGroup={isWhatsAppGroup}
                  currentUserId={currentUserId}
                  conversationType={conversation?.conversationType}
                  conversationStatus={conversation?.status}
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onEdit={() => handleStartEdit(message.id, message.content)}
                  onReply={() => handleReply(message)}
                  onForward={() => handleForward(message)}
                  isDeleting={deletingMessageId === message.id}
                  isEditing={editingMessageId === message.id}
                  editContent={editingMessageId === message.id ? editContent : undefined}
                  onEditChange={setEditContent}
                  onEditConfirm={handleConfirmEdit}
                  onEditCancel={handleEditCancel}
                  isEditPending={editMessageAction.isPending}
                  quotedMessageId={message.quotedMessageId}
                  messages={store.messages}
                  conversationId={conversationOpenedId ?? undefined}
                  originalContent={message.originalContent}
                  onViewHistory={() => handleToggleHistory(message.id)}
                  isHistoryExpanded={expandedHistoryMessageId === message.id}
                  isStarred={isStarred(message.id)}
                  onToggleStar={() => toggleStar(message.id)}
                  isTogglingStarred={isTogglingStarred}
                  reactions={getReactions(message.id)}
                  onToggleReaction={(emoji) => toggleReaction(
                    message.id,
                    emoji,
                    message.sender.type === "attendant",
                    message.remoteJid
                  )}
                />
              )}
            </div>
          );
        })}
        <MessageLoading typing={store.typing} />
      </div>
      {isError ? (
        <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] text-center">
          <p className="text-red-500 mb-2">Erro ao carregar mensagens</p>
          <button
            onClick={() => refetch()}
            className="text-blue-500 underline hover:text-blue-600"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <CircularProgress
          data-hidden={!isLoading || messages.length > 0}
          className="mx-auto absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]"
        />
      )}
    </div>
  );
});

ContainerMessages.displayName = "ContainerMessages";
