"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/app/actions/notifications";
import { useNotificationStore } from "./use-notification-store";
import { Notification } from "@omnichannel/core/domain/entities/notification";

type NotificationFilters = {
  isRead?: boolean;
  type?: Notification.Type;
  startDate?: Date;
  endDate?: Date;
};

type UseNotificationsOptions = {
  filters?: NotificationFilters;
  limit?: number;
  enabled?: boolean;
};

export function useNotifications({
  filters = {},
  limit = 20,
  enabled = true,
}: UseNotificationsOptions = {}) {
  const queryClient = useQueryClient();

  const queryKey = [
    "notifications",
    {
      isRead: filters.isRead,
      type: filters.type,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
  ];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const [result, error] = await listNotifications({
        filters: {
          isRead: filters.isRead,
          type: filters.type,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        cursor: pageParam,
        limit,
      });

      if (error) {
        throw error;
      }

      const store = useNotificationStore.getState();
      store.setUnreadCount(result.unreadCount);

      return result;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 30_000,
    enabled,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const [result, error] = await markNotificationAsRead({ notificationId });

      if (error) {
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      const store = useNotificationStore.getState();
      store.decrementUnread();

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const [result, error] = await markAllNotificationsAsRead({});

      if (error) {
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      const store = useNotificationStore.getState();
      store.setUnreadCount(0);
      store.clearRecent();
      store.hideFloatingButton();

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: query.data?.pages.flatMap((page) => page.notifications) ?? [],
    unreadCount: query.data?.pages[0]?.unreadCount ?? 0,
    hasMore: query.data?.pages[query.data.pages.length - 1]?.hasMore ?? false,
    nextCursor: query.data?.pages[query.data.pages.length - 1]?.nextCursor ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    markAsRead: markAsReadMutation.mutate,
    markAsReadAsync: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutate,
    markAllAsReadAsync: markAllAsReadMutation.mutateAsync,
    refetch: query.refetch,
  };
}
