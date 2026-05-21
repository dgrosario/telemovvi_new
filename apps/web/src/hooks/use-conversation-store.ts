import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ConversationStatus = "open" | "waiting" | "closed" | "expired" | "internal";

const CONVERSATION_STATUSES: ConversationStatus[] = [
  "open",
  "waiting",
  "closed",
  "expired",
  "internal",
];

type PaginationState = {
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
};

type ConversationState = {
  byId: Record<string, Conversation.Raw>;
  idsByStatus: Record<ConversationStatus, string[]>;
  pagination: Record<ConversationStatus, PaginationState>;
  counters: Record<ConversationStatus, number>;
  unreadByStatus: Record<ConversationStatus, number>;
  activeConversationId: string | null;
};

type ConversationActions = {
  setConversationsPage: (
    status: ConversationStatus,
    conversations: Conversation.Raw[],
    cursor: string | null,
    hasMore: boolean,
    counters: Record<ConversationStatus, number>,
    unreadByStatus: Record<ConversationStatus, number>,
    sortOrder?: "desc" | "asc"
  ) => void;

  appendConversationsPage: (
    status: ConversationStatus,
    conversations: Conversation.Raw[],
    cursor: string | null,
    hasMore: boolean,
    sortOrder?: "desc" | "asc"
  ) => void;

  insertConversation: (conversation: Conversation.Raw) => void;

  updateConversation: (
    conversationId: string,
    updates: Partial<Conversation.Raw>
  ) => void;

  moveToTop: (conversationId: string) => void;

  updateCounters: (counters: Partial<Record<ConversationStatus, number>>) => void;

  adjustUnread: (status: ConversationStatus, delta: number) => void;

  markConversationAsRead: (conversationId: string) => void;

  setActiveConversationId: (id: string | null) => void;

  resetStatus: (status: ConversationStatus) => void;

  setLoading: (status: ConversationStatus, isLoading: boolean) => void;

  removeConversation: (conversationId: string) => void;
};

type ConversationStore = ConversationState & ConversationActions;

const MAX_CONVERSATIONS_PER_STATUS = 500;

const initialPaginationState: PaginationState = {
  cursor: null,
  hasMore: true,
  isLoading: false,
};

const initialState: ConversationState = {
  byId: {},
  idsByStatus: {
    open: [],
    waiting: [],
    closed: [],
    expired: [],
    internal: [],
  },
  pagination: {
    open: { ...initialPaginationState },
    waiting: { ...initialPaginationState },
    closed: { ...initialPaginationState },
    expired: { ...initialPaginationState },
    internal: { ...initialPaginationState },
  },
  counters: {
    open: 0,
    waiting: 0,
    closed: 0,
    expired: 0,
    internal: 0,
  },
  unreadByStatus: {
    open: 0,
    waiting: 0,
    closed: 0,
    expired: 0,
    internal: 0,
  },
  activeConversationId: null,
};

function isConversationStatus(value: unknown): value is ConversationStatus {
  return typeof value === "string" && CONVERSATION_STATUSES.includes(value as ConversationStatus);
}

function findConversationBucket(
  state: ConversationState,
  conversationId: string
): ConversationStatus | null {
  for (const status of CONVERSATION_STATUSES) {
    if (state.idsByStatus[status].includes(conversationId)) {
      return status;
    }
  }

  return null;
}

function getConversationBucketFromRaw(
  conversation: Partial<Conversation.Raw> | null | undefined
): ConversationStatus | null {
  if (!conversation) {
    return null;
  }

  if (isConversationStatus(conversation.status)) {
    return conversation.status;
  }

  if (conversation.conversationType === "whatsapp-group") {
    return "open";
  }

  if (
    conversation.conversationType === "direct" ||
    conversation.conversationType === "group"
  ) {
    return "internal";
  }

  return null;
}

