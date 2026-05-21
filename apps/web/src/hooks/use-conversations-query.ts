"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useCallback, useMemo } from "react";
import { listConversationsPaginated } from "@/app/actions/conversations";
import {
  useConversationStore,
  type ConversationStatus,
  selectConversationsByStatus,
} from "./use-conversation-store";
import { useShallow } from "zustand/react/shallow";
import { useChat } from "./use-chat";
import { matchesConversationSearch } from "@/lib/conversation-search-filter";

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CONVERSATION_CACHE_TIME_MS = 5 * 60_000;
const MAX_CONVERSATION_PAGES = 8;

export type ConversationFilters = {
  query?: string;
  searchType?: "phone" | "instagram" | "client-name" | "attendant-name" | "all";
  channelFilters?: string[];
  sectorFilters?: string[];
  userFilters?: string[];
  labelFilters?: string[];
  dateStart?: string;
  dateEnd?: string;
  dateStartAt?: number;
  dateEndAt?: number;
  dateType?: "creation" | "lastMessage";
  sortOrder?: "desc" | "asc";
  waitingStatus?: "attendant" | "client" | "";
  showAll?: boolean;
  conversationTypeFilter?: "contacts" | "groups" | "all";
};

type UseConversationsQueryOptions = {
  status?: ConversationStatus;
  filters?: ConversationFilters;
  limit?: number;
  enabled?: boolean;
};

