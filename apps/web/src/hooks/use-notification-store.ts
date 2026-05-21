import { Notification } from "@omnichannel/core/domain/entities/notification";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type NotificationState = {
  unreadCount: number;
  recentNotifications: Notification.Raw[];
  floatingButtonVisible: boolean;
  floatingButtonEnabled: boolean;
  showToasts: boolean;
};

type NotificationActions = {
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  addNotification: (notification: Notification.Raw) => void;
  showFloatingButton: () => void;
  hideFloatingButton: () => void;
  setFloatingButtonEnabled: (enabled: boolean) => void;
  clearRecent: () => void;
  setShowToasts: (show: boolean) => void;
  initializeFromServer: (unreadCount: number) => void;
};

type NotificationStore = NotificationState & NotificationActions;

const initialState: NotificationState = {
  unreadCount: 0,
  recentNotifications: [],
  floatingButtonVisible: false,
  floatingButtonEnabled: true,
  showToasts: false,
};

export const useNotificationStore = create<NotificationStore>()(
  immer((set) => ({
    ...initialState,

    setUnreadCount: (count) => {
      set((state) => {
        state.unreadCount = count;
      });
    },

    incrementUnread: () => {
      set((state) => {
        state.unreadCount += 1;
      });
    },

    decrementUnread: () => {
      set((state) => {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      });
    },

    addNotification: (notification) => {
      set((state) => {
        const exists = state.recentNotifications.some(
          (n) => n.id === notification.id
        );

        if (!exists) {
          state.recentNotifications.unshift(notification);

          if (state.recentNotifications.length > 5) {
            state.recentNotifications = state.recentNotifications.slice(0, 5);
          }
        }

        if (!notification.isRead && state.floatingButtonEnabled) {
          state.floatingButtonVisible = true;
        }
      });
    },

    showFloatingButton: () => {
      set((state) => {
        if (state.floatingButtonEnabled) {
          state.floatingButtonVisible = true;
        }
      });
    },

    hideFloatingButton: () => {
      set((state) => {
        state.floatingButtonVisible = false;
      });
    },

    setFloatingButtonEnabled: (enabled) => {
      set((state) => {
        state.floatingButtonEnabled = enabled;
        if (!enabled) {
          state.floatingButtonVisible = false;
        }
      });
    },

    clearRecent: () => {
      set((state) => {
        state.recentNotifications = [];
      });
    },

    setShowToasts: (show) => {
      set((state) => {
        state.showToasts = show;
      });
    },

    initializeFromServer: (unreadCount) => {
      set((state) => {
        state.unreadCount = unreadCount;
        if (unreadCount > 0 && state.floatingButtonEnabled) {
          state.floatingButtonVisible = true;
        }
      });
    },
  }))
);

export const selectUnreadCount = (state: NotificationStore): number =>
  state.unreadCount;

export const selectRecentNotifications = (
  state: NotificationStore
): Notification.Raw[] => state.recentNotifications;

export const selectFloatingButtonVisible = (
  state: NotificationStore
): boolean => state.floatingButtonVisible;

export const selectFloatingButtonEnabled = (
  state: NotificationStore
): boolean => state.floatingButtonEnabled;

export const selectShowToasts = (state: NotificationStore): boolean =>
  state.showToasts;