function sortByLastMessage(
  ids: string[],
  byId: Record<string, Conversation.Raw>,
  order: "desc" | "asc" = "desc"
): string[] {
  return [...ids].sort((a, b) => {
    const convA = byId[a];
    const convB = byId[b];
    const timeA = convA?.lastMessageCreatedAt
      ? new Date(convA.lastMessageCreatedAt).getTime()
      : 0;
    const timeB = convB?.lastMessageCreatedAt
      ? new Date(convB.lastMessageCreatedAt).getTime()
      : 0;
    return order === "desc" ? timeB - timeA : timeA - timeB;
  });
}

function collectReferencedIds(state: ConversationState): Set<string> {
  const ids = new Set<string>();
  for (const statusIds of Object.values(state.idsByStatus)) {
    statusIds.forEach((id) => ids.add(id));
  }
  if (state.activeConversationId) {
    ids.add(state.activeConversationId);
  }
  return ids;
}

function pruneDetachedConversations(state: ConversationState): void {
  const referencedIds = collectReferencedIds(state);
  for (const id of Object.keys(state.byId)) {
    if (!referencedIds.has(id)) {
      delete state.byId[id];
    }
  }
}

export const useConversationStore = create<ConversationStore>()(
  immer((set) => ({
    ...initialState,

    setConversationsPage: (
      status,
      conversations,
      cursor,
      hasMore,
      counters,
      unreadByStatus,
      sortOrder = "desc"
    ) => {
      set((state) => {
        const newIds: string[] = [];

        for (const conv of conversations) {
          state.byId[conv.id] = conv;
          newIds.push(conv.id);
        }

        state.idsByStatus[status] = sortByLastMessage(newIds, state.byId, sortOrder).slice(
          0,
          MAX_CONVERSATIONS_PER_STATUS
        );
        state.pagination[status] = { cursor, hasMore, isLoading: false };
        state.counters = counters;
        state.unreadByStatus = unreadByStatus;
        pruneDetachedConversations(state);
      });
    },

    appendConversationsPage: (status, conversations, cursor, hasMore, sortOrder = "desc") => {
      set((state) => {
        const existingIds = new Set(state.idsByStatus[status]);

        for (const conv of conversations) {
          state.byId[conv.id] = conv;
          if (!existingIds.has(conv.id)) {
            state.idsByStatus[status].push(conv.id);
          }
        }

        state.idsByStatus[status] = sortByLastMessage(
          state.idsByStatus[status],
          state.byId,
          sortOrder
        ).slice(0, MAX_CONVERSATIONS_PER_STATUS);
        state.pagination[status] = { cursor, hasMore, isLoading: false };
        pruneDetachedConversations(state);
      });
    },

    insertConversation: (conversation) => {
      set((state) => {
        state.byId[conversation.id] = conversation;

        const bucket = getConversationBucketFromRaw(conversation);
        if (!bucket) {
          return;
        }

        if (!state.idsByStatus[bucket].includes(conversation.id)) {
          state.idsByStatus[bucket].unshift(conversation.id);
          state.counters[bucket] += 1;
        }
      });
    },

    updateConversation: (conversationId, updates) => {
      set((state) => {
        const existing = state.byId[conversationId];
        if (!existing) return;

        const nextConversation = { ...existing, ...updates };
        const oldBucket = findConversationBucket(state, conversationId)
          ?? getConversationBucketFromRaw(existing);
        const newBucket = getConversationBucketFromRaw(nextConversation) ?? oldBucket;

        state.byId[conversationId] = nextConversation;

        if (oldBucket !== newBucket) {
          const oldIndex = oldBucket
            ? state.idsByStatus[oldBucket].indexOf(conversationId)
            : -1;
          if (oldBucket && oldIndex !== -1) {
            state.idsByStatus[oldBucket].splice(oldIndex, 1);
          }

          if (newBucket && !state.idsByStatus[newBucket].includes(conversationId)) {
            state.idsByStatus[newBucket].unshift(conversationId);
          }

          if (oldBucket) {
            state.counters[oldBucket] = Math.max(0, state.counters[oldBucket] - 1);
          }
          if (newBucket) {
            state.counters[newBucket] += 1;
          }

          // Se conversa tem mensagens não lidas, mover contagem entre status
          if (existing.messageToView > 0) {
            if (oldBucket) {
              state.unreadByStatus[oldBucket] = Math.max(
                0,
                state.unreadByStatus[oldBucket] - 1
              );
            }
            if (newBucket) {
              state.unreadByStatus[newBucket] += 1;
            }
          }
        }
      });
    },

    moveToTop: (conversationId) => {
      set((state) => {
        const conv = state.byId[conversationId];
        if (!conv) return;

        const bucket = findConversationBucket(state, conversationId)
          ?? getConversationBucketFromRaw(conv);
        if (!bucket) {
          return;
        }

        const ids = state.idsByStatus[bucket];
        const index = ids.indexOf(conversationId);

        if (index > 0) {
          ids.splice(index, 1);
          ids.unshift(conversationId);
        } else if (index === -1) {
          ids.unshift(conversationId);
        }
      });
    },

    updateCounters: (counters) => {
      set((state) => {
        for (const [status, count] of Object.entries(counters)) {
          if (status in state.counters) {
            state.counters[status as ConversationStatus] = count;
          }
        }
      });
    },

    adjustUnread: (status, delta) => {
      set((state) => {
        state.unreadByStatus[status] = Math.max(
          0,
          state.unreadByStatus[status] + delta
        );
      });
    },

    markConversationAsRead: (conversationId) => {
      set((state) => {
        const conv = state.byId[conversationId];
        if (conv && conv.messageToView > 0) {
          const status = findConversationBucket(state, conversationId)
            ?? getConversationBucketFromRaw(conv);
          if (!status) {
            state.byId[conversationId].messageToView = 0;
            return;
          }
          // Decrementa por 1 (uma conversa lida), nao por messageToView
          state.unreadByStatus[status] = Math.max(0, state.unreadByStatus[status] - 1);
          // Usar mutacao direta no draft do immer para garantir re-renderizacao
          state.byId[conversationId].messageToView = 0;
        }
      });
    },

    setActiveConversationId: (id) => {
      set((state) => {
        state.activeConversationId = id;
      });
    },

    resetStatus: (status) => {
      set((state) => {
        state.idsByStatus[status] = [];
        state.pagination[status] = { ...initialPaginationState };
        pruneDetachedConversations(state);
      });
    },

    setLoading: (status, isLoading) => {
      set((state) => {
        state.pagination[status].isLoading = isLoading;
      });
    },

    removeConversation: (conversationId) => {
      set((state) => {
        const conv = state.byId[conversationId];
        if (conv) {
          const status = findConversationBucket(state, conversationId)
            ?? getConversationBucketFromRaw(conv);
          const index = status ? state.idsByStatus[status].indexOf(conversationId) : -1;
          if (status && index !== -1) {
            state.idsByStatus[status].splice(index, 1);
          }

          // Decrementar contador do status
          if (status) {
            state.counters[status] = Math.max(0, state.counters[status] - 1);
          }

          // Se conversa tinha mensagens nao lidas, decrementar unreadByStatus
          if (status && conv.messageToView > 0) {
            state.unreadByStatus[status] = Math.max(0, state.unreadByStatus[status] - 1);
          }

          delete state.byId[conversationId];
        }
      });
    },
  }))
);

export const selectConversationsByStatus = (
  state: ConversationStore,
  status: ConversationStatus
): Conversation.Raw[] => {
  return state.idsByStatus[status]
    .map((id) => state.byId[id])
    .filter(Boolean);
};

export const selectConversationById = (
  state: ConversationStore,
  id: string
): Conversation.Raw | undefined => {
  return state.byId[id];
};
