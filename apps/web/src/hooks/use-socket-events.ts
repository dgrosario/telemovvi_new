"use client";

import { useSocket } from "@/providers/socket-provider";
import { useUserPermissions } from "@/providers/user-permissions-provider";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Message } from "@omnichannel/core/domain/entities/message";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useChat } from "./use-chat";
import { useConversationStore, type ConversationStatus } from "./use-conversation-store";
import { useNotificationStore } from "./use-notification-store";
import { useUserSectors } from "./use-user-sectors";
import { useMyChannels } from "./use-my-channels";
import { useConversationFilters } from "./conversation-filters-loader";
import { matchesConversationSearch } from "@/lib/conversation-search-filter";
import type { ConversationSearchType } from "@/lib/conversation-search-filter";
import { applyReactionEvent } from "@/lib/message-reaction-events";
import { reconcileSentConfirmation } from "@/lib/message-sent-confirmation";

const MAX_PROCESSED_MESSAGES = 100;
const MESSAGE_STATUS_PRIORITY: Record<Message.Status, number> = {
  senting: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  viewed: 3,
};

function getHigherMessageStatus(
  current: Message.Status,
  incoming: Message.Status
): Message.Status {
  return MESSAGE_STATUS_PRIORITY[incoming] > MESSAGE_STATUS_PRIORITY[current]
    ? incoming
    : current;
}

type MessageReceivedEvent = {
  conversationId: string;
  message: Message.Raw;
  conversation: Conversation.Raw;
  isNewConversation: boolean;
  workspaceId: string;
};

type MessageStatusUpdateEvent = {
  messageId: string;
  status: Message.Status;
  conversationId: string;
  workspaceId: string;
  error?: {
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  };
};

type ConversationCreatedEvent = {
  conversation: Conversation.Raw;
  workspaceId: string;
};

type ChannelStatusUpdateEvent = {
  channelId: string;
  status: string;
  workspaceId: string;
};

type MessageSentConfirmedEvent = {
  conversationId: string;
  conversation?: Conversation.Raw;
  message: Message.Raw;
  whatsappMessageId: string;
  workspaceId: string;
  correlationId?: string;
};

type MessageDeletedEvent = {
  messageId: string;
  conversationId: string;
  deletedAt?: string;
  conversation?: Conversation.Raw | null;
};

type MessageEditedEvent = {
  messageId: string;
  conversationId: string;
  newContent: string;
  editedAt: string;
};

type ContactPresenceUpdateEvent = {
  instanceName: string;
  remoteJid: string;
  presence: "available" | "unavailable" | "composing" | "recording" | "paused";
  lastSeen?: number;
};

type ChannelQrcodeUpdateEvent = {
  instanceName: string;
  qrcode: string;
  source: string;
};

type ChannelConnectionUpdateEvent = {
  instanceName: string;
  state: "open" | "close" | "connecting";
  source: string;
};

type ContactUpdatedEvent = {
  partnerId: string;
  name: string;
  workspaceId: string;
};

type RabbitMQCriticalErrorEvent = {
  error: string;
  instanceName?: string;
  queue?: string;
  timestamp: string;
};

type ConversationAssignedEvent = {
  conversation: Conversation.Raw;
  assignedById: string;
  workspaceId: string;
};

type ConversationClosedEvent = {
  conversation: Conversation.Raw;
  closedById: string;
  workspaceId: string;
};

type ConversationDeletedEvent = {
  conversationId: string;
  deletedById: string;
  workspaceId: string;
};

type ConversationTransferredEvent = {
  conversation: Conversation.Raw;
  transferredById: string;
  newAttendantId: string | null;
  newSectorId: string | null;
  workspaceId: string;
};

type InternalMessageReceivedEvent = {
  conversationId: string;
  message: {
    id: string;
    content: string;
    type: "text" | "audio" | "image" | "document" | "video";
    mediaUrl?: string;
    caption?: string;
    filename?: string;
    mimeType?: string;
    sender: { id: string; name: string };
    recipients: string[];
    createdAt: string;
    correlationId?: string;
    status?: "senting" | "sent" | "delivered" | "viewed" | "failed";
  };
  workspaceId: string;
};

type InternalConversationCreatedEvent = {
  conversation: Conversation.Raw;
  workspaceId: string;
};

type InternalParticipantAddedEvent = {
  conversationId: string;
  participant: {
    userId: string;
    role: string;
    joinedAt: Date;
  };
  addedById: string;
  workspaceId: string;
};

type InternalParticipantRemovedEvent = {
  conversationId: string;
  removedUserId: string;
  removedById: string;
  workspaceId: string;
};

type InternalParticipantLeftEvent = {
  conversationId: string;
  leftUserId: string;
  workspaceId: string;
};

type InternalCommentReceivedEvent = {
  conversationId: string;
  message: Message.Raw;
  workspaceId: string;
};

type ConversationReadEvent = {
  conversationId: string;
};

type NotificationReceivedEvent = {
  id: string;
  workspaceId: string;
  type: "conversation:assigned" | "internal:message" | "transfer:requested" | "channel:new-message";
  title: string;
  content: string;
  metadata: any;
  recipientType: "user" | "sector" | "workspace";
  recipientId: string;
  isRead: boolean;
  readAt: string | null;
  priority: "low" | "normal" | "high";
  createdAt: string;
  expiresAt: string | null;
};

type NotificationReadEvent = {
  notificationId: string;
  userId: string;
  workspaceId: string;
  readAt: Date;
};

type MessageReactionEvent = {
  messageId: string;
  conversationId: string;
  action: "added" | "removed";
  reaction: {
    id: string;
    emoji: string;
    reactorType: "attendant" | "contact";
    reactorId: string;
    reactorName: string | null;
    createdAt: Date;
  } | null;
  removedBy: string | null;
};

