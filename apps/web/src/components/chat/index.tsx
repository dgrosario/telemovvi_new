"use client";

import { retrieveConversation } from "@/app/actions/conversations";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { useFetchProfilePicture } from "@/hooks/use-fetch-profile-picture";
import { AudioPlayerProvider } from "@/hooks/use-audio-player";
import { MediaCacheProvider } from "@/hooks/use-media-cache";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import { User } from "@omnichannel/core/domain/entities/user";
import { CounterConversations } from "@omnichannel/core/infra/repositories/conversations-repository";
import type { ChatAttendant } from "@/types/chat-attendant";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { AlertConversation } from "./alert-conversation";
import { ChatEmptyContainer } from "./chat-empty-container";
import { ChatForm } from "./chat-form";
import { ChatHeader } from "./chat-header";
import { ChatSidebar } from "./chat-sidebar";
import { ContainerMessages, ContainerMessagesHandle } from "./container-messages";
import { FloatingActionButtons } from "./floating-action-buttons";
import { SlashTextareaRef } from "./slash-text-area";
import { ErrorBoundary } from "../error-boundary";

type Props = {
  conversations: Conversation.Raw[];
  userAuthenticated: User.Raw;
  channels: Channel.Raw[];
  sectors: Sector.Props[];
  users: ChatAttendant[];
  workspaceId: string;
  counters: CounterConversations;
};

export function Chat(props: Props) {
  const store = useChat();
  const containerMessages = useRef<HTMLDivElement>(null);
  const containerMessagesRef = useRef<ContainerMessagesHandle>(null);
  const slashTextareaRef = useRef<SlashTextareaRef>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { hasPermission: canSendInternalComment } = usePermissionCheck(["send:internal-comment"]);
  
  // Estados para os botoes flutuantes e componentes compartilhados
  const [mobileSendWithSignature, setMobileSendWithSignature] = useState(true);
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Swipe para voltar à lista de conversas no mobile
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!store.conversationOpenedId) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    
    // Swipe da borda esquerda para direita (>80px horizontal, <50px vertical)
    if (touchStartX.current < 30 && deltaX > 80 && deltaY < 50) {
      store.closeConversationOpened();
    }
  }, [store]);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    containerMessagesRef.current?.scrollToMessage(messageId);
  }, []);

  const retrieveConversationAction = useServerActionQuery(
    retrieveConversation,
    {
      queryKey: ["retrieve-conversation", store.conversationOpenedId],
      input: {
        conversationId: store.conversationOpenedId!,
      },
      enabled: !!store.conversationOpenedId,
    }
  );

  useFetchProfilePicture({
    conversation: retrieveConversationAction.data ?? null,
    enabled: !retrieveConversationAction.isPending,
  });

  const isInternal = useMemo(() => {
    const conv = retrieveConversationAction.data;
    return conv?.conversationType === "direct" || conv?.conversationType === "group";
  }, [retrieveConversationAction.data]);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    store.reset({
      channels: props.channels,
      sectors: props.sectors,
      users: props.users,
      conversations: props.conversations,
      user: props.userAuthenticated,
      counters: props.counters,
    });
  }, []);

  useEffect(() => {
    if (store.conversationOpenedId) {
      const cachedData = queryClient.getQueryData<Conversation.Raw>([
        "retrieve-conversation",
        store.conversationOpenedId,
      ]);
      if (!cachedData) {
        queryClient.invalidateQueries({
          queryKey: ["retrieve-conversation", store.conversationOpenedId],
        });
      }
      const signatureDefault = store.user?.signatureEnabled ?? false;
      setMobileSendWithSignature(signatureDefault);
      setIsInternalNote(false);
      requestAnimationFrame(() => {
        slashTextareaRef.current?.setSendWithSignature(signatureDefault);
      });
    }
  }, [store.conversationOpenedId, queryClient]);


  return (
    <MediaCacheProvider>
      <AudioPlayerProvider>
        <div className="flex h-full min-h-dvh w-full min-w-0 overflow-hidden rounded-none bg-slate-100/30">
          <ErrorBoundary>
            <ChatSidebar />
          </ErrorBoundary>
          <ChatEmptyContainer hidden={!!store.conversationOpenedId} />
          <div
            ref={chatContainerRef}
            data-hidden={!store.conversationOpenedId}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`
              background relative flex-col overflow-hidden bg-[#F5F1EB]/30 gap-0 w-full min-w-0 flex-1 h-full
              ${store.conversationOpenedId ? "flex" : "hidden"}
              md:flex
            `}
            style={{ touchAction: "pan-y" }}
          >
            <div className="sticky top-0 z-20 shrink-0 border-b bg-white/95 backdrop-blur">
              <ChatHeader
                conversation={retrieveConversationAction.data}
                isLoading={retrieveConversationAction.isPending}
                onNavigateToMessage={handleNavigateToMessage}
              />
            </div>
            <div className="flex flex-1 relative overflow-hidden min-h-0">
              <div
                ref={containerMessages}
                id="container-messages"
                className="w-full overflow-y-auto overflow-x-hidden flex-1 flex flex-col px-2 md:px-4"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehaviorX: "contain",
                  touchAction: "pan-y pinch-zoom",
                }}
              >
                <AlertConversation
                  conversation={retrieveConversationAction.data}
                  isLoading={retrieveConversationAction.isPending}
                />
                <ErrorBoundary>
                  <ContainerMessages
                    ref={containerMessagesRef}
                    containerMessages={containerMessages}
                    conversation={retrieveConversationAction.data}
                  />
                </ErrorBoundary>
              </div>
            </div>
            <div
              className="sticky bottom-0 z-20 shrink-0 px-2 md:px-4 pb-3 pt-2 border-t bg-white/95 backdrop-blur pb-safe"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <ChatForm
                conversation={retrieveConversationAction.data}
                ref={slashTextareaRef}
                isInternalNote={isInternalNote}
                onInternalNoteChange={setIsInternalNote}
              />
            </div>

            <FloatingActionButtons
              isInternal={isInternal}
              signatureEnabled={store.user?.signatureEnabled ?? false}
              sendWithSignature={mobileSendWithSignature}
              onToggleSignature={() => {
                const newValue = !mobileSendWithSignature;
                setMobileSendWithSignature(newValue);
                slashTextareaRef.current?.setSendWithSignature(newValue);
              }}
              canSendInternalComment={canSendInternalComment}
              isInternalNote={isInternalNote}
              onToggleInternalNote={() => setIsInternalNote(!isInternalNote)}
            />
          </div>
        </div>
      </AudioPlayerProvider>
    </MediaCacheProvider>
  );
}