export function useConversationsQuery({
  status,
  filters = {},
  limit = 50,
  enabled = true,
}: UseConversationsQueryOptions) {
  const storeKey = status ?? "open";

  const resolvedDateRange = useMemo(() => {
    if (typeof filters.dateStartAt === "number" && typeof filters.dateEndAt === "number") {
      return {
        dateStartAt: Math.floor(filters.dateStartAt),
        dateEndAt: Math.floor(filters.dateEndAt),
      };
    }

    if (!filters.dateStart || !filters.dateEnd) {
      return { dateStartAt: undefined, dateEndAt: undefined };
    }

    if (
      !DATE_ISO_REGEX.test(filters.dateStart) ||
      !DATE_ISO_REGEX.test(filters.dateEnd)
    ) {
      return { dateStartAt: undefined, dateEndAt: undefined };
    }

    const [startYear, startMonth, startDay] = filters.dateStart
      .split("-")
      .map(Number);
    const [endYear, endMonth, endDay] = filters.dateEnd.split("-").map(Number);

    if (
      !startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay
    ) {
      return { dateStartAt: undefined, dateEndAt: undefined };
    }

    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    // Intencional: o filtro respeita o dia no fuso local do usuário.
    if (start.getTime() > end.getTime()) {
      return { dateStartAt: undefined, dateEndAt: undefined };
    }

    return {
      dateStartAt: Math.floor(start.getTime() / 1000),
      dateEndAt: Math.floor(end.getTime() / 1000),
    };
  }, [filters.dateStart, filters.dateEnd, filters.dateStartAt, filters.dateEndAt]);

  const queryKey = [
    "conversations-paginated",
    status ?? "groups",
    {
      query: filters.query,
      searchType: filters.searchType,
      channelFilters: filters.channelFilters,
      sectorFilters: filters.sectorFilters,
      userFilters: filters.userFilters,
      labelFilters: filters.labelFilters,
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
      dateStartAt: resolvedDateRange.dateStartAt,
      dateEndAt: resolvedDateRange.dateEndAt,
      dateType: filters.dateType,
      sortOrder: filters.sortOrder,
      waitingStatus: filters.waitingStatus,
      showAll: filters.showAll,
      conversationTypeFilter: filters.conversationTypeFilter,
    },
  ];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const [result, error] = await listConversationsPaginated({
        statusFilters: status ? [status] : [],
        cursor: pageParam,
        limit,
        query: filters.query,
        searchType: filters.searchType ?? "all",
        channelFilters: filters.channelFilters ?? [],
        sectorFilters: filters.sectorFilters ?? [],
        userFilters: filters.userFilters ?? [],
        labelFilters: filters.labelFilters ?? [],
        dateStart: filters.dateStart,
        dateEnd: filters.dateEnd,
        dateStartAt: resolvedDateRange.dateStartAt,
        dateEndAt: resolvedDateRange.dateEndAt,
        dateType: filters.dateType ?? "lastMessage",
        sortOrder: filters.sortOrder ?? "desc",
        waitingStatus: filters.waitingStatus ?? "",
        showAll: filters.showAll ?? false,
        conversationTypeFilter: filters.conversationTypeFilter ?? "contacts",
      });

      if (error) {
        throw error;
      }

      return result;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 2 * 60_000,
    gcTime: CONVERSATION_CACHE_TIME_MS,
    maxPages: MAX_CONVERSATION_PAGES,
    refetchOnWindowFocus: false,
    enabled,
  });

  useEffect(() => {
    if (!query.data?.pages) return;

    const pages = query.data.pages;
    const firstPage = pages[0];

    if (!firstPage) return;

    const store = useConversationStore.getState();

    const sortOrder = filters.sortOrder ?? "desc";

    if (pages.length === 1) {
      store.setConversationsPage(
        storeKey,
        firstPage.conversations,
        firstPage.nextCursor,
        firstPage.hasMore,
        firstPage.counters,
        firstPage.unreadByStatus,
        sortOrder
      );
    } else {
      const lastPage = pages[pages.length - 1];
      if (lastPage) {
        store.appendConversationsPage(
          storeKey,
          lastPage.conversations,
          lastPage.nextCursor,
          lastPage.hasMore,
          sortOrder
        );
      }
    }
  }, [query.data, storeKey]);

  const allConversations = useConversationStore(
    useShallow((state) => selectConversationsByStatus(state, storeKey))
  );

  const currentUserId = useChat((state) => state.user?.id);

  // Filter conversations on the client side
  // This ensures socket-inserted conversations respect the current filters
  const conversations = useMemo(() => {
    let filtered = allConversations;

    // Filter by showAll - if false, show only conversations of current user or without attendant
    const showAll = filters.showAll ?? false;
    if (!showAll && currentUserId) {
      filtered = filtered.filter(
        (c) => !c.attendant || c.attendant.id === currentUserId
      );
    }

    // Filter by type (contacts vs groups)
    const typeFilter = filters.conversationTypeFilter ?? "contacts";
    if (typeFilter !== "all") {
      filtered = filtered.filter((c) => {
        const isGroup = c.conversationType === "whatsapp-group";
        return typeFilter === "groups" ? isGroup : !isGroup;
      });
    }

    // Filter by channel (safety net for socket-inserted conversations)
    const channelFilter = filters.channelFilters;
    if (channelFilter && channelFilter.length > 0) {
      filtered = filtered.filter(
        (c) => c.channel?.id && channelFilter.includes(c.channel.id)
      );
    }

    // Filter by query/search type (safety net for socket-inserted conversations)
    filtered = filtered.filter((conversation) =>
      matchesConversationSearch(conversation, {
        query: filters.query,
        searchType: filters.searchType,
      })
    );

    return filtered;
  }, [
    allConversations,
    filters.showAll,
    filters.conversationTypeFilter,
    filters.channelFilters,
    filters.query,
    filters.searchType,
    currentUserId,
  ]);

  const counters = useConversationStore((state) => state.counters);
  const unreadByStatus = useConversationStore((state) => state.unreadByStatus);
  const pagination = useConversationStore((state) => state.pagination[storeKey]);

  const fetchNextPage = useCallback(() => {
    if (pagination.hasMore && !pagination.isLoading && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [pagination.hasMore, pagination.isLoading, query]);

  return {
    conversations,
    counters,
    unreadByStatus,
    hasNextPage: pagination.hasMore,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    fetchNextPage,
    refetch: query.refetch,
  };
}