type ConversationUpdatedEvent = {
  conversationId: string;
  name: string;
};

export function useSocketEvents() {
  const { socket, isConnected } = useSocket();
  const store = useChat();
  const queryClient = useQueryClient();
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const pendingStatusByMessageIdRef = useRef<Map<string, Message.Status>>(new Map());

  const { data: userSectors = [] } = useUserSectors();
  const { data: myChannels = [], isSuccess: channelsLoaded } = useMyChannels();
  const { hasPermission } = useUserPermissions();
  const {
    showAll,
    statusFilters,
    sectors,
    channels,
    users,
    query,
    searchType,
    conversationType,
    waitingStatus,
  } = useConversationFilters();

  const userSectorIdsRef = useRef<string[]>([]);
  const hasAllSectorsPermissionRef = useRef(false);
  const userChannelIdsRef = useRef<string[]>([]);
  const hasAllChannelsPermissionRef = useRef(false);
  const channelsLoadedRef = useRef(false);
  const showAllRef = useRef(false);
  const statusFiltersRef = useRef<string[]>(["open"]);
  const sectorsRef = useRef<string[]>([]);
  const channelsRef = useRef<string[]>([]);
  const usersRef = useRef<string[]>([]);
  const conversationTypeRef = useRef<string>("contacts");
  const waitingStatusRef = useRef<string>("");
  const queryRef = useRef<string>("");
  const searchTypeRef = useRef<ConversationSearchType>("all");
  const lastConversationsRefetchAtRef = useRef(0);

  useEffect(() => {
    userSectorIdsRef.current = userSectors.map((s) => s.id);
  }, [userSectors]);

  useEffect(() => {
    userChannelIdsRef.current = myChannels.map((c) => c.id);
  }, [myChannels]);

  useEffect(() => {
    hasAllSectorsPermissionRef.current = hasPermission(["list:all-sectors"]);
  }, [hasPermission]);

  useEffect(() => {
    channelsLoadedRef.current = channelsLoaded;
  }, [channelsLoaded]);

  useEffect(() => {
    hasAllChannelsPermissionRef.current = hasPermission(["list:all-channels"]);
  }, [hasPermission]);

  useEffect(() => {
    showAllRef.current = showAll;
  }, [showAll]);

  useEffect(() => {
    statusFiltersRef.current = statusFilters;
  }, [statusFilters]);

  useEffect(() => {
    sectorsRef.current = sectors;
  }, [sectors]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    conversationTypeRef.current = conversationType;
  }, [conversationType]);

  useEffect(() => {
    waitingStatusRef.current = waitingStatus;
  }, [waitingStatus]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    searchTypeRef.current = searchType;
  }, [searchType]);

  const requestConversationsRefetch = useCallback(
    (reason: string) => {
      const now = Date.now();
      if (now - lastConversationsRefetchAtRef.current < 2000) return;
      lastConversationsRefetchAtRef.current = now;

      console.log("[useSocketEvents] Background refetch conversations:", reason);

      // Refetch em background para evitar perder conversas quando ainda nao temos
      // os canais carregados para decidir o escopo com seguranca.
      queryClient.invalidateQueries({
        queryKey: ["conversations-paginated"],
        refetchType: "active",
      });
    },
    [queryClient]
  );

  const maybeRefetchConversationsForUnknownScope = useCallback(
    (conversation: Conversation.Raw, reason: string) => {
      const isInternalConversation =
        conversation.conversationType === "direct" ||
        conversation.conversationType === "group";
      if (isInternalConversation) return;

      if (hasAllSectorsPermissionRef.current) return;
      if (conversation.sector?.id) return;

      if (hasAllChannelsPermissionRef.current) return;

      // Quando nao temos canal (payload incompleto) ou ainda nao carregamos "meus canais",
      // nao da para decidir com seguranca pelo socket. Fazemos refresh e deixamos o backend
      // aplicar os filtros corretamente.
      if (!channelsLoadedRef.current || !conversation.channel?.id) {
        requestConversationsRefetch(reason);
      }
    },
    [requestConversationsRefetch]
  );

  const canSeeConversation = useCallback((conversation: Conversation.Raw): boolean => {
    const isInternalConversation =
      conversation.conversationType === "direct" ||
      conversation.conversationType === "group";

    if (isInternalConversation) {
      return true;
    }

    if (hasAllSectorsPermissionRef.current) {
      return true;
    }

    if (conversation.sector?.id) {
      return userSectorIdsRef.current.includes(conversation.sector.id);
    }

    if (!channelsLoadedRef.current) {
      return false;
    }

    if (hasAllChannelsPermissionRef.current) {
      return true;
    }

    if (!conversation.channel?.id) {
      return false;
    }

    return userChannelIdsRef.current.includes(conversation.channel.id);
  }, []);

  const matchesCurrentFilters = useCallback((
    conversation: Conversation.Raw,
    lastMessageSenderType?: "contact" | "attendant"
  ): boolean => {
    const convStatus = conversation.status || "open";
    if (!statusFiltersRef.current.includes(convStatus)) {
      return false;
    }

    if (sectorsRef.current.length > 0) {
      if (!conversation.sector?.id || !sectorsRef.current.includes(conversation.sector.id)) {
        return false;
      }
    }

    if (channelsRef.current.length > 0) {
      if (!conversation.channel?.id || !channelsRef.current.includes(conversation.channel.id)) {
        return false;
      }
    }

    if (usersRef.current.length > 0) {
      if (!conversation.attendant?.id || !usersRef.current.includes(conversation.attendant.id)) {
        return false;
      }
    }

    if (
      !matchesConversationSearch(conversation, {
        query: queryRef.current,
        searchType: searchTypeRef.current,
      })
    ) {
      return false;
    }

    const convType = conversationTypeRef.current;
    const actualType = conversation.conversationType;

    if (convType === "contacts") {
      if (actualType !== "external" && actualType !== null && actualType !== undefined) {
        return false;
      }
    } else if (convType === "groups") {
      if (actualType !== "whatsapp-group") {
        return false;
      }
    } else if (convType === "internal") {
      if (actualType !== "direct" && actualType !== "group") {
        return false;
      }
    }

    if (waitingStatusRef.current && lastMessageSenderType) {
      if (waitingStatusRef.current === "attendant") {
        if (lastMessageSenderType !== "contact") {
          return false;
        }
      } else if (waitingStatusRef.current === "client") {
        if (lastMessageSenderType === "contact") {
          return false;
        }
      }
    }

    return true;
  }, []);

  const shouldInsertConversation = useCallback(
    (
      conversation: Conversation.Raw,
      options: {
        currentUserId: string | undefined;
        isViewingConversation?: boolean;
        lastMessageSenderType?: "contact" | "attendant";
      }
    ): boolean => {
      const { currentUserId, isViewingConversation, lastMessageSenderType } = options;

      if (isViewingConversation) {
        return canSeeConversation(conversation);
      }

      if (!canSeeConversation(conversation)) {
        return false;
      }

      if (!matchesCurrentFilters(conversation, lastMessageSenderType)) {
        return false;
      }

      if (showAllRef.current) {
        return true;
      }

      if (!currentUserId) {
        return false;
      }

      const hasNoAttendant = !conversation.attendant || !conversation.attendant.id;
      const isOwnConversation = conversation.attendant?.id === currentUserId;

      return hasNoAttendant || isOwnConversation;
    },
    [canSeeConversation, matchesCurrentFilters]
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMessageReceived = (event: MessageReceivedEvent) => {
      try {
        const messageId = event.message.id;

        if (processedMessagesRef.current.has(messageId)) {
          console.log("[useSocketEvents] Skipping duplicate message:received", messageId);
          return;
        }

        processedMessagesRef.current.add(messageId);

        if (processedMessagesRef.current.size > MAX_PROCESSED_MESSAGES) {
          const firstKey = processedMessagesRef.current.values().next().value;
          if (firstKey) processedMessagesRef.current.delete(firstKey);
        }

        console.log("[useSocketEvents] message:received", event.conversationId, messageId);

        const message = Message.fromRaw(event.message);
        const conversationStore = useConversationStore.getState();
        // Usar getState() para obter valor atual, pois store pode estar desatualizado no handler
        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversationId;

        if (isViewingConversation) {
          store.addMessage(message);
        }

        const existingConversation = conversationStore.byId[event.conversationId];
        const status = (event.conversation?.status || existingConversation?.status || "open") as ConversationStatus;

        if (existingConversation) {
          const newStatus = event.conversation?.status || existingConversation.status;
          const updatedConversation: Conversation.Raw = {
            ...existingConversation,
            ...event.conversation,
            status: newStatus,
          };

          const senderType = event.message.sender?.type as "contact" | "attendant" | undefined;
          if (!isViewingConversation && !matchesCurrentFilters(updatedConversation, senderType)) {
            conversationStore.removeConversation(event.conversationId);
            return;
          }

          const currentMessageToView = existingConversation.messageToView ?? 0;
          const wasAllRead = currentMessageToView === 0;
          const newMessageToView = isViewingConversation ? 0 : currentMessageToView + 1;

          conversationStore.updateConversation(event.conversationId, {
            teaser: event.message.content?.substring(0, 100) || existingConversation.teaser,
            lastMessageCreatedAt: new Date(event.message.createdAt),
            messageToView: newMessageToView,
            status: newStatus,
            name: event.conversation?.name ?? existingConversation.name,
          });

          conversationStore.moveToTop(event.conversationId);

          // Só incrementar unreadByStatus quando conversa TRANSICIONA de "lida" para "não lida"
          // wasAllRead = true significa que a conversa estava "toda lida" antes
          if (!isViewingConversation && event.message.sender?.type === "contact" && wasAllRead) {
            conversationStore.adjustUnread(status, 1);
          }
        } else if (event.isNewConversation && event.conversation) {
          const currentUserId = useChat.getState().user?.id;
          const senderType = event.message.sender?.type as "contact" | "attendant" | undefined;
          const shouldInsert = shouldInsertConversation(event.conversation, {
            currentUserId,
            isViewingConversation,
            lastMessageSenderType: senderType,
          });

          if (shouldInsert) {
            conversationStore.insertConversation(event.conversation);

            if (!isViewingConversation && event.message.sender?.type === "contact") {
              conversationStore.adjustUnread(status, 1);
            }
          } else {
            maybeRefetchConversationsForUnknownScope(
              event.conversation,
              "message:received (new conversation)"
            );
          }
        }

        store.setConversations([event.conversation]);
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:received", error);
      }
    };

    const handleMessageStatusUpdate = (event: MessageStatusUpdateEvent) => {
      try {
        console.log(
          "[useSocketEvents] message:status:update",
          event.messageId,
          "->",
          event.status,
          "conversation:",
          event.conversationId
        );

        const currentStore = useChat.getState();
        const isForOpenConversation =
          currentStore.conversationOpenedId === event.conversationId;
        let appliedInOpenConversation = false;

        if (isForOpenConversation) {
          const messages = currentStore.messages;
          const message = messages.get(event.messageId);
          if (message) {
            const nextStatus = getHigherMessageStatus(message.status, event.status);
            const updatedMessage = Message.fromRaw({
              ...message.raw(),
              status: nextStatus,
            });
            const newMessages = new Map(messages);
            newMessages.set(event.messageId, updatedMessage);
            currentStore.setMessages(Array.from(newMessages.values()).map((m) => m.raw()));
            pendingStatusByMessageIdRef.current.delete(event.messageId);
            appliedInOpenConversation = true;
          }
        }

        if (isForOpenConversation && !appliedInOpenConversation) {
          const previousPending = pendingStatusByMessageIdRef.current.get(event.messageId);
          const nextPending = previousPending
            ? getHigherMessageStatus(previousPending, event.status)
            : event.status;
          pendingStatusByMessageIdRef.current.set(event.messageId, nextPending);

          if (process.env.NODE_ENV === "development") {
            console.log(
              "[useSocketEvents] Cached pending status update",
              JSON.stringify({
                messageId: event.messageId,
                status: event.status,
                conversationId: event.conversationId,
              })
            );
          }
        }

        if (
          event.status === "failed" &&
          event.error &&
          currentStore.conversationOpenedId === event.conversationId
        ) {
          const reason =
            event.error.details ||
            event.error.message ||
            event.error.title ||
            (event.error.code ? `codigo ${event.error.code}` : null);

          if (reason) {
            toast.error(`Falha no envio: ${reason}`);
          }
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:status:update", error);
      }
    };

    const handleConversationCreated = (event: ConversationCreatedEvent) => {
      try {
        console.log("[useSocketEvents] conversation:created", event.conversation.id);
        const conversationStore = useConversationStore.getState();
        const currentUserId = useChat.getState().user?.id;

        const shouldInsert = shouldInsertConversation(event.conversation, {
          currentUserId,
        });

        if (shouldInsert) {
          conversationStore.insertConversation(event.conversation);
          store.setConversations([event.conversation]);
        } else {
          maybeRefetchConversationsForUnknownScope(
            event.conversation,
            "conversation:created"
          );
        }
        queryClient.invalidateQueries({ queryKey: ["cross-channel-indicators"] });
      } catch (error) {
        console.error("[useSocketEvents] Error handling conversation:created", error);
      }
    };

    let channelInvalidationTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidateChannels = () => {
      if (channelInvalidationTimer) clearTimeout(channelInvalidationTimer);
      channelInvalidationTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["list-channels"] });
        channelInvalidationTimer = null;
      }, 2000);
    };

    const handleChannelStatusUpdate = (event: ChannelStatusUpdateEvent) => {
      try {
        console.log("[useSocketEvents] channel:status:update", event.channelId);
        debouncedInvalidateChannels();
      } catch (error) {
        console.error("[useSocketEvents] Error handling channel:status:update", error);
      }
    };

    const handleChannelReconnected = (_event: { channelId: string; workspaceId: string }) => {
      debouncedInvalidateChannels();
    };

    const handleMessageSentConfirmed = (event: MessageSentConfirmedEvent) => {
      try {
        if (!event.message) {
          console.error("[useSocketEvents] message:sent:confirmed received without message");
          return;
        }

        console.log("[useSocketEvents] message:sent:confirmed", event.message.id, "correlationId:", event.correlationId);

        const message = Message.fromRaw(event.message);
        const currentStore = useChat.getState();
        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversationId];
        const isViewingConversation = currentStore.conversationOpenedId === event.conversationId;

        if (event.conversation) {
          currentStore.updateConversation(event.conversation);
        }

        if (existingConversation) {
          try {
            const updatedConversation = event.conversation
              ? ({ ...existingConversation, ...event.conversation } as Conversation.Raw)
              : existingConversation;

            if (
              !isViewingConversation &&
              !matchesCurrentFilters(updatedConversation, "attendant")
            ) {
              conversationStore.removeConversation(event.conversationId);
              return;
            }

            const teaserText = message.type === "text"
              ? message.content?.substring(0, 100)
              : message.type === "audio" ? "Áudio"
              : message.type === "image" ? "Imagem"
              : message.type === "video" ? "Vídeo"
              : message.type === "document" ? "Documento"
              : message.type === "template" ? "Template"
              : existingConversation.teaser;

            conversationStore.updateConversation(event.conversationId, {
              ...event.conversation,
              teaser: teaserText,
              lastMessageCreatedAt: new Date(event.message.createdAt),
            });

            conversationStore.moveToTop(event.conversationId);
          } catch (conversationError) {
            console.error(
              "[useSocketEvents] Failed to update conversation list after sent confirmation",
              conversationError
            );
          }
        }

        const openConversationId = currentStore.conversationOpenedId;
        const reconcileResult = reconcileSentConfirmation({
          event,
          messages: currentStore.messages,
          openConversationId,
          pendingStatusByMessageId: pendingStatusByMessageIdRef.current,
        });

        if (reconcileResult.applied) {
          if (reconcileResult.consumedPendingStatus) {
            pendingStatusByMessageIdRef.current.delete(message.id);
          }

          currentStore.setMessages(
            Array.from(reconcileResult.nextMessages.values()).map((m) => m.raw())
          );

          if (process.env.NODE_ENV === "development") {
            console.log(
              "[useSocketEvents] Reconciled sent confirmation",
              JSON.stringify({
                messageId: event.message.id,
                correlationId: event.correlationId,
                conversationId: event.conversationId,
                openConversationId,
                matchedBy: reconcileResult.matchedBy,
              })
            );
          }
        } else {
          console.warn(
            "[useSocketEvents] Sent confirmation could not be reconciled locally; refetching conversation state",
            JSON.stringify({
              messageId: event.message.id,
              correlationId: event.correlationId,
              conversationId: event.conversationId,
              openConversationId,
            })
          );

          queryClient.invalidateQueries({
            queryKey: ["messages-paginated", event.conversationId],
            refetchType: "active",
          });
          queryClient.invalidateQueries({
            queryKey: ["retrieve-conversation", event.conversationId],
            refetchType: "active",
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:sent:confirmed", error);
      }
    };

    const handleMessageDeleted = (event: MessageDeletedEvent) => {
      try {
        console.log("[useSocketEvents] message:deleted", event.messageId, "in conversation", event.conversationId);
        const currentStore = useChat.getState();
        const hasMessageInStore = currentStore.messages.has(event.messageId);

        currentStore.markMessageAsDeleted(event.messageId);

        const conversationStore = useConversationStore.getState();
        const hasConversationInStore = Boolean(conversationStore.byId[event.conversationId]);

        if (event.conversation) {
          conversationStore.updateConversation(event.conversationId, event.conversation);
        }

        const shouldRefetchConversationState = !hasMessageInStore;
        const shouldRefetchConversationList = !event.conversation || !hasConversationInStore;

        if (shouldRefetchConversationState) {
          queryClient.invalidateQueries({
            queryKey: ["messages-paginated", event.conversationId],
            refetchType: "active",
          });
          queryClient.invalidateQueries({
            queryKey: ["retrieve-conversation", event.conversationId],
            refetchType: "active",
          });
        }

        if (shouldRefetchConversationList) {
          queryClient.invalidateQueries({
            queryKey: ["conversations-paginated"],
            refetchType: "active",
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:deleted", error);
      }
    };

    const handleMessageEdited = (event: MessageEditedEvent) => {
      try {
        console.log("[useSocketEvents] message:edited", event.messageId, "in conversation", event.conversationId);

        const currentStore = useChat.getState();
        if (currentStore.conversationOpenedId === event.conversationId) {
          const messages = currentStore.messages;
          const message = messages.get(event.messageId);
          if (message) {
            const messageRaw = message.raw();
            const updatedMessage = Message.fromRaw({
              ...messageRaw,
              content: event.newContent,
              editedAt: new Date(event.editedAt),
              originalContent: messageRaw.originalContent ?? messageRaw.content,
            });
            const newMessages = new Map(messages);
            newMessages.set(event.messageId, updatedMessage);
            currentStore.setMessages(Array.from(newMessages.values()).map((m) => m.raw()));
          }
        }

        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversationId];
        if (existingConversation) {
          conversationStore.updateConversation(event.conversationId, {
            teaser: event.newContent.substring(0, 100),
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:edited", error);
      }
    };

    const handleContactPresenceUpdate = (event: ContactPresenceUpdateEvent) => {
      try {
        console.log("[useSocketEvents] contact:presence:update", event.remoteJid, event.presence);

        const phoneFromEvent = event.remoteJid?.split("@")[0];

        const conversationOpenedId = useChat.getState().conversationOpenedId;
        if (!conversationOpenedId) return;

        const conversationStore = useConversationStore.getState();
        const conversation = conversationStore.byId[conversationOpenedId];
        if (!conversation) return;

        const contactPhone = conversation.contact?.value;

        if (phoneFromEvent !== contactPhone) return;

        if (event.presence === "composing" || event.presence === "recording") {
          store.onTyping(true);
        } else if (event.presence === "paused" || event.presence === "available") {
          store.onTyping(false);
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling contact:presence:update", error);
      }
    };

    const handleChannelQrcodeUpdate = (event: ChannelQrcodeUpdateEvent) => {
      try {
        console.log("[useSocketEvents] channel:qrcode:update", event.instanceName);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "retrieve-qrcode-channel",
        });
        debouncedInvalidateChannels();
      } catch (error) {
        console.error("[useSocketEvents] Error handling channel:qrcode:update", error);
      }
    };

    const handleChannelConnectionUpdate = (event: ChannelConnectionUpdateEvent) => {
      try {
        console.log("[useSocketEvents] channel:connection:update", event.instanceName, event.state);
        debouncedInvalidateChannels();
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "retrieve-qrcode-channel",
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling channel:connection:update", error);
      }
    };

    const handleContactUpdated = (event: ContactUpdatedEvent) => {
      try {
        console.log("[useSocketEvents] contact:updated", event.partnerId, event.name);
        // Atualizar em background sem mostrar loading
        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
          refetchType: "none",
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling contact:updated", error);
      }
    };

    const handleRabbitMQCriticalError = (event: RabbitMQCriticalErrorEvent) => {
      try {
        console.error("[useSocketEvents] rabbitmq:critical:error", event);
        toast.error(`Erro critico no sistema de mensagens: ${event.error}`, {
          autoClose: false,
          closeOnClick: false,
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling rabbitmq:critical:error", error);
      }
    };

    const handleConversationAssigned = (event: ConversationAssignedEvent) => {
      try {
        console.log(
          "[useSocketEvents] conversation:assigned",
          event.conversation.id,
          "by",
          event.assignedById
        );

        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversation.id];
        const currentUserId = useChat.getState().user?.id;
        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversation.id;

        const shouldKeep = shouldInsertConversation(event.conversation, {
          currentUserId,
          isViewingConversation,
        });

        if (existingConversation) {
          if (shouldKeep || isViewingConversation) {
            conversationStore.updateConversation(event.conversation.id, event.conversation);
            conversationStore.moveToTop(event.conversation.id);
            store.updateConversation(event.conversation);

            if (isViewingConversation && event.assignedById !== currentUserId) {
              toast.info(
                `Conversa atendida por ${event.conversation.attendant?.name}`
              );
            }
          } else {
            conversationStore.removeConversation(event.conversation.id);
          }
        } else if (shouldKeep) {
          conversationStore.insertConversation(event.conversation);
          store.updateConversation(event.conversation);
        } else {
          maybeRefetchConversationsForUnknownScope(
            event.conversation,
            "conversation:assigned"
          );
        }

        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
          refetchType: "none",
        });
        queryClient.invalidateQueries({
          queryKey: ["retrieve-conversation"],
          refetchType: "none",
        });

        if (
          isViewingConversation &&
          shouldKeep &&
          event.assignedById !== currentUserId
        ) {
          toast.info(
            `Conversa atendida por ${event.conversation.attendant?.name}`
          );
        }
      } catch (error) {
        console.error(
          "[useSocketEvents] Error handling conversation:assigned",
          error
        );
      }
    };

    const handleConversationClosed = (event: ConversationClosedEvent) => {
      try {
        console.log(
          "[useSocketEvents] conversation:closed",
          event.conversation.id,
          "by",
          event.closedById
        );

        const conversationStore = useConversationStore.getState();
        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversation.id;

        if (!statusFiltersRef.current.includes("closed") && !isViewingConversation) {
          conversationStore.removeConversation(event.conversation.id);
          return;
        }

        conversationStore.updateConversation(event.conversation.id, event.conversation);
        store.updateConversation(event.conversation);

        if (isViewingConversation) {
          queryClient.setQueryData(
            ["retrieve-conversation", event.conversation.id],
            event.conversation
          );

          toast.info("Conversa encerrada");
        }
        queryClient.invalidateQueries({ queryKey: ["cross-channel-indicators"] });
      } catch (error) {
        console.error(
          "[useSocketEvents] Error handling conversation:closed",
          error
        );
      }
    };

    const handleConversationDeleted = (event: ConversationDeletedEvent) => {
      try {
        console.log(
          "[useSocketEvents] conversation:deleted",
          event.conversationId,
          "by",
          event.deletedById
        );

        const conversationStore = useConversationStore.getState();
        conversationStore.removeConversation(event.conversationId);

        if (useChat.getState().conversationOpenedId === event.conversationId) {
          store.closeConversationOpened();
        }
      } catch (error) {
        console.error(
          "[useSocketEvents] Error handling conversation:deleted",
          error
        );
      }
    };

    const handleConversationTransferred = (event: ConversationTransferredEvent) => {
      try {
        console.log(
          "[useSocketEvents] conversation:transferred",
          event.conversation.id,
          "by",
          event.transferredById,
          "to attendant:",
          event.newAttendantId,
          "sector:",
          event.newSectorId
        );

        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversation.id];
        const currentUserId = useChat.getState().user?.id;
        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversation.id;

        // Se recebemos dados incompletos (apenas id), usar a conversa existente como base
        const conversationData = event.conversation.status
          ? event.conversation
          : existingConversation
            ? { ...existingConversation, ...event.conversation }
            : event.conversation;

        const shouldKeep = shouldInsertConversation(conversationData, {
          currentUserId,
          isViewingConversation,
        });

        if (existingConversation) {
          if (shouldKeep) {
            conversationStore.updateConversation(event.conversation.id, conversationData);
            conversationStore.moveToTop(event.conversation.id);
            store.updateConversation(conversationData);
          } else {
            conversationStore.removeConversation(event.conversation.id);

            if (isViewingConversation && event.transferredById !== currentUserId) {
              const targetName = conversationData.attendant?.name || conversationData.sector?.name || "outro atendente";
              toast.info(`Conversa transferida para ${targetName}`);
            }
          }
        } else if (shouldKeep && conversationData.status) {
          // Apenas inserir se temos dados completos (status presente)
          conversationStore.insertConversation(conversationData);
          store.updateConversation(conversationData);
        } else {
          maybeRefetchConversationsForUnknownScope(
            conversationData,
            "conversation:transferred"
          );
        }

        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
          refetchType: "none",
        });
        queryClient.invalidateQueries({
          queryKey: ["retrieve-conversation"],
          refetchType: "none",
        });

        if (
          isViewingConversation &&
          shouldKeep &&
          event.transferredById !== currentUserId &&
          event.newAttendantId === currentUserId
        ) {
          toast.info("Uma conversa foi transferida para você");
        }
      } catch (error) {
        console.error(
          "[useSocketEvents] Error handling conversation:transferred",
          error
        );
      }
    };

    const handleConversationRead = (event: ConversationReadEvent) => {
      try {
        console.log("[useSocketEvents] conversation:read", event.conversationId);

        const conversationStore = useConversationStore.getState();
        conversationStore.markConversationAsRead(event.conversationId);
      } catch (error) {
        console.error("[useSocketEvents] Error handling conversation:read", error);
      }
    };

    const handleInternalMessageReceived = (event: InternalMessageReceivedEvent) => {
      try {
        const currentUserId = store.user?.id;
        const isRecipient = event.message.recipients.includes(currentUserId ?? "");
        const isSender = event.message.sender.id === currentUserId;

        if (!isRecipient && !isSender) {
          return;
        }

        console.log(
          "[useSocketEvents] internal:message:received",
          event.conversationId,
          event.message.id,
          "from",
          event.message.sender.name
        );

        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversationId];
        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversationId;

        if (isViewingConversation) {
          const currentStore = useChat.getState();
          const existingMessage = currentStore.messages.get(event.message.id);

          if (!existingMessage) {
            const message = Message.fromRaw({
              id: event.message.id,
              content: event.message.content,
              type: event.message.type,
              status: event.message.status ?? "sent",
              sender: {
                type: "attendant",
                id: event.message.sender.id,
                name: event.message.sender.name,
              },
              createdAt: new Date(event.message.createdAt),
              internal: true,
              caption: event.message.caption ?? null,
              filename: event.message.filename ?? null,
              mimetype: event.message.mimeType ?? null,
              mediaKey: null,
              viewedAt: null,
              deletedAt: null,
              editedAt: null,
              originalContent: null,
              quotedMessageId: null,
              templateName: null,
              remoteJid: null,
            });
            store.addMessage(message);
          }
        }

        if (existingConversation) {
          const currentMessageToView = existingConversation.messageToView ?? 0;
          const wasAllRead = currentMessageToView === 0;
          const newMessageToView = isViewingConversation ? 0 : currentMessageToView + 1;

          conversationStore.updateConversation(event.conversationId, {
            teaser: event.message.content?.substring(0, 100) || existingConversation.teaser,
            lastMessageCreatedAt: new Date(event.message.createdAt),
            messageToView: newMessageToView,
          });

          conversationStore.moveToTop(event.conversationId);

          if (!isViewingConversation && !isSender && wasAllRead) {
            conversationStore.adjustUnread("internal", 1);
          }
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:message:received", error);
      }
    };

    const handleInternalConversationCreated = (event: InternalConversationCreatedEvent) => {
      try {
        console.log("[useSocketEvents] internal:conversation:created", event.conversation.id);
        const conversationStore = useConversationStore.getState();
        conversationStore.insertConversation(event.conversation);
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:conversation:created", error);
      }
    };

    const handleInternalParticipantAdded = (event: InternalParticipantAddedEvent) => {
      try {
        console.log(
          "[useSocketEvents] internal:participant:added",
          event.conversationId,
          event.participant.userId
        );
        queryClient.invalidateQueries({
          queryKey: ["internal-conversation", event.conversationId],
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:participant:added", error);
      }
    };

    const handleInternalParticipantRemoved = (event: InternalParticipantRemovedEvent) => {
      try {
        console.log(
          "[useSocketEvents] internal:participant:removed",
          event.conversationId,
          event.removedUserId
        );
        const currentUserId = store.user?.id;

        if (event.removedUserId === currentUserId) {
          const conversationStore = useConversationStore.getState();
          conversationStore.removeConversation(event.conversationId);

          if (useChat.getState().conversationOpenedId === event.conversationId) {
            store.closeConversationOpened();
            toast.info("Você foi removido desta conversa");
          }
        } else {
          queryClient.invalidateQueries({
            queryKey: ["internal-conversation", event.conversationId],
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:participant:removed", error);
      }
    };

    const handleInternalParticipantLeft = (event: InternalParticipantLeftEvent) => {
      try {
        console.log(
          "[useSocketEvents] internal:participant:left",
          event.conversationId,
          event.leftUserId
        );
        const currentUserId = store.user?.id;

        if (event.leftUserId === currentUserId) {
          const conversationStore = useConversationStore.getState();
          conversationStore.removeConversation(event.conversationId);

          if (useChat.getState().conversationOpenedId === event.conversationId) {
            store.closeConversationOpened();
          }
        } else {
          queryClient.invalidateQueries({
            queryKey: ["internal-conversation", event.conversationId],
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:participant:left", error);
      }
    };

    const handleInternalCommentReceived = (event: InternalCommentReceivedEvent) => {
      try {
        console.log(
          "[useSocketEvents] internal:comment:received",
          event.conversationId,
          event.message.id
        );

        const isViewingConversation = useChat.getState().conversationOpenedId === event.conversationId;

        if (isViewingConversation) {
          const currentStore = useChat.getState();
          const existingMessage = currentStore.messages.get(event.message.id);

          if (!existingMessage) {
            const message = Message.fromRaw(event.message);
            store.addMessage(message);
          }
        }

        const conversationStore = useConversationStore.getState();
        const existingConversation = conversationStore.byId[event.conversationId];

        if (existingConversation) {
          conversationStore.updateConversation(event.conversationId, {
            lastMessageCreatedAt: new Date(event.message.createdAt),
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling internal:comment:received", error);
      }
    };

    const handleNotificationReceived = (event: NotificationReceivedEvent) => {
      try {
        console.log("[useSocketEvents] notification:received", event.id);

        const notificationStore = useNotificationStore.getState();
        notificationStore.addNotification(event as any);
        notificationStore.incrementUnread();

        queryClient.invalidateQueries({
          queryKey: ["notifications"],
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling notification:received", error);
      }
    };

    const handleNotificationRead = (event: NotificationReadEvent) => {
      try {
        console.log("[useSocketEvents] notification:read", event.notificationId);

        queryClient.invalidateQueries({
          queryKey: ["notifications"],
        });
      } catch (error) {
        console.error("[useSocketEvents] Error handling notification:read", error);
      }
    };

    const handleMessageReaction = (event: MessageReactionEvent) => {
      try {
        console.log("[useSocketEvents] message:reaction", event.messageId, event.action, event.reaction?.emoji);

        const currentStore = useChat.getState();
        if (currentStore.conversationOpenedId !== event.conversationId) {
          return;
        }

        const messages = currentStore.messages;
        const message = messages.get(event.messageId);
        if (!message) {
          return;
        }

        const messageRaw = message.raw();
        const currentReactions = messageRaw.reactions || [];

        const updatedReactions = applyReactionEvent(currentReactions, event);

        const updatedMessage = Message.fromRaw({
          ...messageRaw,
          reactions: updatedReactions,
        });

        const newMessages = new Map(messages);
        newMessages.set(event.messageId, updatedMessage);
        currentStore.setMessages(Array.from(newMessages.values()).map((m) => m.raw()));
      } catch (error) {
        console.error("[useSocketEvents] Error handling message:reaction", error);
      }
    };

    const handleReconnect = () => {
      try {
        console.log("[useSocketEvents] Socket reconnected, refreshing data...");

        const conversationStore = useConversationStore.getState();
        const statuses: ConversationStatus[] = ["open", "waiting", "closed", "expired", "internal"];

        statuses.forEach((status) => {
          conversationStore.resetStatus(status);
        });

        // Atualizar em background sem mostrar loading
        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
          refetchType: "none",
        });

        processedMessagesRef.current.clear();
        pendingStatusByMessageIdRef.current.clear();
      } catch (error) {
        console.error("[useSocketEvents] Error handling reconnect", error);
      }
    };

    const handleRefresh = () => {
      try {
        console.log("[useSocketEvents] refresh event received");
        const currentStore = useChat.getState();

        // Atualizar em background sem mostrar loading
        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
          refetchType: "none",
        });
        if (currentStore.conversationOpenedId) {
          queryClient.invalidateQueries({
            queryKey: ["messages-paginated", currentStore.conversationOpenedId],
            refetchType: "active",
          });
          queryClient.invalidateQueries({
            queryKey: ["retrieve-conversation", currentStore.conversationOpenedId],
            refetchType: "active",
          });
        } else {
          queryClient.invalidateQueries({
            queryKey: ["retrieve-conversation"],
            refetchType: "none",
          });
        }
      } catch (error) {
        console.error("[useSocketEvents] Error handling refresh", error);
      }
    };

    const handleConversationUpdated = (event: ConversationUpdatedEvent) => {
      console.log("[useSocketEvents] conversation:updated", event.conversationId);

      const conversationStore = useConversationStore.getState();
      const existing = conversationStore.byId[event.conversationId];

      if (existing) {
        conversationStore.updateConversation(event.conversationId, {
          name: event.name,
        });
      }
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("message:status:update", handleMessageStatusUpdate);
    socket.on("conversation:created", handleConversationCreated);
    socket.on("channel:status:update", handleChannelStatusUpdate);
    socket.on("channel:reconnected", handleChannelReconnected);
    socket.on("message:sent:confirmed", handleMessageSentConfirmed);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:edited", handleMessageEdited);
    socket.on("contact:presence:update", handleContactPresenceUpdate);
    socket.on("channel:qrcode:update", handleChannelQrcodeUpdate);
    socket.on("channel:connection:update", handleChannelConnectionUpdate);
    socket.on("contact:updated", handleContactUpdated);
    socket.on("rabbitmq:critical:error", handleRabbitMQCriticalError);
    socket.on("conversation:assigned", handleConversationAssigned);
    socket.on("conversation:closed", handleConversationClosed);
    socket.on("conversation:deleted", handleConversationDeleted);
    socket.on("conversation:transferred", handleConversationTransferred);
    socket.on("conversation:read", handleConversationRead);
    socket.on("internal:message:received", handleInternalMessageReceived);
    socket.on("internal:conversation:created", handleInternalConversationCreated);
    socket.on("internal:participant:added", handleInternalParticipantAdded);
    socket.on("internal:participant:removed", handleInternalParticipantRemoved);
    socket.on("internal:participant:left", handleInternalParticipantLeft);
    socket.on("internal:comment:received", handleInternalCommentReceived);
    socket.on("notification:received", handleNotificationReceived);
    socket.on("notification:read", handleNotificationRead);
    socket.on("message:reaction", handleMessageReaction);
    socket.on("refresh", handleRefresh);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.io.on("reconnect", handleReconnect);

    return () => {
      if (channelInvalidationTimer) clearTimeout(channelInvalidationTimer);
      socket.off("message:received", handleMessageReceived);
      socket.off("message:status:update", handleMessageStatusUpdate);
      socket.off("conversation:created", handleConversationCreated);
      socket.off("channel:status:update", handleChannelStatusUpdate);
      socket.off("channel:reconnected", handleChannelReconnected);
      socket.off("message:sent:confirmed", handleMessageSentConfirmed);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:edited", handleMessageEdited);
      socket.off("contact:presence:update", handleContactPresenceUpdate);
      socket.off("channel:qrcode:update", handleChannelQrcodeUpdate);
      socket.off("channel:connection:update", handleChannelConnectionUpdate);
      socket.off("contact:updated", handleContactUpdated);
      socket.off("rabbitmq:critical:error", handleRabbitMQCriticalError);
      socket.off("conversation:assigned", handleConversationAssigned);
      socket.off("conversation:closed", handleConversationClosed);
      socket.off("conversation:deleted", handleConversationDeleted);
      socket.off("conversation:transferred", handleConversationTransferred);
      socket.off("conversation:read", handleConversationRead);
      socket.off("internal:message:received", handleInternalMessageReceived);
      socket.off("internal:conversation:created", handleInternalConversationCreated);
      socket.off("internal:participant:added", handleInternalParticipantAdded);
      socket.off("internal:participant:removed", handleInternalParticipantRemoved);
      socket.off("internal:participant:left", handleInternalParticipantLeft);
      socket.off("internal:comment:received", handleInternalCommentReceived);
      socket.off("notification:received", handleNotificationReceived);
      socket.off("notification:read", handleNotificationRead);
      socket.off("message:reaction", handleMessageReaction);
      socket.off("refresh", handleRefresh);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.io.off("reconnect", handleReconnect);
    };
  }, [
    socket,
    isConnected,
    store,
    queryClient,
    canSeeConversation,
    shouldInsertConversation,
    matchesCurrentFilters,
    maybeRefetchConversationsForUnknownScope,
  ]);
}
